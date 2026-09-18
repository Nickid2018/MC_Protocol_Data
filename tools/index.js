import * as fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { MultiBar, Presets } from 'cli-progress';

//#region INITIALIZATION

const baseDir = process.argv[2];
if (!baseDir) {
    console.error('No base directory provided');
    process.exit(1);
}

const registriesMapping = new Map();
parse(fs.readFileSync(`${baseDir}/indexes.csv`, { encoding: 'utf8' }), { columns: true }).forEach((line) =>
    Object.entries(line)
        .filter(([_, v]) => v !== '-1')
        .forEach(([key, val]) => {
            if (!registriesMapping.has(key)) registriesMapping.set(key, new Map());
            registriesMapping.get(key).set(line.protocol_version, val);
        }),
);

const packetMapping = new Map();
const packets = parse(fs.readFileSync(`${baseDir}/packets.csv`, { encoding: 'utf8' }), { columns: true });
packets.forEach((line) =>
    Object.entries(line)
        .filter(([_, v]) => v !== '-1')
        .forEach(([key, value]) => {
            if (!packetMapping.has(key)) packetMapping.set(key, new Map());
            packetMapping.get(key).set(line.protocol_version, value);
        }),
);

const versions = JSON.parse(fs.readFileSync(`${baseDir}/versions.json`, { encoding: 'utf8' }));

//#endregion INITIALIZATION

//#region VISUALIZATION

let currentVersion;

const multibar = new MultiBar(
    {
        stopOnComplete: true,
        clearOnComplete: true,
        autopadding: true,
        hideCursor: true,
        barsize: 50,
        stream: process.stdout,
    },
    Presets.shades_classic,
);
const mainBar = multibar.create(versions.length, 0, null, {
    format: 'Main Progress [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s | Errors: {errors}',
});

const logFile = fs.createWriteStream('analysis.log', 'utf8');
await new Promise((resolve) => logFile.on('open', resolve));
let errorCount = 0;
function error(message, file) {
    logFile.write(`[${file} (v: ${currentVersion})] ${message}\n`);
    errorCount++;
    mainBar.update({ errors: errorCount });
}

//#endregion VISUALIZATION

//#region UTILITY
const checkedResources = new Set();
const cachedRegistry = new Set();
const fileCache = new Map();
function read(file) {
    if (fileCache.has(file)) return fileCache.get(file);
    try {
        const content = fs.readFileSync(`${baseDir}/${file}`, { encoding: 'utf8' });
        const json = JSON.parse(content);
        fileCache.set(file, json);
        return json;
    } catch (e) {
        error(`cannot read file ${file}: ${e}`, '#root', -1);
        fileCache.set(file, null);
    }
}
//#endregion UTILITY

//#region PACKET CHECKING
// prettier-ignore
const VALID_PRIMITIVES = new Set([
    'i8', 'i16', 'i32', 'i64',
    'u8', 'u16', 'u32', 'u64',
    'u8_hex', 'u16_hex', 'u32_hex', 'u64_hex',
    'f32', 'f64',
    'varint', 'varlong',
    'zigzag32', 'zigzag64',
    'void', 'bool',
    'string', 'buffer', 'rest_buffer',
    'uuid', 'nbt',
    'recursive',
]);

function checkPayload(payload, file, saves) {
    if (typeof payload === 'string') {
        if (!VALID_PRIMITIVES.has(payload)) error(`invalid primitive type ${payload}`, file);
        return;
    }
    if (!Array.isArray(payload)) return error('invalid type: should be array', file);

    if (payload.length === 1) {
        if (!VALID_PRIMITIVES.has(payload[0])) error(`invalid primitive type ${payload}`, file);
        return;
    }
    if (payload.length > 1 && payload[0] === 'func') return checkFunction(payload[1], file);

    if (payload.length === 2) {
        switch (payload[0]) {
            case 'container':
                return checkContainer(payload[1], file, saves);
            case 'array':
                return checkArray(payload[1], file, saves);
            case 'option':
                return checkOptional(payload[1], file, saves);
            case 'mapper':
                return checkMapper(payload[1], file, saves);
            case 'switch':
                return checkSwitch(payload[1], file, saves);
            case 'bitfield':
                return checkBitfield(payload[1], file, saves);
            case 'registry':
                return checkRegistry(payload[1], null, file);
            case 'reference':
                return checkReference(payload[1], file);
            case 'fix_buffer':
                return checkFixBuffer(payload[1], file);
            case 'top_bit_set_terminated_array':
                return checkTopBitSetTerminatedArray(payload[1], file, saves);
            case 'entity_metadata_loop':
                return checkEntityMetadataLoop(payload[1], file, saves);
        }
    }
    if (payload.length === 3) {
        switch (payload[0]) {
            case 'save':
                return checkSave(payload[1], payload[2], file, saves);
            case 'global_save':
                return checkGlobalSave(payload[1], payload[2], file, saves);
            case 'registry':
                return checkRegistry(payload[1], payload[2], file);
            case 'either':
                return checkEither(payload[1], payload[2], file, saves);
            case 'direct_holder':
                return checkDirectHolder(payload[1], payload[2], file, saves);
            case 'codec':
                return checkCodec(payload[1], payload[2], file, saves);
        }
    }
    error(`unknown type ${payload[0]}`, file);
}

