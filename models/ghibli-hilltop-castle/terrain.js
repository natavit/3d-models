import * as THREE from "three";
import { deformGeometry, tubeAlong } from "../../src/kit/shapes.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm2(x, z, octaves = 4) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2(x * freq, z * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

export function islandMask(x, z) {
  const warpX = (fbm2(x * 4.2 + 3.1, z * 4.2 + 1.7, 3) - 0.5) * 0.075;
  const warpZ = (fbm2(x * 4.2 + 8.4, z * 4.2 + 5.2, 3) - 0.5) * 0.075;

  const qx = Math.abs(x + warpX) / 0.445;
  const qz = Math.abs(z + warpZ) / 0.395;
  const superDist = Math.pow(Math.pow(qx, 3.4) + Math.pow(qz, 3.4), 1 / 3.4);
  return 1 - superDist;
}

export function ravineProfile(x, z) {
  const rearClosure = THREE.MathUtils.smoothstep(-z, -0.05, 0.11);
  const zClamped = THREE.MathUtils.clamp(z, -0.05, 0.44);
  const spineX = THREE.MathUtils.lerp(0.11, 0.015, (zClamped + 0.05) / 0.49);
  const frontWiden = THREE.MathUtils.smoothstep(z, 0.18, 0.34);
  const halfWidth = THREE.MathUtils.lerp(0.052, 0.135, frontWiden);

  const dx = Math.abs(x - spineX);
  const crossProfile = THREE.MathUtils.smoothstep(dx, halfWidth * 0.55, halfWidth * 1.25);
  return Math.max(crossProfile, rearClosure);
}

export function sampleTerrainInfo(x, z) {
  const mask = islandMask(x, z);
  if (mask <= 0) {
    return { y: 0, grassCover: 0, inIsland: false };
  }

  const rimFactor = THREE.MathUtils.smoothstep(mask, 0.0, 0.14);
  const canyon = ravineProfile(x, z);

  const spineX = THREE.MathUtils.lerp(
    0.11,
    0.015,
    THREE.MathUtils.clamp((z + 0.05) / 0.49, 0, 1),
  );
  const isRightHeadland = x > spineX && z > -0.06;

  let targetPlateauH = 0.285;
  if (!isRightHeadland) {
    const rearRise = THREE.MathUtils.smoothstep(-z, -0.06, 0.26) * 0.06;
    const frontLeftDip =
      THREE.MathUtils.smoothstep(z, 0.06, 0.28) *
      THREE.MathUtils.smoothstep(-x, 0.14, 0.36) *
      0.042;
    targetPlateauH = 0.285 + rearRise - frontLeftDip;
  } else {
    const northProgress = THREE.MathUtils.clamp((0.35 - z) / 0.44, 0, 1);
    const rawH = 0.155 + northProgress * 0.135;
    const stepped = Math.floor(rawH * 24) / 24;
    targetPlateauH = THREE.MathUtils.lerp(rawH, stepped, 0.54);
  }

  const ravineBedH = 0.018 + THREE.MathUtils.clamp((0.36 - z) * 0.04, 0, 0.025);
  let h = THREE.MathUtils.lerp(ravineBedH, targetPlateauH, canyon) * rimFactor;

  h += (fbm2(x * 9, z * 9, 2) - 0.5) * 0.013 * rimFactor;
  h = Math.max(0, h);

  const grassCover =
    THREE.MathUtils.smoothstep(mask, 0.125, 0.205) *
    THREE.MathUtils.smoothstep(canyon, 0.83, 0.96) *
    THREE.MathUtils.smoothstep(h, 0.142, 0.174);

  return { y: h, grassCover, inIsland: true, mask, canyon };
}

/**
 * Builds stratified, horizontally terraced limestone cliff crags with fractured rock planes,
 * crevice AO, and mossy rim staining matching the reference diorama cliffs.
 */
