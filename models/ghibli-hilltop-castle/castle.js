import * as THREE from "three";
import { csgSubtract } from "../../src/kit/csg.js";
import {
  deformGeometry,
  extrudeProfile,
  latheProfile,
  placeAroundRing,
  roundedBox,
  tubeAlong,
} from "../../src/kit/shapes.js";
import { sampleTerrainInfo } from "./terrain.js";

function buildFlaredConeRoof(radius, height, paletteMat, segments = 48, flare = 0.22) {
  const pts = [[0, height]];
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps; // 0 apex -> 1 eave
    const r = radius * (t + flare * Math.pow(t, 2.8)) / (1 + flare);
    const y = height * (1 - t);
    pts.push([r, y]);
  }
  // Eave thickness lip
  pts.push([radius, -0.008], [Math.max(0, radius - 0.018), -0.008], [0, height - 0.02]);
  return new THREE.Mesh(latheProfile(pts, { segments }), paletteMat);
}

function buildPitchedGableRoof(width, length, roofHeight, overhang, roofMat, timberMat) {
  const grp = new THREE.Group();
  const hw = width * 0.5 + overhang;
  const fullLen = length + overhang * 2;
  const thick = 0.016;

  // Triangular roof cross-section extruded along Z (length + 2*overhang)
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(0, roofHeight);
  shape.lineTo(hw, 0);
  shape.lineTo(hw - thick, -thick * 0.6);
  shape.lineTo(0, roofHeight - thick * 1.15);
  shape.lineTo(-hw + thick, -thick * 0.6);
  shape.closePath();

  const roofGeo = extrudeProfile(shape, {
    depth: fullLen,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    centerZ: true,
  });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.name = "pitched_gable_roof_mesh";
  grp.add(roofMesh);

  // Sculpted terracotta ridge cap tiles + timber bargeboards & exposed rafter tails
  const ridgeCount = Math.max(5, Math.round(fullLen / 0.024));
  const tileLen = fullLen / ridgeCount;
  const ridgeTileGeo = new THREE.CylinderGeometry(0.0095, 0.0105, tileLen * 0.92, 10, 1, false, 0, Math.PI);
  ridgeTileGeo.rotateZ(Math.PI / 2);
  ridgeTileGeo.rotateY(Math.PI / 2);
  for (let i = 0; i < ridgeCount; i++) {
    const rt = new THREE.Mesh(ridgeTileGeo, roofMat);
    rt.name = `roof_ridge_tile_${i}_mesh`;
    rt.position.set(0, roofHeight - 0.002, -fullLen * 0.5 + (i + 0.5) * tileLen);
    grp.add(rt);
  }

  // Dark-oak sloped bargeboards framing both gable ends
  const slopeLen = Math.hypot(hw, roofHeight);
  const slopeAngle = Math.atan2(roofHeight, hw);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const barge = new THREE.Mesh(
        roundedBox(slopeLen + 0.008, 0.011, 0.009, 0.0015, 2),
        timberMat,
      );
      barge.name = "roof_gable_bargeboard_mesh";
      barge.position.set(sx * hw * 0.5, roofHeight * 0.5 - 0.004, sz * (fullLen * 0.5 - 0.003));
      barge.rotation.z = -sx * slopeAngle;
      grp.add(barge);
    }
  }

  // Exposed wooden eave rafter tails under both side eaves
  const rafterCount = Math.max(4, Math.round(length / 0.036));
  const rafterGeo = roundedBox(0.022, 0.006, 0.006, 0.001, 1);
  for (let r = 0; r <= rafterCount; r++) {
    const rz = -length * 0.48 + (r / rafterCount) * (length * 0.96);
    for (const sx of [-1, 1]) {
      const raf = new THREE.Mesh(rafterGeo, timberMat);
      raf.name = "roof_eave_rafter_mesh";
      raf.position.set(sx * (hw - 0.01), -0.005, rz);
      raf.rotation.z = -sx * slopeAngle * 0.65;
      grp.add(raf);
    }
  }

  return grp;
}

function buildWindowUnit(w, h, palette, namePrefix = "win") {
  const grp = new THREE.Group();
  grp.name = `${namePrefix}_grp`;
  const frame = new THREE.Mesh(roundedBox(w + 0.008, h + 0.008, 0.01, 0.002, 2), palette.darkTimber);
  frame.name = `${namePrefix}_frame_mesh`;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), palette.windowGlow);
  pane.name = `${namePrefix}_pane_mesh`;
  pane.position.z = 0.0055;
  const sill = new THREE.Mesh(roundedBox(w + 0.016, 0.006, 0.016, 0.0015, 2), palette.stoneWall);
  sill.name = `${namePrefix}_sill_mesh`;
  sill.position.set(0, -h * 0.5 - 0.003, 0.003);
  grp.add(frame, pane, sill);
  return grp;
}