function checkContainer(payload, file, saves) {
    if (!Array.isArray(payload)) return error(`invalid container: payload must be an array`, file);
    payload.forEach((entry, i) => {
        if (typeof entry.name !== 'string') return error(`invalid container: name is invalid at ${i}`, file);
        if (!('type' in entry)) return error(`invalid container: type not found at ${i}`, file);
        checkPayload(entry.type, `${file}/${entry.name}`, saves);
    });
}

function checkArray(payload, file, saves) {
    if (typeof payload !== 'object' || payload === null) return error(`invalid array: payload must be an object`, file);
    if ('offset' in payload && typeof payload.offset !== 'string')
        error(`invalid array: offset must be a string`, file);
    if ('countType' in payload) checkPayload(payload.countType, file + '/[count]', saves);
    if ('count' in payload) {
        switch (typeof payload.count) {
            case 'number':
                break;
            case 'string':
                if (!saves.includes(payload.count))
                    error(`invalid array: count field variable ${payload.count} not found`, file);
                break;
            default:
                error(`invalid array: count field has a wrong type`, file);
        }
    }
    if (!('count' in payload) && !('countType' in payload)) error(`invalid array: not found count and countType`, file);
    if (!('type' in payload)) return error(`invalid array: type not found`, file);
    checkPayload(payload.type, file + '/[element]', saves);
}

function checkOptional(payload, file, saves) {
    checkPayload(payload, file + '/[option]', saves);
}

function checkMapping(payload, file) {
    if (typeof payload !== 'object') return error(`invalid mapper: invalid mapping file`, file);
    Object.entries(payload)
        .filter(([_, v]) => typeof v !== 'string')
        .forEach(([k]) => error(`invalid mapper: mapping[${k}] must be a string`, file));
}

function checkMapper(payload, file, saves) {
    if (typeof payload !== 'object' || payload === null)
        return error(`invalid mapper: payload must be an object`, file);
    if ('type' in payload) checkPayload(payload.type, file + '/[map_field]', saves);
    if ('var' in payload) {
        if (typeof payload.var !== 'string') error(`invalid mapper: var must be a string`, file);
        else if (!saves.includes(payload.var))
            error(`invalid mapper: mapper field variable ${payload.var} not found`, file);
    }
    if (!('type' in payload) && !('var' in payload)) error(`invalid mapper: not found type and var`, file);
    if ('source' in payload) {
        if (typeof payload.source !== 'string') error(`invalid mapper: source must be a string`, file);
        else {
            const checkKey = `map/${payload.source}`;
            if (!checkedResources.has(checkKey)) {
                checkedResources.add(checkKey);
                const fileIndex = registriesMapping.get(payload.source)?.get(currentVersion);
                const fileName = fileIndex
                    ? `indexed_data/${fileIndex}/mappings/${payload.source}.json`
                    : `mappings/${payload.source}.json`;
                const content = read(fileName);
                if (!content) error(`invalid mapper: unknown mapping file ${fileName}`, file);
                else if (typeof content !== 'object') error(`invalid mapper: invalid mapping file`, fileName);
                else checkMapping(content, fileName);
            }
        }
    }
    if ('mappings' in payload) {
        if (!(typeof payload.mappings === 'object') || payload.mappings === null)
            error(`invalid mapper: mappings must be an object`, file);
        else checkMapping(payload.mappings, file);
    }
    if (!('source' in payload) && !('mappings' in payload))
        error(`invalid mapper: not found source and mappings`, file);
}

function checkSwitch(payload, file, saves) {
    if (typeof payload !== 'object' || payload === null)
        return error(`invalid switch: payload must be an object`, file);
    if (typeof payload.compareTo !== 'string') error(`invalid switch: compareTo must be a string`, file);
    if ('default' in payload) checkPayload(payload.default, file + '/[default]', saves);
    if (typeof payload.fields !== 'object') return error(`invalid switch: fields must be an object`, file);
    Object.entries(payload.fields).forEach(([k, v]) => checkPayload(v, `${file}/s:${k}`, saves));
}