function buildChiseledCliffCrags(palette) {
  const cragGrp = new THREE.Group();
  cragGrp.name = "cliff_chiseled_crags_grp";

  const colorSun = new THREE.Color(0xe6dac2);
  const colorMid = new THREE.Color(0xb6aa95);
  const colorCrevice = new THREE.Color(0x635a4e);
  const colorMoss = new THREE.Color(0x5d7837);
  const tmp = new THREE.Color();

  function makeCragBlock(w, h, d, seed, flatBottom = true) {
    const base = new THREE.BoxGeometry(w, h, d, 6, 9, 6);
    const geo = deformGeometry(base, (v) => {
      const yn = THREE.MathUtils.clamp((v.y + h * 0.5) / Math.max(h, 1e-4), 0, 1);
      // Horizontal sedimentary limestone strata shelves + angular rock facets
      const strataBand = Math.sin(yn * Math.PI * 7.0 + seed * 0.7);
      const shelfOut = Math.pow(Math.abs(strataBand), 0.55) * Math.sign(strataBand) * 0.011;
      const taper = 1 - yn * 0.14;
      const facetA = (hash2(Math.round(v.x * 48) + seed, Math.round(v.z * 48) - seed) - 0.5) * 0.019;
      const facetB = (hash2(seed * 3 + Math.round(v.y * 36), Math.round(v.x * 36)) - 0.5) * 0.019;
      const fissure =
        Math.abs(Math.sin(v.x * 38 + seed) * Math.cos(v.z * 38 - seed)) > 0.78 ? -0.008 : 0;

      v.x = v.x * taper + facetA + Math.sign(v.x || 1) * (shelfOut + fissure);
      v.z = v.z * taper + facetB + Math.sign(v.z || 1) * (shelfOut + fissure);
      if (flatBottom) {
        v.y = Math.max(0, v.y + h * 0.5);
      } else {
        v.y += h * 0.5;
      }
    });

    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const py = THREE.MathUtils.clamp(pos.getY(i) / Math.max(h, 0.01), 0, 1);
      const ny = nrm ? nrm.getY(i) : 0;
      const strataCrevice = Math.sin(py * Math.PI * 7.0 + seed * 0.7);
      const jitter = (hash2(i * 1.3 + seed, seed * 7) - 0.5) * 0.12;
      const lightT = THREE.MathUtils.clamp(py * 0.72 + strataCrevice * 0.18 + jitter, 0, 1);

      if (lightT < 0.36) {
        tmp.copy(colorCrevice).lerp(colorMid, lightT / 0.36);
      } else {
        tmp.copy(colorMid).lerp(colorSun, (lightT - 0.36) / 0.64);
      }
      // Upward-facing rock shelves near top rim catch mossy green tint
      if (ny > 0.48 && py > 0.62) {
        tmp.lerp(colorMoss, THREE.MathUtils.clamp((ny - 0.48) * 1.1, 0, 0.55));
      }
      cols[i * 3] = tmp.r;
      cols[i * 3 + 1] = tmp.g;
      cols[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }

  const perimeterCount = 42;
  for (let i = 0; i < perimeterCount; i++) {
    const a = (i / perimeterCount) * Math.PI * 2;
    const dirX = Math.cos(a);
    const dirZ = Math.sin(a);

    let rRim = 0.35;
    for (let r = 0.25; r <= 0.48; r += 0.008) {
      if (islandMask(dirX * r, dirZ * r) > 0.05) rRim = r;
    }

    const px = dirX * (rRim - 0.03);
    const pz = dirZ * (rRim - 0.03);

    // Keep front ravine archway cove open
    if (pz > 0.24 && px > -0.14 && px < 0.16) continue;

    const infoInner = sampleTerrainInfo(dirX * (rRim - 0.09), dirZ * (rRim - 0.09));
    if (infoInner.y < 0.085) continue;

    // Lower stepped buttress + mid shelf + upper cliff shoulder
    const h1 = infoInner.y * (0.58 + (i % 3) * 0.12);
    const w1 = 0.096 + (i % 4) * 0.018;
    const d1 = 0.086 + ((i + 2) % 3) * 0.016;
    const crag1 = new THREE.Mesh(makeCragBlock(w1, h1, d1, i * 13 + 1, true), palette.cliffRock);
    crag1.name = `cliff_perimeter_crag_low_${i}_mesh`;
    crag1.position.set(px, 0, pz);
    crag1.rotation.y = -a + ((i % 3) - 1) * 0.18;
    cragGrp.add(crag1);

    const h2 = infoInner.y * 0.94;
    const crag2 = new THREE.Mesh(
      makeCragBlock(w1 * 0.84, h2, d1 * 0.84, i * 17 + 5, true),
      palette.cliffRock,
    );
    crag2.name = `cliff_perimeter_crag_high_${i}_mesh`;
    crag2.position.set(dirX * (rRim - 0.056), 0, dirZ * (rRim - 0.056));
    crag2.rotation.y = -a + 0.11;
    cragGrp.add(crag2);
  }

  // Canyon gorge walls & mossy riverside boulders around viaduct piers
  const canyonSpots = [
    [-0.088, 0.125, 0.085, 0.245, 0.085, 0.22],
    [-0.058, 0.032, 0.085, 0.275, 0.085, 0.42],
    [0.186, 0.142, 0.085, 0.215, 0.085, -0.32],
    [0.196, 0.042, 0.085, 0.265, 0.085, -0.22],
    [-0.145, 0.245, 0.075, 0.185, 0.075, 0.15],
    [0.145, 0.265, 0.075, 0.145, 0.075, -0.25],
    // Small boulders nestled at bottom of front ravine cove
    [-0.085, 0.31, 0.036, 0.028, 0.032, 0.4],
    [0.025, 0.345, 0.032, 0.024, 0.028, -0.5],
    [0.115, 0.315, 0.038, 0.03, 0.034, 0.2],
  ];
  canyonSpots.forEach(([cx, cz, cw, ch, cd, rot], idx) => {
    const m = new THREE.Mesh(makeCragBlock(cw, ch, cd, 200 + idx * 9, true), palette.cliffRock);
    m.name = `canyon_wall_crag_${idx}_mesh`;
    m.position.set(cx, 0, cz);
    m.rotation.y = rot;
    cragGrp.add(m);
  });

  return cragGrp;
}

function buildCoreTerrainAndGrassMeshes(palette) {
  const segX = 120;
  const segZ = 112;
  const minX = -0.46;
  const maxX = 0.46;
  const minZ = -0.42;
  const maxZ = 0.42;

  const cols = segX + 1;
  const rows = segZ + 1;
  const gridH = new Float32Array(cols * rows);
  const gridGrass = new Float32Array(cols * rows);
  const gridIn = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    const z = THREE.MathUtils.lerp(minZ, maxZ, r / segZ);
    for (let c = 0; c < cols; c++) {
      const x = THREE.MathUtils.lerp(minX, maxX, c / segX);
      const mask = islandMask(x, z);
      const info = sampleTerrainInfo(x, z);
      const idx = r * cols + c;
      const insideCore = mask > 0.035;
      // Add subtle rock strata ripples on exposed vertical canyon cliffs
      const cliffRipple =
        insideCore && info.grassCover < 0.3
          ? Math.sin(info.y * 85 + fbm2(x * 18, z * 18, 2) * 3.0) * 0.0045
          : 0;
      gridH[idx] = insideCore ? Math.max(0, info.y + cliffRipple) : 0;
      gridGrass[idx] = info.grassCover;
      gridIn[idx] = insideCore ? 1 : 0;
    }
  }

  const rockPos = [];
  const rockCol = [];
  const rockUv = [];
  const rockIdx = [];

  const colorWarm = new THREE.Color(0xe2d6be);
  const colorCool = new THREE.Color(0x9a9080);
  const colorSand = new THREE.Color(0xd6c8ab);
  const colorRavineMoss = new THREE.Color(0x697c46);
  const tmpCol = new THREE.Color();

  for (let r = 0; r < rows; r++) {
    const vUv = r / segZ;
    const z = THREE.MathUtils.lerp(minZ, maxZ, vUv);
    for (let c = 0; c < cols; c++) {
      const uUv = c / segX;
      const x = THREE.MathUtils.lerp(minX, maxX, uUv);
      const idx = r * cols + c;
      const y = gridH[idx];

      rockPos.push(x, y, z);
      rockUv.push(uUv * 4.5, vUv * 4.5);

      const nVar = fbm2(x * 15 + 4, z * 15 + 9, 3);
      if (y < 0.048 && gridIn[idx]) {
        tmpCol.copy(colorSand).lerp(colorRavineMoss, THREE.MathUtils.clamp((nVar - 0.42) * 1.8, 0, 0.55));
      } else {
        tmpCol.copy(colorCool).lerp(colorWarm, THREE.MathUtils.clamp(nVar * 1.25, 0, 1));
        tmpCol.multiplyScalar(
          THREE.MathUtils.lerp(0.62, 1.04, THREE.MathUtils.clamp(y / 0.32, 0, 1)),
        );
      }
      rockCol.push(tmpCol.r, tmpCol.g, tmpCol.b);
    }
  }

  const bottomOffset = cols * rows;
  for (let r = 0; r < rows; r++) {
    const z = THREE.MathUtils.lerp(minZ, maxZ, r / segZ);
    for (let c = 0; c < cols; c++) {
      const x = THREE.MathUtils.lerp(minX, maxX, c / segX);
      rockPos.push(x, 0, z);
      rockUv.push(c / segX, r / segZ);
      rockCol.push(0.44, 0.41, 0.36);
    }
  }

  for (let r = 0; r < segZ; r++) {
    for (let c = 0; c < segX; c++) {
      const i00 = r * cols + c;
      const i10 = i00 + 1;
      const i01 = (r + 1) * cols + c;
      const i11 = i01 + 1;
      if (!(gridIn[i00] && gridIn[i10] && gridIn[i01] && gridIn[i11])) continue;

      rockIdx.push(i00, i01, i11, i00, i11, i10);
      const b00 = bottomOffset + i00;
      const b10 = bottomOffset + i10;
      const b01 = bottomOffset + i01;
      const b11 = bottomOffset + i11;
      rockIdx.push(b00, b11, b01, b00, b10, b11);
    }
  }

  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute("position", new THREE.Float32BufferAttribute(rockPos, 3));
  rockGeo.setAttribute("color", new THREE.Float32BufferAttribute(rockCol, 3));
  rockGeo.setAttribute("uv", new THREE.Float32BufferAttribute(rockUv, 2));
  rockGeo.setIndex(rockIdx);
  rockGeo.computeVertexNormals();

  const rockMesh = new THREE.Mesh(rockGeo, palette.cliffRock);
  rockMesh.name = "limestone_cliff_core_mesh";

  // Plush Overhanging Emerald Grass Turf Cap
  const grassPos = [];
  const grassCol = [];
  const grassUv = [];
  const grassIdx = [];

  const grassSun = new THREE.Color(0x88c93d);
  const grassMid = new THREE.Color(0x4b8923);
  const grassDeep = new THREE.Color(0x2d5b16);

  for (let r = 0; r < rows; r++) {
    const vUv = r / segZ;
    const z = THREE.MathUtils.lerp(minZ, maxZ, vUv);
    for (let c = 0; c < cols; c++) {
      const uUv = c / segX;
      const x = THREE.MathUtils.lerp(minX, maxX, uUv);
      const idx = r * cols + c;
      const gc = gridGrass[idx];
      const turfOffset = gc > 0.02 ? -0.005 + gc * 0.021 : 0;
      const gy = Math.max(0.004, gridH[idx] + turfOffset);
      grassPos.push(x, gy, z);
      grassUv.push(uUv * 7, vUv * 7);

      const patch = fbm2(x * 12 + 2.5, z * 12 - 3.2, 3);
      tmpCol.copy(grassMid).lerp(grassSun, THREE.MathUtils.clamp((patch - 0.25) * 1.45, 0, 1));
      if (gc < 0.5) tmpCol.lerp(grassDeep, (1 - gc / 0.5) * 0.85);
      grassCol.push(tmpCol.r, tmpCol.g, tmpCol.b);
    }
  }

  for (let r = 0; r < segZ; r++) {
    for (let c = 0; c < segX; c++) {
      const i00 = r * cols + c;
      const i10 = i00 + 1;
      const i01 = (r + 1) * cols + c;
      const i11 = i01 + 1;
      if (
        gridGrass[i00] > 0.05 ||
        gridGrass[i10] > 0.05 ||
        gridGrass[i01] > 0.05 ||
        gridGrass[i11] > 0.05
      ) {
        grassIdx.push(i00, i01, i11, i00, i11, i10);
      }
    }
  }

  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute("position", new THREE.Float32BufferAttribute(grassPos, 3));
  grassGeo.setAttribute("color", new THREE.Float32BufferAttribute(grassCol, 3));
  grassGeo.setAttribute("uv", new THREE.Float32BufferAttribute(grassUv, 2));
  grassGeo.setIndex(grassIdx);
  grassGeo.computeVertexNormals();

  const grassMesh = new THREE.Mesh(grassGeo, palette.lushGrass);
  grassMesh.name = "grassy_terraces_cap_mesh";

  return { rockMesh, grassMesh };
}