function buildHalfTimberWing({
  name,
  width,
  depth,
  stoneH,
  stuccoH,
  roofH,
  palette,
  chimneySide = 0,
}) {
  const grp = new THREE.Group();
  grp.name = `${name}_grp`;

  // 1. Stone ground-floor plinth (extends -0.05m downward to anchor firmly into uneven terrain)
  const stonePlinth = new THREE.Mesh(
    roundedBox(width, stoneH + 0.06, depth, 0.004, 2),
    palette.stoneWall,
  );
  stonePlinth.name = `${name}_stone_plinth_mesh`;
  stonePlinth.position.y = (stoneH - 0.06) * 0.5;
  grp.add(stonePlinth);

  // 2. Slightly jettied (overhanging) cream-stucco upper timber story
  const upW = width + 0.014;
  const upD = depth + 0.014;
  const stuccoBody = new THREE.Mesh(
    roundedBox(upW, stuccoH, upD, 0.003, 2),
    palette.creamStucco,
  );
  stuccoBody.name = `${name}_stucco_body_mesh`;
  stuccoBody.position.y = stoneH + stuccoH * 0.5;
  grp.add(stuccoBody);

  // Triangular stucco gable walls on +Z and -Z ends
  const gableTri = new THREE.Shape();
  gableTri.moveTo(-upW * 0.5, 0);
  gableTri.lineTo(0, roofH - 0.006);
  gableTri.lineTo(upW * 0.5, 0);
  gableTri.closePath();
  const gableWall = new THREE.Mesh(
    extrudeProfile(gableTri, {
      depth: upD - 0.004,
      bevelEnabled: false,
      centerZ: true,
    }),
    palette.creamStucco,
  );
  gableWall.name = `${name}_stucco_gable_mesh`;
  gableWall.position.y = stoneH + stuccoH;
  grp.add(gableWall);

  // 3. 3D Proud Dark-Oak Timber Framing (posts, horizontal girts, gable king-posts)
  const beamT = 0.008;
  // Horizontal jetty belt & eave plate
  for (const by of [stoneH, stoneH + stuccoH * 0.5, stoneH + stuccoH]) {
    const belt = new THREE.Mesh(
      roundedBox(upW + beamT, beamT, upD + beamT, 0.0015, 2),
      palette.darkTimber,
    );
    belt.name = `${name}_timber_belt_mesh`;
    belt.position.y = by;
    grp.add(belt);
  }

  // Corner & intermediate vertical timber posts
  for (const sx of [-1, 0, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(
        roundedBox(beamT, stuccoH + beamT, beamT, 0.0015, 2),
        palette.darkTimber,
      );
      post.name = `${name}_timber_post_mesh`;
      post.position.set(sx * (upW * 0.49), stoneH + stuccoH * 0.5, sz * (upD * 0.49));
      grp.add(post);
    }
  }

  // Gable end king-post & diagonal Tudor braces on +Z and -Z faces
  for (const sz of [-1, 1]) {
    const zPos = sz * (upD * 0.5);
    const kingPost = new THREE.Mesh(
      roundedBox(beamT, roofH - 0.01, beamT, 0.0015, 2),
      palette.darkTimber,
    );
    kingPost.name = `${name}_gable_kingpost_mesh`;
    kingPost.position.set(0, stoneH + stuccoH + roofH * 0.48, zPos);
    grp.add(kingPost);

    // Diagonal V-braces inside upper stucco bay & triangle gable
    for (const sx of [-1, 1]) {
      const diagGable = new THREE.Mesh(
        tubeAlong(
          [
            [sx * (upW * 0.04), stoneH + stuccoH + 0.004, zPos],
            [sx * (upW * 0.27), stoneH + stuccoH + roofH * 0.44, zPos],
          ],
          { radius: beamT * 0.42, tubularSegments: 4, radialSegments: 6 },
        ),
        palette.darkTimber,
      );
      diagGable.name = `${name}_gable_brace_mesh`;
      grp.add(diagGable);

      const diagWall = new THREE.Mesh(
        tubeAlong(
          [
            [sx * (upW * 0.48), stoneH + 0.004, zPos],
            [sx * (upW * 0.24), stoneH + stuccoH * 0.5, zPos],
          ],
          { radius: beamT * 0.42, tubularSegments: 4, radialSegments: 6 },
        ),
        palette.darkTimber,
      );
      diagWall.name = `${name}_wall_brace_mesh`;
      grp.add(diagWall);
    }

    // Gable window
    const gWin = buildWindowUnit(0.026, 0.032, palette, `${name}_gable_win_${sz > 0 ? "f" : "b"}`);
    gWin.position.set(0, stoneH + stuccoH + roofH * 0.34, zPos + sz * 0.002);
    if (sz < 0) gWin.rotation.y = Math.PI;
    grp.add(gWin);

    // Upper story twin windows on gable ends
    for (const wx of [-upW * 0.24, upW * 0.24]) {
      const win = buildWindowUnit(0.026, 0.034, palette, `${name}_end_win`);
      win.position.set(wx, stoneH + stuccoH * 0.52, zPos + sz * 0.002);
      if (sz < 0) win.rotation.y = Math.PI;
      grp.add(win);
    }
  }

  // Timber jetty corbel brackets under overhanging upper story + side windows
  for (const sx of [-1, 1]) {
    for (const kz of [-upD * 0.42, 0, upD * 0.42]) {
      const corbel = new THREE.Mesh(roundedBox(0.014, 0.018, 0.009, 0.002, 1), palette.darkTimber);
      corbel.name = `${name}_jetty_corbel_mesh`;
      corbel.position.set(sx * (width * 0.5 + 0.003), stoneH - 0.009, kz);
      grp.add(corbel);
    }
    for (const wz of [-upD * 0.26, upD * 0.26]) {
      const win = buildWindowUnit(0.026, 0.032, palette, `${name}_side_win`);
      win.position.set(sx * (upW * 0.5 + 0.002), stoneH + stuccoH * 0.52, wz);
      win.rotation.y = sx * (Math.PI / 2);
      grp.add(win);
    }
  }

  // 4. Pitched Terracotta Roof
  const roof = buildPitchedGableRoof(
    upW,
    upD,
    roofH,
    0.02,
    palette.terracottaRoof,
    palette.darkTimber,
  );
  roof.name = `${name}_roof_grp`;
  roof.position.y = stoneH + stuccoH;
  grp.add(roof);

  // 5. Optional Stone Chimney + Terracotta Chimney Pots
  if (chimneySide !== 0) {
    const chimGrp = new THREE.Group();
    chimGrp.name = `${name}_chimney_grp`;
    const chimH = stuccoH + roofH + 0.055;
    const stack = new THREE.Mesh(
      roundedBox(0.034, chimH, 0.038, 0.003, 2),
      palette.stoneWall,
    );
    stack.name = `${name}_chimney_stack_mesh`;
    stack.position.y = stoneH + chimH * 0.5 - 0.01;
    const cap = new THREE.Mesh(roundedBox(0.042, 0.01, 0.046, 0.002, 2), palette.stoneWall);
    cap.name = `${name}_chimney_cap_mesh`;
    cap.position.y = stoneH + chimH - 0.01;
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.009, 0.022, 14),
      palette.terracottaRoof,
    );
    pot.name = `${name}_chimney_pot_mesh`;
    pot.position.y = stoneH + chimH + 0.005;
    chimGrp.add(stack, cap, pot);
    chimGrp.position.set(chimneySide * (upW * 0.44), 0, -upD * 0.22);
    grp.add(chimGrp);
  }

  return grp;
}

