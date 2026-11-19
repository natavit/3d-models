import * as THREE from "three";
import { noiseBumpTexture } from "../../src/kit/materials.js";

// Official 64x64 Google Cloud brand grid scaled to meters (1 grid unit = 0.01 m)
const R_TUBE = 0.05565; // 11.13 / 2 * 0.01
const C_LEFT = { x: -0.13915, y: 0.18085, R: 0.1252 };
const C_RIGHT = { x: 0.13915, y: 0.18085, R: 0.1252 };
const C_TOP = { x: 0.0, y: 0.2648, R: 0.1944 };
const K_45 = 0.28516; // Master 45-deg seam line: y - x = K_45

const SEAM_HALF_GAP = 0.00038; // 0.38 mm per side -> 0.76 mm crisp reveal groove
const MATED_BEVEL_R = 0.0036; // 3.6 mm cushion bevel on interlocking seams
const HOOK_TIP_BEVEL_R = 0.0062; // 6.2 mm plush bevel on Yellow's exposed free C-hook tip

function intersectCircle45(cx, cy, radius, sdOffset, chooseUpperRight) {
  const pc = (cx + cy) * Math.SQRT1_2;
  const qc = (cy - cx) * Math.SQRT1_2;
  const q = K_45 * Math.SQRT1_2 + sdOffset;
  const disc = Math.max(0, radius * radius - (q - qc) * (q - qc));
  const root = Math.sqrt(disc);
  const p = chooseUpperRight ? pc + root : pc - root;
  const x = (p - q) * Math.SQRT1_2;
  const y = (p + q) * Math.SQRT1_2;
  return { x, y, theta: Math.atan2(y - cy, x - cx) };
}

function intersectCircleCircleAngle(c1x, c1y, r1, c2x, c2y, r2, branchSign) {
  const vx = c2x - c1x;
  const vy = c2y - c1y;
  const d = Math.hypot(vx, vy);
  const base = Math.atan2(vy, vx);
  const cosA = THREE.MathUtils.clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1);
  const alpha = Math.acos(cosA);
  const theta = base + branchSign * alpha;
  return {
    x: c1x + r1 * Math.cos(theta),
    y: c1y + r1 * Math.sin(theta),
    theta,
  };
}

/**
 * Builds a closed manifold tubular mesh with concentric sculpted end-caps and
 * independent start/end quarter-round fillets.
 */
