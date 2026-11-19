import * as THREE from "three";
import { labelCanvasTexture, noiseBumpTexture, polishedChrome } from "../../src/kit/materials.js";
import {
  deformGeometry,
  latheProfile,
  roundedBox,
  tubeAlong,
} from "../../src/kit/shapes.js";

function sgnPow(val, exp) {
  return Math.sign(val) * Math.pow(Math.abs(val), exp);
}

/**
 * Uniformly tessellated superellipsoid cushion generator (zero flat-face triangulation artifacts).
 * ex, ey, ez near 1.0 -> round sphere/ellipsoid; near 0.35 -> soft rounded rectangular cushion.
 */
function buildSuperCushion(
  halfW,
  halfH,
  halfD,
  ex = 0.45,
  ey = 0.45,
  ez = 0.45,
  segU = 64,
  segV = 48,
  mutatorFn = null,
) {
  const geo = new THREE.SphereGeometry(0.5, segU, segV);
  return deformGeometry(geo, (v) => {
    const nx = THREE.MathUtils.clamp(v.x * 2, -1, 1);
    const ny = THREE.MathUtils.clamp(v.y * 2, -1, 1);
    const nz = THREE.MathUtils.clamp(v.z * 2, -1, 1);
    v.set(sgnPow(nx, ex) * halfW, sgnPow(ny, ey) * halfH, sgnPow(nz, ez) * halfD);
    if (mutatorFn) mutatorFn(v, nx, ny, nz);
  });
}

function createVelourMaterial(hex, sheenHex = 0xdbeafe, roughness = 0.78) {
  const nap = noiseBumpTexture({ size: 256, contrast: 24, repeat: 20, seed: 505 });
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: 0.0,
    roughness,
    sheen: 0.72,
    sheenRoughness: 0.54,
    sheenColor: new THREE.Color(sheenHex),
    bumpMap: nap,
    bumpScale: 0.0007,
    envMapIntensity: 0.28,
  });
}

/**
 * KOYA head backrest pillow: full cheeks, cozy forehead dome, perimeter welt groove.
 */
function buildKoyaHeadGeometry() {
  return buildSuperCushion(0.42, 0.325, 0.13, 0.84, 0.88, 0.84, 72, 56, (v, nx, ny, nz) => {
    const t = THREE.MathUtils.clamp((ny + 1) * 0.5, 0, 1);
    const cheekBell = Math.sin(Math.pow(t, 0.76) * Math.PI);
    const halfW = 0.33 + 0.098 * cheekBell;
    const halfD = 0.135 - 0.032 * Math.pow(t, 1.25);
    const seamPinch = 1 - 0.025 * Math.exp(-Math.pow(nz / 0.11, 2));

    const sx = sgnPow(nx, 0.85) * halfW * seamPinch;
    const sy = (sgnPow(ny, 0.9) * 0.5 + 0.5) * 0.65;
    const frontBias = nz > 0 ? 1.07 : 0.93;
    const sz = sgnPow(nz, 0.86) * halfD * frontBias;
    v.set(sx, sy, sz);
  });
}

function sampleHeadFrontZ(localX, localY) {
  const yn = THREE.MathUtils.clamp((localY / 0.65 - 0.5) * 2, -0.98, 0.98);
  const ny = sgnPow(yn, 1 / 0.9);
  const t = THREE.MathUtils.clamp((ny + 1) * 0.5, 0, 1);
  const cheekBell = Math.sin(Math.pow(t, 0.76) * Math.PI);
  const halfW = 0.33 + 0.098 * cheekBell;
  const halfD = 0.135 - 0.032 * Math.pow(t, 1.25);

  const xn = THREE.MathUtils.clamp(localX / halfW, -0.98, 0.98);
  const nx = sgnPow(xn, 1 / 0.85);
  const nzSq = Math.max(0.01, 1 - nx * nx - ny * ny);
  return Math.pow(Math.sqrt(nzSq), 0.86) * halfD * 1.07;
}

/**
 * Plush koala ear cushion + recessed front cream-white inlay.
 */
function buildEarGroup(skyMat, creamMat, isRightViewerSide) {
  const grp = new THREE.Group();
  grp.name = isRightViewerSide ? "ear_left_chair_grp" : "ear_right_chair_grp";

  const earGeo = buildSuperCushion(0.152, 0.16, 0.038, 0.88, 0.88, 0.82, 48, 36, (v, nx, ny, nz) => {
    const cup = -0.014 * (nx * nx + ny * ny);
    const seamPinch = 1 - 0.05 * Math.exp(-Math.pow(nz / 0.14, 2));
    v.z = v.z * seamPinch + cup;
  });
  const earMesh = new THREE.Mesh(earGeo, skyMat);
  earMesh.name = isRightViewerSide ? "ear_left_outer_mesh" : "ear_right_outer_mesh";
  grp.add(earMesh);

  const patchGeo = buildSuperCushion(0.096, 0.106, 0.01, 0.9, 0.9, 0.8, 36, 28, (v, nx, ny, nz) => {
    v.x += isRightViewerSide ? -0.02 : 0.02;
    v.y -= 0.014;
    const cup = -0.014 * ((v.x / 0.152) ** 2 + (v.y / 0.16) ** 2);
    v.z = (nz > 0 ? Math.pow(nz, 0.8) * 0.011 : -0.004) + 0.03 + cup;
  });
  const patchMesh = new THREE.Mesh(patchGeo, creamMat);
  patchMesh.name = isRightViewerSide ? "ear_left_inlay_mesh" : "ear_right_inlay_mesh";
  grp.add(patchMesh);

  return grp;
}

/**
 * Overstuffed marshmallow armrest bolster with gathered radial front pleats (zero stripes).
 */