function buildCurvedStoneViaduct(palette) {
  const grp = new THREE.Group();
  grp.name = "stone_viaduct_bridge_grp";

  // Smooth J-curve from right headland terrace (+0.19, 0.168, +0.31) across front ravine up to gatehouse (-0.11, 0.285, +0.185)
  const curvePts = [
    new THREE.Vector3(0.215, 0.162, 0.305),
    new THREE.Vector3(0.095, 0.196, 0.345),
    new THREE.Vector3(-0.025, 0.234, 0.335),
    new THREE.Vector3(-0.102, 0.268, 0.275),
    new THREE.Vector3(-0.112, 0.288, 0.188),
  ];
  const deckCurve = new THREE.CatmullRomCurve3(curvePts, false, "centripetal", 0.5);

  const steps = 64;
  const pts = deckCurve.getSpacedPoints(steps);
  const frames = deckCurve.computeFrenetFrames(steps, false);
  const halfBridgeW = 0.038;

  // Build curved stone viaduct wall body from y = 0.018 up to deck y(s)
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let i = 0; i <= steps; i++) {
    const p = pts[i];
    const t = frames.tangents[i];
    const side = new THREE.Vector3(-t.z, 0, t.x).normalize();

    const pLTop = [p.x - side.x * halfBridgeW, p.y, p.z - side.z * halfBridgeW];
    const pRTop = [p.x + side.x * halfBridgeW, p.y, p.z + side.z * halfBridgeW];
    const pLBot = [pLTop[0], 0.015, pLTop[2]];
    const pRBot = [pRTop[0], 0.015, pRTop[2]];

    // 4 vertices per station: 0=LTop, 1=RTop, 2=RBot, 3=LBot
    pos.push(...pLTop, ...pRTop, ...pRBot, ...pLBot);
    const u = (i / steps) * 4;
    uvs.push(u, 1, u, 0.8, u, 0, u, 0.2);
  }

  for (let i = 0; i < steps; i++) {
    const b = i * 4;
    const n = (i + 1) * 4;
    // Top deck (+Y)
    idx.push(b + 0, n + 0, n + 1, b + 0, n + 1, b + 1);
    // Right/outer face
    idx.push(b + 1, n + 1, n + 2, b + 1, n + 2, b + 2);
    // Bottom face
    idx.push(b + 2, n + 2, n + 3, b + 2, n + 3, b + 3);
    // Left/inner face
    idx.push(b + 3, n + 3, n + 0, b + 3, n + 0, b + 0);
  }
  // End caps
  idx.push(0, 1, 2, 0, 2, 3);
  const e = steps * 4;
  idx.push(e + 0, e + 3, e + 2, e + 0, e + 2, e + 1);

  const rawBridgeGeo = new THREE.BufferGeometry();
  rawBridgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  rawBridgeGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  rawBridgeGeo.setIndex(idx);
  rawBridgeGeo.computeVertexNormals();

  const rawBridgeMesh = new THREE.Mesh(rawBridgeGeo, palette.stoneBridge);

  // Subtract 3 tall vaulted arches along stations s = 0.25, 0.48, 0.70
  const cutters = [];
  const archSpecs = [
    { u: 0.24, w: 0.044, topOffset: 0.042 },
    { u: 0.47, w: 0.048, topOffset: 0.044 },
    { u: 0.7, w: 0.044, topOffset: 0.046 },
  ];

  for (const spec of archSpecs) {
    const p = deckCurve.getPointAt(spec.u);
    const tang = deckCurve.getTangentAt(spec.u);
    const yaw = Math.atan2(tang.x, tang.z);

    const hw = spec.w * 0.5;
    const archTop = p.y - spec.topOffset;
    const springY = archTop - hw;

    const archShape = new THREE.Shape();
    archShape.moveTo(-hw, 0.0);
    archShape.lineTo(hw, 0.0);
    archShape.lineTo(hw, Math.max(0.02, springY));
    archShape.absarc(0, Math.max(0.02, springY), hw, 0, Math.PI, false);
    archShape.lineTo(-hw, 0.0);

    const cutterGeo = extrudeProfile(archShape, {
      depth: 0.16,
      bevelEnabled: false,
      centerZ: true,
    });
    // Extrude is along Z, arch width is along X; align X along bridge tangent (`yaw - PI/2`)
    const cutter = new THREE.Mesh(cutterGeo, palette.stoneBridge);
    cutter.position.set(p.x, 0, p.z);
    cutter.rotation.y = yaw - Math.PI / 2;
    cutters.push(cutter);
  }

  const carvedViaduct = csgSubtract(rawBridgeMesh, cutters, palette.stoneBridge);
  carvedViaduct.name = "viaduct_arched_masonry_mesh";
  grp.add(carvedViaduct);

  // Full-height stone arch pier & voussoir trim registered identically to CSG arch cutters
  archSpecs.forEach((spec, ai) => {
    const p = deckCurve.getPointAt(spec.u);
    const tang = deckCurve.getTangentAt(spec.u);
    const yaw = Math.atan2(tang.x, tang.z);
    const hw = spec.w * 0.5;
    const outerHw = hw + 0.0065;
    const springY = Math.max(0.02, p.y - spec.topOffset - hw);

    const ringShape = new THREE.Shape();
    ringShape.moveTo(-outerHw, 0.015);
    ringShape.lineTo(-outerHw, springY);
    ringShape.absarc(0, springY, outerHw, Math.PI, 0, true);
    ringShape.lineTo(outerHw, 0.015);
    ringShape.lineTo(hw, 0.015);
    ringShape.lineTo(hw, springY);
    ringShape.absarc(0, springY, hw, 0, Math.PI, false);
    ringShape.lineTo(-hw, 0.015);
    ringShape.closePath();

    const ringGeo = extrudeProfile(ringShape, {
      depth: halfBridgeW * 2 + 0.003,
      bevelEnabled: false,
      centerZ: true,
    });
    const ring = new THREE.Mesh(ringGeo, palette.stoneBridge);
    ring.name = `viaduct_arch_voussoir_${ai}_mesh`;
    ring.userData.noAO = true;
    ring.userData.isExplodeTrim = true;
    ring.position.set(p.x, 0, p.z);
    ring.rotation.y = yaw - Math.PI / 2;
    grp.add(ring);
  });

  // Twin stone parapet walls + projecting deck cornice stringcourse + stepped stone treads
  for (const sideSign of [-1, 1]) {
    const wallPts = pts.map((p, i) => {
      const t = frames.tangents[i];
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      return [
        p.x + side.x * (halfBridgeW - 0.005) * sideSign,
        p.y + 0.009,
        p.z + side.z * (halfBridgeW - 0.005) * sideSign,
      ];
    });
    const parapet = new THREE.Mesh(
      tubeAlong(wallPts, { radius: 0.0085, tubularSegments: 56, radialSegments: 8 }),
      palette.stoneWall,
    );
    parapet.name = `viaduct_parapet_${sideSign < 0 ? "inner" : "outer"}_mesh`;
    grp.add(parapet);

    const cornicePts = pts.map((p, i) => {
      const t = frames.tangents[i];
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      return [
        p.x + side.x * (halfBridgeW + 0.002) * sideSign,
        p.y - 0.004,
        p.z + side.z * (halfBridgeW + 0.002) * sideSign,
      ];
    });
    const cornice = new THREE.Mesh(
      tubeAlong(cornicePts, { radius: 0.0045, tubularSegments: 56, radialSegments: 6 }),
      palette.stoneWall,
    );
    cornice.name = `viaduct_cornice_${sideSign < 0 ? "inner" : "outer"}_mesh`;
    grp.add(cornice);
  }

  // Stepped stone stair treads along the curved ramp
  const stepGeo = roundedBox(halfBridgeW * 1.65, 0.006, 0.016, 0.0015, 2);
  for (let s = 2; s < steps - 1; s += 3) {
    const p = pts[s];
    const t = frames.tangents[s];
    const tread = new THREE.Mesh(stepGeo, palette.stoneWall);
    tread.name = `viaduct_step_${s}_mesh`;
    tread.position.set(p.x, p.y + 0.003, p.z);
    tread.rotation.y = Math.atan2(t.x, t.z);
    grp.add(tread);
  }

  return grp;
}

