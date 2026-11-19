import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LoopSubdivision } from "three-subdivide";

export function roundedBox(width, height, depth, radius = 0.01, segments = 4) {
  const maxR = Math.min(width, height, depth) * 0.49;
  return new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, maxR));
}

export function roundedRectShape(width, height, radius = 0.01) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  if (r > 0) s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  if (r > 0) s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  if (r > 0) s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  if (r > 0) s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

export function extrudeProfile(shapeOrPoints, opts = {}) {
  const {
    depth = 0.02,
    bevelEnabled = true,
    bevelThickness = 0.002,
    bevelSize = 0.002,
    bevelSegments = 4,
    curveSegments = 24,
    centerZ = true,
  } = opts;

  let shape = shapeOrPoints;
  if (Array.isArray(shapeOrPoints)) {
    shape = new THREE.Shape(
      shapeOrPoints.map((p) => (p instanceof THREE.Vector2 ? p : new THREE.Vector2(p[0], p[1]))),
    );
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelEnabled && bevelThickness > 0 && bevelSize > 0,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
  });

  if (centerZ) {
    geo.translate(0, 0, -depth / 2);
  }
  geo.computeVertexNormals();
  return geo;
}

export function latheProfile(points2D, opts = {}) {
  const { segments = 64, phiStart = 0, phiLength = Math.PI * 2 } = opts;
  const pts = points2D.map((p) =>
    p instanceof THREE.Vector2 ? p : new THREE.Vector2(p[0], p[1]),
  );
  const geo = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  geo.computeVertexNormals();
  return geo;
}

export function tubeAlong(points3D, opts = {}) {
  const {
    radius = 0.008,
    tubularSegments = 64,
    radialSegments = 20,
    closed = false,
    curveType = "catmullrom",
    tension = 0.5,
  } = opts;

  const pts = points3D.map((p) =>
    p instanceof THREE.Vector3 ? p : new THREE.Vector3(p[0], p[1], p[2]),
  );
  const curve = new THREE.CatmullRomCurve3(pts, closed, curveType, tension);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  geo.computeVertexNormals();
  return geo;
}

export function deformGeometry(geometry, mutatorFn) {
  const geo = geometry.clone();
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    mutatorFn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function subdivide(geometry, iterations = 1, opts = {}) {
  const geo = LoopSubdivision.modify(geometry, iterations, {
    split: opts.split ?? true,
    uvSmooth: opts.uvSmooth ?? false,
    preserveEdges: opts.preserveEdges ?? false,
    flatOnly: opts.flatOnly ?? false,
    maxTriangles: opts.maxTriangles ?? 250000,
  });
  geo.computeVertexNormals();
  return geo;
}

export function placeAroundRing(count, radius, builderFn, axis = "y") {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const item = builderFn(i, angle);
    if (!item) continue;
    if (axis === "y") {
      item.position.set(Math.cos(angle) * radius, item.position.y, Math.sin(angle) * radius);
      item.rotation.y = -angle;
    } else if (axis === "z") {
      item.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, item.position.z);
      item.rotation.z = angle;
    } else {
      item.position.set(item.position.x, Math.cos(angle) * radius, Math.sin(angle) * radius);
      item.rotation.x = angle;
    }
    group.add(item);
  }
  return group;
}