function buildBeveledSweepMesh(
  sampleFiberFn,
  {
    bodySteps = 96,
    bevelSteps = 12,
    capRings = 6,
    radialSegs = 72,
    bevelStart = MATED_BEVEL_R,
    bevelEnd = MATED_BEVEL_R,
    occludeStart = true,
    occludeEnd = true,
  } = {},
) {
  const rFlatStart = R_TUBE - bevelStart;
  const rFlatEnd = R_TUBE - bevelEnd;
  const stations = [];

  // 1. Concentric start cap rings (from inner ring outward to rFlatStart at d = 0)
  for (let c = 1; c < capRings; c++) {
    stations.push({
      end: "start",
      d: 0,
      u: 0,
      rEff: (c / capRings) * rFlatStart,
      ao: occludeStart ? 0.68 : 0.98,
      bevelStart,
      bevelEnd,
    });
  }

  // 2. Start quarter-round fillet (alpha: 0 -> pi/2)
  for (let i = 0; i <= bevelSteps; i++) {
    const t = i / bevelSteps;
    const a = t * (Math.PI / 2);
    stations.push({
      end: "start",
      d: bevelStart * (1 - Math.cos(a)),
      u: 0,
      rEff: rFlatStart + bevelStart * Math.sin(a),
      ao: occludeStart ? THREE.MathUtils.lerp(0.72, 1.0, Math.sin(a)) : 1.0,
      bevelStart,
      bevelEnd,
    });
  }

  // 3. Smooth main body stations
  for (let i = 1; i < bodySteps; i++) {
    stations.push({
      end: "body",
      d: 0,
      u: i / bodySteps,
      rEff: R_TUBE,
      ao: 1.0,
      bevelStart,
      bevelEnd,
    });
  }

  // 4. End quarter-round fillet (alpha: pi/2 -> 0)
  for (let i = 0; i <= bevelSteps; i++) {
    const a = ((bevelSteps - i) / bevelSteps) * (Math.PI / 2);
    stations.push({
      end: "end",
      d: bevelEnd * (1 - Math.cos(a)),
      u: 1,
      rEff: rFlatEnd + bevelEnd * Math.sin(a),
      ao: occludeEnd ? THREE.MathUtils.lerp(0.72, 1.0, Math.sin(a)) : 1.0,
      bevelStart,
      bevelEnd,
    });
  }

  // 5. Concentric end cap rings (from rFlatEnd inward toward end pole at d = 0)
  for (let c = capRings - 1; c >= 1; c--) {
    stations.push({
      end: "end",
      d: 0,
      u: 1,
      rEff: (c / capRings) * rFlatEnd,
      ao: occludeEnd ? 0.68 : 0.98,
      bevelStart,
      bevelEnd,
    });
  }

  const ringCount = stations.length;
  const rings = [];
  const ringCenters = [];

  for (let s = 0; s < ringCount; s++) {
    const st = stations[s];
    const ring = [];
    let sx = 0;
    let sy = 0;
    let sz = 0;

    for (let j = 0; j < radialSegs; j++) {
      const phi = (j / radialSegs) * Math.PI * 2;
      const delta = st.rEff * Math.cos(phi);
      const z = st.rEff * Math.sin(phi);
      const pt = sampleFiberFn(st, delta, z, phi);
      ring.push(pt);
      sx += pt[0];
      sy += pt[1];
      sz += pt[2];
    }
    rings.push(ring);
    ringCenters.push([sx / radialSegs, sy / radialSegs, sz / radialSegs]);
  }

  const startPole = sampleFiberFn(
    { end: "start", d: 0, u: 0, rEff: 0, bevelStart, bevelEnd },
    0,
    0,
    0,
  );
  const endPole = sampleFiberFn(
    { end: "end", d: 0, u: 1, rEff: 0, bevelStart, bevelEnd },
    0,
    0,
    0,
  );

  const positions = [];
  const uvs = [];
  const colors = [];

  const startAo = occludeStart ? 0.66 : 0.98;
  const endAo = occludeEnd ? 0.66 : 0.98;

  positions.push(startPole[0], startPole[1], startPole[2]);
  uvs.push(0, 0.5);
  colors.push(startAo, startAo, startAo);

  for (let s = 0; s < ringCount; s++) {
    const uCoord = s / (ringCount - 1);
    const ao = stations[s].ao;
    for (let j = 0; j < radialSegs; j++) {
      const p = rings[s][j];
      positions.push(p[0], p[1], p[2]);
      uvs.push(uCoord, j / radialSegs);
      colors.push(ao, ao, ao);
    }
  }

  const endPoleIdx = 1 + ringCount * radialSegs;
  positions.push(endPole[0], endPole[1], endPole[2]);
  uvs.push(1, 0.5);
  colors.push(endAo, endAo, endAo);

  const midS = Math.floor(ringCount / 2);
  const pA = new THREE.Vector3(...rings[midS][0]);
  const pB = new THREE.Vector3(...rings[midS + 1][0]);
  const pC = new THREE.Vector3(...rings[midS][1]);
  const ctr = new THREE.Vector3(...ringCenters[midS]);
  const triNormal = new THREE.Vector3()
    .subVectors(pB, pA)
    .cross(new THREE.Vector3().subVectors(pC, pA));
  const outwardDir = new THREE.Vector3().subVectors(pA, ctr);
  const flip = triNormal.dot(outwardDir) < 0;

  const indices = [];
  const ringVertex = (s, j) => 1 + s * radialSegs + (j % radialSegs);
  const pushTri = (a, b, c) => {
    if (flip) indices.push(a, c, b);
    else indices.push(a, b, c);
  };

  for (let j = 0; j < radialSegs; j++) {
    pushTri(0, ringVertex(0, j), ringVertex(0, j + 1));
  }

  for (let s = 0; s < ringCount - 1; s++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = ringVertex(s, j);
      const b = ringVertex(s + 1, j);
      const c = ringVertex(s + 1, j + 1);
      const d = ringVertex(s, j + 1);
      pushTri(a, b, c);
      pushTri(a, c, d);
    }
  }

  const lastS = ringCount - 1;
  for (let j = 0; j < radialSegs; j++) {
    pushTri(ringVertex(lastS, j), endPoleIdx, ringVertex(lastS, j + 1));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function unwrapAngleCCW(startAngle, endAngle) {
  let e = endAngle;
  while (e <= startAngle) e += Math.PI * 2;
  return e;
}

function unwrapAngleCW(startAngle, endAngle) {
  let e = endAngle;
  while (e >= startAngle) e -= Math.PI * 2;
  return e;
}

function buildYellowGeometry() {
  return buildBeveledSweepMesh(
    (st, delta, z) => {
      const r = C_LEFT.R + delta;
      // Start is the free inner C-hook tip (no neighbor, so starts right on K_45)
      const sdStart = st.end === "start" ? st.d : st.bevelStart;
      // End mates with Green across the 45-deg seam
      const sdEnd = SEAM_HALF_GAP + (st.end === "end" ? st.d : st.bevelEnd);

      const pStart = intersectCircle45(C_LEFT.x, C_LEFT.y, r, sdStart, true);
      const pEnd = intersectCircle45(C_LEFT.x, C_LEFT.y, r, sdEnd, false);

      if (st.end === "start") return [pStart.x, pStart.y, z];
      if (st.end === "end") return [pEnd.x, pEnd.y, z];

      const th0 = pStart.theta;
      const th1 = unwrapAngleCCW(th0, pEnd.theta);
      const th = THREE.MathUtils.lerp(th0, th1, st.u);
      return [C_LEFT.x + r * Math.cos(th), C_LEFT.y + r * Math.sin(th), z];
    },
    {
      bodySteps: 108,
      bevelSteps: 14,
      radialSegs: 72,
      bevelStart: HOOK_TIP_BEVEL_R,
      bevelEnd: MATED_BEVEL_R,
      occludeStart: false,
      occludeEnd: true,
    },
  );
}

function buildRedGeometry() {
  return buildBeveledSweepMesh(
    (st, delta, z) => {
      const r = C_TOP.R + delta;
      const dLeft = SEAM_HALF_GAP + (st.end === "start" ? st.d : st.bevelStart);
      const dRight = SEAM_HALF_GAP + (st.end === "end" ? st.d : st.bevelEnd);

      // True 3D toroidal saddle: match Yellow's circular cross-section at height z
      const shellR = R_TUBE + dLeft;
      const yellowBarrelAtZ = C_LEFT.R + Math.sqrt(Math.max(0.0001, shellR * shellR - z * z));

      const pLeft = intersectCircleCircleAngle(
        C_TOP.x,
        C_TOP.y,
        r,
        C_LEFT.x,
        C_LEFT.y,
        yellowBarrelAtZ,
        -1,
      );
      const pRight = intersectCircle45(C_TOP.x, C_TOP.y, r, dRight, true);

      if (st.end === "start") return [pLeft.x, pLeft.y, z];
      if (st.end === "end") return [pRight.x, pRight.y, z];

      const th0 = pLeft.theta;
      const th1 = unwrapAngleCW(th0, pRight.theta);
      const th = THREE.MathUtils.lerp(th0, th1, st.u);
      return [C_TOP.x + r * Math.cos(th), C_TOP.y + r * Math.sin(th), z];
    },
    { bodySteps: 88, bevelSteps: 12, radialSegs: 72 },
  );
}

function buildGreenGeometry() {
  return buildBeveledSweepMesh(
    (st, delta, z) => {
      const r = C_LEFT.R + delta;
      const yLine = C_LEFT.y - r;

      const dStart = SEAM_HALF_GAP + (st.end === "start" ? st.d : st.bevelStart);
      const dEnd = SEAM_HALF_GAP + (st.end === "end" ? st.d : st.bevelEnd);

      const pStart = intersectCircle45(C_LEFT.x, C_LEFT.y, r, -dStart, false);
      const xEnd = -dEnd;

      if (st.end === "start") return [pStart.x, pStart.y, z];
      if (st.end === "end") return [xEnd, yLine, z];

      const th0 = pStart.theta;
      const thTangent = unwrapAngleCCW(th0, -Math.PI / 2);
      const arcLen = Math.max(0.001, (thTangent - th0) * r);
      const lineLen = Math.max(0.001, xEnd - C_LEFT.x);
      const totalLen = arcLen + lineLen;
      const sDist = st.u * totalLen;

      if (sDist <= arcLen) {
        const th = th0 + (sDist / arcLen) * (thTangent - th0);
        return [C_LEFT.x + r * Math.cos(th), C_LEFT.y + r * Math.sin(th), z];
      }
      const x = C_LEFT.x + (sDist - arcLen);
      return [x, yLine, z];
    },
    { bodySteps: 72, bevelSteps: 12, radialSegs: 72 },
  );
}

function buildBlueGeometry() {
  return buildBeveledSweepMesh(
    (st, delta, z) => {
      const rTop = C_TOP.R + delta;
      const rRight = C_RIGHT.R + delta;
      const yBottom = C_RIGHT.y - rRight;

      const dStart = SEAM_HALF_GAP + (st.end === "start" ? st.d : st.bevelStart);
      const dEnd = SEAM_HALF_GAP + (st.end === "end" ? st.d : st.bevelEnd);

      const pStart = intersectCircle45(C_TOP.x, C_TOP.y, rTop, -dStart, true);
      const xEnd = dEnd;

      if (st.end === "start") return [pStart.x, pStart.y, z];
      if (st.end === "end") return [xEnd, yBottom, z];

      const pMiter = intersectCircleCircleAngle(
        C_TOP.x,
        C_TOP.y,
        rTop,
        C_RIGHT.x,
        C_RIGHT.y,
        rRight,
        1,
      );

      const thTop0 = pStart.theta;
      const thTop1 = unwrapAngleCW(thTop0, pMiter.theta);
      const lenTop = Math.max(0.001, (thTop0 - thTop1) * rTop);

      const thRight0 = Math.atan2(pMiter.y - C_RIGHT.y, pMiter.x - C_RIGHT.x);
      const thRight1 = unwrapAngleCW(thRight0, -Math.PI / 2);
      const lenRight = Math.max(0.001, (thRight0 - thRight1) * rRight);

      const lenBottom = Math.max(0.001, C_RIGHT.x - xEnd);
      const totalLen = lenTop + lenRight + lenBottom;
      const sDist = st.u * totalLen;

      // Adaptive quadratic fillet across the shoulder saddle (crisp at outer cusp, smooth on inner corner)
      const innerFactor = THREE.MathUtils.clamp((R_TUBE - delta) / (2 * R_TUBE), 0, 1);
      const miterZone = THREE.MathUtils.lerp(0.0024, 0.0065, innerFactor);

      if (Math.abs(sDist - lenTop) < miterZone) {
        const sBefore = Math.max(0, lenTop - miterZone);
        const thB = thTop0 - (sBefore / lenTop) * (thTop0 - thTop1);
        const ax = C_TOP.x + rTop * Math.cos(thB);
        const ay = C_TOP.y + rTop * Math.sin(thB);

        const sAfter = Math.min(lenRight, miterZone);
        const thA = thRight0 - (sAfter / lenRight) * (thRight0 - thRight1);
        const cx = C_RIGHT.x + rRight * Math.cos(thA);
        const cy = C_RIGHT.y + rRight * Math.sin(thA);

        const t = (sDist - (lenTop - miterZone)) / (2 * miterZone);
        const omt = 1 - t;
        return [
          omt * omt * ax + 2 * omt * t * pMiter.x + t * t * cx,
          omt * omt * ay + 2 * omt * t * pMiter.y + t * t * cy,
          z,
        ];
      }

      if (sDist < lenTop) {
        const th = thTop0 - (sDist / lenTop) * (thTop0 - thTop1);
        return [C_TOP.x + rTop * Math.cos(th), C_TOP.y + rTop * Math.sin(th), z];
      }

      const s2 = sDist - lenTop;
      if (s2 <= lenRight) {
        const th = thRight0 - (s2 / lenRight) * (thRight0 - thRight1);
        return [C_RIGHT.x + rRight * Math.cos(th), C_RIGHT.y + rRight * Math.sin(th), z];
      }

      const x = C_RIGHT.x - (s2 - lenRight);
      return [x, yBottom, z];
    },
    { bodySteps: 180, bevelSteps: 12, radialSegs: 72 },
  );
}

function googleBrandPolymer(hexColor) {
  const microGrain = noiseBumpTexture({ size: 256, contrast: 12, repeat: 8, seed: 314 });
  return new THREE.MeshPhysicalMaterial({
    color: hexColor,
    vertexColors: true,
    metalness: 0.0,
    roughness: 0.44,
    ior: 1.46,
    clearcoat: 0.16,
    clearcoatRoughness: 0.36,
    envMapIntensity: 0.38,
    bumpMap: microGrain,
    bumpScale: 0.00016,
  });
}

export function buildModel() {
  const root = new THREE.Group();
  root.name = "google_cloud_logo_root";

  const centerPivotY = 0.2574;
  const turntableGrp = new THREE.Group();
  turntableGrp.name = "cloud_turntable_grp";
  turntableGrp.position.set(0, centerPivotY, 0);
  root.add(turntableGrp);

  const createSegmentGroup = (name) => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(0, -centerPivotY, 0);
    turntableGrp.add(grp);
    return grp;
  };

  const redGrp = createSegmentGroup("red_arch_grp");
  const blueGrp = createSegmentGroup("blue_lobe_grp");
  const greenGrp = createSegmentGroup("green_base_grp");
  const yellowGrp = createSegmentGroup("yellow_c_ring_grp");

  const redMesh = new THREE.Mesh(buildRedGeometry(), googleBrandPolymer(0xea4335));
  redMesh.name = "red_arch_mesh";
  redGrp.add(redMesh);

  const blueMesh = new THREE.Mesh(buildBlueGeometry(), googleBrandPolymer(0x4285f4));
  blueMesh.name = "blue_lobe_mesh";
  blueGrp.add(blueMesh);

  const greenMesh = new THREE.Mesh(buildGreenGeometry(), googleBrandPolymer(0x34a853));
  greenMesh.name = "green_base_mesh";
  greenGrp.add(greenMesh);

  const yellowMesh = new THREE.Mesh(buildYellowGeometry(), googleBrandPolymer(0xfbbc05));
  yellowMesh.name = "yellow_c_ring_mesh";
  yellowGrp.add(yellowMesh);

  const params = {
    assemblySpread: 0,
    yellowReliefZ: 0,
    turntableDeg: 0,
    tiltDeg: 0,
  };

  const paramSpecs = {
    assemblySpread: { min: 0, max: 1, step: 0.01, label: "4-Segment Spread" },
    yellowReliefZ: { min: -0.008, max: 0.008, step: 0.0005, label: "Yellow Z-Relief (m)" },
    turntableDeg: { min: -180, max: 180, step: 1, label: "Turntable (deg)" },
    tiltDeg: { min: -20, max: 20, step: 0.5, label: "Tilt (deg)" },
  };

  function update(state) {
    const s = state.assemblySpread * 0.085;
    redGrp.position.set(-0.28 * s, -centerPivotY + 0.92 * s, 0);
    blueGrp.position.set(0.94 * s, -centerPivotY + 0.18 * s, 0);
    greenGrp.position.set(-0.32 * s, -centerPivotY - 0.9 * s, 0);
    yellowGrp.position.set(-0.95 * s, -centerPivotY + 0.15 * s, state.yellowReliefZ + 0.18 * s);

    turntableGrp.rotation.y = THREE.MathUtils.degToRad(state.turntableDeg);
    turntableGrp.rotation.x = THREE.MathUtils.degToRad(state.tiltDeg);
  }

  return {
    root,
    params,
    paramSpecs,
    update,
    metadata: {
      name: "Google Cloud Logo",
      category: "Brand Icons",
      summary: "Plush tubular 4-piece sculpture built on Google's 64x64 brand grid with a 3D toroidal saddle joint",
      units: "meters",
    },
  };
}