function buildGatehouseAndWalls(palette) {
  const grp = new THREE.Group();
  grp.name = "gatehouse_and_walls_grp";

  const gx = -0.112;
  const gz = 0.145;
  const baseY = 0.23;
  const gateW = 0.135;
  const gateH = 0.21;
  const gateD = 0.105;

  const rawTower = new THREE.Mesh(
    roundedBox(gateW, gateH, gateD, 0.004, 2),
    palette.stoneWall,
  );
  rawTower.position.set(0, baseY + gateH * 0.5, 0);

  // Carve arched gate recess on +Z front face
  const portalShape = new THREE.Shape();
  portalShape.moveTo(-0.028, 0);
  portalShape.lineTo(0.028, 0);
  portalShape.lineTo(0.028, 0.055);
  portalShape.absarc(0, 0.055, 0.028, 0, Math.PI, false);
  portalShape.closePath();

  const portalCutter = new THREE.Mesh(
    extrudeProfile(portalShape, { depth: 0.04, bevelEnabled: false, centerZ: true }),
    palette.stoneWall,
  );
  portalCutter.position.set(0, 0.285, gateD * 0.5 - 0.005);

  const gateBody = csgSubtract(rawTower, [portalCutter], palette.stoneWall);
  gateBody.name = "gatehouse_masonry_mesh";

  const gateLocal = new THREE.Group();
  gateLocal.name = "gatehouse_tower_grp";
  gateLocal.position.set(gx, 0, gz);
  gateLocal.add(gateBody);

  // Arched oak double doors + iron strap hinges inside gate recess
  const doorMesh = new THREE.Mesh(
    extrudeProfile(portalShape, { depth: 0.01, bevelEnabled: false, centerZ: true }),
    palette.warmPlank,
  );
  doorMesh.name = "gatehouse_oak_doors_mesh";
  doorMesh.position.set(0, 0.285, gateD * 0.5 - 0.016);
  gateLocal.add(doorMesh);

  for (const hy of [0.308, 0.338]) {
    const strap = new THREE.Mesh(roundedBox(0.052, 0.004, 0.004, 0.001, 1), palette.darkIron);
    strap.name = "gatehouse_iron_hinge_mesh";
    strap.position.set(0, hy, gateD * 0.5 - 0.01);
    gateLocal.add(strap);
  }

  // Overhanging parapet corbel rim + crenellated merlons around all 4 sides
  const topY = baseY + gateH;
  const rim = new THREE.Mesh(
    roundedBox(gateW + 0.014, 0.014, gateD + 0.014, 0.002, 2),
    palette.stoneWall,
  );
  rim.name = "gatehouse_parapet_rim_mesh";
  rim.position.y = topY;
  gateLocal.add(rim);

  const merlonGeo = roundedBox(0.022, 0.022, 0.018, 0.002, 2);
  for (const mx of [-0.054, -0.018, 0.018, 0.054]) {
    for (const mz of [-gateD * 0.5, gateD * 0.5]) {
      const m = new THREE.Mesh(merlonGeo, palette.stoneWall);
      m.name = "gatehouse_merlon_mesh";
      m.position.set(mx, topY + 0.016, mz);
      gateLocal.add(m);
    }
  }
  for (const mz of [-0.022, 0.022]) {
    for (const mx of [-gateW * 0.5, gateW * 0.5]) {
      const m = new THREE.Mesh(merlonGeo, palette.stoneWall);
      m.name = "gatehouse_side_merlon_mesh";
      m.rotation.y = Math.PI / 2;
      m.position.set(mx, topY + 0.016, mz);
      gateLocal.add(m);
    }
  }

  grp.add(gateLocal);

  // Crenellated curtain wall extending northeast from gatehouse along ravine rim
  const curtainGrp = new THREE.Group();
  curtainGrp.name = "courtyard_curtain_wall_grp";
  curtainGrp.position.set(-0.032, 0.295, 0.125);
  curtainGrp.rotation.y = 0.32;

  const curtainWall = new THREE.Mesh(
    roundedBox(0.115, 0.145, 0.026, 0.003, 2),
    palette.stoneWall,
  );
  curtainWall.name = "courtyard_curtain_wall_mesh";
  curtainWall.position.y = 0.03;
  curtainGrp.add(curtainWall);

  for (const cmx of [-0.042, -0.014, 0.014, 0.042]) {
    const cm = new THREE.Mesh(roundedBox(0.018, 0.018, 0.028, 0.002, 2), palette.stoneWall);
    cm.name = "curtain_wall_merlon_mesh";
    cm.position.set(cmx, 0.11, 0);
    curtainGrp.add(cm);
  }
  grp.add(curtainGrp);

  // Courtyard stone steps leading up to the manor door
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(roundedBox(0.048, 0.012, 0.02, 0.002, 2), palette.stoneWall);
    st.name = `courtyard_stair_${i}_mesh`;
    st.position.set(0.048 - i * 0.006, 0.296 + i * 0.008, 0.042 - i * 0.018);
    grp.add(st);
  }

  return grp;
}

