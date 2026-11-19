import * as THREE from "three";

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

const textureCache = new Map();

export function noiseBumpTexture({ size = 256, contrast = 28, repeat = 4, seed = 42 } = {}) {
  const key = `noise:${size}:${contrast}:${repeat}:${seed}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(seed);

  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(128 + (rand() - 0.5) * 2 * contrast)));
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  textureCache.set(key, tex);
  return tex;
}

export function brushedMetalTexture({ size = 512, repeat = 2, seed = 101 } = {}) {
  const key = `brushed:${size}:${repeat}:${seed}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(seed);
  for (let i = 0; i < size * 10; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 24 + rand() * 140;
    const shade = Math.round(95 + rand() * 68);
    ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.32)`;
    ctx.lineWidth = 0.8 + rand() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.lineTo(x + len / 2, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  textureCache.set(key, tex);
  return tex;
}

export function woodGrainTexture({
  size = 512,
  baseHex = "#6b442a",
  grainHex = "#472916",
  seed = 77,
} = {}) {
  const key = `wood:${size}:${baseHex}:${grainHex}:${seed}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(seed);
  ctx.strokeStyle = grainHex;
  for (let i = 0; i < 140; i++) {
    const xBase = (i / 140) * size + (rand() - 0.5) * 8;
    ctx.globalAlpha = 0.12 + rand() * 0.24;
    ctx.lineWidth = 1 + rand() * 2.5;
    ctx.beginPath();
    for (let y = 0; y <= size; y += 16) {
      const wave = Math.sin((y / size) * Math.PI * 2 + i * 0.35) * 5;
      if (y === 0) ctx.moveTo(xBase + wave, y);
      else ctx.lineTo(xBase + wave, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

export function labelCanvasTexture(width, height, drawFn, { srgb = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  drawFn(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function paintedMetal(color = 0xc8372d, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.32,
    roughness: 0.2,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    ...opts,
  });
}

export function brushedMetal(color = 0xd2d6dc, opts = {}) {
  const brush = brushedMetalTexture();
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.92,
    roughness: 0.32,
    roughnessMap: brush,
    bumpMap: brush,
    bumpScale: 0.0012,
    ...opts,
  });
}

export function polishedChrome(opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf4f6f8,
    metalness: 1.0,
    roughness: 0.06,
    envMapIntensity: 1.25,
    ...opts,
  });
}

export function mattePlastic(color = 0x23262b, opts = {}) {
  const bump = noiseBumpTexture({ contrast: 20, repeat: 6 });
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.56,
    bumpMap: bump,
    bumpScale: 0.0008,
    ...opts,
  });
}

export function rubber(color = 0x18191c, opts = {}) {
  const bump = noiseBumpTexture({ contrast: 32, repeat: 8, seed: 99 });
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.88,
    bumpMap: bump,
    bumpScale: 0.0015,
    ...opts,
  });
}

export function clearGlass(opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.04,
    transmission: 0.94,
    ior: 1.5,
    thickness: 0.012,
    transparent: true,
    ...opts,
  });
}

export function tintedGlass(color = 0x9bb8c9, opts = {}) {
  return clearGlass({ color, transmission: 0.86, ...opts });
}

export function ceramic(color = 0xf5f2eb, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.14,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
    ...opts,
  });
}

export function wood(baseHex = "#6b442a", grainHex = "#472916", opts = {}) {
  const map = woodGrainTexture({ baseHex, grainHex });
  return new THREE.MeshPhysicalMaterial({
    map,
    metalness: 0.0,
    roughness: 0.44,
    clearcoat: 0.22,
    clearcoatRoughness: 0.35,
    bumpMap: map,
    bumpScale: 0.0012,
    ...opts,
  });
}

export function fabric(color = 0x4b5563, opts = {}) {
  const bump = noiseBumpTexture({ contrast: 38, repeat: 14, seed: 202 });
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.0,
    roughness: 0.84,
    sheen: 0.75,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35),
    bumpMap: bump,
    bumpScale: 0.002,
    ...opts,
  });
}

export function emissiveLed(color = 0x38bdf8, intensity = 2.4, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.25,
    metalness: 0.0,
    ...opts,
  });
}
