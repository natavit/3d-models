---
name: threejs-3d-modeler
description: >-
  Designs and builds high-craft interactive 3D models and downloadable .glb
  assets using Three.js (CSG booleans, subdivision surfaces, profiled extrusions,
  lathes, procedural PBR textures, or parametric CAD kernels), guided by
  multi-angle reference search or Nano Banana orthographic turnaround sheets and
  verified through an automated 4-angle orthographic + studio render loop. Use
  when the user asks to create, model, sculpt, or generate a 3D object, prop,
  vehicle, character, furniture piece, or interactive 3D asset.
---

# Three.js High-Craft 3D Modeler

Build production-quality 3D models through a gated 5-phase workflow. Never write
3D geometry code on Turn 1: settle requirements first, lock multi-angle visual
references second, author a measured spatial blueprint third, and verify every
modeling pass with deterministic multi-angle renders.

## Phase 1 — Clarify Requirements (Gate 1)

Ask all unsettled frontier decisions in a single round (via `ask_question` or
concise numbered choices with recommended defaults), then **stop and wait**:

1. **Subject & Signature Details:** Exact object, variant/era, and the 2–3 hero details that make it unmistakable.
2. **Visual & Material Direction:** Photoreal studio PBR, tactile stylized/miniature, precision technical/CAD, or art-directed low-poly.
3. **Reference Strategy:**
   - `hybrid` (Recommended) — Search real-world photos and dimensions first, then synthesize a clean 4-view orthographic turnaround sheet with Nano Banana (`image-generator` subagent).
   - `generate` — Pure Nano Banana workflow: Hero 3/4 concept anchor first, then a 4-view orthographic turnaround sheet (best for original or imaginary designs).
   - `search` — Real-world multi-angle product/blueprint photos directly (best when exact existing orthographic blueprints are available).
4. **Deliverable & Articulation:** Standalone studio viewer + `.glb` export (default) or integration into an existing Three.js / React Three Fiber app; static hero prop vs. articulated pivots (doors, wheels, dials, joints, exploded view).

**Completion criterion:** Every decision above is settled by the user (skip waiting only when the user explicitly asks for an autonomous end-to-end run).

## Phase 2 — Multi-Angle Reference Sheet (Gate 2)

Read [references/reference-turnarounds.md](./references/reference-turnarounds.md) and populate `<project>/refs/`:

- **Search:** Retrieve ground-truth dimensions (`W × H × D`) and clean front/side/back/top or 3/4 photos. Inspect every downloaded image with `read_file` to confirm unobstructed views.
- **Generate (Nano Banana via `image-generator` subagent):**
  1. Generate **1 Hero 3/4 Studio Anchor** (`refs/hero-3q.png`). If the design was open-ended, confirm this direction with the user before generating the turnaround.
  2. Pass `refs/hero-3q.png` back into `image-generator` to generate **one single 2×2 Orthographic Turnaround Sheet** (`refs/turnaround-ortho.png`) showing `FRONT | RIGHT` on the top row and `BACK | TOP` on the bottom row at identical scale with zero perspective lens distortion.
- **Hybrid:** Gather real-world reference photos and dimensions first, then invoke `image-generator` grounded on those references to produce `refs/hero-3q.png` and `refs/turnaround-ortho.png`.

Inspect `refs/` with `read_file`, summarize the key measured proportions, show the reference images to the user, and **wait for approval** before modeling.

## Phase 3 — Spatial Blueprint (`blueprint.md`)

Read [references/geometry-toolkits.md](./references/geometry-toolkits.md) and author `<project>/blueprint.md` from your visual inspection of `refs/`:

1. **Coordinate Standard & Bounding Box:**
   - `1 unit = 1 meter` (use real-world scale even for small objects; the studio harness auto-fits cameras and shadow frustums to any bounding box).
   - Floor contact plane at `y = 0`, centered laterally on `x = 0` and `z = 0`.
   - Forward = `+Z`, Right = `+X`, Up = `+Y`.
   - Record target overall `[width, height, depth]` and landmark proportional ratios measured from the Front, Right, and Top panels.
2. **Scene Graph & Articulation Pivots:**
   - Tree of named `THREE.Group` and `THREE.Mesh` nodes (`node.name = "lid_hinge_grp"`, etc.—preserved in `.glb` exports for downstream animation or a separate Blender Cycles studio render skill).
   - Place every movable or angled sub-assembly's `Group` origin at its physical hinge, axle, or attachment point, then model child geometry in local coordinates relative to that pivot.