function buildCentralKeepAndTurrets(palette) {
  const grp = new THREE.Group();
  grp.name = "keep_and_turrets_grp";

  // 1. Hero Central Cylindrical Keep + Slate-Blue Conical Spire + Brass Rooster Weathervane
  const keepGrp = new THREE.Group();
  keepGrp.name = "central_keep_tower_grp";
  keepGrp.position.set(-0.015, 0.32, -0.205);

  const shaftH = 0.3;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.094, 0.104, shaftH + 0.08, 40),
    palette.stoneWall,
  );
  shaft.name = "keep_stone_shaft_mesh";
  shaft.position.y = (shaftH - 0.08) * 0.5;
  keepGrp.add(shaft);

  // Stone machicolation corbels around top of stone shaft
  const corbelRing = placeAroundRing(18, 0.097, (i) => {
    const c = new THREE.Mesh(roundedBox(0.016, 0.032, 0.022, 0.002, 2), palette.stoneWall);
    c.name = `keep_corbel_${i}_mesh`;
    c.position.y = shaftH - 0.012;
    return c;
  });
  corbelRing.name = "keep_corbels_grp";
  keepGrp.add(corbelRing);

  // Half-timbered circular watch-gallery drum
  const galH = 0.068;
  const galDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.108, galH, 36),
    palette.creamStucco,
  );
  galDrum.name = "keep_watch_gallery_mesh";
  galDrum.position.y = shaftH + galH * 0.5;
  keepGrp.add(galDrum);

  for (const gy of [shaftH, shaftH + galH]) {
    const ringBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.008, 36),
      palette.darkTimber,
    );
    ringBeam.name = "keep_gallery_ring_beam_mesh";
    ringBeam.position.y = gy;
    keepGrp.add(ringBeam);
  }

  const galPosts = placeAroundRing(12, 0.112, (i) => {
    const bay = new THREE.Group();
    bay.name = `keep_gallery_bay_${i}_grp`;
    const post = new THREE.Mesh(
      roundedBox(0.008, galH, 0.008, 0.001, 1),
      palette.darkTimber,
    );
    post.name = `keep_gallery_post_${i}_mesh`;
    bay.add(post);
    if (i % 2 === 0) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.028), palette.windowGlow);
      win.name = `keep_gallery_win_${i}_mesh`;
      win.rotation.y = Math.PI / 2;
      win.position.x = 0.003;
      bay.add(win);
    }
    return bay;
  });
  galPosts.name = "keep_gallery_bays_grp";
  galPosts.position.y = shaftH + galH * 0.5;
  keepGrp.add(galPosts);

  // Flared Slate-Blue Conical Spire
  const spireH = 0.225;
  const spire = buildFlaredConeRoof(0.142, spireH, palette.slateRoof, 48, 0.28);
  spire.name = "keep_slate_blue_spire_mesh";
  spire.position.y = shaftH + galH;
  keepGrp.add(spire);

  // Brass Finial + Weathervane Cross + Rooster Silhouette
  const vaneY = shaftH + galH + spireH;
  const finial = new THREE.Mesh(
    latheProfile(
      [
        [0, 0],
        [0.016, 0],
        [0.012, 0.015],
        [0.004, 0.055],
        [0.008, 0.06],
        [0.003, 0.068],
        [0, 0.082],
      ],
      { segments: 20 },
    ),
    palette.weatheredBrass,
  );
  finial.name = "keep_brass_finial_mesh";
  finial.position.y = vaneY - 0.006;
  keepGrp.add(finial);

  for (const rotY of [0, Math.PI / 2]) {
    const arrow = new THREE.Mesh(
      roundedBox(0.056, 0.003, 0.003, 0.001, 1),
      palette.weatheredBrass,
    );
    arrow.name = "weathervane_cross_arm_mesh";
    arrow.position.y = vaneY + 0.044;
    arrow.rotation.y = rotY;
    keepGrp.add(arrow);
  }

  // Sculpted 2D->3D brass rooster weathervane at the very apex
  const roosterShape = new THREE.Shape();
  roosterShape.moveTo(-0.006, 0);
  roosterShape.lineTo(0.008, 0);
  roosterShape.quadraticCurveTo(0.018, 0.008, 0.016, 0.022); // breast
  roosterShape.quadraticCurveTo(0.014, 0.032, 0.02, 0.034); // beak/comb
  roosterShape.quadraticCurveTo(0.01, 0.038, 0.006, 0.028); // neck
  roosterShape.quadraticCurveTo(-0.002, 0.018, -0.016, 0.03); // tail arch
  roosterShape.quadraticCurveTo(-0.024, 0.022, -0.014, 0.008); // tail plume
  roosterShape.closePath();

  const rooster = new THREE.Mesh(
    extrudeProfile(roosterShape, { depth: 0.0035, bevelEnabled: false, centerZ: true }),
    palette.weatheredBrass,
  );
  rooster.name = "keep_rooster_weathervane_mesh";
  rooster.position.set(0, vaneY + 0.055, 0);
  keepGrp.add(rooster);

  grp.add(keepGrp);

  // 2. Left & Right Flanking Terracotta Turrets
  const turretSpecs = [
    {
      name: "west_terracotta_turret",
      x: -0.155,
      y: 0.32,
      z: -0.205,
      r: 0.054,
      h: 0.255,
      roofH: 0.145,
      hasGallery: false,
    },
    {
      name: "east_terracotta_turret",
      x: 0.132,
      y: 0.32,
      z: -0.155,
      r: 0.05,
      h: 0.225,
      roofH: 0.14,
      hasGallery: true,
    },
  ];

  for (const ts of turretSpecs) {
    const tGrp = new THREE.Group();
    tGrp.name = `${ts.name}_grp`;
    tGrp.position.set(ts.x, ts.y, ts.z);

    const tShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(ts.r * 0.95, ts.r * 1.04, ts.h + 0.08, 32),
      palette.stoneWall,
    );
    tShaft.name = `${ts.name}_shaft_mesh`;
    tShaft.position.y = (ts.h - 0.08) * 0.5;
    tGrp.add(tShaft);

    let roofBaseY = ts.h;
    if (ts.hasGallery) {
      const gDrum = new THREE.Mesh(
        new THREE.CylinderGeometry(ts.r * 1.12, ts.r * 1.08, 0.048, 28),
        palette.creamStucco,
      );
      gDrum.name = `${ts.name}_gallery_mesh`;
      gDrum.position.y = ts.h + 0.024;
      tGrp.add(gDrum);
      roofBaseY += 0.048;
    }

    const tRoof = buildFlaredConeRoof(ts.r * 1.38, ts.roofH, palette.terracottaRoof, 36, 0.24);
    tRoof.name = `${ts.name}_roof_mesh`;
    tRoof.position.y = roofBaseY;
    tGrp.add(tRoof);

    const tPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0015, 0.005, 0.036, 12),
      palette.weatheredBrass,
    );
    tPin.name = `${ts.name}_finial_mesh`;
    tPin.position.y = roofBaseY + ts.roofH + 0.015;
    tGrp.add(tPin);

    grp.add(tGrp);
  }

  return grp;
}

