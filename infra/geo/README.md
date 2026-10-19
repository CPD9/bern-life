# infra/geo: Bern from swisstopo open data

Builds `web/public/world/bern.geo`, the compact file with Bern's real building footprints, roads,
water and railways that the world map loads. Python standard library only. Map data ©swisstopo
(see `PROVENANCE.md` and `NOTICE`).

```bash
python3 -m infra.geo.build fetch   # swissTLM3D lines and address lookups, cached, >= 1 s apart
python3 -m infra.geo.build build   # tiles + cache -> web/public/world/bern.geo, prints its sha256
```

Raw data stays outside git in `$BERNLIFE_DATA_DIR/geo/raw` (default
`~/Developer/bern-life-data/geo/raw`):

| What | From | Size |
| --- | --- | --- |
| swissBUILDINGS3D 3.0, 2021 CityGML tiles 1166-24, 1166-41, 1166-42 | `data.geo.admin.ch` STAC, downloaded by hand | 313 MB zipped |
| swissTLM3D roads, water network, railways in 500 m cells | geo.admin identify API (`tlm/`) | small |
| building addresses of the places and five landmarks | geo.admin search (`addresses/`) | small |

The CityGML tiles are streamed straight from their zips (1-2 GB of XML each), never unpacked.
The `.gdb` variant of the same tiles stores 3D solids that GDAL's Python readers cannot open.

## Map frame

1 unit = 20 m, origin at the Zytglogge ("Bim Zytglogge 1", LV95 E 2600706.2 N 1199646.9), +x
east, -z north, the frame `web/features/world/geography.ts` documents. The box is LV95 E
2597600-2602000, N 1197300-1201500. Points are stored as int16 in 1/16 unit (1.25 m).

## What the file holds

Format in `encode.py`, decoder in `web/features/world/bern-geo.ts`.

- Buildings: ground footprints simplified to 1 m, footprints under 15 m² and large walls, canopies
  and greenhouses left out, height in whole metres (roof top minus terrain point). Landmarks
  (Zytglogge, Bundeshaus, Münster, University main building, Inselspital) are flagged.
- Lines: roads with a width from their swissTLM3D class ("10m Strasse", ...), the Aare (50 m)
  and smaller streams, railways.
- Place anchors: each place with an address, at its address point in its own building, matched
  by EGID (the federal building id both the address register and swissBUILDINGS3D carry).
