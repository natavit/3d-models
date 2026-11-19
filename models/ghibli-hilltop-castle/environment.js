import * as THREE from "three";
import { deformGeometry, latheProfile, roundedBox, tubeAlong } from "../../src/kit/shapes.js";
import { createGhibliTree } from "./terrain.js";

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

/**
 * Builds a multi-lobed cauliflower cumulus cluster with analytical 3D inter-puff ambient occlusion
 * baked into vertex color channel R and normalized bank height in channel G for the volumetric shader.
 */
function createCumulusCluster(puffSpecs, material, namePrefix = "cloud", seed = 1) {
  const grp = new THREE.Group();
  grp.name = `${namePrefix}_grp`;
  grp.userData.noAO = true;

  const sharedSphere = new THREE.SphereGeometry(1, 32, 24);

  let minBankY = Infinity;
  let maxBankY = -Infinity;
  for (const [px, py, , , ry] of puffSpecs) {
    if (py - ry < minBankY) minBankY = py - ry;
    if (py + ry > maxBankY) maxBankY = py + ry;
  }
  const bankSpanY = Math.max(maxBankY - minBankY, 0.05);

  puffSpecs.forEach(([px, py, pz, rx, ry, rz], idx) => {
    const ph = seed * 1.7 + idx * 2.3;
    const geo = deformGeometry(sharedSphere, (v) => {
      // Multi-frequency cauliflower cumulus lobes (round boiling tops, flatter bases)
      const b1 = Math.sin(v.x * 3.8 + ph) * Math.cos(v.z * 3.6 - ph * 0.7);
      const b2 = Math.sin(v.y * 5.4 + v.x * 3.1 + idx) * Math.cos(v.z * 4.9 + ph);
      const b3 = 1 - Math.abs(Math.sin(v.x * 7.5 - ph) * Math.cos(v.y * 7.2 + idx));
      const billow = 1 + 0.13 * b1 + 0.08 * b2 + 0.06 * b3;
      const ySquash = v.y < 0 ? 0.56 : 1.06;
      v.set(v.x * rx * billow, v.y * ry * billow * ySquash, v.z * rz * billow);
    });

    const pos = geo.attributes.position;
    const meta = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const wx = px + pos.getX(i);
      const wy = py + pos.getY(i);
      const wz = pz + pos.getZ(i);

      // Compute analytical multi-sphere crease occlusion from neighboring puffs in this cluster
      let occ = 1.0;
      for (let j = 0; j < puffSpecs.length; j++) {
        if (j === idx) continue;
        const [ox, oy, oz, orx, ory, orz] = puffSpecs[j];
        const dx = (wx - ox) / Math.max(orx, 1e-3);
        const dy = (wy - oy) / Math.max(ory, 1e-3);
        const dz = (wz - oz) / Math.max(orz, 1e-3);
        const normDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Vertices near/inside neighbor puff pockets darken smoothly like Cycles volume crevices
        const crease = THREE.MathUtils.smoothstep(normDist, 0.78, 1.48);
        occ *= THREE.MathUtils.lerp(0.56, 1.0, crease);
      }

      const bankH = THREE.MathUtils.clamp((wy - minBankY) / bankSpanY, 0, 1);
      const localUp = THREE.MathUtils.clamp(pos.getY(i) / Math.max(ry, 1e-3) * 0.5 + 0.5, 0, 1);
      const finalAO = THREE.MathUtils.clamp(occ * (0.62 + 0.38 * localUp), 0.22, 1.0);

      meta[i * 3] = finalAO;
      meta[i * 3 + 1] = bankH;
      meta[i * 3 + 2] = ((idx * 37 + seed) % 100) / 100;
    }

    geo.setAttribute("color", new THREE.Float32BufferAttribute(meta, 3));

    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `${namePrefix}_puff_${idx}_mesh`;
    mesh.position.set(px, py, pz);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.noAO = true;
    grp.add(mesh);
  });

  return grp;
}

