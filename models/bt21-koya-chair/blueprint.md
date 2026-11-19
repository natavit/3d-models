# Spatial Blueprint — TTRacing ORA Sofa Chair (BT21 KOYA Edition)

## 1. Coordinate Standard & Bounding Box

- **Scale:** `1 unit = 1 meter` (derived from TTRacing ORA Sofa Chair specs + pixel-measured studio turnarounds).
- **Origin & Grounding:** Swivel steel ring base glide pads rest flush at `y = 0.0000 m`; chair body centered laterally at `x = 0.0000 m` and around swivel axis `z = 0.0000 m`.
- **Axes:** Forward (sitting direction) = `+Z`, Viewer-Right (Chair's Left Arm) = `+X`, Viewer-Left (Chair's Right Arm with Phone Holder) = `-X`, Up = `+Y`.
- **Upright Dimensions (`W × H × D`):**
  - **Symmetric Chair Body Width:** `0.945 m` (`x ∈ [-0.4725, +0.4725]`); with curved gooseneck arm on `-X`: total `X` span `~1.10 m` (`x ∈ [-0.63, +0.4725]`)
  - **Overall Height (`Y`):** `1.055 m` (`y ∈ [0.0000, 1.0550]`; head crown `1.030 m`, ear tips `1.055 m`, armrest top `0.600 m`, seat top `0.480 m`)
  - **Overall Upright Depth (`Z`):** `0.975 m` (`z ∈ [-0.515, +0.460]`; extends to `~1.40 m` when fully reclined)

---

## 2. Scene Graph & Articulation Pivots

```text
bt21_koya_chair_root (THREE.Group, origin [0, 0, 0])
├── swivel_ring_base_grp (stationary floor ring + cross-spokes + glide pads, y = 0..0.052)
└── chair_swivel_upper_grp (pivot [0, 0.052, 0] — rotates Y ±120° for 240° swivel)
    ├── tub_chassis_grp (side cheeks, rear skirt flap, seam welts, brand tab, inner seat pan)
    │   ├── right_flank_hardware_grp (x = -0.47: chrome socket, power recline button, star patch)
    │   │   └── gooseneck_mount_grp (pivot [-0.472, 0.255, 0.015] — swing/flex + visibility toggle)
    │   │       ├── gooseneck_tube_mesh
    │   │       └── phone_clamp_head_grp (ball joint + spring clamp jaws)
    │   └── left_flank_patches_grp (x = +0.47: Zz speech bubble + green leaf embroidery)
    ├── seat_cushion_grp (plump white seat cushion, y = 0.30..0.48, w = 0.535, d = 0.58)
    ├── armrests_grp (left +X and right -X overstuffed pleated bolsters, y = 0.42..0.60)
    ├── footrest_mechanism_grp (pivot [0, 0.35, 0.34] — synchronized recline deployment)
    │   ├── scissor_linkage_grp (left & right articulated steel pantograph bars)
    │   └── footrest_apron_grp (sky-blue U-apron frame + inset white calf cushion)
    └── koya_backrest_hinge_grp (pivot [0, 0.42, -0.15] — reclines from 12° to 34° backward)
        ├── koya_head_cushion_mesh (sculpted velour pillow dome + side welt seam)
        ├── koya_ears_grp (left & right plush ears with cream-white inner patches)
        └── koya_face_applique_grp (3D purple nose, sleepy tilted eyes, curved smile)
```

**Interactive Articulation Parameters (`lil-gui`):**
- `recline` (`0.0 → 1.0`, default `0.0`): Synchronized power recline (`102° → 124°` backrest tilt + elevating footrest & dual scissor pantograph linkage).
- `swivelDeg` (`-120° → +120°`, default `0°`): `240°` rotational swivel on the black steel ring base.
- `phoneArmSwing` (`-25° → +35°`, default `0°`): Swings/poses the flexible gooseneck phone holder.
- `showPhoneHolder` (`0` or `1`, step `1`, default `1`): Shows or detaches the gooseneck phone holder accessory.

---

## 3. Part-by-Part Geometry Constructors

| Component | Geometry Constructor / Technique |
| :--- | :--- |
| **Swivel Steel Ring & Cross-Spokes** | `TorusGeometry` (`R = 0.315, r = 0.0125`) + `tubeAlong` radial cross-bars + `latheProfile` central bearing column & 6 floor glide pads at `y = 0`. |
| **Tub Side Cheeks & Rear Skirt** | Subdivided & spatially sculpted `roundedBox` (`deformGeometry` + `subdivide`) creating barrel-curved outer flanks, recessed seat well, tailored rear flap (`05-back-3q.webp`), and `tubeAlong` welt piping. |
| **Deploying U-Apron Footrest & Seat Cushion** | Profiled `extrudeProfile` U-frame with `deformGeometry` pillow crown + `subdivide` for the sky-blue U-apron; sculpted `deformGeometry` + `subdivide` crown cushions for the white seat and white footrest inlay. |
| **Scissor Pantograph Linkage** | Articulated steel flat-bars (`roundedBox`) + cylindrical pivot rivets arranged in a true 4-bar kinematic pantograph folding cleanly behind the front apron at `recline = 0`. |
| **Pleated Armrest Bolsters** | Subdivided bolster cages with analytical radial gather pleats (`sin` crease modulation along the rounded front bolster nose) + side tuck seam. |
| **KOYA Head Backrest & Ears** | Sculpted superellipsoidal pillow dome (`deformGeometry` + `subdivide`) with koala cheek fullness, perimeter welt seam (`tubeAlong`), and C-curved plush ears with recessed cream-white velour inlays. |
| **Face & Side Embroideries** | Surface-conforming 3D plush/stitched appliqués (`purple nose`, `sleepy eyes`, `smile` on head; `5-point star` on `-X` flank; `Zz bubble` + `green leaf` on `+X` flank). |
| **Gooseneck Phone Holder & Button** | `latheProfile` chrome hex/collar socket + `tubeAlong` `CatmullRomCurve3` gooseneck + `csgSubtract` / `roundedBox` spring phone clamp + `latheProfile` recessed power-recline rocker switch. |

---

## 4. Material Palette

- `koya_blue_velour`: `#9AD2F4` plush microsuede/velvet (`roughness: 0.78`, `sheen: 0.82`, `sheenRoughness: 0.48`, fine micro-nap bump).
- `cream_white_velour`: `#F3F4F6` plush white cushion/ear inlay (`roughness: 0.76`, `sheen: 0.65`, fine nap bump).
- `koya_nose_plush`: `#736396` muted lavender-purple plush embroidery (`roughness: 0.80`, `sheen: 0.55`).
- `embroidery_ink`: `#1B2028` deep charcoal-navy stitched thread (`roughness: 0.70`).
- `leaf_green_patch`: `#1D9A49` vibrant leaf-green embroidery (`roughness: 0.68`).
- `zz_bubble_fill`: `#E3E6F5` pale lavender-white embroidery fill.
- `powder_black_steel`: `#181A1E` satin powder-coated steel (`metalness: 0.65`, `roughness: 0.42`) for ring base & scissor linkage.
- `matte_black_abs` & `gooseneck_rubber`: `#16181C` (`roughness: 0.52` clamp / `0.78` flexible silicone-wrapped arm) + `polishedChrome` socket collar.