/**
 * 18,000 Instanced 3D Curved Grass Blades across all grassy hillsides & rims (single draw call).
 */
function buildInstancedMeadowGrass(palette) {
  // 3-segment curved tapered blade (7 vertices, 5 triangles)
  const w0 = 0.0028;
  const w1 = 0.0021;
  const w2 = 0.0012;
  const h = 0.017;
  const pos = new Float32Array([
    -w0, 0.0, 0.0,
    w0, 0.0, 0.0,
    -w1, h * 0.38, 0.0014,
    w1, h * 0.38, 0.0014,
    -w2, h * 0.74, 0.0038,
    w2, h * 0.74, 0.0038,
    0.0, h, 0.0068,
  ]);
  // Root-to-tip gradient: deep mossy root -> rich meadow mid -> warm sunlit chartreuse tip
  const col = new Float32Array([
    0.26, 0.46, 0.14,
    0.26, 0.46, 0.14,
    0.42, 0.72, 0.22,
    0.42, 0.72, 0.22,
    0.64, 0.88, 0.32,
    0.64, 0.88, 0.32,
    0.84, 0.96, 0.44,
  ]);
  const idx = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6];

  const bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  bladeGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  bladeGeo.setIndex(idx);
  bladeGeo.computeVertexNormals();
  // Tilt normals slightly upward so hillside grass catches soft sky/sun light evenly without harsh backfaces
  const nrm = bladeGeo.attributes.normal;
  for (let i = 0; i < nrm.count; i++) {
    const v = new THREE.Vector3(nrm.getX(i) * 0.35, 0.88, nrm.getZ(i) * 0.35).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }

  // Exclusion zones under solid castle building footprints so blades don't poke through floors
  function insideBuildingFootprint(x, z) {
    // West manor wing
    if (x > -0.32 && x < -0.17 && z > -0.155 && z < 0.105) return true;
    // Cross hall & courtyard gable
    if (x > -0.21 && x < 0.05 && z > -0.18 && z < -0.02) return true;
    // Gatehouse
    if (x > -0.18 && x < -0.04 && z > 0.09 && z < 0.20) return true;
    // Keep & flanking turrets
    if (Math.hypot(x + 0.015, z + 0.205) < 0.105) return true;
    if (Math.hypot(x + 0.155, z + 0.205) < 0.06) return true;
    if (Math.hypot(x - 0.132, z + 0.155) < 0.056) return true;
    // Windmill stone base
    if (Math.hypot(x - 0.295, z + 0.025) < 0.092) return true;
    return false;
  }

  const rand = mulberry32(7717);
  const placements = [];
  const maxBlades = 17500;
  let attempts = 0;

  while (placements.length < maxBlades && attempts < 85000) {
    attempts++;
    const x = (rand() * 2 - 1) * 0.44;
    const z = (rand() * 2 - 1) * 0.40;
    if (insideBuildingFootprint(x, z)) continue;

    const info = sampleTerrainInfo(x, z);
    if (!info.inIsland || info.grassCover < 0.14) continue;
    // Reject steep vertical ravine cliff walls
    const hDx = sampleTerrainInfo(x + 0.008, z).y - info.y;
    const hDz = sampleTerrainInfo(x, z + 0.008).y - info.y;
    const slope = Math.hypot(hDx, hDz) / 0.008;
    if (slope > 1.35) continue;

    const turfY = info.y - 0.004 + info.grassCover * 0.02;
    placements.push({ x, y: turfY, z, gc: info.grassCover, hDx, hDz });
  }

  const mesh = new THREE.InstancedMesh(bladeGeo, palette.grassBlade, placements.length);
  mesh.name = "meadow_grass_blades_instanced_mesh";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.noAO = true;
  mesh.userData.isExplodeTrim = true;

  const dummy = new THREE.Object3D();
  const cCool = new THREE.Color(0x78b85a);
  const cWarm = new THREE.Color(0xbce874);
  const cRim = new THREE.Color(0x639c44);
  const instCol = new THREE.Color();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    dummy.position.set(p.x, p.y, p.z);
    // Gentle prevailing breeze lean + natural random tuft splay
    const yaw = rand() * Math.PI * 2;
    const lean = 0.12 + rand() * 0.24;
    dummy.rotation.set(lean - p.hDz * 8.0, yaw, p.hDx * 8.0);
    const sW = 0.8 + rand() * 0.55;
    const sH = (0.65 + rand() * 0.78) * THREE.MathUtils.lerp(0.65, 1.15, p.gc);
    dummy.scale.set(sW, sH, sW);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const patch = fbm2(p.x * 10 + 1.4, p.z * 10 - 2.7, 3);
    instCol.copy(cCool).lerp(cWarm, THREE.MathUtils.clamp((patch - 0.22) * 1.5, 0, 1));
    if (p.gc < 0.45) instCol.lerp(cRim, 1 - p.gc / 0.45);
    mesh.setColorAt(i, instCol);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * ~850 Instanced Mossy Shrubs & Cliff-Ledge Foliage Clumps hugging rocky rims, terrace steps & walls.
 */