function makeRichBankSpecs(scaleX, scaleY, scaleZ, seed = 1) {
  const rand = mulberry32(seed);
  const specs = [
    [0, 0.02 * scaleY, 0, 0.26 * scaleX, 0.16 * scaleY, 0.22 * scaleZ],
    [-0.18 * scaleX, -0.02 * scaleY, 0.06 * scaleZ, 0.21 * scaleX, 0.13 * scaleY, 0.18 * scaleZ],
    [0.19 * scaleX, -0.015 * scaleY, -0.05 * scaleZ, 0.22 * scaleX, 0.14 * scaleY, 0.18 * scaleZ],
    [-0.07 * scaleX, 0.09 * scaleY, -0.03 * scaleZ, 0.17 * scaleX, 0.14 * scaleY, 0.16 * scaleZ],
    [0.09 * scaleX, 0.08 * scaleY, 0.04 * scaleZ, 0.16 * scaleX, 0.13 * scaleY, 0.15 * scaleZ],
    [0.01 * scaleX, 0.14 * scaleY, 0.01 * scaleZ, 0.13 * scaleX, 0.11 * scaleY, 0.12 * scaleZ],
  ];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rand() * 0.8;
    const rr = 0.14 + rand() * 0.12;
    specs.push([
      Math.cos(a) * rr * scaleX,
      (-0.03 + rand() * 0.09) * scaleY,
      Math.sin(a) * rr * scaleZ,
      (0.11 + rand() * 0.06) * scaleX,
      (0.08 + rand() * 0.05) * scaleY,
      (0.11 + rand() * 0.05) * scaleZ,
    ]);
  }
  return specs;
}

/**
 * Instanced soft FBM cloud-wisp tendrils wrapping around the cliff base, front ravine cove,
 * and cloud-bank crests so solid rock blends seamlessly into misty cumulus vapor.
 */
function buildCloudWispTendrils(wispMaterial) {
  const rand = mulberry32(4242);
  const wispSpecs = [];

  // 1) Misty collar outside the cliff perimeter (kept outside rock radius so sprites never hard-clip rock!)
  const collarCount = 72;
  for (let i = 0; i < collarCount; i++) {
    const a = (i / collarCount) * Math.PI * 2 + (rand() - 0.5) * 0.05;
    const isFrontArchZone = Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.42;
    const rad = (isFrontArchZone ? 0.58 : 0.54) + rand() * 0.22;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const y = (isFrontArchZone ? -0.045 : -0.03) + rand() * 0.05;
    const sx = 0.2 + rand() * 0.14;
    const sy = sx * (0.55 + rand() * 0.2);
    const sunSide = THREE.MathUtils.clamp(0.76 - x * 0.25 + y * 1.2, 0.48, 1.04);
    const opacity = isFrontArchZone ? 0.22 + rand() * 0.12 : 0.28 + rand() * 0.16;
    wispSpecs.push({ x, y, z, sx, sy, light: sunSide, opacity });
  }

  // 2) Foreground & mid sea-of-clouds feathery surface mist
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const rad = 0.72 + Math.pow(rand(), 0.75) * 1.5;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    // Keep rear mist low so upper cerulean sky stays open
    const rearDrop = z < 0 ? z * 0.12 : 0;
    const y = -0.15 + rearDrop + rand() * 0.11;
    const sx = 0.26 + rand() * 0.26;
    const sy = sx * (0.5 + rand() * 0.18);
    const sunSide = THREE.MathUtils.clamp(0.78 - x * 0.14 + (y + 0.15) * 1.1, 0.45, 1.04);
    wispSpecs.push({ x, y, z, sx, sy, light: sunSide, opacity: 0.24 + rand() * 0.16 });
  }

  // 3) Soft sunlit fringes around the central thunderhead only
  for (let i = 0; i < 28; i++) {
    const spreadX = (rand() * 2 - 1) * 0.65;
    const spreadY = 0.12 + rand() * 0.68;
    const lx = -0.96 + spreadX * 0.75;
    const ly = -0.14 + spreadY;
    const lz = -1.48 + (rand() - 0.5) * 0.25 - spreadX * 0.3;
    const sx = 0.26 + rand() * 0.2;
    const sy = sx * (0.72 + rand() * 0.18);
    const sunSide = THREE.MathUtils.clamp(0.68 + spreadY * 0.32 - spreadX * 0.15, 0.52, 1.06);
    wispSpecs.push({ x: lx, y: ly, z: lz, sx, sy, light: sunSide, opacity: 0.28 + rand() * 0.16 });
  }

  const quadGeo = new THREE.PlaneGeometry(1, 1);
  const inst = new THREE.InstancedMesh(quadGeo, wispMaterial, wispSpecs.length);
  inst.name = "volumetric_cloud_wisps_instanced_mesh";
  inst.castShadow = false;
  inst.receiveShadow = false;
  inst.renderOrder = 2;
  inst.userData.noAO = true;

  const dummy = new THREE.Object3D();
  const cAttr = new THREE.Color();
  wispSpecs.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);

    cAttr.setRGB(w.light, 0.5, w.opacity);
    inst.setColorAt(i, cAttr);
  });

  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingBox();
  inst.computeBoundingSphere();
  return inst;
}