function buildArmrestGeometry(sideSign) {
  return buildSuperCushion(0.128, 0.096, 0.325, 0.62, 0.65, 0.48, 72, 56, (v, nx, ny, nz) => {
    const zNorm = THREE.MathUtils.clamp((v.z + 0.325) / 0.65, 0, 1); // 0 rear -> 1 front

    // Plumper, fuller front pillow head, tapering smoothly into backrest cheek
    const widthScale = 0.84 + 0.24 * Math.sin(Math.pow(zNorm, 0.85) * Math.PI * 0.72);
    const heightScale = 0.86 + 0.18 * Math.pow(zNorm, 0.8);
    v.x *= widthScale;
    v.y *= heightScale;

    // Cozy inward hug toward white seat cushion at front
    v.x -= sideSign * 0.018 * Math.pow(zNorm, 1.4);

    // Gathered radial upholstery pleats concentrated on the front bolster nose
    const noseFactor =
      THREE.MathUtils.smoothstep(zNorm, 0.66, 0.98) * (1 - 0.25 * Math.abs(ny));
    if (noseFactor > 0.001) {
      const angle = Math.atan2(v.y + 0.018, v.x * sideSign);
      // 7 soft radial cushion folds around the front nose
      const wave = Math.abs(Math.sin(angle * 4.5));
      const tuck = (1 - Math.pow(wave, 0.55)) * 0.0075 * noseFactor;
      const rLen = Math.hypot(v.x, v.y);
      if (rLen > 1e-4) {
        v.x -= (v.x / rLen) * tuck;
        v.y -= (v.y / rLen) * tuck * 0.85;
      }
      v.z -= tuck * 0.35;
    }

    // Subtle horizontal outer welt tuck line
    if (v.x * sideSign > 0) {
      const weltGroove = Math.exp(-Math.pow((v.y + 0.015) / 0.014, 2)) * 0.003;
      v.x -= sideSign * weltGroove;
    }
  });
}

/**
 * Smooth barrel-curved lower side cheek of the recliner tub (zero facets).
 */
function buildSideCheekGeometry(sideSign) {
  return buildSuperCushion(0.105, 0.198, 0.345, 0.42, 0.36, 0.34, 56, 44, (v) => {
    const yNorm = THREE.MathUtils.clamp((v.y + 0.198) / 0.396, 0, 1);
    const zNorm = THREE.MathUtils.clamp((v.z + 0.345) / 0.69, 0, 1);

    if (v.x * sideSign > 0) {
      // Cozy barrel curvature matching 01-front.webp
      const belly = Math.sin(yNorm * Math.PI) * 0.028;
      const bottomTaper = (1 - THREE.MathUtils.smoothstep(yNorm, 0.0, 0.36)) * 0.042;
      v.x += sideSign * (belly - bottomTaper);
    }

    // Gentle rocker sweep at front/rear bottom corners
    const cornerLift = Math.pow(Math.abs(zNorm - 0.5) * 2, 2.6) * 0.012 * (1 - yNorm);
    v.y += cornerLift;
  });
}

/**
 * Smooth parametric swept cushion tube for the sky-blue U-shaped front apron.
 */
