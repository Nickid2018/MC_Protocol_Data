## Protocol Schema 2.3
Released in 2025/9/13 (minor fix):
- Replace `/` to `_` for protocol packets id.

Released in 2025/8/14:
- Add special mark `encrypt_request` to support key log file feature.

## Protocol Schema 2.2
Released in 2025/5/30:
- Add special mark `legacy_registry_holder` to support legacy registry synchronization flow.
- Composite type `registry` will be replaced with `varint` in runtime if flag `registries` is not available in protocol data.
- Remove simple type `optional_nbt`.

## Protocol Schema 2.1
Released in 2024/10/2:
- Fully complete all types.
- Add special mark `registry` to record writeable registries.
- Add simple type `fix_buffer` to support fix-length buffer which should not be represent by array.
- Add field `var` for composite type `mapper` to support variable mapping for better display.
- Add two essential simple type `entity_metadata_loop` and `top_bit_set_terminated_array`.

## Protocol Schema 2.0
Released in 2024/9/20:
- Fully refactor all schema definitions, switch from protodef.
- Some types are not available in this version.

## Protocol Schema 1.0
Released in 2024/7/21:
- Use protodef to describe minecraft protocol.