function buildFloatingIslet(palette, scale = 1.0, seed = 1) {
  const grp = new THREE.Group();
  grp.name = `floating_islet_${seed}_grp`;

  const rockBase = new THREE.SphereGeometry(0.118 * scale, 16, 14);
  const rockGeo = deformGeometry(rockBase, (v) => {
    const ny = v.y / (0.118 * scale);
    if (ny > 0.14) {
      v.y = 0.022 * scale;
    } else {
      const depthT = (0.14 - ny) / 1.14;
      const taper = 1 - 0.74 * Math.pow(depthT, 0.82);
      const crag =
        1 +
        0.24 * Math.sin(v.x * 58 + seed * 2.1) * Math.cos(v.z * 58 - seed * 1.7) +
        0.14 * Math.cos(depthT * 14 + seed);
      v.x *= taper * crag;
      v.z *= taper * crag;
      v.y = (0.022 - depthT * 0.155) * scale;
    }
  });

  const rPos = rockGeo.attributes.position;
  const rCols = new Float32Array(rPos.count * 3);
  for (let i = 0; i < rPos.count; i++) {
    const yn = THREE.MathUtils.clamp((rPos.getY(i) / (0.15 * scale) + 1) * 0.8, 0, 1);
    const shade = THREE.MathUtils.lerp(0.46, 0.98, yn);
    rCols[i * 3] = 0.74 * shade;
    rCols[i * 3 + 1] = 0.68 * shade;
    rCols[i * 3 + 2] = 0.58 * shade;
  }
  rockGeo.setAttribute("color", new THREE.Float32BufferAttribute(rCols, 3));

  const rock = new THREE.Mesh(rockGeo, palette.cliffRock);
  rock.name = `floating_islet_${seed}_rock_mesh`;
  grp.add(rock);

  // Overhanging emerald meadow turf + bushy rim clumps
  const turfGeo = deformGeometry(new THREE.SphereGeometry(0.12 * scale, 22, 14), (v) => {
    const warp = 1 + 0.09 * Math.sin(v.x * 36 + seed) * Math.cos(v.z * 36);
    v.x *= warp;
    v.z *= warp;
    v.y = v.y * 0.2 + 0.026 * scale;
  });
  const tPos = turfGeo.attributes.position;
  const tCols = new Float32Array(tPos.count * 3);
  for (let i = 0; i < tPos.count; i++) {
    const topBias = THREE.MathUtils.clamp((tPos.getY(i) / Math.max(0.03 * scale, 1e-3)), 0, 1);
    tCols[i * 3] = THREE.MathUtils.lerp(0.26, 0.54, topBias);
    tCols[i * 3 + 1] = THREE.MathUtils.lerp(0.54, 0.84, topBias);
    tCols[i * 3 + 2] = THREE.MathUtils.lerp(0.15, 0.26, topBias);
  }
  turfGeo.setAttribute("color", new THREE.Float32BufferAttribute(tCols, 3));
  const turf = new THREE.Mesh(turfGeo, palette.lushGrass);
  turf.name = `floating_islet_${seed}_grass_mesh`;
  grp.add(turf);

  // Mossy rim shrub tufts around each floating sky-islet
  const shrubGeo = deformGeometry(new THREE.SphereGeometry(1, 12, 10), (v) => {
    v.y *= 0.68;
  });
  const sPos = shrubGeo.attributes.position;
  const sCols = new Float32Array(sPos.count * 3);
  for (let i = 0; i < sPos.count; i++) {
    const t = THREE.MathUtils.clamp((sPos.getY(i) + 0.6) / 1.3, 0, 1);
    sCols[i * 3] = THREE.MathUtils.lerp(0.2, 0.52, t);
    sCols[i * 3 + 1] = THREE.MathUtils.lerp(0.45, 0.82, t);
    sCols[i * 3 + 2] = THREE.MathUtils.lerp(0.12, 0.25, t);
  }
  shrubGeo.setAttribute("color", new THREE.Float32BufferAttribute(sCols, 3));
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2 + seed;
    const rr = (0.072 + (k % 3) * 0.016) * scale;
    const sr = (0.014 + (k % 2) * 0.005) * scale;
    const bush = new THREE.Mesh(shrubGeo, palette.mossFoliage);
    bush.name = `islet_${seed}_rim_shrub_${k}_mesh`;
    bush.position.set(Math.cos(ang) * rr, 0.032 * scale, Math.sin(ang) * rr);
    bush.scale.setScalar(sr);
    grp.add(bush);
  }

  const tree1 = createGhibliTree(palette, {
    scale: 0.52 * scale,
    seed,
    namePrefix: `islet_${seed}_tree_a`,
  });
  tree1.position.set(-0.026 * scale, 0.032 * scale, 0.012 * scale);
  grp.add(tree1);

  if (scale > 0.68) {
    const tree2 = createGhibliTree(palette, {
      scale: 0.38 * scale,
      seed: seed + 5,
      namePrefix: `islet_${seed}_tree_b`,
    });
    tree2.position.set(0.038 * scale, 0.032 * scale, -0.02 * scale);
    grp.add(tree2);
  }

  return grp;
}