function buildSmoothUApronGeometry() {
  // Centerline path of the U-border with generous corner radius > cross-section half-width
  const spinePts = [
    new THREE.Vector3(-0.358, 0.182, -0.012),
    new THREE.Vector3(-0.358, 0.035, -0.004),
    new THREE.Vector3(-0.325, -0.088, 0.002),
    new THREE.Vector3(-0.205, -0.132, 0.006),
    new THREE.Vector3(0.0, -0.136, 0.008),
    new THREE.Vector3(0.205, -0.132, 0.006),
    new THREE.Vector3(0.325, -0.088, 0.002),
    new THREE.Vector3(0.358, 0.035, -0.004),
    new THREE.Vector3(0.358, 0.182, -0.012),
  ];
  const curve = new THREE.CatmullRomCurve3(spinePts, false, "centripetal", 0.5);

  const steps = 96;
  const radSegs = 40;
  const capRings = 4;

  const frames = curve.computeFrenetFrames(steps, false);
  const pts = curve.getSpacedPoints(steps);

  const stations = [];
  for (let c = 1; c < capRings; c++) {
    stations.push({ idx: 0, scale: c / capRings, zCap: -0.012 * (1 - c / capRings) });
  }
  for (let i = 0; i <= steps; i++) {
    const endRound =
      THREE.MathUtils.smoothstep(i / steps, 0, 0.05) *
      THREE.MathUtils.smoothstep(1 - i / steps, 0, 0.05);
    stations.push({ idx: i, scale: 0.88 + 0.12 * endRound, zCap: 0 });
  }
  for (let c = capRings - 1; c >= 1; c--) {
    stations.push({ idx: steps, scale: c / capRings, zCap: -0.012 * (1 - c / capRings) });
  }

  const positions = [];
  const uvs = [];
  const rings = [];
  const centers = [];

  for (let s = 0; s < stations.length; s++) {
    const { idx, scale, zCap } = stations[s];
    const p = pts[idx];
    const tang = frames.tangents[idx];
    const n2d = new THREE.Vector3(-tang.y, tang.x, 0).normalize();
    const uFrac = idx / steps;
    const bottomFactor = Math.exp(-Math.pow((uFrac - 0.5) / 0.28, 2));
    const halfInPlane = THREE.MathUtils.lerp(0.088, 0.064, bottomFactor) * scale;
    const halfDepth = 0.048 * scale;

    const ring = [];
    for (let j = 0; j < radSegs; j++) {
      const phi = (j / radSegs) * Math.PI * 2;
      const c = sgnPow(Math.cos(phi), 0.76) * halfInPlane;
      const zOff = sgnPow(Math.sin(phi), 0.78) * halfDepth;

      const vx = p.x + n2d.x * c;
      const vy = p.y + n2d.y * c + zCap * 0.2;
      const vz = p.z + zOff;

      ring.push([vx, vy, vz]);
      positions.push(vx, vy, vz);
      uvs.push(s / (stations.length - 1), j / radSegs);
    }
    rings.push(ring);
    centers.push([p.x, p.y, p.z]);
  }

  const startPole = [pts[0].x, pts[0].y - 0.005, pts[0].z];
  const endPole = [pts[steps].x, pts[steps].y - 0.005, pts[steps].z];

  // Prepend startPole, append endPole
  const fullPos = [...startPole, ...positions, ...endPole];
  const fullUvs = [0, 0.5, ...uvs, 1, 0.5];

  const ringCount = stations.length;
  const endPoleIdx = 1 + ringCount * radSegs;
  const mid = Math.floor(ringCount / 2);
  const pA = new THREE.Vector3(...rings[mid][0]);
  const pB = new THREE.Vector3(...rings[mid + 1][0]);
  const pC = new THREE.Vector3(...rings[mid][1]);
  const ctr = new THREE.Vector3(...centers[mid]);
  const triN = new THREE.Vector3().subVectors(pB, pA).cross(new THREE.Vector3().subVectors(pC, pA));
  const flip = triN.dot(new THREE.Vector3().subVectors(pA, ctr)) < 0;

  const indices = [];
  const rv = (s, j) => 1 + s * radSegs + (j % radSegs);
  const tri = (a, b, c) => (flip ? indices.push(a, c, b) : indices.push(a, b, c));

  for (let j = 0; j < radSegs; j++) tri(0, rv(0, j), rv(0, j + 1));
  for (let s = 0; s < ringCount - 1; s++) {
    for (let j = 0; j < radSegs; j++) {
      tri(rv(s, j), rv(s + 1, j), rv(s + 1, j + 1));
      tri(rv(s, j), rv(s + 1, j + 1), rv(s, j + 1));
    }
  }
  for (let j = 0; j < radSegs; j++) tri(rv(ringCount - 1, j), endPoleIdx, rv(ringCount - 1, j + 1));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(fullPos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(fullUvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Deploying front U-shaped sky-blue cushion apron + seamless stadium white front/calf cushion.
 */
function buildFootrestAssembly(skyMat, whiteMat, steelMat) {
  const grp = new THREE.Group();
  grp.name = "footrest_apron_grp";

  const apronMesh = new THREE.Mesh(buildSmoothUApronGeometry(), skyMat);
  apronMesh.name = "footrest_blue_u_apron_mesh";
  grp.add(apronMesh);

  // Full-height plump white front/calf cushion tucked seamlessly behind the U-apron inner rim
  const calfGeo = buildSuperCushion(0.296, 0.158, 0.056, 0.52, 0.56, 0.62, 56, 44, (v) => {
    if (v.y < -0.02) {
      const yLow = THREE.MathUtils.clamp((-0.02 - v.y) / 0.14, 0, 1);
      v.x *= 1 - 0.1 * yLow * yLow;
    }
    if (v.z > 0) {
      const r2 = (v.x / 0.296) ** 2 + (v.y / 0.158) ** 2;
      v.z += 0.018 * Math.max(0, 1 - 0.45 * r2);
    }
  });
  const calfMesh = new THREE.Mesh(calfGeo, whiteMat);
  calfMesh.name = "footrest_white_pad_mesh";
  calfMesh.position.set(0, 0.052, -0.008);
  grp.add(calfMesh);

  const backPlate = new THREE.Mesh(roundedBox(0.72, 0.28, 0.014, 0.005, 2), steelMat);
  backPlate.name = "footrest_backing_plate_mesh";
  backPlate.position.set(0, 0.01, -0.044);
  grp.add(backPlate);

  return grp;
}

function solveTwoBoneIK(p0y, p0z, p2y, p2z, L1, L2) {
  const dz = p2z - p0z;
  const dy = p2y - p0y;
  const d = Math.max(1e-5, Math.hypot(dz, dy));
  const dc = Math.min(d, L1 + L2 - 1e-4);
  const a = (L1 * L1 - L2 * L2 + dc * dc) / (2 * dc);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const uz = dz / d;
  const uy = dy / d;
  // Downward/rearward knee branch (-uz in Y, +uy in Z) keeps linkage inside cavity & under footrest
  return {
    y: p0y + a * uy + h * -uz,
    z: p0z + a * uz + h * uy,
  };
}

function placeBarYZ(mesh, x, y1, z1, y2, z2) {
  const dy = y2 - y1;
  const dz = z2 - z1;
  mesh.position.set(x, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
  mesh.rotation.x = Math.atan2(-dy, dz);
}

function buildScissorLinkage(steelMat, chromeMat) {
  const root = new THREE.Group();
  root.name = "scissor_linkage_grp";

  const L_BOT = 0.215;
  const L_TOP = 0.175;

  const botBarGeo = roundedBox(0.008, 0.026, L_BOT + 0.018, 0.003, 2);
  const topBarGeo = roundedBox(0.008, 0.022, L_TOP + 0.016, 0.003, 2);
  const bracketGeo = roundedBox(0.012, 0.125, 0.018, 0.003, 2);
  const pinGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.026, 16);
  pinGeo.rotateZ(Math.PI / 2);

  const sides = [-0.195, 0.195];
  const rigs = [];

  for (const sx of sides) {
    const tag = sx < 0 ? "r" : "l";
    const sideGrp = new THREE.Group();
    sideGrp.name = sx < 0 ? "scissor_right_chair_grp" : "scissor_left_chair_grp";

    const botLink1 = new THREE.Mesh(botBarGeo, steelMat);
    botLink1.name = `scissor_bot_link1_${tag}_mesh`;
    const botLink2 = new THREE.Mesh(botBarGeo, steelMat);
    botLink2.name = `scissor_bot_link2_${tag}_mesh`;

    const topLink1 = new THREE.Mesh(topBarGeo, steelMat);
    topLink1.name = `scissor_top_link1_${tag}_mesh`;
    const topLink2 = new THREE.Mesh(topBarGeo, steelMat);
    topLink2.name = `scissor_top_link2_${tag}_mesh`;

    const padBracket = new THREE.Mesh(bracketGeo, steelMat);
    padBracket.name = `scissor_pad_bracket_${tag}_mesh`;

    const kneePinBot = new THREE.Mesh(pinGeo, chromeMat);
    kneePinBot.name = `scissor_pin_kbot_${tag}_mesh`;
    const kneePinTop = new THREE.Mesh(pinGeo, chromeMat);
    kneePinTop.name = `scissor_pin_ktop_${tag}_mesh`;
    const endPinBot = new THREE.Mesh(pinGeo, chromeMat);
    endPinBot.name = `scissor_pin_ebot_${tag}_mesh`;
    const endPinTop = new THREE.Mesh(pinGeo, chromeMat);
    endPinTop.name = `scissor_pin_etop_${tag}_mesh`;

    sideGrp.add(
      botLink1,
      botLink2,
      topLink1,
      topLink2,
      padBracket,
      kneePinBot,
      kneePinTop,
      endPinBot,
      endPinTop,
    );
    root.add(sideGrp);

    rigs.push({
      sx,
      botLink1,
      botLink2,
      topLink1,
      topLink2,
      padBracket,
      kneePinBot,
      kneePinTop,
      endPinBot,
      endPinTop,
    });
  }

  function updateLinkage(footPy, footPz, footRotX) {
    const cosT = Math.cos(footRotX);
    const sinT = Math.sin(footRotX);
    const toChairYZ = (ly, lz) => ({
      y: footPy + ly * cosT - lz * sinT,
      z: footPz + ly * sinT + lz * cosT,
    });

    // Anchors inside the enclosed dark seat box
    const p0Bot = { y: 0.315, z: 0.215 };
    const p0Top = { y: 0.345, z: 0.205 };

    // Moving bracket pins strictly on the REAR (-Z) backing plate of the footrest
    const bBot = toChairYZ(-0.038, -0.052);
    const bTop = toChairYZ(0.046, -0.052);
    const bMid = toChairYZ(0.004, -0.048);

    const kBot = solveTwoBoneIK(p0Bot.y, p0Bot.z, bBot.y, bBot.z, L_BOT, L_BOT);
    const kTop = solveTwoBoneIK(p0Top.y, p0Top.z, bTop.y, bTop.z, L_TOP, L_TOP);

    for (const rig of rigs) {
      const { sx } = rig;
      placeBarYZ(rig.botLink1, sx - 0.004, p0Bot.y, p0Bot.z, kBot.y, kBot.z);
      placeBarYZ(rig.botLink2, sx + 0.004, kBot.y, kBot.z, bBot.y, bBot.z);

      placeBarYZ(rig.topLink1, sx + 0.004, p0Top.y, p0Top.z, kTop.y, kTop.z);
      placeBarYZ(rig.topLink2, sx - 0.004, kTop.y, kTop.z, bTop.y, bTop.z);

      rig.padBracket.position.set(sx, bMid.y, bMid.z);
      rig.padBracket.rotation.x = footRotX;

      rig.kneePinBot.position.set(sx, kBot.y, kBot.z);
      rig.kneePinTop.position.set(sx, kTop.y, kTop.z);
      rig.endPinBot.position.set(sx, bBot.y, bBot.z);
      rig.endPinTop.position.set(sx, bTop.y, bTop.z);
    }
  }

  return { group: root, updateLinkage };
}

function createStarPatchTexture() {
  return labelCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const outerR = 175;
    const innerR = 78;

    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#88c4ee";
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 24;
    ctx.strokeStyle = "#172234";
    ctx.stroke();
  });
}

function createZzLeafPatchTexture() {
  return labelCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Speech bubble "Zz"
    ctx.save();
    ctx.translate(168, 332);
    ctx.beginPath();
    ctx.ellipse(0, -10, 108, 82, -0.12, 0.42, Math.PI * 2 + 0.12);
    ctx.lineTo(36, 94);
    ctx.lineTo(6, 68);
    ctx.closePath();
    ctx.fillStyle = "#e3e6f5";
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = "#18202c";
    ctx.stroke();

    ctx.strokeStyle = "#18202c";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(-62, -24);
    ctx.lineTo(-14, -42);
    ctx.lineTo(-52, 22);
    ctx.lineTo(-4, 6);
    ctx.stroke();

    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(14, -10);
    ctx.lineTo(52, -24);
    ctx.lineTo(20, 22);
    ctx.lineTo(58, 8);
    ctx.stroke();
    ctx.restore();

    // Green leaf
    ctx.save();
    ctx.translate(358, 168);
    ctx.rotate(0.18);
    ctx.beginPath();
    ctx.moveTo(0, -92);
    ctx.bezierCurveTo(78, -42, 74, 54, 0, 78);
    ctx.bezierCurveTo(-74, 54, -78, -42, 0, -92);
    ctx.closePath();
    ctx.fillStyle = "#1d9a49";
    ctx.fill();
    ctx.lineWidth = 15;
    ctx.strokeStyle = "#18202c";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -68);
    ctx.lineTo(0, 104);
    ctx.moveTo(0, -10);
    ctx.lineTo(34, -34);
    ctx.moveTo(0, 24);
    ctx.lineTo(-34, 0);
    ctx.stroke();
    ctx.restore();
  });
}

