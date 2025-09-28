# Version and Indexed protocol data
Some protocol data may change between the protocol version, but copying all files into one version is too costive.
To resolve this, we introduce two indexing files and make a directory to save these indexed data.

In following sections, we will add a new version for the protocol data in step to help you understand the indexing files.

## First Step: Update `versions.json`
To add a new version, the first step is to add the version information into the `version.json`.
All versions recorded in the file should be ordered by time, from the latest to the oldest.

A version should contains these information:
- `version`: Name of the version.
- `protocol_version`: Protocol version.
  - Two different versions **may** have same protocol version.
    Generally, these versions should have same protocol data, but in some cases they are different.
    Dissector only respects the latest data for one protocol version, even if the protocol data may not compat the version.
- `data_version`: Data version. Should be unique.

## Second Step: Compare differences between former version
Diff two versions data, and save these files into `./indexed_data/<protocol_version>/<path>`, then add new line into `indexes.csv` and `packets.csv` with these differences.

For example, if the oldest version (0) contains three data named `A`, `B`, `C` and `D`; former version (1) changes data `B` and `C`; and the version you want to add (2) deletes `C` and `D`, then the csv file should like this:

```csv
protocol_version, B, D
               2, 1,-1
               1, 1, 1
               0, 0, 0
```

`A` and `C` should not be recorded here because it doesn't change between all versions,
and they should be placed into `./<path>` instead of indexed data folder.
Adding and deleting should not be recorded unless the data has been changed during the data exists.
If the data needs to be indexed, all versions not contains the data should fill `-1` for this data.

## Third Step: How it works
When dissector needs to find a data file, it will find the index in the indexing file.
If an index is found and the index is not `-1`, the dissector will use `./indexed_data/<index>/<path>` to read the data.
Otherwise, use `./<path>`.

## indexes.csv and packets.csv
These file records different data:
- `indexes.csv` only record registries, protocol definitions, entity sync data, entity events and level events.
- `packets.csv` record packets, codecs and structures.