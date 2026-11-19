import * as THREE from "three";
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";

const evaluator = new Evaluator();
evaluator.useGroups = false;
evaluator.attributes = ["position", "normal", "uv"];

function ensureCSGGeometry(geometry) {
  const geo = geometry.clone();
  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  if (!geo.attributes.uv) {
    const count = geo.attributes.position.count;
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return geo;
}

function toBrush(meshOrGeometry, fallbackMaterial) {
  if (meshOrGeometry instanceof Brush) {
    meshOrGeometry.updateMatrixWorld(true);
    return meshOrGeometry;
  }
  if (meshOrGeometry instanceof THREE.Mesh) {
    meshOrGeometry.updateMatrixWorld(true);
    const brush = new Brush(
      ensureCSGGeometry(meshOrGeometry.geometry),
      meshOrGeometry.material || fallbackMaterial,
    );
    brush.applyMatrix4(meshOrGeometry.matrixWorld);
    brush.updateMatrixWorld(true);
    return brush;
  }
  const brush = new Brush(ensureCSGGeometry(meshOrGeometry), fallbackMaterial);
  brush.updateMatrixWorld(true);
  return brush;
}

function runCSG(base, operands, op, material) {
  const mat = material || base.material || new THREE.MeshStandardMaterial();
  let current = toBrush(base, mat);
  const list = Array.isArray(operands) ? operands : [operands];

  for (const item of list) {
    if (!item) continue;
    const nextBrush = toBrush(item, mat);
    const result = evaluator.evaluate(current, nextBrush, op);
    result.updateMatrixWorld(true);
    current = result;
  }

  const finalGeo = current.geometry;
  finalGeo.computeVertexNormals();
  finalGeo.computeBoundingBox();
  finalGeo.computeBoundingSphere();

  const mesh = new THREE.Mesh(finalGeo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function csgSubtract(base, cutters, material) {
  return runCSG(base, cutters, SUBTRACTION, material);
}

export function csgUnion(base, additions, material) {
  return runCSG(base, additions, ADDITION, material);
}

export function csgIntersect(base, masks, material) {
  return runCSG(base, masks, INTERSECTION, material);
}
