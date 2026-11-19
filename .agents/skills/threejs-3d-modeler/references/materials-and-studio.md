# PBR Materials, Procedural Graphics & Studio Handoff

Flat `MeshStandardMaterial({ color })` without micro-roughness, clearcoat, or procedural surface detail makes even good geometry look like 1990s plastic. Use `src/kit/materials.js` presets and procedural `<canvas>` textures in Pass 3.

---

## 1. Studio Material Presets (`src/kit/materials.js`)

| Material Helper | Physical Properties | Best For |
| :--- | :--- | :--- |
| `paintedMetal(color, opts)` | `metalness: 0.35`, `roughness: 0.22`, `clearcoat: 0.9`, `clearcoatRoughness: 0.08` | Automotive paint, powder-coated appliances, enameled housings |
| `brushedMetal(color, opts)` | `metalness: 0.92`, `roughness: 0.30` + procedural brushed streak roughness/bump map | Stainless steel panels, aluminum chassis, camera top plates |
| `polishedChrome(opts)` | `metalness: 1.0`, `roughness: 0.06`, `envMapIntensity: 1.3` | Trim rings, levers, mirror bezels, hydraulic rods |
| `mattePlastic(color, opts)` | `metalness: 0.0`, `roughness: 0.58` + fine grain bump map | ABS housings, keycaps, grips, matte buttons |
| `rubber(color, opts)` | `metalness: 0.0`, `roughness: 0.86` + micro-noise bump | Tires, feet (`y = 0`), gaskets, seals, cables |
| `clearGlass(opts)` / `tintedGlass(color, opts)` | `transmission: 0.94`, `ior: 1.5`, `roughness: 0.04`, `thickness: 0.01` | Lenses, gauge crystals, car windows, carafes, display covers |
| `ceramic(color, opts)` | `metalness: 0.0`, `roughness: 0.14`, `clearcoat: 0.85` | Porcelain cups, glazed tiles, glossy white housings |
| `wood(color, opts)` | `metalness: 0.0`, `roughness: 0.42`, `clearcoat: 0.25` + procedural wood grain | Walnut handles, furniture legs, instrument bodies |
| `fabric(color, opts)` | `metalness: 0.0`, `roughness: 0.82`, `sheen: 0.7`, `sheenRoughness: 0.5` + weave bump | Upholstery, speaker grilles, straps, plush surfaces |
| `emissiveLed(color, intensity)` | `emissive: color`, `emissiveIntensity: intensity` | Power indicators, backlit displays, headlights |

---

## 2. Procedural 2D `<canvas>` Graphics (`labelCanvasTexture`)

Dials, pressure gauges, OLED screens, ruler ticks, keyboard legends, badges, and warning labels immediately anchor human scale. Generate crisp `1024×1024` high-DPI canvas textures in code:

```js
import { labelCanvasTexture } from "./kit/materials.js";

const dialMap = labelCanvasTexture(1024, 1024, (ctx, w, h) => {
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = "#f6f3ec";
  ctx.fillRect(0, 0, w, h);

  // Minute/pressure tick marks
  ctx.strokeStyle = "#1f2328";
  for (let i = 0; i <= 30; i++) {
    const a = (-Math.PI * 0.75) + (i / 30) * (Math.PI * 1.5);
    const rOuter = 430;
    const rInner = i % 5 === 0 ? 375 : 402;
    ctx.lineWidth = i % 5 === 0 ? 10 : 5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
    ctx.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
    ctx.stroke();
  }
});
```

---

## 3. Articulation & `src/model.js` Contract

Every `src/model.js` exports `buildModel(ctx)` with this shape so the studio harness, `lil-gui`, and `render-quad.mjs` work seamlessly:

```js
export function buildModel() {
  const root = new THREE.Group();
  root.name = "espresso_machine_root";

  // ... build hierarchy & pivots ...

  const params = {
    leverAngle: 0, // exposed automatically as a slider in lil-gui when specs are provided
  };

  const paramSpecs = {
    leverAngle: { min: 0, max: 65, step: 1, label: "Brew Lever (deg)" },
  };

  function update(state) {
    leverPivot.rotation.x = THREE.MathUtils.degToRad(state.leverAngle);
  }

  return {
    root,
    params,
    paramSpecs,
    update,
    tick, // optional: (elapsedSec, params) => void for subtle live idle motion
    layers: [
      // optional toggleable Inspector -> Layers checkboxes:
      // { key: "subject", label: "Main Structure", group: mainGrp, default: true },
      // { key: "env", label: "Environment", group: envGrp, default: true, external: true, hidesStudioGround: true },
      // { key: "bg", label: "Sky Backdrop", group: bgGrp, default: true, external: true, hidesStudioGround: true },
    ],
    metadata: {
      name: "Lever Espresso Machine",
      category: "Appliances",
      summary: "One-line description for collection gallery cards",
      units: "meters",
    },
  };
}
```

*Note on `external: true` layers:* External scenic/sky layers are added directly to `scene` outside `root` so they never distort tight `Box3` camera framing, `2048×2048` shadow-map resolution, or 2×2 orthographic blueprint captures.

---

## 4. Clean `.glb` Export & Downstream Blender Handoff

`render-quad.mjs --export-glb=exports/<slug>.glb` runs `GLTFExporter` (`binary: true`) on `root` in its neutral pose (`explode = 0`, clay override off):

- **Named Hierarchy:** Every `Group` and `Mesh` `.name` becomes an editable object/empty in Blender (`bpy.data.objects[...]`).
- **Meters & Floor Origin:** Three.js `1 unit = 1 m` with `y = 0` floor maps 1:1 to Blender's metric unit scale (`GLTFExporter` + Blender's glTF importer automatically convert `+Y up` ↔ `+Z up`).
- **Standard PBR Channels:** Base color, metalness, roughness, emissive, and embedded canvas PNG textures export directly inside the single `.glb` binary.