function buildWindmillAndAirshipDock(palette) {
  const grp = new THREE.Group();
  grp.name = "windmill_and_dock_grp";

  const wx = 0.295;
  const wz = -0.025;
  const baseGroundY = sampleTerrainInfo(wx, wz).y;
  grp.position.set(wx, baseGroundY, wz);
  grp.rotation.y = -0.22; // Faces slightly front-left toward viewer like hero-3q.jpg

  // 1. Battered Cylindrical Stone Base + Arched Oak Door
  const stoneH = 0.115;
  const baseDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.092, stoneH + 0.06, 32),
    palette.stoneWall,
  );
  baseDrum.name = "windmill_stone_base_mesh";
  baseDrum.position.y = (stoneH - 0.06) * 0.5;
  grp.add(baseDrum);

  const millDoor = new THREE.Mesh(roundedBox(0.03, 0.052, 0.016, 0.012, 3), palette.warmPlank);
  millDoor.name = "windmill_oak_door_mesh";
  millDoor.position.set(-0.028, 0.026, 0.082);
  millDoor.rotation.y = -0.32;
  grp.add(millDoor);

  // 2. Tapered Octagonal Half-Timbered Tower Body
  const towerH = 0.205;
  const octTower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.078, towerH, 8),
    palette.creamStucco,
  );
  octTower.name = "windmill_octagonal_body_mesh";
  octTower.position.y = stoneH + towerH * 0.5;
  octTower.rotation.y = Math.PI / 8;
  grp.add(octTower);

  // Horizontal & vertical timber framing on the 8-sided windmill tower
  for (const ringFrac of [0, 0.48, 1.0]) {
    const rRing = THREE.MathUtils.lerp(0.08, 0.06, ringFrac);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(rRing, rRing, 0.008, 8),
      palette.darkTimber,
    );
    ring.name = "windmill_timber_ring_mesh";
    ring.position.y = stoneH + towerH * ringFrac;
    ring.rotation.y = Math.PI / 8;
    grp.add(ring);
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const ribPts = [
      [Math.cos(a) * 0.079, stoneH, Math.sin(a) * 0.079],
      [Math.cos(a) * 0.059, stoneH + towerH, Math.sin(a) * 0.059],
    ];
    const rib = new THREE.Mesh(
      tubeAlong(ribPts, { radius: 0.0038, tubularSegments: 6, radialSegments: 6 }),
      palette.darkTimber,
    );
    rib.name = `windmill_rib_${i}_mesh`;
    grp.add(rib);
  }

  // Glowing mill windows
  for (const wy of [stoneH + 0.055, stoneH + 0.145]) {
    const rAtY = THREE.MathUtils.lerp(0.076, 0.058, (wy - stoneH) / towerH);
    const win = buildWindowUnit(0.022, 0.028, palette, "windmill_win");
    win.position.set(0, wy, rAtY - 0.002);
    grp.add(win);
  }

  // 3. Conical / Octagonal Terracotta Cap Roof + Rotor Dormer Hood
  const capY = stoneH + towerH;
  const capRoof = buildFlaredConeRoof(0.082, 0.115, palette.terracottaRoof, 8, 0.18);
  capRoof.name = "windmill_cap_roof_mesh";
  capRoof.position.y = capY;
  capRoof.rotation.y = Math.PI / 8;
  grp.add(capRoof);

  const hood = new THREE.Mesh(roundedBox(0.036, 0.036, 0.055, 0.004, 2), palette.terracottaRoof);
  hood.name = "windmill_rotor_hood_mesh";
  hood.position.set(0, capY + 0.025, 0.048);
  grp.add(hood);

  // 4. Articulated 4-Sail Lattice Canvas Windmill Wheel
  const rotorPivot = new THREE.Group();
  rotorPivot.name = "windmill_rotor_pivot_grp";
  rotorPivot.position.set(0, capY + 0.022, 0.082);
  rotorPivot.rotation.z = Math.PI / 4; // Classic X-cross initial resting pose

  const hubShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.042, 16),
    palette.darkTimber,
  );
  hubShaft.name = "windmill_hub_shaft_mesh";
  hubShaft.rotation.x = Math.PI / 2;
  hubShaft.position.z = -0.01;
  rotorPivot.add(hubShaft);

  const sailLen = 0.195;
  const sailW = 0.044;
  for (let i = 0; i < 4; i++) {
    const bladeGrp = new THREE.Group();
    bladeGrp.name = `windmill_blade_${i}_grp`;
    bladeGrp.rotation.z = (i * Math.PI) / 2;
    // Slight realistic aerodynamic pitch angle on each blade
    const pitchWrap = new THREE.Group();
    pitchWrap.name = `windmill_blade_pitch_${i}_grp`;
    pitchWrap.rotation.y = 0.16;

    const mainSpar = new THREE.Mesh(
      roundedBox(0.008, sailLen, 0.008, 0.0015, 2),
      palette.darkTimber,
    );
    mainSpar.name = `windmill_spar_${i}_mesh`;
    mainSpar.position.y = sailLen * 0.5;
    pitchWrap.add(mainSpar);

    // Outer frame rails + cross-rungs + cream canvas sail
    const sailStart = 0.038;
    const activeLen = sailLen - sailStart - 0.006;
    const canvasPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(sailW - 0.006, activeLen),
      palette.sailCanvas,
    );
    canvasPanel.name = `windmill_sail_canvas_${i}_mesh`;
    canvasPanel.position.set(sailW * 0.42, sailStart + activeLen * 0.5, -0.001);
    pitchWrap.add(canvasPanel);

    for (const rx of [0.008, sailW - 0.008]) {
      const rail = new THREE.Mesh(
        roundedBox(0.004, activeLen + 0.006, 0.004, 0.001, 1),
        palette.darkTimber,
      );
      rail.name = `windmill_sail_rail_${i}_mesh`;
      rail.position.set(rx + 0.006, sailStart + activeLen * 0.5, 0);
      pitchWrap.add(rail);
    }

    for (let r = 0; r <= 5; r++) {
      const ry = sailStart + (r / 5) * activeLen;
      const rung = new THREE.Mesh(
        roundedBox(sailW, 0.004, 0.005, 0.001, 1),
        palette.darkTimber,
      );
      rung.name = `windmill_sail_rung_${i}_${r}_mesh`;
      rung.position.set(sailW * 0.42, ry, 0);
      pitchWrap.add(rung);
    }

    bladeGrp.add(pitchWrap);
    rotorPivot.add(bladeGrp);
  }
  grp.add(rotorPivot);

  // 5. Cantilevered Wooden Airship Mooring Dock + Waving Red Pennant on +X side
  const dockGrp = new THREE.Group();
  dockGrp.name = "airship_mooring_dock_grp";
  dockGrp.position.set(0.072, stoneH - 0.015, 0.01);
  dockGrp.rotation.y = 0.22; // Align cleanly along world +X

  const deck = new THREE.Mesh(roundedBox(0.115, 0.009, 0.078, 0.002, 2), palette.warmPlank);
  deck.name = "dock_plank_deck_mesh";
  deck.position.x = 0.052;
  dockGrp.add(deck);

  // Diagonal timber knee-braces supporting the cantilevered dock
  for (const bz of [-0.028, 0.028]) {
    const brace = new THREE.Mesh(
      tubeAlong(
        [
          [0.0, -0.065, bz],
          [0.095, -0.004, bz],
        ],
        { radius: 0.0045, tubularSegments: 8, radialSegments: 6 },
      ),
      palette.darkTimber,
    );
    brace.name = "dock_knee_brace_mesh";
    dockGrp.add(brace);
  }

  // Timber railings & corner posts
  for (const [px, pz] of [
    [0.105, -0.034],
    [0.105, 0.034],
    [0.015, -0.034],
    [0.015, 0.034],
  ]) {
    const post = new THREE.Mesh(
      roundedBox(0.006, 0.032, 0.006, 0.001, 1),
      palette.darkTimber,
    );
    post.name = "dock_railing_post_mesh";
    post.position.set(px, 0.018, pz);
    dockGrp.add(post);
  }

  const frontRail = new THREE.Mesh(roundedBox(0.005, 0.005, 0.072, 0.001, 1), palette.darkTimber);
  frontRail.name = "dock_end_rail_mesh";
  frontRail.position.set(0.105, 0.032, 0);
  dockGrp.add(frontRail);

  for (const sz of [-0.034, 0.034]) {
    const sideRail = new THREE.Mesh(roundedBox(0.096, 0.005, 0.005, 0.001, 1), palette.darkTimber);
    sideRail.name = "dock_side_rail_mesh";
    sideRail.position.set(0.058, 0.032, sz);
    dockGrp.add(sideRail);
  }

  // Flagpole + waving red windsock pennant
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.003, 0.072, 10),
    palette.darkTimber,
  );
  pole.name = "dock_flagpole_mesh";
  pole.position.set(0.105, 0.048, -0.034);
  dockGrp.add(pole);

  const pennantGeo = deformGeometry(new THREE.ConeGeometry(0.011, 0.058, 12, 8, true), (v) => {
    // Orient cone horizontally along +X from [0,0,0] to [+0.058, 0, 0] with gentle wind wave
    const hx = v.y + 0.029; // 0 at pole -> 0.058 at tip
    const py = v.x;
    const pz = v.z;
    const wave = Math.sin(hx * 85) * 0.004 * (hx / 0.058);
    v.set(0.058 - hx, py - hx * 0.08, pz + wave);
  });
  const pennantPivot = new THREE.Group();
  pennantPivot.name = "dock_pennant_pivot_grp";
  pennantPivot.position.set(0.106, 0.08, -0.034);
  const pennant = new THREE.Mesh(pennantGeo, palette.redPennant);
  pennant.name = "dock_red_windsock_mesh";
  pennantPivot.add(pennant);
  dockGrp.add(pennantPivot);

  grp.add(dockGrp);

  return { group: grp, rotorPivot, pennantPivot };
}

