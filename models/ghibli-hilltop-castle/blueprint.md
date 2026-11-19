# Spatial Blueprint — Studio Ghibli Hilltop Castle Diorama

## 1. Coordinate Standard & Bounding Box

- **Scale:** `1 unit = 1 meter` (architectural museum maquette scale; `1.0 m` tall hero diorama).
- **Origin & Grounding:** Sculpted limestone island plinth rests flat at `y = 0.0000 m`, centered at `(0, 0)`.
- **Axes:** Forward = `+Z`, Right = `+X`, Up = `+Y`.
- **Maquette Bounding Box (`root` — Layers 1 & 2):**
  - `Width (X)`: `~1.04 m` (`x ∈ [-0.48, +0.56]` including cantilevered airship dock & windsock)
  - `Height (Y)`: `~0.98 m` (`y ∈ [0.0000, 0.9800]` from limestone base to brass rooster weathervane)
  - `Depth (Z)`: `~0.88 m` (`z ∈ [-0.44, +0.44]`)
- **External Scenic Layers (excluded from tight `Box3` shadow/camera framing):**
  - **Environment Layer (`environment`):** Cloud sea (`r = 0.55..4.2 m, y = -0.22..+0.12 m`), 3 floating mossy sky-islets (`[-1.55, 0.82, -1.15]`, etc.), and multi-balloon Ghibli airship (`[+1.25, 1.05, -0.75]`).
  - **Background Layer (`background`):** Inverted Ghibli sky dome (`R = 28 m`) + towering 3D cumulus thunderhead (`z = -6.8 m, y = -0.5..+4.2 m`).

---

## 2. Toggleable Layer Hierarchy & Articulation

```text
Scene
├── ghibli_hilltop_castle_root (maquette subject root)
│   └── diorama_turntable_grp
│       ├── layer_terrain_grp ("Cliff & Flora Terrain")
│       │   ├── limestone_cliff_left_mesh & limestone_cliff_right_mesh (stratified crags, y = 0)
│       │   ├── ravine_sandy_bed_mesh & stone_footpaths_grp
│       │   ├── grassy_terraces_grp (stepped emerald meadow caps)
│       │   └── ghibli_trees_and_shrubs_grp (clustered foliage canopies & trunks)
│       └── layer_castle_grp ("Castle Architecture")
│           ├── stone_viaduct_bridge_grp (curved 3-arch stepped masonry viaduct + parapets)
│           ├── gatehouse_and_walls_grp (crenellated gatehouse, oak double doors, curtain walls)
│           ├── tudor_manor_hall_grp (N-S west gable wing, E-W cross-hall, front oriel gable, chimneys)
│           ├── central_keep_tower_grp (ashlar shaft, corbelled timber gallery, slate-blue spire, weathervane)
│           ├── flanking_turrets_grp (left & right stone turrets with terracotta conical roofs)
│           ├── ravine_footbridge_grp (arched timber bridge + railings)
│           └── windmill_and_dock_grp (stone base, octagonal timber tower, spinning 4-sail rotor, airship dock + pennant)
├── layer_environment_grp ("Cloud Sea, Islets & Airship", external: true)
│   ├── cloud_sea_banks_grp (sculpted sunlit/periwinkle cumulus clusters)
│   ├── floating_sky_islets_grp (3 distant mossy crag islets with mini trees)
│   └── ghibli_airship_grp (wooden gondola, 4 ribbed gasbags, rudder & propeller)
└── layer_background_grp ("Ghibli Sky & Thunderhead", external: true, hidesStudioGround: true)
    ├── ghibli_sky_dome_mesh (day-to-dusk gradient dome)
    └── towering_thunderhead_grp (sculpted Laputa-style giant cumulus cloud mountain)
```

**Interactive Controls:**
- **Layers Folder (Checkboxes):** `Castle Architecture`, `Cliff & Flora Terrain`, `Cloud Sea & Airship (Env)`, `Ghibli Sky & Clouds (Bg)`.
- **Articulation Folder (Sliders):**
  - `duskGlow` (`0.0 → 1.0`, default `0.18`): Shifts window & lantern emissive warmth + transitions the Ghibli sky dome & cloud tint from crisp summer noon to golden twilight.
  - `windmillAngle` (`0° → 360°`, default `0°`) + `autoAnimate` (`boolean`, default `true`): Gently spins the 4-blade windmill sails, flutters the red windsock, and drifts the distant Ghibli airship!
  - `turntableDeg` (`-180° → +180°`, default `0°`): Rotates the castle maquette.