export function buildModel() {
  const root = new THREE.Group();
  root.name = "bt21_koya_chair_root";

  const skyVelour = createVelourMaterial(0x9bd3f5, 0xe0f2fe, 0.78);
  const skySeamMat = createVelourMaterial(0x8bc5ec, 0xd4ecff, 0.8);
  const creamVelour = createVelourMaterial(0xf3f5f8, 0xffffff, 0.74);
  const nosePlush = createVelourMaterial(0x705f93, 0xb8add4, 0.82);
  const threadDark = createVelourMaterial(0x1c212a, 0x374151, 0.72);
  const cavityFabric = createVelourMaterial(0x1c1f24, 0x2d323b, 0.9);

  const steelBlack = new THREE.MeshPhysicalMaterial({
    color: 0x181a1e,
    metalness: 0.58,
    roughness: 0.42,
  });
  const absBlack = new THREE.MeshPhysicalMaterial({
    color: 0x14171b,
    metalness: 0.05,
    roughness: 0.44,
    clearcoat: 0.16,
    clearcoatRoughness: 0.38,
  });
  const flexRubber = new THREE.MeshPhysicalMaterial({
    color: 0x17191d,
    metalness: 0.0,
    roughness: 0.76,
  });
  const chromeMat = polishedChrome();

  // =========================================================================
  // 1. Swivel Tubular Steel Ring Base (y = 0.000 .. 0.052)
  // =========================================================================
  const baseGrp = new THREE.Group();
  baseGrp.name = "swivel_ring_base_grp";

  const ringRadius = 0.315;
  const ringMesh = new THREE.Mesh(
    new THREE.TorusGeometry(ringRadius, 0.0125, 20, 72),
    steelBlack,
  );
  ringMesh.name = "base_steel_ring_mesh";
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(0, 0.0165, -0.02);
  baseGrp.add(ringMesh);

  const padGeo = latheProfile(
    [
      [0, 0],
      [0.018, 0],
      [0.02, 0.004],
      [0.016, 0.008],
      [0, 0.008],
    ],
    { segments: 24 },
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pad = new THREE.Mesh(padGeo, flexRubber);
    pad.name = `base_glide_pad_${i}_mesh`;
    pad.position.set(Math.cos(a) * ringRadius, 0, -0.02 + Math.sin(a) * ringRadius);
    baseGrp.add(pad);
  }

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const spoke = new THREE.Mesh(
      tubeAlong(
        [
          [Math.cos(a) * (ringRadius - 0.005), 0.017, -0.02 + Math.sin(a) * (ringRadius - 0.005)],
          [Math.cos(a) * 0.16, 0.028, -0.02 + Math.sin(a) * 0.16],
          [Math.cos(a) * 0.04, 0.046, -0.02 + Math.sin(a) * 0.04],
        ],
        { radius: 0.01, tubularSegments: 24, radialSegments: 14 },
      ),
      steelBlack,
    );
    spoke.name = `base_spoke_${i}_mesh`;
    baseGrp.add(spoke);
  }

  const hubMesh = new THREE.Mesh(
    latheProfile(
      [
        [0, 0.032],
        [0.088, 0.032],
        [0.092, 0.042],
        [0.082, 0.062],
        [0, 0.062],
      ],
      { segments: 36 },
    ),
    steelBlack,
  );
  hubMesh.name = "base_swivel_hub_mesh";
  hubMesh.position.set(0, 0, -0.02);
  baseGrp.add(hubMesh);
  root.add(baseGrp);

  // =========================================================================
  // 2. Upper Swivel Chair Assembly
  // =========================================================================
  const upperPivotZ = -0.02;
  const swivelGrp = new THREE.Group();
  swivelGrp.name = "chair_swivel_upper_grp";
  swivelGrp.position.set(0, 0, upperPivotZ);
  root.add(swivelGrp);

  const chairLocal = new THREE.Group();
  chairLocal.name = "chair_body_frame_grp";
  chairLocal.position.set(0, 0, -upperPivotZ);
  swivelGrp.add(chairLocal);

  // =========================================================================
  // 3. Tub Chassis: Smooth Superellipsoid Side Cheeks & Rear Tailored Skirt
  // =========================================================================
  const tubGrp = new THREE.Group();
  tubGrp.name = "tub_chassis_grp";
  chairLocal.add(tubGrp);

  const innerPan = new THREE.Mesh(roundedBox(0.56, 0.27, 0.65, 0.02, 3), cavityFabric);
  innerPan.name = "inner_seat_pan_mesh";
  innerPan.position.set(0, 0.2, 0.0);
  tubGrp.add(innerPan);

  const bottomSkirt = new THREE.Mesh(
    buildSuperCushion(0.39, 0.048, 0.29, 0.4, 0.55, 0.4, 40, 28),
    skyVelour,
  );
  bottomSkirt.name = "tub_bottom_skirt_mesh";
  bottomSkirt.position.set(0, 0.094, -0.035);
  tubGrp.add(bottomSkirt);

  const rightChairCheek = new THREE.Mesh(buildSideCheekGeometry(-1), skyVelour);
  rightChairCheek.name = "tub_cheek_right_chair_mesh";
  rightChairCheek.position.set(-0.352, 0.252, 0.0);
  tubGrp.add(rightChairCheek);

  const leftChairCheek = new THREE.Mesh(buildSideCheekGeometry(1), skyVelour);
  leftChairCheek.name = "tub_cheek_left_chair_mesh";
  leftChairCheek.position.set(0.352, 0.252, 0.0);
  tubGrp.add(leftChairCheek);

  const rearFlapGeo = buildSuperCushion(0.368, 0.2, 0.048, 0.34, 0.34, 0.55, 48, 36, (v) => {
    const yNorm = THREE.MathUtils.clamp((v.y + 0.2) / 0.4, 0, 1);
    v.z += yNorm * 0.026;
    v.z -= (1 - Math.pow(v.x / 0.368, 2)) * 0.016;
  });
  const rearFlap = new THREE.Mesh(rearFlapGeo, skyVelour);
  rearFlap.name = "rear_upholstery_flap_mesh";
  rearFlap.position.set(0, 0.254, -0.312);
  tubGrp.add(rearFlap);

  for (const sx of [-1, 1]) {
    const welt = new THREE.Mesh(
      tubeAlong(
        [
          [sx * 0.365, 0.066, -0.318],
          [sx * 0.37, 0.25, -0.324],
          [sx * 0.355, 0.435, -0.285],
        ],
        { radius: 0.0045, tubularSegments: 28, radialSegments: 10 },
      ),
      skySeamMat,
    );
    welt.name = `rear_welt_${sx < 0 ? "r" : "l"}_mesh`;
    tubGrp.add(welt);
  }

  const brandTab = new THREE.Mesh(roundedBox(0.024, 0.006, 0.018, 0.0015, 2), absBlack);
  brandTab.name = "rear_woven_brand_tab_mesh";
  brandTab.position.set(-0.368, 0.422, -0.268);
  brandTab.rotation.z = 0.25;
  tubGrp.add(brandTab);

  // =========================================================================
  // 4. White Plush Seat Cushion (meets top roll of front pad seamlessly at y = 0.468)
  // =========================================================================
  const seatGrp = new THREE.Group();
  seatGrp.name = "seat_cushion_grp";
  const seatGeo = buildSuperCushion(0.285, 0.102, 0.295, 0.5, 0.58, 0.48, 64, 48, (v) => {
    const rx = v.x / 0.285;
    const rz = v.z / 0.295;
    if (v.y > 0) {
      v.y += 0.024 * Math.max(0, 1 - 0.45 * (rx * rx + rz * rz));
    }
  });
  const seatMesh = new THREE.Mesh(seatGeo, creamVelour);
  seatMesh.name = "white_seat_cushion_mesh";
  seatMesh.position.set(0, 0.362, 0.058);
  seatGrp.add(seatMesh);
  chairLocal.add(seatGrp);

  // =========================================================================
  // 5. Overstuffed Pleated Armrest Bolsters
  // =========================================================================
  const armrestsGrp = new THREE.Group();
  armrestsGrp.name = "armrests_grp";

  const rightArmMesh = new THREE.Mesh(buildArmrestGeometry(-1), skyVelour);
  rightArmMesh.name = "armrest_right_chair_mesh";
  rightArmMesh.position.set(-0.352, 0.506, 0.095);
  rightArmMesh.rotation.z = -0.08;
  armrestsGrp.add(rightArmMesh);

  const leftArmMesh = new THREE.Mesh(buildArmrestGeometry(1), skyVelour);
  leftArmMesh.name = "armrest_left_chair_mesh";
  leftArmMesh.position.set(0.352, 0.506, 0.095);
  leftArmMesh.rotation.z = 0.08;
  armrestsGrp.add(leftArmMesh);

  chairLocal.add(armrestsGrp);

  // =========================================================================
  // 6. Deploying Footrest (Smooth Swept U-Apron + Stadium White Cushion + Scissor)
  // =========================================================================
  const footrestMechGrp = new THREE.Group();
  footrestMechGrp.name = "footrest_mechanism_grp";
  chairLocal.add(footrestMechGrp);

  const scissor = buildScissorLinkage(steelBlack, chromeMat);
  footrestMechGrp.add(scissor.group);

  const footrestPivot = new THREE.Group();
  footrestPivot.name = "footrest_carrier_pivot_grp";
  const footrestPad = buildFootrestAssembly(skyVelour, creamVelour, steelBlack);
  footrestPivot.add(footrestPad);
  footrestMechGrp.add(footrestPivot);

  // =========================================================================
  // 7. KOYA Head Backrest + Plush Ears + 3D Embroidered Face
  // =========================================================================
  const backrestHinge = new THREE.Group();
  backrestHinge.name = "koya_backrest_hinge_grp";
  backrestHinge.position.set(0, 0.4, -0.175);
  chairLocal.add(backrestHinge);

  const headMesh = new THREE.Mesh(buildKoyaHeadGeometry(), skyVelour);
  headMesh.name = "koya_head_cushion_mesh";
  backrestHinge.add(headMesh);

  const weltPts = [];
  for (let i = 0; i <= 44; i++) {
    const a = -0.12 * Math.PI + (i / 44) * (1.24 * Math.PI);
    const ny = Math.sin(a);
    const nx = Math.cos(a);
    const t = THREE.MathUtils.clamp((ny + 1) * 0.5, 0, 1);
    const cheekBell = Math.sin(Math.pow(t, 0.76) * Math.PI);
    const halfW = (0.33 + 0.098 * cheekBell) * 0.978;
    const x = sgnPow(nx, 0.85) * halfW;
    const y = (sgnPow(ny, 0.9) * 0.5 + 0.5) * 0.65;
    weltPts.push([x, y, 0]);
  }
  const headWelt = new THREE.Mesh(
    tubeAlong(weltPts, { radius: 0.0045, tubularSegments: 72, radialSegments: 10 }),
    skySeamMat,
  );
  headWelt.name = "koya_head_welt_mesh";
  backrestHinge.add(headWelt);

  const earsGrp = new THREE.Group();
  earsGrp.name = "koya_ears_grp";

  const earRightChair = buildEarGroup(skyVelour, creamVelour, false);
  earRightChair.position.set(-0.34, 0.472, -0.01);
  earRightChair.rotation.set(0.06, 0.12, 0.52);

  const earLeftChair = buildEarGroup(skyVelour, creamVelour, true);
  earLeftChair.position.set(0.338, 0.484, -0.01);
  earLeftChair.rotation.set(0.06, -0.12, -0.48);

  earsGrp.add(earRightChair, earLeftChair);
  backrestHinge.add(earsGrp);

  // KOYA Embroidered Face Appliqué (matching 01-front.webp proportions & eye slope)
  const faceGrp = new THREE.Group();
  faceGrp.name = "koya_face_applique_grp";

  const noseCenterY = 0.34;
  const noseGeo = buildSuperCushion(0.053, 0.068, 0.008, 0.9, 0.9, 0.8, 36, 28, (v, nx, ny, nz) => {
    const lx = v.x * (1 - 0.14 * ny);
    const ly = noseCenterY + v.y;
    const surfZ = sampleHeadFrontZ(lx, ly);
    const relief = nz > 0 ? Math.pow(nz, 0.75) * 0.0065 : -0.003;
    v.set(lx, ly, surfZ + relief);
  });
  const noseMesh = new THREE.Mesh(noseGeo, nosePlush);
  noseMesh.name = "koya_nose_mesh";
  faceGrp.add(noseMesh);

  // Sleepy eyes: crisp rectangular embroidered bars tilted gently upward toward nose
  for (const sx of [-1, 1]) {
    const eyeGeo = buildSuperCushion(0.039, 0.0095, 0.0035, 0.45, 0.55, 0.7, 24, 16, (v) => {
      // Rotate in local XY by sleepy tilt (+10 deg on viewer-left sx=-1, -10 deg on viewer-right sx=+1)
      const tilt = -sx * 0.175;
      const rx = v.x * Math.cos(tilt) - v.y * Math.sin(tilt);
      const ry = v.x * Math.sin(tilt) + v.y * Math.cos(tilt);
      const lx = sx * 0.142 + rx;
      const ly = 0.332 + ry;
      const surfZ = sampleHeadFrontZ(lx, ly);
      v.set(lx, ly, surfZ + v.z + 0.0022);
    });
    const eyeMesh = new THREE.Mesh(eyeGeo, threadDark);
    eyeMesh.name = `koya_eye_${sx < 0 ? "r" : "l"}_mesh`;
    faceGrp.add(eyeMesh);
  }

  // Curved KOYA smile below nose
  const smilePts = [];
  for (let i = 0; i <= 18; i++) {
    const a = -0.8 * (Math.PI / 2) + (i / 18) * (1.6 * (Math.PI / 2));
    const lx = Math.sin(a) * 0.046;
    const ly = 0.246 - Math.cos(a) * 0.022;
    const lz = sampleHeadFrontZ(lx, ly) + 0.0022;
    smilePts.push([lx, ly, lz]);
  }
  const smileMesh = new THREE.Mesh(
    tubeAlong(smilePts, { radius: 0.0082, tubularSegments: 24, radialSegments: 12 }),
    threadDark,
  );
  smileMesh.name = "koya_smile_mesh";
  faceGrp.add(smileMesh);
  for (const endPt of [smilePts[0], smilePts[smilePts.length - 1]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0082, 12, 10), threadDark);
    cap.name = "koya_smile_cap_mesh";
    cap.position.set(endPt[0], endPt[1], endPt[2]);
    faceGrp.add(cap);
  }

  backrestHinge.add(faceGrp);

  // =========================================================================
  // 8. Flank Hardware (-X Chair Right) & Embroidery Patches
  // =========================================================================
  const rightHardwareGrp = new THREE.Group();
  rightHardwareGrp.name = "right_flank_hardware_grp";
  tubGrp.add(rightHardwareGrp);

  const reclineBtnGrp = new THREE.Group();
  reclineBtnGrp.name = "power_recline_button_grp";
  reclineBtnGrp.position.set(-0.483, 0.258, 0.095);
  reclineBtnGrp.rotation.z = Math.PI / 2;

  const btnBezel = new THREE.Mesh(
    latheProfile(
      [
        [0, 0],
        [0.032, 0],
        [0.035, 0.006],
        [0.033, 0.012],
        [0.024, 0.012],
        [0.023, 0.004],
        [0, 0.004],
      ],
      { segments: 36 },
    ),
    absBlack,
  );
  btnBezel.name = "recline_btn_bezel_mesh";
  const btnRocker = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.008, 32), absBlack);
  btnRocker.name = "recline_btn_rocker_mesh";
  btnRocker.position.y = 0.006;
  reclineBtnGrp.add(btnBezel, btnRocker);
  rightHardwareGrp.add(reclineBtnGrp);

  const socketPos = new THREE.Vector3(-0.481, 0.258, 0.005);
  const socketGrp = new THREE.Group();
  socketGrp.name = "chrome_socket_grp";
  socketGrp.position.copy(socketPos);
  socketGrp.rotation.z = Math.PI / 2;
  const socketMesh = new THREE.Mesh(
    latheProfile(
      [
        [0, 0],
        [0.016, 0],
        [0.017, 0.008],
        [0.012, 0.012],
        [0.012, 0.022],
        [0.015, 0.024],
        [0.015, 0.03],
        [0, 0.03],
      ],
      { segments: 28 },
    ),
    chromeMat,
  );
  socketMesh.name = "chrome_socket_collar_mesh";
  socketGrp.add(socketMesh);
  rightHardwareGrp.add(socketGrp);

  const gooseneckPivot = new THREE.Group();
  gooseneckPivot.name = "gooseneck_mount_grp";
  gooseneckPivot.position.copy(socketPos);
  rightHardwareGrp.add(gooseneckPivot);

  // Gooseneck arches up to KOYA's eye level (~0.725m world Y) matching 01-front.webp & 03-right-side.webp
  const armCurvePts = [
    [0.0, 0.0, 0.0],
    [-0.016, 0.025, 0.004],
    [-0.018, 0.105, 0.028],
    [-0.088, 0.205, 0.175],
    [-0.165, 0.315, 0.305],
    [-0.085, 0.405, 0.245],
    [0.165, 0.468, 0.135],
  ];
  const gooseneckTube = new THREE.Mesh(
    tubeAlong(armCurvePts, { radius: 0.0085, tubularSegments: 96, radialSegments: 16 }),
    flexRubber,
  );
  gooseneckTube.name = "gooseneck_tube_mesh";
  gooseneckPivot.add(gooseneckTube);

  const clampGrp = new THREE.Group();
  clampGrp.name = "phone_clamp_head_grp";
  clampGrp.position.set(0.172, 0.47, 0.132);
  clampGrp.rotation.set(0.04, 0.06, 0.02);

  const ballNut = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 16), absBlack);
  ballNut.name = "phone_clamp_ball_mesh";
  ballNut.position.set(-0.008, 0, 0.008);

  const clampBody = new THREE.Mesh(roundedBox(0.162, 0.078, 0.016, 0.005, 3), absBlack);
  clampBody.name = "phone_clamp_body_mesh";
  clampBody.position.set(0.015, 0, -0.008);

  const jawTop = new THREE.Mesh(roundedBox(0.048, 0.009, 0.026, 0.003, 2), absBlack);
  jawTop.name = "phone_clamp_jaw_top_mesh";
  jawTop.position.set(0.015, 0.038, -0.012);

  const jawBot = new THREE.Mesh(roundedBox(0.048, 0.009, 0.026, 0.003, 2), absBlack);
  jawBot.name = "phone_clamp_jaw_bot_mesh";
  jawBot.position.set(0.015, -0.038, -0.012);

  clampGrp.add(ballNut, clampBody, jawTop, jawBot);
  gooseneckPivot.add(clampGrp);

  // Star embroidery patch on -X flank
  const starMat = new THREE.MeshStandardMaterial({
    map: createStarPatchTexture(),
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.75,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const starPatchGeo = deformGeometry(new THREE.PlaneGeometry(0.095, 0.095, 14, 14), (v) => {
    const wy = 0.285 + v.y;
    const yNorm = THREE.MathUtils.clamp((wy - 0.054) / 0.396, 0, 1);
    const belly = Math.sin(yNorm * Math.PI) * 0.028;
    const bottomTaper = (1 - THREE.MathUtils.smoothstep(yNorm, 0, 0.36)) * 0.042;
    v.z = belly - bottomTaper + 0.003;
  });
  const starPatch = new THREE.Mesh(starPatchGeo, starMat);
  starPatch.name = "right_flank_star_patch_mesh";
  starPatch.rotation.y = -Math.PI / 2;
  starPatch.position.set(-0.456, 0.285, 0.245);
  rightHardwareGrp.add(starPatch);

  // Left flank (+X) Zz bubble + green leaf embroidery patch
  const leftPatchesGrp = new THREE.Group();
  leftPatchesGrp.name = "left_flank_patches_grp";
  const zzLeafMat = new THREE.MeshStandardMaterial({
    map: createZzLeafPatchTexture(),
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.75,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const zzPatchGeo = deformGeometry(new THREE.PlaneGeometry(0.22, 0.22, 16, 16), (v) => {
    const wy = 0.225 + v.y;
    const yNorm = THREE.MathUtils.clamp((wy - 0.054) / 0.396, 0, 1);
    const belly = Math.sin(yNorm * Math.PI) * 0.028;
    const bottomTaper = (1 - THREE.MathUtils.smoothstep(yNorm, 0, 0.36)) * 0.042;
    v.z = belly - bottomTaper + 0.003;
  });
  const zzPatch = new THREE.Mesh(zzPatchGeo, zzLeafMat);
  zzPatch.name = "left_flank_zz_leaf_patch_mesh";
  zzPatch.rotation.y = Math.PI / 2;
  zzPatch.position.set(0.456, 0.225, 0.205);
  leftPatchesGrp.add(zzPatch);
  tubGrp.add(leftPatchesGrp);

  // =========================================================================
  // 9. Interactive Articulation State & Kinematics
  // =========================================================================
  const params = {
    recline: 0,
    swivelDeg: 0,
    phoneArmSwing: 0,
    showPhoneHolder: 1,
  };

  const paramSpecs = {
    recline: { min: 0, max: 1, step: 0.01, label: "Power Recline" },
    swivelDeg: { min: -120, max: 120, step: 1, label: "Swivel (deg)" },
    phoneArmSwing: { min: -25, max: 35, step: 1, label: "Phone Arm Swing" },
    showPhoneHolder: { min: 0, max: 1, step: 1, label: "Phone Holder (0/1)" },
  };

  function update(state) {
    const r = THREE.MathUtils.clamp(state.recline, 0, 1);

    const backTiltRad = THREE.MathUtils.degToRad(12 + r * 22);
    backrestHinge.rotation.x = -backTiltRad;

    const footPy = THREE.MathUtils.lerp(0.256, 0.432, Math.pow(r, 0.78));
    const footPz = THREE.MathUtils.lerp(0.352, 0.568, r);
    const footRotX = -THREE.MathUtils.degToRad(r * 86);

    footrestPivot.position.set(0, footPy, footPz);
    footrestPivot.rotation.x = footRotX;

    scissor.updateLinkage(footPy, footPz, footRotX);

    swivelGrp.rotation.y = THREE.MathUtils.degToRad(state.swivelDeg);

    gooseneckPivot.visible = state.showPhoneHolder >= 0.5;
    gooseneckPivot.rotation.y = THREE.MathUtils.degToRad(state.phoneArmSwing);
  }

  return {
    root,
    params,
    paramSpecs,
    update,
    metadata: {
      name: "BT21 KOYA Sofa Recliner",
      category: "Furniture",
      summary:
        "TTRacing ORA plush velour power-recliner with synchronized scissor footrest, 240° swivel ring base, and gooseneck phone mount",
      units: "meters",
    },
  };
}
