# Overview for this schema
## Basic structure
The protocol data should be organized as below:
- `settings.json`: A profile for the protocol data.
- `java_edition`: Folder for storing all MCJE protocol data.
  - `indexed_data`: Data indexed in protocol version. If the data has no changes between all versions, it should not be here. See (this page)[./version.md].
  - `codec`, `packets`, `structures`: See (this page)[./protocol.md].
  - `indexes.csv`, `packets.csv`: Indexing files. See (this page)[./version.md].
  - `versions.json`: Versions recorded in this protocol data.
  - `initial.json`: Initial protocol.

## Settings
`settings.json` should be placed at root of the protocol data. It describes the protocol schema version and data compatiblity.

The file should contain following fields:
- `version`: Schema version. `2.3` for now.
- `entity_sync_datas`: If the protocol data contains Entity Metadata Synchronzition Serializer data.
- `events`: If the protocol data contains Entity Events and Level Events.
- `packet_names`: If the protocol data contains human-readable names for packets.
- `protocols`: Should be `true`.
- `registries`: If the protocol data contains builtin registries data.
- `registry_codec_support`: If the protocol data contains registry codec data.