function buildInstancedMossAndShrubs(palette) {
  // Indexed SphereGeometry produces 100% smooth billowy foliage normals (zero flat crystal facets)
  const clumpGeo = deformGeometry(new THREE.SphereGeometry(1, 16, 12), (v) => {
    const lump =
      1 +
      0.2 * Math.sin(v.x * 5.2 + 0.7) * Math.cos(v.z * 5.2 - 0.4) +
      0.12 * Math.sin(v.y * 6.2 + v.x * 3.1);
    const ySquash = v.y < 0 ? 0.52 : 0.86;
    v.set(v.x * lump, v.y * lump * ySquash, v.z * lump);
  });

  const pos = clumpGeo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const cBot = new THREE.Color(0x224614);
  const cTop = new THREE.Color(0x7ab839);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + 0.55) / 1.4, 0, 1);
    tmp.copy(cBot).lerp(cTop, t);
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  clumpGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));

  const rand = mulberry32(9021);
  const spots = [];

  // 1) Cliff-rim & canyon-edge overhanging moss/bush clusters
  for (let i = 0; i < 6500 && spots.length < 620; i++) {
    const x = (rand() * 2 - 1) * 0.44;
    const z = (rand() * 2 - 1) * 0.40;
    const info = sampleTerrainInfo(x, z);
    if (!info.inIsland) continue;

    const isRimEdge = info.grassCover > 0.05 && info.grassCover < 0.68 && info.y > 0.13;
    const isTerraceStep =
      x > 0.08 && z > -0.02 && info.grassCover > 0.5 && Math.abs(Math.sin(info.y * Math.PI * 24)) > 0.86;
    const isRavineMoss = info.y < 0.046 && z > 0.16 && z < 0.37 && rand() > 0.7;

    if (!(isRimEdge || isTerraceStep || isRavineMoss)) continue;
    const r = isRavineMoss ? 0.007 + rand() * 0.009 : 0.008 + rand() * 0.012;
    const yOff = isRavineMoss ? 0.005 : info.grassCover * 0.012;
    spots.push({ x, y: Math.max(r * 0.85, info.y + yOff), z, r });
  }

  // 2) Foundation shrubs hugging stone walls, viaduct abutments & windmill base
  const foundationAnchors = [
    [-0.17, 0.16], [-0.06, 0.16], [0.01, 0.12], [-0.25, 0.10], [-0.32, 0.02],
    [-0.32, -0.10], [0.22, -0.04], [0.23, 0.04], [0.36, -0.05], [0.20, 0.30],
    [0.14, 0.31], [-0.12, 0.20], [0.06, 0.05], [0.15, 0.07],
  ];
  for (const [ax, az] of foundationAnchors) {
    for (let k = 0; k < 8; k++) {
      const x = ax + (rand() - 0.5) * 0.055;
      const z = az + (rand() - 0.5) * 0.055;
      const info = sampleTerrainInfo(x, z);
      if (!info.inIsland) continue;
      const r = 0.009 + rand() * 0.012;
      spots.push({
        x,
        y: Math.max(r * 0.85, info.y + 0.009),
        z,
        r,
      });
    }
  }

  const mesh = new THREE.InstancedMesh(clumpGeo, palette.mossFoliage, spots.length);
  mesh.name = "cliff_moss_and_shrubs_instanced_mesh";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isExplodeTrim = true;

  const dummy = new THREE.Object3D();
  const tintA = new THREE.Color(0x78b552);
  const tintB = new THREE.Color(0x528e38);
  const tintC = new THREE.Color(0x98cc5c);
  const cInst = new THREE.Color();

  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set((rand() - 0.5) * 0.22, rand() * Math.PI * 2, (rand() - 0.5) * 0.22);
    dummy.scale.set(s.r * (1.05 + rand() * 0.3), s.r * (0.68 + rand() * 0.2), s.r * (1.0 + rand() * 0.3));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const pick = rand();
    if (pick < 0.45) cInst.copy(tintA);
    else if (pick < 0.82) cInst.copy(tintB);
    else cInst.copy(tintC);
    mesh.setColorAt(i, cInst);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