function buildRavineFootbridge(palette) {
  const grp = new THREE.Group();
  grp.name = "ravine_footbridge_grp";
  grp.position.set(0.112, 0.282, 0.058);
  grp.rotation.y = -0.42;

  const span = 0.135;
  const width = 0.046;

  // Arched deck planks
  for (let i = 0; i <= 10; i++) {
    const u = i / 10 - 0.5;
    const x = u * span;
    const archY = Math.cos(u * Math.PI) * 0.016;
    const plank = new THREE.Mesh(roundedBox(0.011, 0.005, width, 0.001, 1), palette.warmPlank);
    plank.name = `footbridge_plank_${i}_mesh`;
    plank.position.set(x, archY, 0);
    plank.rotation.z = -Math.sin(u * Math.PI) * 0.22;
    grp.add(plank);
  }

  // Twin arched timber handrails
  for (const sz of [-width * 0.46, width * 0.46]) {
    const railPts = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8 - 0.5;
      railPts.push([u * span, Math.cos(u * Math.PI) * 0.016 + 0.024, sz]);
    }
    const rail = new THREE.Mesh(
      tubeAlong(railPts, { radius: 0.0028, tubularSegments: 18, radialSegments: 8 }),
      palette.darkTimber,
    );
    rail.name = "footbridge_handrail_mesh";
    grp.add(rail);

    for (const uPost of [-0.46, 0, 0.46]) {
      const p = new THREE.Mesh(roundedBox(0.005, 0.026, 0.005, 0.001, 1), palette.darkTimber);
      p.name = "footbridge_post_mesh";
      p.position.set(uPost * span, Math.cos(uPost * Math.PI) * 0.016 + 0.012, sz);
      grp.add(p);
    }
  }

  return grp;
}