function checkBitfield(payload, file, saves) {
    if (!Array.isArray(payload)) return error(`invalid bitfield: payload must be an array`, file);
    payload.forEach((entry, i) => {
        if (!(typeof entry === 'object') || entry === null)
            return error(`invalid bitfield: must be an object at ${i}`, file);
        if (typeof entry.name !== 'string') return error(`invalid bitfield: name is invalid at ${i}`, file);
        if (typeof entry.size !== 'number') error(`invalid bitfield: size must be number`, `${file}/${entry.name}`);
        if ('signed' in entry && typeof entry.signed !== 'boolean')
            error(`invalid bitfield: signed must be a boolean`, `${file}/${entry.name}`);
        if ('saveName' in entry) {
            if (typeof entry.saveName !== 'string')
                return error(`invalid bitfield: saveName must be a string`, `${file}/${entry.name}`);
            saves.push(entry.saveName);
        }
    });
}

function checkSave(payload1, payload2, file, saves) {
    if (typeof payload2 !== 'string') error(`invalid save: payload 2 must be a string`, file);
    checkPayload(payload1, file + '/[save]', saves);
    saves.push(payload2);
}

function checkGlobalSave(payload1, payload2, file, saves) {
    if (typeof payload2 !== 'string') error(`invalid global_save: payload 2 must be a string`, file);
    checkPayload(payload1, file + '/[global_save]', saves);
}

function checkRegistry(payload1, payload2, file) {
    if (payload2 !== null && typeof payload2 !== 'string') error(`invalid registry: payload 2 must be a string`, file);
    if (typeof payload1 !== 'string') return error(`invalid registry: payload 1 must be a string`, file);
}

function checkReference(payload, file) {
    if (typeof payload !== 'string') return error(`invalid reference: payload must be a string`, file);
    const checkKey = `reg/${file}`;
    if (checkedResources.has(checkKey)) return;
    checkedResources.add(checkKey);
    const fileIndex = packetMapping.get(payload)?.get(currentVersion);
    const fileName = fileIndex ? `indexed_data/${fileIndex}/structures/${payload}.json` : `structures/${payload}.json`;
    const content = read(fileName);
    if (!content) return error(`invalid reference: unknown file ${fileName}`, file);
    checkPayload(content, fileName + ':#root', []);
}

function checkFixBuffer(payload, file) {
    if (typeof payload !== 'number') error(`invalid fix_buffer: payload must be a number`, file);
}

function checkFunction(payload, file) {
    if (typeof payload !== 'string') error(`invalid func: payload must be a string`, file);
}

function checkTopBitSetTerminatedArray(payload, file, saves) {
    checkPayload(payload, file + '/[top_bit_set_terminated_array]', saves);
}

function checkEntityMetadataLoop(payload, file, saves) {
    if (typeof payload !== 'object' || payload === null)
        return error(`invalid entity_metadata_loop: payload must be an object`, file);
    if (typeof payload.endVal !== 'number') error(`invalid entity_metadata_loop: endVal must be a number`, file);
    checkPayload(payload.type, file + '/[entity_metadata_loop]', saves);
}

function checkEither(payload1, payload2, file, saves) {
    checkPayload(payload1, file + '/[either_true]', saves);
    checkPayload(payload2, file + '/[either_false]', saves);
}

function checkDirectHolder(payload1, payload2, file, saves) {
    if (typeof payload1 !== 'string') error(`invalid direct_holder: payload1 must be a string`, file);
    checkPayload(payload2, file + '/[direct]', saves);
}

function checkCodec(payload1, payload2, file, saves) {
    if (typeof payload2 !== 'string') error(`invalid codec: payload2 must be a string`, file);
    else if (!saves.includes(payload2)) error(`invalid codec: codec variable not found`, file);
    if (typeof payload1 !== 'string') return error(`invalid codec: payload1 must be a string`, file);
    const checkKey = `codec/${payload1}`;
    if (checkedResources.has(checkKey)) return;
    checkedResources.add(checkKey);
    const fileIndex = registriesMapping.get(payload1)?.get(currentVersion);
    if (!fileIndex) return error(`invalid codec: registry ${payload1} not found`, file);
    const fileName = `indexed_data/${fileIndex}/registries/${payload1}.json`;
    const content = read(fileName);
    if (!content) return error(`invalid codec: unknown registry file ${fileName}`, file);
    if (!Array.isArray(content)) return error(`invalid codec: registry ${payload1} must be an array`, fileName);
    content.forEach((item, i) => {
        if (typeof item !== 'string')
            return error(`invalid codec: registry ${payload1}[${i}] must be a string`, fileName);
        const itemFileIndex = packetMapping.get(`${payload1}/${item}`)?.get(currentVersion);
        const itemFileName = itemFileIndex
            ? `indexed_data/${itemFileIndex}/codec/${payload1}/${item}.json`
            : `codec/${payload1}/${item}.json`;
        const itemContent = read(itemFileName);
        if (!itemContent) return error(`invalid codec: unknown file ${itemFileName}`, fileName);
        checkPayload(itemContent, itemFileName + ':#root', []);
    });
}
//#endregion PACKET CHECKING