3. **Part-by-Part Geometry Plan:**
   - Map every component to a profiled, beveled, boolean, or subdivided constructor (`RoundedBoxGeometry`, `extrudeProfile` with 2D Bezier `Shape` + bevels, `latheProfile`, `tubeAlong`, `csgSubtract`/`csgUnion` via `three-bvh-csg`, `subdivide` via `three-subdivide`, or `manifold-3d`/`replicad` for precision CAD).
   - Reserve raw `SphereGeometry` and `CylinderGeometry` strictly for true spheres, optical lenses, pins, axles, or CSG boolean cutters.
4. **Material Palette:**
   - Named `MeshPhysicalMaterial` specs (albedo, metalness, roughness, clearcoat, IOR, transmission, sheen, procedural noise/brushed/canvas textures).

**Completion criterion:** Every visible component in `refs/turnaround-ortho.png` appears in `blueprint.md` with explicit dimensions, parent pivot, geometry constructor, and material name.

## Phase 4 — Studio Project Setup

Check whether the current workspace already hosts a **3D Collection Gallery** (`src/gallery.js` and `src/kit/` at root):

- **Collection Workspace Mode (Preferred when `src/gallery.js` exists):**
  - Author the model at `models/<slug>/model.js` importing helpers from `../../src/kit/` (`csg.js`, `shapes.js`, `materials.js`).
  - Include `metadata: { name, category, summary, units: "meters" }` in `buildModel()`'s return object so `render-quad.mjs --model=<slug>` automatically populates `models/<slug>/meta.json` and `models/<slug>/thumbnail.png` for the gallery landing page.
- **Standalone Project Mode:**
  - Copy [resources/studio-harness/](./resources/studio-harness/) to `<project>/` and consult [references/materials-and-studio.md](./references/materials-and-studio.md).
  - Ensure `three`, `three-bvh-csg`, `three-subdivide`, `lil-gui`, `vite`, and `playwright-core` (or `playwright`) are installed, and implement `src/model.js`.

## Phase 5 — 3-Pass Build & Visual Diff Loop

Build in three progressive passes. After **every** pass, run [scripts/render-quad.mjs](./scripts/render-quad.mjs) and inspect the rendered PNGs alongside `refs/` using `read_file`:

```bash
# Collection Workspace Mode (--model=<slug>)
node <skill_dir>/scripts/render-quad.mjs . models/<slug>/renders/pass-1 --model=<slug> --clay
node <skill_dir>/scripts/render-quad.mjs . models/<slug>/renders/pass-3 --model=<slug> --export-glb=models/<slug>/exports/<slug>.glb

# Standalone Project Mode
node <skill_dir>/scripts/render-quad.mjs <project_dir> <project_dir>/renders/pass-1 --clay
node <skill_dir>/scripts/render-quad.mjs <project_dir> <project_dir>/renders/pass-3 --export-glb=<project_dir>/exports/<slug>.glb
```

1. **Pass 1 — Clay Blockout & Proportions:**
   - Construct all primary silhouettes and hierarchy pivots.
   - Check JSON diagnostics from `render-quad.mjs`: verify `groundOffset` (`minY` within `±0.002` of `0`), `centerOffsetX` (`≈ 0` for symmetric subjects), and overall `[W, H, D]` aspect ratios.
   - Visually compare `pass-1-ortho.png` (`FRONT | RIGHT | BACK | TOP`) against `refs/turnaround-ortho.png`. Correct proportion errors, posture, and part intersections before adding fine detail.
2. **Pass 2 — Secondary Forms, CSG Cutouts & Bevels:**
   - Add boolean recesses, vents, ports, wheel arches, panel grooves, trim piping, fasteners, fillets, and subdivided organic transitions.
   - Render `--clay` and normal studio views (`pass-2-ortho.png`, `pass-2-hero.png`). Inspect for Z-fighting, coplanar boolean slivers, disconnected floating parts, or inverted normals, and fix every defect.
3. **Pass 3 — PBR Materials, Procedural Graphics & Articulation:**
   - Apply `MeshPhysicalMaterial` finishes, seeded procedural bump/roughness maps, crisp `<canvas>` dial/label/screen graphics, glass transmission, emissive accents, and `lil-gui` articulation controls.
   - Run `render-quad.mjs` with `--export-glb` to produce `pass-3-ortho.png`, `pass-3-hero.png`, and `exports/<slug>.glb`. Run up to 2 extra refinement passes if any angle still diverges from `refs/`.

**Completion criterion:**
- `render-quad.mjs` exits `0` with zero console/page/WebGL errors and `minY ≈ 0`.
- All 4 orthographic panels (`FRONT`, `RIGHT`, `BACK`, `TOP`) and the `3/4 HERO` studio render match the approved reference turnaround in silhouette, proportions, surface transitions, and material read.
- `exports/<slug>.glb` is generated with clean node names and PBR materials (ready for web embedding or handoff to a downstream Blender rendering skill).
