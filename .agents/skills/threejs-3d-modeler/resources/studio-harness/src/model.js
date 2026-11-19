import * as THREE from "three";
import { csgSubtract } from "./kit/csg.js";
import {
  brushedMetal,
  clearGlass,
  labelCanvasTexture,
  paintedMetal,
  polishedChrome,
  rubber,
} from "./kit/materials.js";
import { latheProfile, roundedBox } from "./kit/shapes.js";

export function buildModel() {
  const root = new THREE.Group();
  root.name = "studio_meter_root";

  const bodyPaint = paintedMetal(0xd94832);
  const topMetal = brushedMetal(0xd6dade);
  const chromeMat = polishedChrome();
  const footRubber = rubber(0x1b1d21);
  const glassMat = clearGlass({ thickness: 0.004 });

  // 1. Rubber feet resting flush at y = 0 (height = 0.008)
  const feetGroup = new THREE.Group();
  feetGroup.name = "rubber_feet_grp";
  const footGeo = latheProfile(
    [
      [0, 0],
      [0.011, 0],
      [0.013, 0.002],
      [0.012, 0.008],
      [0, 0.008],
    ],
    { segments: 32 },
  );
  for (const [fx, fz] of [
    [-0.048, -0.032],
    [0.048, -0.032],
    [-0.048, 0.032],
    [0.048, 0.032],
  ]) {
    const foot = new THREE.Mesh(footGeo, footRubber);
    foot.name = `foot_${fx > 0 ? "r" : "l"}_${fz > 0 ? "f" : "b"}_mesh`;
    foot.position.set(fx, 0, fz);
    feetGroup.add(foot);
  }
  root.add(feetGroup);

  // 2. Main enameled housing with CSG recessed gauge well
  const rawBody = new THREE.Mesh(roundedBox(0.13, 0.145, 0.09, 0.012, 5), bodyPaint);
  rawBody.position.set(0, 0.008 + 0.145 / 2, 0);

  const gaugeWellCutter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.024, 48),
    bodyPaint,
  );
  gaugeWellCutter.rotation.x = Math.PI / 2;
  gaugeWellCutter.position.set(0, 0.092, 0.042);

  const housing = csgSubtract(rawBody, [gaugeWellCutter], bodyPaint);
  housing.name = "main_housing_mesh";
  root.add(housing);

  // 3. Brushed top cap with 0.8mm reveal gap
  const topCap = new THREE.Mesh(roundedBox(0.128, 0.018, 0.088, 0.005, 4), topMetal);
  topCap.name = "top_cap_mesh";
  topCap.position.set(0, 0.008 + 0.145 + 0.0008 + 0.009, 0);
  root.add(topCap);

  // 4. Turned chrome bezel + dial face + articulated needle + crystal glass
  const gaugeGroup = new THREE.Group();
  gaugeGroup.name = "gauge_assembly_grp";
  gaugeGroup.position.set(0, 0.092, 0.045);

  const bezelGeo = latheProfile(
    [
      [0.038, 0],
      [0.045, 0],
      [0.046, 0.006],
      [0.043, 0.01],
      [0.039, 0.01],
      [0.038, 0.002],
    ],
    { segments: 64 },
  );
  bezelGeo.rotateX(Math.PI / 2);
  const bezel = new THREE.Mesh(bezelGeo, chromeMat);
  bezel.name = "gauge_bezel_mesh";
  bezel.position.z = -0.002;
  gaugeGroup.add(bezel);

  const dialTex = labelCanvasTexture(512, 512, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = "#f7f4ec";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#1f2329";
    for (let i = 0; i <= 24; i++) {
      const a = -Math.PI * 1.25 + (i / 24) * Math.PI * 1.5;
      const major = i % 4 === 0;
      ctx.lineWidth = major ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (major ? 175 : 192), cy + Math.sin(a) * (major ? 175 : 192));
      ctx.lineTo(cx + Math.cos(a) * 214, cy + Math.sin(a) * 214);
      ctx.stroke();
    }
  });
  const dialFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.038, 48),
    new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.45 }),
  );
  dialFace.name = "dial_face_mesh";
  dialFace.position.z = -0.009;
  gaugeGroup.add(dialFace);

  const needlePivot = new THREE.Group();
  needlePivot.name = "needle_pivot_grp";
  needlePivot.position.set(0, 0, -0.006);
  const needle = new THREE.Mesh(roundedBox(0.003, 0.03, 0.0015, 0.0006, 2), paintedMetal(0xc92a2a));
  needle.name = "needle_pointer_mesh";
  needle.position.y = 0.011;
  needlePivot.add(needle);
  gaugeGroup.add(needlePivot);

  const crystal = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.003, 48), glassMat);
  crystal.name = "gauge_crystal_mesh";
  crystal.rotation.x = Math.PI / 2;
  crystal.position.z = 0.004;
  gaugeGroup.add(crystal);

  root.add(gaugeGroup);

  // 5. Top rotary control knob
  const knobPivot = new THREE.Group();
  knobPivot.name = "rotary_knob_pivot_grp";
  knobPivot.position.set(0, 0.172, 0);
  const knobGeo = latheProfile(
    [
      [0, 0],
      [0.018, 0],
      [0.019, 0.003],
      [0.017, 0.016],
      [0.015, 0.018],
      [0, 0.018],
    ],
    { segments: 48 },
  );
  const knob = new THREE.Mesh(knobGeo, chromeMat);
  knob.name = "rotary_knob_mesh";
  knobPivot.add(knob);
  root.add(knobPivot);

  const params = { reading: 0.35 };
  const paramSpecs = {
    reading: { min: 0, max: 1, step: 0.01, label: "Meter Reading" },
  };

  function update(state) {
    needlePivot.rotation.z = THREE.MathUtils.lerp(2.1, -2.1, state.reading);
    knobPivot.rotation.y = state.reading * Math.PI * 1.5;
  }

  return {
    root,
    params,
    paramSpecs,
    update,
    metadata: {
      name: "Precision Desk Meter (Starter Template)",
      units: "meters",
    },
  };
}