function buildMultiBalloonAirship(palette) {
  const ship = new THREE.Group();
  ship.name = "ghibli_airship_grp";

  // Wooden sky-galleon hull with bowsprit & outrigger fins matching reference upper-right airship
  const hullGeo = deformGeometry(roundedBox(0.125, 0.03, 0.038, 0.008, 3), (v) => {
    const endTaper = 1 - 0.38 * Math.pow(Math.abs(v.x) / 0.062, 2);
    v.z *= endTaper;
    if (v.y < 0) v.z *= 0.72;
  });
  const hull = new THREE.Mesh(hullGeo, palette.warmPlank);
  hull.name = "airship_gondola_hull_mesh";
  ship.add(hull);

  // Bowsprit spar
  const bowsprit = new THREE.Mesh(
    tubeAlong(
      [
        [0.052, 0.006, 0],
        [0.095, 0.018, 0],
      ],
      { radius: 0.0022, tubularSegments: 6, radialSegments: 6 },
    ),
    palette.darkTimber,
  );
  bowsprit.name = "airship_bowsprit_mesh";
  ship.add(bowsprit);

  // Deckhouse cabin + glowing stern gallery windows
  const cabin = new THREE.Mesh(roundedBox(0.066, 0.02, 0.028, 0.003, 2), palette.creamStucco);
  cabin.name = "airship_cabin_mesh";
  cabin.position.set(-0.004, 0.02, 0);
  ship.add(cabin);

  for (const sz of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.008), palette.windowGlow);
    win.name = "airship_cabin_window_mesh";
    win.position.set(-0.004, 0.021, sz * 0.0145);
    if (sz < 0) win.rotation.y = Math.PI;
    ship.add(win);

    // Horizontal canvas outrigger fins
    const fin = new THREE.Mesh(roundedBox(0.042, 0.0025, 0.024, 0.001, 1), palette.sailCanvas);
    fin.name = "airship_side_fin_mesh";
    fin.position.set(-0.018, 0.004, sz * 0.026);
    fin.rotation.x = sz * 0.12;
    ship.add(fin);
  }

  // 5 Ribbed Cream Gasbags with Dark Meridian Rope Netting Bands
  const balloonGeo = latheProfile(
    [
      [0, -0.062],
      [0.026, -0.05],
      [0.044, -0.02],
      [0.046, 0.016],
      [0.034, 0.048],
      [0, 0.064],
    ],
    { segments: 24 },
  );
  balloonGeo.rotateZ(Math.PI / 2);

  const hoopGeo = new THREE.TorusGeometry(0.045, 0.0014, 6, 20);
  hoopGeo.rotateY(Math.PI / 2);

  const balloonSpots = [
    [0.0, 0.088, 0.0, 1.15, 0.92, 0.92],
    [-0.018, 0.074, 0.046, 0.78, 0.72, 0.72],
    [-0.018, 0.074, -0.046, 0.78, 0.72, 0.72],
    [0.052, 0.072, 0.024, 0.64, 0.62, 0.62],
    [-0.055, 0.07, -0.018, 0.62, 0.6, 0.6],
  ];

  balloonSpots.forEach(([bx, by, bz, sx, sy, sz], i) => {
    const bagGrp = new THREE.Group();
    bagGrp.name = `airship_gasbag_${i}_grp`;
    bagGrp.position.set(bx, by, bz);
    bagGrp.scale.set(sx, sy, sz);

    const bag = new THREE.Mesh(balloonGeo, palette.sailCanvas);
    bag.name = `airship_gasbag_${i}_mesh`;
    bagGrp.add(bag);

    for (const hx of [-0.026, 0.0, 0.026]) {
      const sRing = 1 - Math.abs(hx) * 5.2;
      const hoop = new THREE.Mesh(hoopGeo, palette.darkTimber);
      hoop.name = `airship_net_band_${i}_mesh`;
      hoop.position.x = hx;
      hoop.scale.set(1, sRing, sRing);
      bagGrp.add(hoop);
    }
    ship.add(bagGrp);

    // Twin rigging suspension cables down to hull gunwales
    for (const rOff of [-0.018, 0.018]) {
      const cable = new THREE.Mesh(
        tubeAlong(
          [
            [bx * 0.55 + rOff, 0.016, bz * 0.32],
            [bx + rOff, by - 0.026 * sy, bz],
          ],
          { radius: 0.001, tubularSegments: 4, radialSegments: 5 },
        ),
        palette.darkTimber,
      );
      cable.name = `airship_rigging_${i}_mesh`;
      ship.add(cable);
    }
  });

  const rudder = new THREE.Mesh(roundedBox(0.026, 0.032, 0.003, 0.001, 1), palette.redPennant);
  rudder.name = "airship_rudder_mesh";
  rudder.position.set(-0.07, 0.008, 0);
  ship.add(rudder);

  const propPivot = new THREE.Group();
  propPivot.name = "airship_propeller_pivot_grp";
  propPivot.position.set(-0.064, -0.004, 0);
  for (let b = 0; b < 2; b++) {
    const blade = new THREE.Mesh(
      roundedBox(0.003, 0.03, 0.005, 0.001, 1),
      palette.weatheredBrass,
    );
    blade.name = `airship_prop_blade_${b}_mesh`;
    blade.rotation.x = (b * Math.PI) / 2;
    propPivot.add(blade);
  }
  ship.add(propPivot);

  return { group: ship, propPivot };
}

