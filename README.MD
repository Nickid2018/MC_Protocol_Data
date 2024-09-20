# Minecraft Protocol Data Repository for MC_Dissector

The repository contains the protocol data for the Minecraft Protocol dissector for Wireshark.

All protocol data is stored in the `protocols` directory. The data is stored in [ProtoDef](https://github.com/ProtoDef-io/ProtoDef) format.

Some protocol data is from the [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data) project.

## About this branch 'dev-registry-codec'

I'm working on a new protocol schema for Minecraft Protocol, based on ProtoDef format.

Differences are listed as follows:
* Define primitive types: 
  * Integer types: `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `varint`, `varlong`. Add suffix `-hex` to display as hex numbers.
  * `f32`, `f64`, `bool`, `string`, `uuid`, `nbt`, `optional_nbt`, `buffer`, `void`, `recursive`.
* Define composite types:
  * `bitfield`: `usused` is reserved for useless bytes.
  * `codec`: Use registry codec. The first param is registry name, the second param is registry key variable. For example: `["codec", "entity", "entity_key"]`.
  * `func`: Use hardcoded function to resolve data. For example: `["func", "entity_sync"]`.
  * `registry`: Read a varint and use specific registry to recover the registry key. For example: `["registry", "entity"]`.
  * `reference`: Reference to another file, which can be defined in version manifest. For example: `["reference", "slot"]`.
  * `save`, `global_save`: Save the field as a variable. The first param is field type, the second param is variable name. For example: `["save", "string", "type"]`.