export function createGhibliTree(palette, { scale = 1.0, seed = 1, namePrefix = "tree" } = {}) {
  const grp = new THREE.Group();
  grp.name = `${namePrefix}_grp`;
  const rand = mulberry32(seed * 97 + 13);

  // Gnarled main trunk + forked upper limbs (clamped >= 0 in local y when groundY is near 0)
  const trunkPts = [
    [0, 0.0, 0],
    [0.005 * scale, 0.028 * scale, 0.003 * scale],
    [-0.004 * scale, 0.058 * scale, -0.003 * scale],
    [0.002 * scale, 0.088 * scale, 0.001 * scale],
  ];
  const trunk = new THREE.Mesh(
    tubeAlong(trunkPts, { radius: 0.009 * scale, tubularSegments: 14, radialSegments: 10 }),
    palette.darkTimber,
  );
  trunk.name = `${namePrefix}_trunk_mesh`;
  grp.add(trunk);

  const limbSpecs = [
    [
      [-0.002 * scale, 0.056 * scale, -0.002 * scale],
      [-0.026 * scale, 0.082 * scale, 0.014 * scale],
    ],
    [
      [0.001 * scale, 0.062 * scale, 0.0],
      [0.026 * scale, 0.085 * scale, 0.012 * scale],
    ],
    [
      [0.0, 0.064 * scale, -0.002 * scale],
      [0.006 * scale, 0.084 * scale, -0.024 * scale],
    ],
  ];
  limbSpecs.forEach((pts, bi) => {
    const limb = new THREE.Mesh(
      tubeAlong(pts, { radius: 0.0048 * scale, tubularSegments: 8, radialSegments: 7 }),
      palette.darkTimber,
    );
    limb.name = `${namePrefix}_limb_${bi}_mesh`;
    grp.add(limb);
  });

  // Smooth indexed SphereGeometry for plush Ghibli bonsai leaf tufts (zero flat icosahedron facets)
  const baseLeafGeo = deformGeometry(new THREE.SphereGeometry(1, 18, 14), (v) => {
    const billow =
      1 +
      0.16 * Math.sin(v.x * 5.2 + seed) * Math.cos(v.z * 5.2 - seed) +
      0.10 * Math.sin(v.y * 6.0);
    v.multiplyScalar(billow);
  });

  const canopyPuffs = [
    // Lower shady boughs
    [-0.032, 0.082, 0.016, 0.024],
    [0.032, 0.084, 0.014, 0.023],
    [0.014, 0.08, -0.028, 0.024],
    [-0.022, 0.084, -0.022, 0.023],
    [0.0, 0.082, 0.03, 0.022],
    [-0.036, 0.092, -0.004, 0.021],
    [0.035, 0.092, -0.008, 0.021],
    // Mid billowy crown
    [0.0, 0.1, 0.0, 0.03],
    [-0.022, 0.104, 0.016, 0.024],
    [0.023, 0.105, 0.012, 0.023],
    [0.012, 0.102, -0.02, 0.023],
    [-0.018, 0.106, -0.016, 0.022],
    [0.004, 0.104, 0.024, 0.021],
    // Upper sunlit Ghibli foliage tufts
    [-0.012, 0.122, 0.008, 0.022],
    [0.014, 0.12, 0.004, 0.021],
    [-0.002, 0.122, -0.012, 0.021],
    [0.0, 0.134, 0.002, 0.019],
    [-0.016, 0.114, -0.004, 0.019],
  ];

  const cShadow = new THREE.Color(0x204b15);
  const cMid = new THREE.Color(0x468624);
  const cSun = new THREE.Color(0x9be04a);
  const tmpCol = new THREE.Color();

  canopyPuffs.forEach(([px, py, pz, r], i) => {
    const geo = baseLeafGeo.clone();
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const puffHeightNorm = THREE.MathUtils.clamp((py - 0.075) / 0.062, 0, 1);

    for (let k = 0; k < pos.count; k++) {
      const vx = pos.getX(k);
      const vy = pos.getY(k);
      const vz = pos.getZ(k);
      // Sun from upper-left-front (-X, +Y, +Z)
      const sunDot = (-vx * 0.42 + vy * 0.72 + vz * 0.35) * 0.5 + 0.5;
      const light = THREE.MathUtils.clamp(
        sunDot * 0.62 + puffHeightNorm * 0.42 + (rand() - 0.5) * 0.06,
        0,
        1,
      );
      if (light < 0.45) {
        tmpCol.copy(cShadow).lerp(cMid, light / 0.45);
      } else {
        tmpCol.copy(cMid).lerp(cSun, (light - 0.45) / 0.55);
      }
      cols[k * 3] = tmpCol.r;
      cols[k * 3 + 1] = tmpCol.g;
      cols[k * 3 + 2] = tmpCol.b;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));

    const m = new THREE.Mesh(geo, i % 2 === 0 ? palette.treeFoliageA : palette.treeFoliageB);
    m.name = `${namePrefix}_canopy_${i}_mesh`;
    m.position.set(px * scale, py * scale, pz * scale);
    const squash = 0.8 + ((seed + i) % 3) * 0.06;
    m.scale.set(r * scale, r * scale * squash, r * scale);
    grp.add(m);
  });

  return grp;
}