function createGhibliSkyDome() {
  const uniforms = {
    uDusk: { value: 0.16 },
  };

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uDusk;
      varying vec3 vDir;

      void main() {
        float elev = vDir.y;

        // Calibrated to the 24-deg elevated studio camera (vDir.y spans -0.58 bottom .. -0.20 top)
        // so the upper sky renders deep Ghibli cerulean and grades into warm cream at the cloud horizon!
        vec3 dayZenith = vec3(0.05, 0.25, 0.58);
        vec3 dayMid    = vec3(0.20, 0.50, 0.82);
        vec3 dayHoriz  = vec3(0.97, 0.91, 0.82);
        vec3 dayNadir  = vec3(0.74, 0.80, 0.90);

        vec3 duskZenith = vec3(0.07, 0.10, 0.28);
        vec3 duskMid    = vec3(0.46, 0.28, 0.50);
        vec3 duskHoriz  = vec3(0.98, 0.56, 0.32);
        vec3 duskNadir  = vec3(0.32, 0.25, 0.42);

        vec3 zenith = mix(dayZenith, duskZenith, uDusk);
        vec3 mid    = mix(dayMid, duskMid, uDusk);
        vec3 horiz  = mix(dayHoriz, duskHoriz, uDusk);
        vec3 nadir  = mix(dayNadir, duskNadir, uDusk);

        vec3 col;
        if (elev < -0.54) {
          col = nadir;
        } else if (elev < -0.41) {
          col = mix(nadir, horiz, smoothstep(-0.54, -0.41, elev));
        } else if (elev < -0.31) {
          col = mix(horiz, mid, smoothstep(-0.41, -0.31, elev));
        } else {
          col = mix(mid, zenith, smoothstep(-0.31, -0.19, elev));
        }

        // Subtle warm solar glow in upper-left horizon matching reference illumination
        vec3 sunDir = normalize(vec3(-0.65, -0.18, -0.55));
        float sunGlow = pow(clamp(dot(vDir, sunDir), 0.0, 1.0), 5.0);
        col += mix(vec3(0.18, 0.14, 0.07), vec3(0.32, 0.14, 0.05), uDusk) * sunGlow;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(28, 48, 32), skyMat);
  dome.name = "ghibli_sky_dome_mesh";
  dome.renderOrder = -10;
  dome.userData.noAO = true;
  return { dome, uniforms };
}

