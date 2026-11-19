import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import GUI from "lil-gui";

function createShadowDiscTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.5,
  );
  grad.addColorStop(0, "rgba(15, 18, 22, 0.34)");
  grad.addColorStop(0.55, "rgba(15, 18, 22, 0.14)");
  grad.addColorStop(1, "rgba(15, 18, 22, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function mountStudio(buildModelFn, opts = {}) {
  const params = new URLSearchParams(window.location.search);
  const canvas = opts.canvas || document.getElementById("viewport");
  const guiContainer = opts.guiContainer || undefined;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe5e5e5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const built = buildModelFn({ THREE, scene, renderer });
  const root = built.root;
  if (!root.name) root.name = "model_root";
  scene.add(root);

  const lightCfg = built.lighting || {};
  const baseExposure = lightCfg.exposure ?? 0.98;
  const baseEnvIntensity = lightCfg.envIntensity ?? 0.52;
  renderer.toneMappingExposure = baseExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.environmentIntensity = baseEnvIntensity;

  const layerDefs = Array.isArray(built.layers) ? built.layers : [];
  const layerState = {};
  for (const layer of layerDefs) {
    layerState[layer.key] = layer.default !== false;
    if (layer.external && layer.group) {
      scene.add(layer.group);
    }
  }

  const modelParams = { ...(built.params || {}) };
  if (typeof built.update === "function") {
    built.update(modelParams, null);
  }
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxSpan = Math.max(size.x, size.y, size.z, 0.05);

  // Studio 3-point + hemisphere lighting (customizable per model for atmospheric scenes)
  const hemi = new THREE.HemisphereLight(
    lightCfg.hemiSkyColor ?? 0xffffff,
    lightCfg.hemiGroundColor ?? 0xb8bec6,
    lightCfg.hemiIntensity ?? 0.38,
  );
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(
    lightCfg.keyColor ?? 0xfffdf8,
    lightCfg.keyIntensity ?? 1.35,
  );
  if (lightCfg.sunAzimuthDeg !== undefined && lightCfg.sunElevationDeg !== undefined) {
    const az = THREE.MathUtils.degToRad(lightCfg.sunAzimuthDeg);
    const el = THREE.MathUtils.degToRad(lightCfg.sunElevationDeg);
    const sunDist = maxSpan * 3.1;
    keyLight.position.set(
      center.x + sunDist * Math.cos(el) * Math.sin(az),
      center.y + sunDist * Math.sin(el),
      center.z + sunDist * Math.cos(el) * Math.cos(az),
    );
  } else {
    keyLight.position.set(
      center.x + maxSpan * 1.4,
      center.y + maxSpan * 2.3,
      center.z + maxSpan * 1.7,
    );
  }
  keyLight.target.position.copy(center);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  const sCam = keyLight.shadow.camera;
  const sHalf = maxSpan * (lightCfg.shadowBoundsScale ?? 1.1);
  sCam.left = -sHalf;
  sCam.right = sHalf;
  sCam.top = sHalf;
  sCam.bottom = -sHalf;
  sCam.near = maxSpan * 0.1;
  sCam.far = maxSpan * 7.5;
  keyLight.shadow.bias = lightCfg.shadowBias ?? -0.0004;
  keyLight.shadow.normalBias = lightCfg.shadowNormalBias ?? maxSpan * 0.0018;
  scene.add(keyLight, keyLight.target);

  const fillLight = new THREE.DirectionalLight(
    lightCfg.fillColor ?? 0xf0f5ff,
    lightCfg.fillIntensity ?? 0.42,
  );
  fillLight.position.set(
    center.x - maxSpan * 1.8,
    center.y + maxSpan * 0.9,
    center.z + maxSpan * 1.1,
  );
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(
    lightCfg.rimColor ?? 0xffffff,
    lightCfg.rimIntensity ?? 0.48,
  );
  rimLight.position.set(
    center.x - maxSpan * 0.6,
    center.y + maxSpan * 1.5,
    center.z - maxSpan * 2.0,
  );
  scene.add(rimLight);

  const groundGroup = new THREE.Group();
  groundGroup.name = "__studio_ground";
  groundGroup.userData.noAO = true;

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(maxSpan * 8, maxSpan * 8),
    new THREE.ShadowMaterial({ opacity: 0.18 }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0;
  shadowPlane.receiveShadow = true;
  shadowPlane.userData.noAO = true;

  const aoDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x, 0.05) * 1.45, Math.max(size.z, 0.05) * 1.45),
    new THREE.MeshBasicMaterial({
      map: createShadowDiscTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  aoDisc.rotation.x = -Math.PI / 2;
  aoDisc.position.set(center.x, 0.0002, center.z);
  aoDisc.userData.noAO = true;
  groundGroup.add(shadowPlane, aoDisc);
  scene.add(groundGroup);

  const gridHelper = new THREE.GridHelper(maxSpan * 2.5, 20, 0x9aa0a8, 0xcacfd6);
  gridHelper.position.y = 0;
  gridHelper.visible = false;
  scene.add(gridHelper);

  const orthoGroundLine = new THREE.GridHelper(maxSpan * 1.6, 8, 0x8b929c, 0xbec4cc);
  orthoGroundLine.position.set(center.x, 0, center.z);
  orthoGroundLine.visible = false;
  scene.add(orthoGroundLine);

  const perspCam = new THREE.PerspectiveCamera(
    24,
    window.innerWidth / window.innerHeight,
    maxSpan * 0.015,
    Math.max(maxSpan * 80, 150),
  );

  function positionHeroCamera() {
    const fovRad = THREE.MathUtils.degToRad(perspCam.fov);
    const aspect = Math.max(perspCam.aspect, 0.5);
    const fitHeight = maxSpan * 0.62;
    const distV = fitHeight / Math.tan(fovRad / 2);
    const distH = fitHeight / (Math.tan(fovRad / 2) * aspect);
    const dist = Math.max(distV, distH) * 1.18;
    const elev = THREE.MathUtils.degToRad(24);
    const azim = THREE.MathUtils.degToRad(36);
    perspCam.position.set(
      center.x + dist * Math.cos(elev) * Math.sin(azim),
      center.y + dist * Math.sin(elev),
      center.z + dist * Math.cos(elev) * Math.cos(azim),
    );
    perspCam.lookAt(center);
    perspCam.updateProjectionMatrix();
  }
  positionHeroCamera();

  const controls = new OrbitControls(perspCam, canvas);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.update();

  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, maxSpan * 0.01, maxSpan * 20);

  // Post-processing pipeline: 4x MSAA HDR target -> RenderPass -> GTAOPass -> UnrealBloomPass -> OutputPass
  const composerTarget = new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(window.innerWidth * dpr)),
    Math.max(1, Math.floor(window.innerHeight * dpr)),
    {
      type: THREE.HalfFloatType,
      samples: 4,
    },
  );
  const composer = new EffectComposer(renderer, composerTarget);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, perspCam);
  composer.addPass(renderPass);

  const gtaoPass = new GTAOPass(
    scene,
    perspCam,
    Math.max(1, Math.floor(window.innerWidth * dpr)),
    Math.max(1, Math.floor(window.innerHeight * dpr)),
  );
  gtaoPass.output = GTAOPass.OUTPUT.Default;
  gtaoPass.blendIntensity = lightCfg.aoIntensity ?? 0.58;
  gtaoPass.updateGtaoMaterial({
    radius: maxSpan * (lightCfg.aoRadiusScale ?? 0.11),
    distanceExponent: 1.5,
    thickness: maxSpan * 0.35,
    distanceFallOff: 1.0,
    scale: 1.0,
    samples: 16,
    screenSpaceRadius: false,
  });
  gtaoPass.updatePdMaterial({
    lumaPhi: 10,
    depthPhi: 2,
    normalPhi: 3,
    radius: 6,
    rings: 2,
    samples: 16,
  });

  const restAoBox = bounds.clone().expandByScalar(maxSpan * 0.65);
  const workAoBox = restAoBox.clone();
  gtaoPass.setSceneClipBox(restAoBox);

  // Exclude studio ground planes, sky domes, and transparent/volumetric cloud shaders from GTAO normal buffer
  gtaoPass.overrideVisibility = function () {
    const cache = this._visibilityCache;
    const hideSubtree = (node) => {
      node.traverse((c) => {
        if (!cache.has(c)) cache.set(c, c.visible);
        c.visible = false;
      });
    };
    scene.traverse((obj) => {
      if (!cache.has(obj)) cache.set(obj, obj.visible);
      if (!obj.visible) return;
      if (obj.isPoints || obj.isLine) {
        obj.visible = false;
        return;
      }
      if (obj.userData && obj.userData.noAO) {
        hideSubtree(obj);
        return;
      }
      if (obj.isMesh && obj.material) {
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        if (mat && (mat.transparent || mat.side === THREE.BackSide || mat.depthWrite === false)) {
          obj.visible = false;
        }
      }
    });
  };
  composer.addPass(gtaoPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    lightCfg.bloomStrength ?? 0.08,
    lightCfg.bloomRadius ?? 0.38,
    lightCfg.bloomThreshold ?? 0.98,
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const lightRig = {
    scene,
    renderer,
    hemi,
    keyLight,
    fillLight,
    rimLight,
    bloomPass,
    gtaoPass,
    center,
    maxSpan,
  };
  if (typeof built.update === "function") {
    built.update(modelParams, lightRig);
  }

  const originalMaterials = new Map();
  const claySolidMat = new THREE.MeshStandardMaterial({
    color: 0x9e988e,
    roughness: 0.72,
    metalness: 0.05,
  });
  const clayGlassMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.0,
    transparent: true,
    opacity: 0.35,
  });

  root.traverse((obj) => {
    if (obj.isMesh) {
      originalMaterials.set(obj.uuid, obj.material);
      if (obj.castShadow === undefined) obj.castShadow = true;
      if (obj.receiveShadow === undefined) obj.receiveShadow = true;
    }
  });

  // Two-pass hierarchical CAD explode solver:
  // 1) Unwraps single-child wrappers and recursively expands multi-part assemblies while keeping
  //    cohesive leaf props (wings, bridges, rotors, bases, face appliques) intact.
  // 2) Binds thin/micro surface trim (piping welts, decals, ribs, doors, finials) to their
  //    touching host assembly so structures explode cleanly without shedding surface details.
  function boxDistanceSq(a, b) {
    const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
    const dy = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y);
    const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
    return dx * dx + dy * dy + dz * dz;
  }

  function computeLocalDims(cur) {
    cur.updateWorldMatrix(true, true);
    const invRoot = cur.matrixWorld.clone().invert();
    const localBox = new THREE.Box3();
    const tmpBox = new THREE.Box3();
    const tmpMat = new THREE.Matrix4();
    cur.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry) return;
      if (obj.isInstancedMesh) {
        if (!obj.boundingBox) obj.computeBoundingBox();
        if (obj.boundingBox) {
          tmpMat.multiplyMatrices(invRoot, obj.matrixWorld);
          tmpBox.copy(obj.boundingBox).applyMatrix4(tmpMat);
          localBox.union(tmpBox);
        }
        return;
      }
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      tmpMat.multiplyMatrices(invRoot, obj.matrixWorld);
      tmpBox.copy(obj.geometry.boundingBox).applyMatrix4(tmpMat);
      localBox.union(tmpBox);
    });
    if (localBox.isEmpty()) return [0, 0, 0];
    const ls = localBox.getSize(new THREE.Vector3());
    return [ls.x, ls.y, ls.z].sort((a, b) => a - b);
  }

  function sharedAncestorDepth(a, b) {
    const chainA = [];
    for (let p = a; p; p = p.parent) chainA.push(p);
    chainA.reverse();
    const chainB = [];
    for (let p = b; p; p = p.parent) chainB.push(p);
    chainB.reverse();
    let d = 0;
    while (d < chainA.length && d < chainB.length && chainA[d] === chainB[d]) {
      d++;
    }
    return d;
  }

  function shouldExpandContainer(cur, box, dims, depth) {
    if (!cur.children || cur.children.length < 2 || depth >= 4) return false;
    if (depth === 0) return true;

    const [d0, , d2] = dims;
    const minSpanRatio = depth === 1 ? 0.25 : depth === 2 ? 0.31 : 0.36;
    if (d2 < maxSpan * minSpanRatio || d0 < maxSpan * 0.058) return false;

    const localDims = computeLocalDims(cur);
    if (localDims[0] < maxSpan * 0.058) return false;

    const childEntries = [];
    for (const ch of cur.children) {
      const cb = new THREE.Box3().setFromObject(ch);
      if (cb.isEmpty()) continue;
      const cs = cb.getSize(new THREE.Vector3());
      const cDims = [cs.x, cs.y, cs.z].sort((a, b) => a - b);
      childEntries.push({
        node: ch,
        box: cb,
        center: cb.getCenter(new THREE.Vector3()),
        dims: cDims,
        span: cDims[2],
      });
    }
    if (childEntries.length < 2) return false;

    childEntries.sort((a, b) => b.span - a.span);
    const lead = childEntries[0];
    if (lead.node.isMesh && lead.span >= d2 * 0.88) {
      const leadEnvelope = lead.box.clone().expandByScalar(maxSpan * 0.02);
      let independentSiblings = 0;
      for (let i = 1; i < childEntries.length; i++) {
        const ce = childEntries[i];
        if (ce.node.userData && ce.node.userData.isExplodeTrim) continue;
        const isSubstantial = ce.span >= d2 * 0.35 && ce.dims[0] >= maxSpan * 0.025;
        if (isSubstantial || (ce.span >= maxSpan * 0.09 && !leadEnvelope.containsPoint(ce.center))) {
          independentSiblings++;
        }
      }
      if (independentSiblings === 0) return false;
    }

    return true;
  }

  const rawTargets = [];
  function collectExplodeNodes(node, parentCenter, depth = 0) {
    let cur = node;
    while (cur.children && cur.children.length === 1 && !cur.children[0].isMesh) {
      cur = cur.children[0];
    }
    const box = new THREE.Box3().setFromObject(cur);
    if (box.isEmpty()) return;
    const nodeSize = box.getSize(new THREE.Vector3());
    const nodeCenter = box.getCenter(new THREE.Vector3());
    const dims = [nodeSize.x, nodeSize.y, nodeSize.z].sort((a, b) => a - b);

    if (shouldExpandContainer(cur, box, dims, depth)) {
      for (const child of cur.children) {
        collectExplodeNodes(child, nodeCenter, depth + 1);
      }
      return;
    }

    const heightFrac = THREE.MathUtils.clamp(
      (nodeCenter.y - bounds.min.y) / Math.max(size.y, 1e-4),
      0,
      1,
    );
    const dyRaw =
      (heightFrac - 0.28) * size.y * 0.65 + (nodeCenter.y - parentCenter.y) * 0.72;
    const worldDelta = new THREE.Vector3(
      (nodeCenter.x - center.x) * 0.72 + (nodeCenter.x - parentCenter.x) * 0.68,
      Math.max(dyRaw, -maxSpan * 0.16),
      (nodeCenter.z - center.z) * 0.72 + (nodeCenter.z - parentCenter.z) * 0.68,
    );

    if (worldDelta.lengthSq() < 1e-6) {
      worldDelta.set(0, maxSpan * 0.22, 0);
    }

    const localDims = computeLocalDims(cur);
    const isTrim =
      Boolean(cur.userData && cur.userData.isExplodeTrim) ||
      localDims[2] < maxSpan * 0.068 ||
      localDims[0] < maxSpan * 0.022 ||
      localDims[1] < maxSpan * 0.028 ||
      (localDims[0] < maxSpan * 0.042 && localDims[0] < localDims[1] * 0.28);

    rawTargets.push({
      node: cur,
      box,
      center: nodeCenter,
      isTrim,
      worldDelta,
    });
  }
  collectExplodeNodes(root, center, 0);

  const primaryTargets = rawTargets.filter((t) => !t.isTrim);
  if (primaryTargets.length > 0) {
    const maxAttachDistSq = Math.pow(maxSpan * 0.036, 2);
    const touchTolSq = Math.pow(maxSpan * 0.009, 2);
    for (const t of rawTargets) {
      if (!t.isTrim) continue;
      let bestHost = null;
      let bestTier = 2;
      let bestSharedDepth = -1;
      let bestBoxDistSq = Infinity;
      let bestCenterDistSq = Infinity;
      for (const host of primaryTargets) {
        const bSq = boxDistanceSq(t.box, host.box);
        if (bSq > maxAttachDistSq) continue;
        const tier = bSq <= touchTolSq ? 0 : 1;
        const sDepth = sharedAncestorDepth(t.node, host.node);
        const cSq = t.center.distanceToSquared(host.center);
        const better =
          tier < bestTier ||
          (tier === bestTier && sDepth > bestSharedDepth) ||
          (tier === bestTier &&
            sDepth === bestSharedDepth &&
            (tier === 0
              ? cSq < bestCenterDistSq
              : bSq < bestBoxDistSq - 1e-6 ||
                (Math.abs(bSq - bestBoxDistSq) <= 1e-6 && cSq < bestCenterDistSq)));
        if (better) {
          bestHost = host;
          bestTier = tier;
          bestSharedDepth = sDepth;
          bestBoxDistSq = bSq;
          bestCenterDistSq = cSq;
        }
      }
      if (bestHost) {
        t.worldDelta.copy(bestHost.worldDelta);
      }
    }
  }

  let minFloorDeltaY = 0;
  const explodeTargets = rawTargets.map((t) => {
    const p0 = new THREE.Vector3().setFromMatrixPosition(t.node.matrixWorld);
    const p1 = p0.clone().add(t.worldDelta);
    if (t.node.parent) {
      t.node.parent.worldToLocal(p0);
      t.node.parent.worldToLocal(p1);
    }
    const nextMinY = t.box.min.y + t.worldDelta.y - bounds.min.y;
    if (nextMinY < minFloorDeltaY) {
      minFloorDeltaY = nextMinY;
    }
    return {
      node: t.node,
      localDelta: p1.sub(p0),
      savedPos: new THREE.Vector3(),
    };
  });

  const savedCamPos = new THREE.Vector3();

  const uiState = {
    view: params.get("view") === "ortho" ? "ortho" : "hero",
    clay: params.get("clay") === "1" || params.get("clay") === "true",
    wireframe: false,
    grid: false,
    explode: 0,
    clean: params.get("clean") === "1" || params.get("clean") === "true",
  };

  let gui = null;

  function syncGuiDisplay() {
    if (!gui) return;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  function applyVisualState() {
    document.body.classList.toggle("mode-ortho", uiState.view === "ortho");
    document.body.classList.toggle("capture-clean", uiState.clean);

    let suppressGround = false;
    const allowExternal = uiState.view !== "ortho" && !uiState.clay;
    for (const layer of layerDefs) {
      const enabled = Boolean(layerState[layer.key]);
      if (layer.group) {
        layer.group.visible = layer.external ? enabled && allowExternal : enabled;
      }
      if (enabled && layer.hidesStudioGround && allowExternal) {
        suppressGround = true;
      }
    }

    groundGroup.visible = uiState.view !== "ortho" && !suppressGround;
    gridHelper.visible = uiState.grid && uiState.view !== "ortho";
    orthoGroundLine.visible = uiState.view === "ortho";
    controls.enabled = uiState.view !== "ortho";

    gtaoPass.enabled = !uiState.wireframe;
    bloomPass.enabled = !uiState.clay && !uiState.wireframe;

    if (uiState.clay) {
      hemi.color.setHex(0xffffff);
      hemi.groundColor.setHex(0xb8bec6);
      hemi.intensity = 0.42;
      keyLight.color.setHex(0xffffff);
      keyLight.intensity = 1.35;
      fillLight.color.setHex(0xf0f5ff);
      fillLight.intensity = 0.42;
    } else if (typeof built.update === "function") {
      hemi.color.set(lightCfg.hemiSkyColor ?? 0xffffff);
      hemi.groundColor.set(lightCfg.hemiGroundColor ?? 0xb8bec6);
      hemi.intensity = lightCfg.hemiIntensity ?? 0.38;
      keyLight.color.set(lightCfg.keyColor ?? 0xfffdf8);
      keyLight.intensity = lightCfg.keyIntensity ?? 1.35;
      fillLight.color.set(lightCfg.fillColor ?? 0xf0f5ff);
      fillLight.intensity = lightCfg.fillIntensity ?? 0.42;
      built.update(modelParams, lightRig);
    }

    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const orig = originalMaterials.get(obj.uuid);
      if (uiState.clay) {
        const isTrans =
          orig && (orig.transmission > 0.2 || (orig.transparent && orig.opacity < 0.85));
        obj.material = isTrans ? clayGlassMat : claySolidMat;
      } else if (orig) {
        obj.material = orig;
      }
      if (obj.material) {
        obj.material.wireframe = uiState.wireframe;
      }
    });

    root.updateMatrixWorld(true);
    syncGuiDisplay();
    if (typeof opts.onStateChange === "function") {
      opts.onStateChange({ ...uiState });
    }
  }

  function withExplodeApplied(fn) {
    if (uiState.explode <= 1e-5 || explodeTargets.length === 0) {
      groundGroup.position.y = 0;
      if (sCam.right !== sHalf) {
        sCam.left = -sHalf;
        sCam.right = sHalf;
        sCam.top = sHalf;
        sCam.bottom = -sHalf;
        sCam.updateProjectionMatrix();
        gtaoPass.setSceneClipBox(restAoBox);
      }
      fn();
      return;
    }
    const sExtent = sHalf * (1 + uiState.explode * 0.85);
    sCam.left = -sExtent;
    sCam.right = sExtent;
    sCam.top = sExtent;
    sCam.bottom = -sExtent;
    sCam.updateProjectionMatrix();

    workAoBox.copy(restAoBox).expandByScalar(maxSpan * uiState.explode * 0.9);
    gtaoPass.setSceneClipBox(workAoBox);
    groundGroup.position.y = minFloorDeltaY * uiState.explode;

    for (const item of explodeTargets) {
      item.savedPos.copy(item.node.position);
      item.node.position.addScaledVector(item.localDelta, uiState.explode);
    }
    root.updateMatrixWorld(true);
    try {
      fn();
    } finally {
      for (const item of explodeTargets) {
        item.node.position.copy(item.savedPos);
      }
      root.updateMatrixWorld(true);
    }
  }

  function renderFrame() {
    withExplodeApplied(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      if (uiState.view === "ortho") {
        renderer.setRenderTarget(null);
        renderer.setScissorTest(true);
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const subAspect = halfW / Math.max(halfH, 1);

        const liveBounds = new THREE.Box3().setFromObject(root);
        const liveSize = liveBounds.getSize(new THREE.Vector3());
        const liveCenter = liveBounds.getCenter(new THREE.Vector3());
        const uniformSpan = Math.max(liveSize.x, liveSize.y, liveSize.z, 0.05);
        const halfExtent = uniformSpan * 0.66;
        const dist = uniformSpan * 4;

        orthoCam.top = halfExtent;
        orthoCam.bottom = -halfExtent;
        orthoCam.right = halfExtent * subAspect;
        orthoCam.left = -halfExtent * subAspect;
        orthoCam.near = uniformSpan * 0.01;
        orthoCam.far = uniformSpan * 12;
        orthoCam.updateProjectionMatrix();

        const panels = [
          { x: 0, y: halfH, w: halfW, h: h - halfH, pos: [0, 0, dist], up: [0, 1, 0] },
          { x: halfW, y: halfH, w: w - halfW, h: h - halfH, pos: [dist, 0, 0], up: [0, 1, 0] },
          { x: 0, y: 0, w: halfW, h: halfH, pos: [0, 0, -dist], up: [0, 1, 0] },
          { x: halfW, y: 0, w: w - halfW, h: halfH, pos: [0, dist, 0], up: [0, 0, -1] },
        ];

        for (const p of panels) {
          renderer.setViewport(p.x, p.y, p.w, p.h);
          renderer.setScissor(p.x, p.y, p.w, p.h);
          orthoCam.position.set(
            liveCenter.x + p.pos[0],
            liveCenter.y + p.pos[1],
            liveCenter.z + p.pos[2],
          );
          orthoCam.up.set(p.up[0], p.up[1], p.up[2]);
          orthoCam.lookAt(liveCenter);
          renderer.render(scene, orthoCam);
        }
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
      } else {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        controls.update();
        if (uiState.explode > 1e-5) {
          savedCamPos.copy(perspCam.position);
          perspCam.position
            .sub(controls.target)
            .multiplyScalar(1 + uiState.explode * 0.56)
            .add(controls.target);
          perspCam.updateMatrixWorld();
          composer.render();
          perspCam.position.copy(savedCamPos);
          perspCam.updateMatrixWorld();
        } else {
          composer.render();
        }
      }
    });
  }

  gui = new GUI({
    title: "Inspector",
    ...(guiContainer ? { container: guiContainer } : {}),
  });

  if (layerDefs.length > 0) {
    const layersFolder = gui.addFolder("Layers");
    for (const layer of layerDefs) {
      layersFolder
        .add(layerState, layer.key)
        .name(layer.label || layer.key)
        .onChange(() => {
          applyVisualState();
          renderFrame();
        });
    }
  }

  gui.add(uiState, "explode", 0, 1, 0.01).name("Explode Parts").onChange(applyVisualState);

  if (built.paramSpecs && typeof built.update === "function") {
    const folder = gui.addFolder("Articulation");
    for (const [key, spec] of Object.entries(built.paramSpecs)) {
      const isBool = typeof modelParams[key] === "boolean" || spec.type === "boolean";
      const ctrl = isBool
        ? folder.add(modelParams, key)
        : folder.add(modelParams, key, spec.min ?? 0, spec.max ?? 1, spec.step ?? 0.01);
      ctrl.name(spec.label || key).onChange(() => {
        built.update(modelParams, uiState.clay ? null : lightRig);
        root.updateMatrixWorld(true);
      });
    }
  }

  async function exportGLBArrayBuffer() {
    const prevClay = uiState.clay;
    const prevWire = uiState.wireframe;
    const prevExplode = uiState.explode;
    uiState.clay = false;
    uiState.wireframe = false;
    uiState.explode = 0;
    applyVisualState();

    const exporter = new GLTFExporter();
    const buffer = await new Promise((resolve, reject) => {
      exporter.parse(
        root,
        (result) => resolve(result),
        (err) => reject(err),
        { binary: true },
      );
    });

    uiState.clay = prevClay;
    uiState.wireframe = prevWire;
    uiState.explode = prevExplode;
    applyVisualState();
    return buffer;
  }

  async function downloadGLB(slug) {
    const buf = await exportGLBArrayBuffer();
    const blob = new Blob([buf], { type: "model/gltf-binary" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug || root.name || "model"}.glb`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onResize() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(nextDpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    perspCam.aspect = window.innerWidth / window.innerHeight;
    perspCam.updateProjectionMatrix();
    composer.setPixelRatio(nextDpr);
    composer.setSize(window.innerWidth, window.innerHeight);
    renderFrame();
  }
  window.addEventListener("resize", onResize);

  applyVisualState();

  let rafId = 0;
  let disposed = false;
  const clock = new THREE.Clock();
  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    if (typeof built.tick === "function" && !uiState.clean) {
      built.tick(clock.getElapsedTime(), modelParams, uiState.clay ? null : lightRig);
    }
    renderFrame();
  }
  animate();

  const api = {
    ready: true,
    metadata: built.metadata || {},
    getState() {
      return { ...uiState };
    },
    setMode(next = {}) {
      if (next.view !== undefined) uiState.view = next.view;
      if (next.clay !== undefined) uiState.clay = Boolean(next.clay);
      if (next.wireframe !== undefined) uiState.wireframe = Boolean(next.wireframe);
      if (next.grid !== undefined) uiState.grid = Boolean(next.grid);
      if (next.clean !== undefined) uiState.clean = Boolean(next.clean);
      if (next.explode !== undefined) uiState.explode = Number(next.explode);
      if (next.resetHeroCamera) {
        perspCam.aspect = window.innerWidth / window.innerHeight;
        positionHeroCamera();
        controls.target.copy(center);
        controls.update();
      }
      applyVisualState();
      renderFrame();
    },
    setModelParam(key, value) {
      if (key in modelParams && typeof built.update === "function") {
        modelParams[key] = value;
        built.update(modelParams, uiState.clay ? null : lightRig);
        root.updateMatrixWorld(true);
        syncGuiDisplay();
        renderFrame();
      }
    },
    setLayer(key, visible) {
      if (key in layerState) {
        layerState[key] = Boolean(visible);
        applyVisualState();
        renderFrame();
      }
    },
    getLayers() {
      return { ...layerState };
    },
    downloadGLB,
    getDiagnostics() {
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const sz = box.getSize(new THREE.Vector3());
      const ctr = box.getCenter(new THREE.Vector3());
      let meshCount = 0;
      let triangleCount = 0;
      let nanVertices = 0;
      const unnamedMeshes = [];
      const negativeScaleNodes = [];

      root.traverse((obj) => {
        if (obj.scale.x < 0 || obj.scale.y < 0 || obj.scale.z < 0) {
          negativeScaleNodes.push(obj.name || obj.type);
        }
        if (obj.isMesh) {
          meshCount++;
          if (!obj.name) unnamedMeshes.push(obj.uuid.slice(0, 8));
          const geo = obj.geometry;
          if (geo) {
            const pos = geo.attributes.position;
            if (pos) {
              const triPerInstance = geo.index ? geo.index.count / 3 : pos.count / 3;
              const instanceMult = obj.isInstancedMesh ? obj.count : 1;
              triangleCount += triPerInstance * instanceMult;
              for (let i = 0; i < pos.array.length; i++) {
                if (!Number.isFinite(pos.array[i])) {
                  nanVertices++;
                  break;
                }
              }
            }
          }
        }
      });

      const round4 = (n) => Math.round(n * 10000) / 10000;
      const maxDim = Math.max(sz.y, 1e-6);

      return {
        name: root.name,
        metadata: built.metadata || {},
        dimensions: {
          width: round4(sz.x),
          height: round4(sz.y),
          depth: round4(sz.z),
        },
        ratiosToHeight: {
          widthOverHeight: round4(sz.x / maxDim),
          depthOverHeight: round4(sz.z / maxDim),
        },
        bounds: {
          min: [round4(box.min.x), round4(box.min.y), round4(box.min.z)],
          max: [round4(box.max.x), round4(box.max.y), round4(box.max.z)],
          center: [round4(ctr.x), round4(ctr.y), round4(ctr.z)],
        },
        groundOffsetMinY: round4(box.min.y),
        centerOffsetX: round4(ctr.x),
        meshCount,
        triangleCount: Math.round(triangleCount),
        nanVertices,
        unnamedMeshCount: unnamedMeshes.length,
        negativeScaleNodes,
      };
    },
    async exportGLBBase64() {
      const buffer = await exportGLBArrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("mode-ortho", "capture-clean");
      if (gui) gui.destroy();
      controls.dispose();
      gtaoPass.dispose();
      bloomPass.dispose();
      outputPass.dispose();
      composer.dispose();
      composerTarget.dispose();
      envTex.dispose();
      pmrem.dispose();
      claySolidMat.dispose();
      clayGlassMat.dispose();
      renderer.dispose();
      if (window.__studio === api) {
        delete window.__studio;
      }
    },
  };

  window.__studio = api;
  return api;
}