export function buildTerrainLayer(palette) {
  const terrainGrp = new THREE.Group();
  terrainGrp.name = "layer_terrain_grp";

  const { rockMesh, grassMesh } = buildCoreTerrainAndGrassMeshes(palette);
  const cragRing = buildChiseledCliffCrags(palette);
  const grassBlades = buildInstancedMeadowGrass(palette);
  const mossAndShrubs = buildInstancedMossAndShrubs(palette);

  terrainGrp.add(rockMesh, cragRing, grassMesh, grassBlades, mossAndShrubs);

  // Textured cobble/dirt footpaths on right headland & upper courtyard
  const pathPts = [
    [0.215, 0.168, 0.3],
    [0.275, 0.19, 0.245],
    [0.255, 0.24, 0.155],
    [0.195, 0.28, 0.085],
    [0.255, 0.288, 0.015],
  ];
  const headlandPath = new THREE.Mesh(
    tubeAlong(pathPts, { radius: 0.017, tubularSegments: 36, radialSegments: 10 }),
    palette.dirtPath,
  );
  headlandPath.name = "headland_footpath_mesh";
  headlandPath.geometry = deformGeometry(headlandPath.geometry, (v) => {
    const base = sampleTerrainInfo(v.x, v.z).y;
    v.y = base + 0.012 + (v.y - base) * 0.2;
  });
  terrainGrp.add(headlandPath);

  const floraGrp = new THREE.Group();
  floraGrp.name = "ghibli_trees_and_shrubs_grp";

  const treePlacements = [
    { x: -0.365, z: 0.065, scale: 1.18, name: "west_cliff_hero_tree" },
    { x: 0.34, z: 0.105, scale: 0.96, name: "windmill_terrace_tree_a" },
    { x: 0.288, z: 0.17, scale: 0.76, name: "windmill_terrace_tree_b" },
    { x: 0.195, z: -0.2, scale: 0.82, name: "east_turret_tree" },
    { x: -0.31, z: -0.22, scale: 0.85, name: "northwest_cliff_tree" },
  ];

  treePlacements.forEach((tp, idx) => {
    const groundY = Math.max(0.01, sampleTerrainInfo(tp.x, tp.z).y);
    const tree = createGhibliTree(palette, {
      scale: tp.scale,
      seed: idx + 1,
      namePrefix: tp.name,
    });
    tree.position.set(tp.x, groundY, tp.z);
    floraGrp.add(tree);
  });

  terrainGrp.add(floraGrp);
  return terrainGrp;
}
