import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import glbUrl from "./exports/bt21-koya-chair-blender.glb?url";

// Lazily fetched only when this model card is opened in the viewer (via loadModelBuilder -> preload)
let loadedGltf = null;

export async function preload() {
  if (!loadedGltf) {
    const loader = new GLTFLoader();
    loadedGltf = await loader.loadAsync(glbUrl);
  }
}

export function buildModel({ THREE }) {
  const root = loadedGltf.scene.clone(true);
  root.name = "bt21_koya_blender_root";

  // Enable studio shadows & clone materials per viewer instance so clay/wireframe toggles stay isolated
  const matMap = new Map();
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        if (!matMap.has(node.material)) {
          const cloned = node.material.clone();
          cloned.side = THREE.FrontSide;
          matMap.set(node.material, cloned);
        }
        node.material = matMap.get(node.material);
      }
    }
  });

  const swivelGrp = root.getObjectByName("chair_swivel_upper_grp");
  const backrestHinge = root.getObjectByName("koya_backrest_hinge_grp");
  const footrestPivot = root.getObjectByName("footrest_mechanism_grp");
  const gooseneckPivot = root.getObjectByName("gooseneck_mount_grp");

  const baseBackQuat = backrestHinge ? backrestHinge.quaternion.clone() : new THREE.Quaternion();
  const baseFootPos = footrestPivot ? footrestPivot.position.clone() : new THREE.Vector3();
  const baseFootQuat = footrestPivot ? footrestPivot.quaternion.clone() : new THREE.Quaternion();
  const baseGooseQuat = gooseneckPivot ? gooseneckPivot.quaternion.clone() : new THREE.Quaternion();

  const xAxis = new THREE.Vector3(1, 0, 0);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const tmpQuat = new THREE.Quaternion();

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
    const r = THREE.MathUtils.clamp(state.recline ?? 0, 0, 1);

    if (backrestHinge) {
      tmpQuat.setFromAxisAngle(xAxis, -THREE.MathUtils.degToRad(r * 22));
      backrestHinge.quaternion.copy(baseBackQuat).premultiply(tmpQuat);
    }

    if (footrestPivot) {
      footrestPivot.position.set(
        baseFootPos.x,
        baseFootPos.y + Math.pow(r, 0.78) * 0.165,
        baseFootPos.z + r * 0.205,
      );
      tmpQuat.setFromAxisAngle(xAxis, -THREE.MathUtils.degToRad(r * 82));
      footrestPivot.quaternion.copy(baseFootQuat).premultiply(tmpQuat);
    }

    if (swivelGrp) {
      swivelGrp.rotation.set(0, THREE.MathUtils.degToRad(state.swivelDeg ?? 0), 0);
    }

    if (gooseneckPivot) {
      gooseneckPivot.visible = (state.showPhoneHolder ?? 1) >= 0.5;
      tmpQuat.setFromAxisAngle(yAxis, THREE.MathUtils.degToRad(state.phoneArmSwing ?? 0));
      gooseneckPivot.quaternion.copy(baseGooseQuat).premultiply(tmpQuat);
    }
  }

  return {
    root,
    params,
    paramSpecs,
    update,
    metadata: {
      name: "BT21 KOYA Sofa Recliner (Blender)",
      category: "Furniture",
      summary:
        "Sculpted natively in Blender 5.3 with Catmull-Clark subdivision surfaces, gathered bolster pleats, 3D stitched flank embroidery, and Cycles/glTF plush velour sheen",
      units: "meters",
    },
  };
}