export function buildCastleLayer(palette) {
  const castleGrp = new THREE.Group();
  castleGrp.name = "layer_castle_grp";

  // 1. Curved 3-Arch Stone Viaduct Bridge
  castleGrp.add(buildCurvedStoneViaduct(palette));

  // 2. Crenellated Stone Gatehouse & Curtain Walls
  castleGrp.add(buildGatehouseAndWalls(palette));

  // 3. L-Shaped Half-Timbered Tudor Manor Hall
  const manorGrp = new THREE.Group();
  manorGrp.name = "tudor_manor_hall_grp";

  // West N-S Main Wing
  const westWing = buildHalfTimberWing({
    name: "manor_west_wing",
    width: 0.145,
    depth: 0.255,
    stoneH: 0.068,
    stuccoH: 0.088,
    roofH: 0.098,
    palette,
    chimneySide: -1,
  });
  westWing.position.set(-0.248, 0.275, -0.025);
  manorGrp.add(westWing);

  // East-West Connecting Hall Wing
  const crossHall = buildHalfTimberWing({
    name: "manor_cross_hall",
    width: 0.115,
    depth: 0.225,
    stoneH: 0.062,
    stuccoH: 0.075,
    roofH: 0.082,
    palette,
    chimneySide: 0,
  });
  crossHall.rotation.y = Math.PI / 2;
  crossHall.position.set(-0.095, 0.305, -0.115);
  manorGrp.add(crossHall);

  // Forward-Projecting Courtyard Oriel Gable Wing
  const frontGable = buildHalfTimberWing({
    name: "manor_courtyard_gable",
    width: 0.108,
    depth: 0.135,
    stoneH: 0.062,
    stuccoH: 0.078,
    roofH: 0.088,
    palette,
    chimneySide: 1,
  });
  frontGable.position.set(0.025, 0.305, -0.075);

  // Projecting timber bay/oriel window + arched courtyard door on frontGable
  const orielBox = new THREE.Mesh(
    roundedBox(0.056, 0.042, 0.026, 0.003, 2),
    palette.darkTimber,
  );
  orielBox.name = "manor_oriel_bay_mesh";
  orielBox.position.set(0, 0.098, 0.076);
  const orielPane = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.03), palette.windowGlow);
  orielPane.name = "manor_oriel_pane_mesh";
  orielPane.position.set(0, 0.098, 0.09);
  const manorDoor = new THREE.Mesh(
    roundedBox(0.028, 0.048, 0.012, 0.01, 2),
    palette.warmPlank,
  );
  manorDoor.name = "manor_courtyard_door_mesh";
  manorDoor.position.set(0, 0.025, 0.068);
  frontGable.add(orielBox, orielPane, manorDoor);

  manorGrp.add(frontGable);
  castleGrp.add(manorGrp);

  // 4. Central Slate-Blue Keep + Flanking Terracotta Turrets
  castleGrp.add(buildCentralKeepAndTurrets(palette));

  // 5. Ravine Wooden Footbridge
  castleGrp.add(buildRavineFootbridge(palette));

  // 6. Octagonal Half-Timbered Windmill + Airship Dock
  const windmill = buildWindmillAndAirshipDock(palette);
  castleGrp.add(windmill.group);

  return {
    castleGrp,
    rotorPivot: windmill.rotorPivot,
    pennantPivot: windmill.pennantPivot,
  };
}
