# Protocol Definition and Packet Type
## Protocol Definition
Here are two places to create the protocol file:
- `initial.json`: The initial protocol which will not change forever. The protocol will be used at connection establishing to identity and handshake.
- `indexed_data/<index>/protocol.json`: Detailed protocol for specific protocol version.

The `initial.json` should contain 3 arrays: `handshaking_server`(Handshake), `status_client`(S2C, SLP) and `status_server`(C2S, SLP);
the detailed protocol file should contain 4 arrays at least: `login_client`(S2C, Login or Transfer), `login_server`(C2S, Login or Transfer), `play_client`(S2C, Play) and `play_server`(C2S, Play).
For newer versions, the detailed protocol file should contain 2 another arrays: `configuration_client`(S2C, Configuration) and `configuration_server`(C2S, Configuration).

These arrays represents different states for minecraft protocol. Each state has different ID mappings.
For a protocol entry, its index in the array represents its protocol ID.

A protocol entry should have these fields:
- `key`: Namespaced ID **without `minecarft:` prefix**.
- `name`: (Optional) Human-readable name for the packet.
- `type`: (Optional) Packet type. If not exists, dissector will read data `packets/<state name>_<key (replace '/' to '_')>.json`.
- `specialMark`: (Optional) A mark to tell dissector to execute some builtin procedures. See `marks/` folder in this documentation.

## Packet Type
Packet type is the structure of a packet, a structure or a codec, which controls the display in wireshark.

Packet type has two categories: Simple type and composite type.

Simple types are primitive builtins, can be simply used by `"<type>"` or `["<type>"]`:
- `i8/i16/i32/i64`: x-bit integers.
- `u8/u16/u32/u64`: x-bit unsigned integers.
- `u8_hex/u16_hex/u32_hex/u64_hex`: x-bit unsigned integers, but displayed in hex numbers.
- `f32/f64`: x-bit floating point numbers.
- `varint/varlong`: Variable length integers.
- `void`: Do nothing.
- `bool`: Boolean value.
- `string`: UTF-8 string.
- `buffer`: A byte buffer. Length is read from current tvbuff.
- `rest_buffer`: A byte buffer contains all rest bytes in current tvbuff.
- `uuid`: 128-bit UUID.
- `nbt`: Minecraft Named Binary Tag.
- `recursive`: Recursive calling this file.

For a packet, a structure or a codec, if it only has a simple type field, it should be written as `["<type>"]`.

Composite types are like function calling. These types should be defined as `["<type>", <arg1>, <arg2>, ...]`.
All of these can be found in `types/` folder in this documentation.