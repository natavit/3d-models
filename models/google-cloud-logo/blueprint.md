# Spatial Blueprint — 3D Google Cloud Logo Sculpture

## 1. Coordinate Standard & Measured Bounding Box

- **Scale:** `1 unit = 1 meter` (`1 SVG grid unit` on the official `64 × 64` grid = `0.01 m`).
- **Origin & Grounding:** Bottom tangent rests flush at `y = 0.0000 m`; centered horizontally on `x = 0.0000 m` and depth-centered around `z = 0.0000 m`.
- **Axes:** Forward = `+Z`, Right = `+X`, Up = `+Y`.
- **Target Overall Dimensions (`W × H × D`):**
  - `Width (X)`: `0.6400 m` (`x ∈ [-0.3200, +0.3200]`)
  - `Height (Y)`: `0.5148 m` (`y ∈ [0.0000, +0.5148]`, `W / H = 1.2432`, `H / W = 0.8044`)
  - `Depth (Z)`: `0.1113 m` base tubular diameter (`+0.0035 m` subtle forward relief on `yellow_c_ring_grp` → `~0.1148 m` total depth)

### Canonical Brand Grid Landmarks

- **Tubular Band Diameter (`T`):** `0.1113 m` (`r_tube = 0.05565 m`)
- **Left Lobe Center (`C_left`):** `(-0.13915, 0.18085)`, midline radius `R_L = 0.12520 m` (`R_in = 0.06955 m`, `R_out = 0.18085 m`)
- **Right Lobe Center (`C_right`):** `(+0.13915, 0.18085)`, midline radius `R_R = 0.12520 m` (`R_in = 0.06955 m`, `R_out = 0.18085 m`)
- **Top Crown Center (`C_top`):** `(0.00000, 0.26480)`, midline radius `R_T = 0.19440 m` (`R_in = 0.13875 m`, `R_out = 0.25005 m`)
- **Master 45° Seam Axis:** `y - x = 0.28516 m` (colinear diagonal governing the `Yellow/Green` lower-left cut, the `Yellow` inner C-hook tip, and the `Red/Blue` upper-right cut)
- **Bottom Center Seam:** `x = 0.0000 m` along the bottom horizontal bar (`y_center = 0.05565 m`)
- **Physical Reveal Seam Gap:** `0.0007 m` (`0.7 mm` half-gap per side → `1.4 mm` crisp beveled reveal groove)
- **End-Cap Fillet Radius:** `0.0028 m` (`2.8 mm` quarter-round bevel on all cut faces)

---

## 2. Scene Graph & Articulation Pivots

```text
google_cloud_logo_root (THREE.Group, origin [0, 0, 0])
└── cloud_turntable_grp (THREE.Group, pivot [0, 0.2574, 0] for turntable/tilt/hover)
    ├── red_arch_grp (THREE.Group, pivot [0.0, 0.405, 0.0], explode vector [-0.28, +0.92, 0])
    │   └── red_arch_mesh (THREE.Mesh)
    ├── blue_lobe_grp (THREE.Group, pivot [0.185, 0.215, 0.0], explode vector [+0.94, +0.18, 0])
    │   └── blue_lobe_mesh (THREE.Mesh)
    ├── green_base_grp (THREE.Group, pivot [-0.095, 0.056, 0.0], explode vector [-0.32, -0.90, 0])
    │   └── green_base_mesh (THREE.Mesh)
    └── yellow_c_ring_grp (THREE.Group, pivot [-0.185, 0.205, +0.0035], explode vector [-0.95, +0.15, +0.18])
        └── yellow_c_ring_mesh (THREE.Mesh)
```

**Interactive Articulation Parameters (`lil-gui`):**
- `assemblySpread` (`0.0 → 1.0`, default `0.0`): Radial 4-segment assembly/separation along brand vectors while keeping neutral pose grounded at `0.0`.
- `yellowReliefZ` (`0.000 → 0.012 m`, default `0.0035 m`): Subtle forward Z-step of the Yellow C-ring matching the 3D turnaround sheet.
- `turntableDeg` (`-180° → +180°`, default `0°`): Y-axis presentation rotation around center.
- `tiltDeg` (`-20° → +20°`, default `0°`): Subtle X/Z presentation tilt.

---

## 3. Part-by-Part Geometry Constructors

| Mesh Name | Parametric Construction Recipe |
| :--- | :--- |
| `yellow_c_ring_mesh` | Body-fitted curvilinear torus sweep around `C_left` (`R = 0.12520`, `r = 0.05565`), bounded at both ends by the exact `45°` plane `y - x = 0.28516 + gap` with `2.8 mm` quarter-round end-cap bevels and closed manifold pole caps. |
| `red_arch_mesh` | Body-fitted curvilinear torus sweep around `C_top` (`R = 0.19440`, `r = 0.05565`), bounded on the left by exact circle-circle intersection against `Yellow`'s outer shell (`R_out_left + gap` around `C_left`) and on the right by the `45°` plane `y - x = 0.28516 + gap`, both with `2.8 mm` quarter-round end-cap bevels. |
| `green_base_mesh` | G1-continuous curvilinear sweep combining the lower-left `C_left` arc (from `45°` plane `y - x = 0.28516 - gap` to `θ = -90°`) and straight horizontal bar (`y_mid = 0.05565`) to `x = -gap/2`, with `2.8 mm` quarter-round end-cap bevels at both ends. |
| `blue_lobe_mesh` | Single manifold curvilinear sweep uniting the upper-right `C_top` shoulder (from `45°` plane `y - x = 0.28516 - gap` to the exact analytic torus-torus miter loop `(x_m(φ), y_m(φ), z_m(φ))`) with the `C_right` lobe + bottom horizontal bar (ending at `x = +gap/2`), with `2.8 mm` quarter-round end-cap bevels and smooth saddle normal blending along the shoulder miter crease. |

---

## 4. Material Palette (Tactile Satin Soft-Touch Polymer + Subtle Clearcoat)

All four segments share a unified physical polymer shader formula (`MeshPhysicalMaterial`) with seeded ultra-fine micro-grain bump (`bumpScale: 0.00025`), `roughness: 0.34`, `metalness: 0.0`, `clearcoat: 0.38`, `clearcoatRoughness: 0.26`, `sheen: 0.18`:

- `google_red_mat`: `#EA4335`
- `google_blue_mat`: `#4285F4`
- `google_green_mat`: `#34A853`
- `google_yellow_mat`: `#FBBC05`