function checkProtocol(version) {
    currentVersion = version.toString();
    checkedResources.clear();
    cachedRegistry.clear();
    const fileIndex = registriesMapping.get('protocol')?.get(currentVersion);
    if (!fileIndex) return error(`invalid protocol: ${currentVersion} not found`, 'protocol.json');
    const fileName = `indexed_data/${fileIndex}/protocol.json`;
    const content = read(fileName);
    if (!content) return error(`invalid protocol: unknown protocol file ${fileName}`, 'protocol.json');
    if (typeof content !== 'object') return error(`invalid protocol: protocol file must be an object`, fileName);
    const protocolProgress = multibar.create(Object.keys(content).length, 0, null, {
        format: 'Protocol      [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
    });
    protocolProgress.start(Object.keys(content).length, 0);
    Object.entries(content).forEach(([key, value]) => {
        (() => {
            const keySplit = key.split('_');
            if (keySplit.length !== 2) return error(`invalid protocol: invalid status key: ${key}`, fileName);
            if (!['play', 'login', 'configuration'].includes(keySplit[0]))
                return error(`invalid protocol: unknown status: ${keySplit[0]}`, fileName);
            if (!['client', 'server'].includes(keySplit[1]))
                return error(`invalid protocol: unknown direction: ${keySplit[1]}`, fileName);
            if (!Array.isArray(value)) return error(`invalid protocol: content must be an array`);
            const statusProgress = multibar.create(value.length, 0, null, {
                format: 'Status       [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
            });
            statusProgress.start(value.length, 0);
            value.forEach((val, i) => {
                (() => {
                    if (typeof val !== 'object' || val === null)
                        return error(`invalid protocol: entry[${i}] must be an object`, fileName);
                    if (typeof val.key !== 'string')
                        return error(`invalid protocol: entry[${i}].key must be a string`, fileName);
                    if (typeof val.name !== 'string')
                        error(`invalid protocol: entry[${i}].name must be a string`, fileName);
                    const packetKey = `${key}_${val.key.replaceAll('/', '_')}`;
                    if ('stateNext' in val) {
                        if (typeof val.stateNext !== 'string')
                            error(`invalid protocol: stateNext[${packetKey}] must be a string`, fileName);
                        else if (!['play', 'login', 'configuration'].includes(val.stateNext))
                            error(`invalid protocol: stateNext[${packetKey}] is invalid`, fileName);
                    }
                    if ('stateSide' in val) {
                        if (typeof val.stateSide !== 'string')
                            error(`invalid protocol: stateSide[${packetKey}] must be a string`, fileName);
                        else if (!['client', 'server', 'all'].includes(val.stateSide))
                            error(`invalid protocol: stateSide[${packetKey}] is invalid`, fileName);
                    }
                    if ('specialMark' in val && typeof val.specialMark !== 'string')
                        error(`invalid protocol: specialMark[${packetKey}] must be a string`, fileName);
                    if ('type' in val) return checkPayload(val.type, `${fileName}:${val.key}!#root`, []);
                    const itemFileIndex = packetMapping.get(packetKey)?.get(currentVersion);
                    const itemFileName = itemFileIndex
                        ? `indexed_data/${itemFileIndex}/packets/${packetKey}.json`
                        : `packets/${packetKey}.json`;
                    const itemContent = read(itemFileName);
                    if (!itemContent) return error(`invalid protocol: unknown file ${itemFileName}`, fileName);
                    checkPayload(itemContent, itemFileName + ':#root', []);
                })();
                statusProgress.increment();
            });
            statusProgress.stop();
            multibar.remove(statusProgress);
        })();
        protocolProgress.increment();
    });
    protocolProgress.stop();
    multibar.remove(protocolProgress);
}

mainBar.start(versions.length, 0, { errors: 0 });
versions.forEach((version, i) => {
    (() => {
        if (typeof version !== 'object' || version === null) return error(`invalid version at ${i}`, 'version.json');
        if (typeof version.protocol_version !== 'number')
            return error(`invalid version.protocol_version at ${i}`, 'version.json');
        if (typeof version.version !== 'string') return error(`invalid version.version at ${i}`, 'version.json');
        if (typeof version.data_version !== 'number') error(`invalid version.data_version at ${i}`, 'version.json');
        checkProtocol(version.protocol_version);
    })();
    mainBar.increment();
});
mainBar.stop();

logFile.end();
await new Promise((resolve) => logFile.on('finish', resolve));
logFile.close();

if (errorCount > 0) {
    console.error(`${errorCount} error(s) found`);
    process.exit(1);
}
