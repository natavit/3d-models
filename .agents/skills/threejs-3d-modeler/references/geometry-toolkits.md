# Geometry Toolkits & Part Construction Guide

Real manufactured and organic objects catch specular highlights along **bevels, fillets, profiles, and transitions**—never razor-sharp 90° `BoxGeometry` edges. Choose the right geometry constructor for every part in `blueprint.md`.

All helpers below are pre-built in `resources/studio-harness/src/kit/` (`shapes.js` and `csg.js`).

---

## 1. Choosing the Right Constructor per Form

| Form Family | Preferred Constructor / Kit Helper | Typical Examples |
| :--- | :--- | :--- |
| **Rounded housings & slabs** | `RoundedBoxGeometry` (`roundedBox`) | Chassis blocks, camera bodies, cushions, plinths, buttons |
| **Profiled 2D silhouettes with bevels** | `THREE.Shape` + Bezier/arc curves → `extrudeProfile` | Side-profile body panels, brackets, guitar bodies, fin blades, custom cutouts via `shape.holes` |
| **Axisymmetric / turned parts** | `Vector2[]` / spline → `latheProfile` | Lenses, dials, knobs, cups, wheels/tires, nozzles, bottles, lampshades |
| **Bent pipes, frames, wires, trim** | `CatmullRomCurve3` → `tubeAlong` | Tubular steel furniture, handlebars, steam wands, cables, rubber gaskets |
| **Hard-surface cutouts, recesses & joins** | `csgSubtract`, `csgUnion`, `csgIntersect` (`three-bvh-csg`) | Window/screen recesses, wheel wells, vents, screw/USB ports, boolean merges |
| **Smooth organic / sculpted forms** | Low-poly cage + `deformGeometry` → `subdivide` (`three-subdivide`) | Stylized characters, ergonomic grips, saddle seats, aerodynamic shells |
| **Smooth metaball / fluid blends** | `MarchingCubes` (`three/addons/objects/MarchingCubes.js`) | Droplets, soft-blended biomorphic forms |
| **Precision mechanical CAD** | `replicad` or `manifold-3d` (install on demand) | Variable-radius CAD fillets, involute gears, precision mechanical enclosures |

---

## 2. Kit Helper Patterns (`src/kit/shapes.js` & `src/kit/csg.js`)

### Beveled Profile Extrusions (`extrudeProfile` & `roundedRectShape`)

Prefer `extrudeProfile` over `BoxGeometry` whenever a part has a non-rectangular silhouette, angled face, or interior hole:

```js
import { extrudeProfile, roundedRectShape } from "./kit/shapes.js";

const panelShape = roundedRectShape(0.28, 0.18, 0.016);
const windowHole = roundedRectShape(0.20, 0.10, 0.008);
panelShape.holes.push(windowHole);

const panelGeo = extrudeProfile(panelShape, {
  depth: 0.014,
  bevelThickness: 0.0025,
  bevelSize: 0.002,
  bevelSegments: 4,
  curveSegments: 24,
  centerZ: true,
});
```

### Turned / Rotational Profiles (`latheProfile`)

Define the right-side `[radius, y]` cross-section from bottom to top, including wall thickness and rim bevels so openings are never paper-thin:

```js
import { latheProfile } from "./kit/shapes.js";

const cupGeo = latheProfile(
  [
    [0.0, 0.0],
    [0.032, 0.0],
    [0.036, 0.004],
    [0.044, 0.068],
    [0.043, 0.071],
    [0.040, 0.071],
    [0.039, 0.068],
    [0.031, 0.006],
    [0.0, 0.006],
  ],
  { segments: 64 },
);
```

### CSG Booleans Without Gotchas (`csgSubtract`, `csgUnion`, `csgIntersect`)

1. **Avoid coplanar face slivers:** Extend subtraction cutters **1–2 mm (`0.002`) past** the outer surface being cut—never flush with the target face.
2. **Automatic matrix sync:** Position/rotate cutters normally; `csgSubtract` calls `updateMatrixWorld(true)` automatically.
3. **Clean segments:** Keep cutter cylinder/box segments moderate (`24–48`) for clean, fast BVH triangulation.

```js
import * as THREE from "three";
import { roundedBox } from "./kit/shapes.js";
import { csgSubtract } from "./kit/csg.js";

const bodyMesh = new THREE.Mesh(roundedBox(0.24, 0.32, 0.28, 0.014, 5), bodyMat);
const recessCutter = new THREE.Mesh(roundedBox(0.18, 0.16, 0.09, 0.008, 4), bodyMat);
recessCutter.position.set(0, -0.02, 0.105);

const carvedBody = csgSubtract(bodyMesh, [recessCutter], bodyMat);
carvedBody.name = "chassis_body_mesh";
```

### Organic Subdivision & Space Deformation (`subdivide` & `deformGeometry`)

Shape a clean cage or apply spatial taper/crown/bend and Loop-subdivide:

```js
import { roundedBox, deformGeometry, subdivide } from "./kit/shapes.js";

let cushionGeo = roundedBox(0.52, 0.12, 0.48, 0.035, 3);
cushionGeo = deformGeometry(cushionGeo, (v) => {
  const r2 = (v.x / 0.26) ** 2 + (v.z / 0.24) ** 2;
  if (v.y > 0) v.y += 0.018 * Math.max(0, 1 - r2);
  v.x *= 1 - 0.06 * ((v.z + 0.24) / 0.48);
});
cushionGeo = subdivide(cushionGeo, 1);
```

---

## 3. Craft & Detailing Rules

1. **Panel Gaps & Reveal Seams:** Separate distinct parts (lid vs. body, door vs. frame, bezel vs. glass) by a deliberate **0.5–1.5 mm (`0.0005–0.0015 m`) shadow gap** or inset collar so ambient lighting reads the assembly.
2. **Physical Attachment:** Connect every handle, wheel, gauge, mirror, or limb via a **boss, collar, grommet, bracket, or axle**—zero hovering or nakedly intersecting parts.
3. **Positive Scales & Named Nodes:**
   - Give every `THREE.Group` and `THREE.Mesh` a descriptive snake_case `.name` (`"lid_hinge_grp"`, `"dial_bezel_mesh"`).
   - Keep all mesh scales positive (`+1, +1, +1`) so `.glb` triangle winding stays outward-facing in Three.js and Blender; mirror left/right parts by negating `position.x` and mirroring rotations.
4. **Micro-Hardware:** Add rubber feet resting at `y = 0`, hex fasteners (`placeAroundRing`), knurled collars, port recesses, and indicator lenses to sell real-world scale.
5. **Closed-Loop Kinematics & Mid-Travel Sweep Checks:**
   - When a mechanism connects a fixed chassis anchor `P0` to a moving part's bracket `P2(t)` (scissor linkages, hydraulic struts, suspension wishbones, hinges), solve **closed-loop two-bone inverse kinematics** (Law of Cosines knee solver) directly from `P2(t)`'s world/parent coordinates rather than lerping open-loop angles or toggling `.visible`.
   - Always render and visually inspect **intermediate slider values** (`t = 0.1, 0.5, 1.0`), not just `0.0` and `1.0`, to catch mid-stroke mesh clipping.
