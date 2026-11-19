import * as THREE from "three";
import { buildCastleLayer } from "./castle.js";
import { buildEnvironmentAndBackground } from "./environment.js";
import { createCastlePalette } from "./materials.js";
import { buildTerrainLayer } from "./terrain.js";

export function buildModel() {
  const root = new THREE.Group();
  root.name = "ghibli_hilltop_castle_root";

  const palette = createCastlePalette();

  const turntableGrp = new THREE.Group();
  turntableGrp.name = "diorama_turntable_grp";
  root.add(turntableGrp);

  // Layer 2: Sculpted Stratified Limestone Cliff & Instanced Flora Terrain (y = 0)
  const terrainGrp = buildTerrainLayer(palette);
  turntableGrp.add(terrainGrp);

  // Layer 1: Castle Architecture
  const { castleGrp, rotorPivot, pennantPivot } = buildCastleLayer(palette);
  turntableGrp.add(castleGrp);

  // Layers 3 & 4: External Volumetric Cloud Sea/Airship & Ghibli Sky/Thunderhead
  const scenic = buildEnvironmentAndBackground(palette);

  // Match cloud shader sun vector to the directional keyLight (-38 deg azimuth, 39 deg elevation)
  const sunAz = THREE.MathUtils.degToRad(-38);
  const sunEl = THREE.MathUtils.degToRad(39);
  scenic.cloudUniforms.uSunDir.value
    .set(Math.cos(sunEl) * Math.sin(sunAz), Math.sin(sunEl), Math.cos(sunEl) * Math.cos(sunAz))
    .normalize();

  const dayKeyCol = new THREE.Color(0xfff1d6);
  const duskKeyCol = new THREE.Color(0xff8e4f);
  const dayHemiSky = new THREE.Color(0x8ec4ff);
  const duskHemiSky = new THREE.Color(0x6e64b5);
  const dayHemiGround = new THREE.Color(0xdcc7a4);
  const duskHemiGround = new THREE.Color(0x63485c);

  const params = {
    duskGlow: 0.12,
    windmillDeg: 25,
    airshipDrift: 0,
    turntableDeg: 0,
    liveWind: true,
  };

  const paramSpecs = {
    duskGlow: { min: 0, max: 1, step: 0.01, label: "Day -> Dusk Glow" },
    windmillDeg: { min: 0, max: 360, step: 1, label: "Windmill Angle" },
    airshipDrift: { min: -30, max: 30, step: 0.5, label: "Airship Orbit" },
    turntableDeg: { min: -180, max: 180, step: 1, label: "Turntable (deg)" },
    liveWind: { type: "boolean", label: "Live Wind Motion" },
  };

  function applyState(state, windPhase = 0, lightRig = null) {
    const dusk = THREE.MathUtils.clamp(state.duskGlow, 0, 1);

    // Window emissive warmth scales from subtle daytime interior warmth to cozy dusk lantern glow
    palette.windowGlow.emissiveIntensity = THREE.MathUtils.lerp(0.55, 3.2, dusk);

    // Volumetric cloud & sky dome shaders
    scenic.skyUniforms.uDusk.value = dusk;
    scenic.cloudUniforms.uDusk.value = dusk;
    scenic.cloudUniforms.uTime.value = windPhase;

    // Modulate scene sun & sky bounce lights smoothly from golden-morning to sunset-dusk
    if (lightRig) {
      lightRig.keyLight.color.copy(dayKeyCol).lerp(duskKeyCol, dusk);
      lightRig.keyLight.intensity = THREE.MathUtils.lerp(1.85, 1.35, dusk);
      lightRig.hemi.color.copy(dayHemiSky).lerp(duskHemiSky, dusk);
      lightRig.hemi.groundColor.copy(dayHemiGround).lerp(duskHemiGround, dusk);
      lightRig.hemi.intensity = THREE.MathUtils.lerp(0.62, 0.48, dusk);
      if (lightRig.bloomPass) {
        lightRig.bloomPass.strength = THREE.MathUtils.lerp(0.11, 0.24, dusk);
      }
    }

    // Windmill rotor + live breeze spin
    const baseRad = THREE.MathUtils.degToRad(state.windmillDeg) + Math.PI / 4;
    rotorPivot.rotation.z = baseRad - windPhase * 0.55;

    // Red pennant flutter
    pennantPivot.rotation.y = Math.sin(windPhase * 3.4) * 0.12;
    pennantPivot.rotation.z = Math.cos(windPhase * 2.6) * 0.05;

    // Distant airship gentle bobbing + orbit
    const driftRad = THREE.MathUtils.degToRad(state.airshipDrift);
    scenic.airshipGroup.position.set(
      0.37 * Math.cos(driftRad) - 0.44 * Math.sin(driftRad),
      0.78 + Math.sin(windPhase * 1.3) * 0.016,
      -0.44 * Math.cos(driftRad) - 0.37 * Math.sin(driftRad),
    );
    scenic.airshipProp.rotation.x = windPhase * 9.0;

    turntableGrp.rotation.y = THREE.MathUtils.degToRad(state.turntableDeg);
  }

  function update(state, lightRig = null) {
    applyState(state, 0, lightRig);
  }

  function tick(elapsed, state, lightRig = null) {
    if (!state.liveWind) return;
    applyState(state, elapsed, lightRig);
  }

  return {
    root,
    params,
    paramSpecs,
    update,
    tick,
    lighting: {
      sunAzimuthDeg: -38,
      sunElevationDeg: 39,
      keyColor: 0xfff1d6,
      keyIntensity: 1.85,
      hemiSkyColor: 0x8ec4ff,
      hemiGroundColor: 0xdcc7a4,
      hemiIntensity: 0.62,
      fillColor: 0xbcd8ff,
      fillIntensity: 0.32,
      rimColor: 0xffebc8,
      rimIntensity: 0.38,
      envIntensity: 0.38,
      exposure: 0.97,
      aoIntensity: 0.84,
      aoRadiusScale: 0.125,
      bloomStrength: 0.11,
      bloomRadius: 0.42,
      bloomThreshold: 0.94,
      shadowBias: -0.00035,
      shadowNormalBias: 0.0016,
    },
    layers: [
      {
        key: "castle",
        label: "Castle Architecture",
        group: castleGrp,
        default: true,
      },
      {
        key: "terrain",
        label: "Cliff & Flora Terrain",
        group: terrainGrp,
        default: true,
      },
      {
        key: "environment",
        label: "Cloud Sea & Airship (Env)",
        group: scenic.envGrp,
        default: true,
        external: true,
        hidesStudioGround: true,
      },
      {
        key: "background",
        label: "Ghibli Sky & Clouds (Bg)",
        group: scenic.bgGrp,
        default: true,
        external: true,
        hidesStudioGround: true,
      },
    ],
    metadata: {
      name: "Ghibli Hilltop Castle",
      category: "Environments",
      summary:
        "Storybook cliffside castle diorama with volumetric cumulus clouds, instanced meadow grass, GTAO lighting, and toggleable scenic layers",
      units: "meters",
    },
  };
}