export function buildEnvironmentAndBackground(palette) {
  // =========================================================================
  // Layer 3: Surrounding Environment (Volumetric Cloud Sea + Wisps + Islets + Airship)
  // =========================================================================
  const envGrp = new THREE.Group();
  envGrp.name = "layer_environment_grp";

  const cloudMat = palette.cloudVolumetric;
  const cloudSeaGrp = new THREE.Group();
  cloudSeaGrp.name = "cloud_sea_banks_grp";
  cloudSeaGrp.userData.noAO = true;

  // Ring 0: Soft 3D micro-cumulus puffs nestling right against the cliff base (zero flat plane clips!)
  const microCollarCount = 28;
  for (let i = 0; i < microCollarCount; i++) {
    const a = (i / microCollarCount) * Math.PI * 2 + 0.08;
    const isFront = Math.sin(a) > 0.52 && Math.abs(Math.cos(a)) < 0.44;
    const dist = (isFront ? 0.52 : 0.44) + (i % 2) * 0.05;
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const cy = isFront ? -0.055 : -0.032 - (i % 2) * 0.015;
    const s = isFront ? 0.36 : 0.44 + (i % 3) * 0.06;
    const bank = createCumulusCluster(
      makeRichBankSpecs(s, s * 0.75, s, 40 + i * 5),
      cloudMat,
      `cliff_mist_puff_${i}`,
      40 + i,
    );
    bank.position.set(cx, cy, cz);
    bank.rotation.y = -a;
    cloudSeaGrp.add(bank);
  }

  // Ring 1: Close-in 3D cumulus collar softly hugging the rocky cliff base
  const ring1Count = 26;
  for (let i = 0; i < ring1Count; i++) {
    const a = (i / ring1Count) * Math.PI * 2;
    const isFront = Math.sin(a) > 0.5 && Math.abs(Math.cos(a)) < 0.45;
    const dist = (isFront ? 0.66 : 0.56) + (i % 3) * 0.10;
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const cy = (isFront ? -0.105 : -0.068) - (i % 2) * 0.024;
    const s = 0.74 + (i % 3) * 0.13;

    const bank = createCumulusCluster(
      makeRichBankSpecs(s, s * 0.82, s, 100 + i * 7),
      cloudMat,
      `collar_cloud_bank_${i}`,
      100 + i,
    );
    bank.position.set(cx, cy, cz);
    bank.rotation.y = -a + 0.3;
    cloudSeaGrp.add(bank);
  }

  // Ring 2: Continuous rolling mid-ground sea of clouds (sloped down in rear to preserve horizon)
  const ring2Count = 28;
  for (let i = 0; i < ring2Count; i++) {
    const a = (i / ring2Count) * Math.PI * 2 + 0.11;
    const dist = 1.04 + (i % 4) * 0.22;
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const rearSlope = cz < 0 ? cz * 0.18 : 0;
    const s = 1.12 + (i % 3) * 0.18;
    const bank = createCumulusCluster(
      makeRichBankSpecs(s, s * 0.76, s * 0.92, 300 + i * 11),
      cloudMat,
      `mid_cloud_bank_${i}`,
      300 + i,
    );
    bank.position.set(cx, -0.19 + rearSlope - (i % 3) * 0.03, cz);
    bank.rotation.y = -a + Math.PI * 0.35;
    cloudSeaGrp.add(bank);
  }

  // Ring 3: Continuous horizon cloud sea shelf (meets the sky horizon seamlessly with zero gaps!)
  const ring3Count = 28;
  for (let i = 0; i < ring3Count; i++) {
    const a = (i / ring3Count) * Math.PI * 2 + 0.18;
    const dist = 1.82 + (i % 3) * 0.36;
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const isRightShoulder = cx > 0.85 && cz < 0.35 && cz > -1.1;
    const rearDrop = cz < 0 ? cz * 0.18 : 0;
    const yLift = (isRightShoulder ? -0.18 : -0.26) + rearDrop - (i % 2) * 0.03;
    const s = (isRightShoulder ? 1.55 : 1.48) + (i % 3) * 0.2;
    const bank = createCumulusCluster(
      makeRichBankSpecs(s, s * (isRightShoulder ? 0.92 : 0.78), s * 0.92, 600 + i * 13),
      cloudMat,
      `horizon_cloud_bank_${i}`,
      600 + i,
    );
    bank.position.set(cx, yLift, cz);
    bank.rotation.y = -a + Math.PI * 0.5;
    cloudSeaGrp.add(bank);
  }

  envGrp.add(cloudSeaGrp);

  // 3 Distant Mossy Floating Sky-Islets framed in upper-left sky
  const isletsGrp = new THREE.Group();
  isletsGrp.name = "floating_sky_islets_grp";

  const isletSpecs = [
    { pos: [-0.76, 0.66, -0.52], scale: 0.86 },
    { pos: [-0.56, 0.54, -0.42], scale: 0.56 },
    { pos: [-0.92, 0.48, -0.28], scale: 0.5 },
  ];
  isletSpecs.forEach((sp, i) => {
    const islet = buildFloatingIslet(palette, sp.scale, i + 1);
    islet.position.set(...sp.pos);
    isletsGrp.add(islet);
  });
  envGrp.add(isletsGrp);

  // Detailed 5-Balloon Ghibli Airship framed in upper-right sky
  const airshipAnchor = new THREE.Group();
  airshipAnchor.name = "airship_orbit_anchor_grp";
  const airship = buildMultiBalloonAirship(palette);
  airship.group.position.set(0.37, 0.78, -0.44);
  airship.group.rotation.y = -0.62;
  airship.group.scale.setScalar(0.96);
  airshipAnchor.add(airship.group);
  envGrp.add(airshipAnchor);

  // =========================================================================
  // Layer 4: Background (Ghibli Sky Dome + Towering Cauliflower Cumulus Thunderhead)
  // =========================================================================
  const bgGrp = new THREE.Group();
  bgGrp.name = "layer_background_grp";
  bgGrp.userData.noAO = true;

  const { dome, uniforms: skyUniforms } = createGhibliSkyDome();
  bgGrp.add(dome);

  // Compact, Vertical Cauliflower Laputa Thunderhead rising behind the central spire
  // (rooted deep in the cloud sea at y = -0.46 so zero sky gap appears underneath, and narrow
  // enough horizontally so the left sky-islets and right 5-balloon airship sit in open blue sky!)
  const thunderheadSpecs = [
    // Deeply rooted base anchored inside the horizon cloud sea
    [-0.46, 0.02, 0.12, 0.34, 0.24, 0.28],
    [0.0, 0.04, 0.04, 0.38, 0.26, 0.30],
    [0.46, 0.02, -0.08, 0.34, 0.24, 0.28],
    [-0.28, 0.24, 0.08, 0.30, 0.25, 0.25],
    [0.0, 0.28, 0.06, 0.34, 0.27, 0.26],
    [0.28, 0.24, -0.02, 0.30, 0.25, 0.25],
    // Boiling mid-altitude cauliflower turrets
    [-0.24, 0.48, 0.06, 0.25, 0.24, 0.22],
    [0.0, 0.52, 0.08, 0.27, 0.26, 0.24],
    [0.24, 0.46, 0.02, 0.24, 0.23, 0.22],
    [-0.11, 0.68, 0.04, 0.22, 0.22, 0.20],
    [0.12, 0.66, 0.03, 0.21, 0.21, 0.19],
    // Crisp sunlit cumulus crown framing the rooster weathervane
    [-0.07, 0.84, 0.02, 0.17, 0.16, 0.16],
    [0.07, 0.82, 0.02, 0.16, 0.15, 0.15],
    [0.0, 0.91, 0.0, 0.14, 0.14, 0.14],
  ];

  const thunderhead = createCumulusCluster(
    thunderheadSpecs,
    cloudMat,
    "towering_thunderhead",
    901,
  );
  thunderhead.position.set(-0.92, -0.46, -1.48);
  thunderhead.rotation.y = 0.62;
  bgGrp.add(thunderhead);

  return {
    envGrp,
    bgGrp,
    skyUniforms,
    cloudUniforms: palette.cloudUniforms,
    airshipGroup: airship.group,
    airshipProp: airship.propPivot,
    isletsGrp,
  };
}
