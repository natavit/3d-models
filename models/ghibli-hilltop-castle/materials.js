import * as THREE from "three";
import { labelCanvasTexture, noiseBumpTexture, woodGrainTexture } from "../../src/kit/materials.js";

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

function hash2d(ix, iy, seed = 1) {
  const h = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

function tileableNoise2D(u, v, period, seed = 1) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const x0 = ((ix % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y0 = ((iy % period) + period) % period;
  const y1 = (y0 + 1) % period;

  const a = hash2d(x0, y0, seed);
  const b = hash2d(x1, y0, seed);
  const c = hash2d(x0, y1, seed);
  const d = hash2d(x1, y1, seed);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function tileableFbm2D(u, v, basePeriod = 8, octaves = 4, seed = 1) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = basePeriod;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileableNoise2D(u, v, p, seed + i * 19);
    norm += amp;
    p *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

function createAshlarStoneTextures(repeatX = 3.5, repeatY = 3.5, seed = 11) {
  const size = 1024;
  const colorTex = labelCanvasTexture(size, size, (ctx, w, h) => {
    const rand = mulberry32(seed);
    ctx.fillStyle = "#4d473f";
    ctx.fillRect(0, 0, w, h);

    const rows = 16;
    const rowH = h / rows;
    const tones = [
      "#c9bfae",
      "#b9af9d",
      "#d1c7b6",
      "#a99f8f",
      "#c2b7a4",
      "#b2a898",
      "#cbc0ad",
    ];

    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      let x = (r % 2) * -54 - Math.floor(rand() * 24);
      while (x < w + 64) {
        const bw = 74 + rand() * 62;
        const base = tones[Math.floor(rand() * tones.length)];
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.roundRect(x + 3.5, y + 3.5, bw - 7, rowH - 7, 6);
        ctx.fill();

        // Top sunlit bevel edge & bottom shadow edge per stone block
        ctx.fillStyle = "rgba(255, 250, 238, 0.22)";
        ctx.fillRect(x + 6, y + 4, bw - 12, 4);
        ctx.fillStyle = "rgba(38, 33, 27, 0.24)";
        ctx.fillRect(x + 6, y + rowH - 8, bw - 12, 4);

        // Chiseled mineral grain & subtle lichen/weathering flecks
        for (let s = 0; s < 14; s++) {
          const sx = x + 6 + rand() * Math.max(4, bw - 12);
          const sy = y + 6 + rand() * (rowH - 12);
          const rad = 1.5 + rand() * 3.5;
          ctx.fillStyle =
            rand() > 0.48
              ? `rgba(255,248,235,${(0.06 + rand() * 0.1).toFixed(2)})`
              : `rgba(45,40,34,${(0.07 + rand() * 0.11).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        if (rand() > 0.82) {
          ctx.fillStyle = "rgba(92, 118, 62, 0.18)";
          ctx.beginPath();
          ctx.arc(x + bw * 0.5, y + rowH - 7, 6 + rand() * 8, 0, Math.PI * 2);
          ctx.fill();
        }
        x += bw;
      }
    }
  });
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(repeatX, repeatY);

  const bumpTex = labelCanvasTexture(
    size,
    size,
    (ctx, w, h) => {
      const r2 = mulberry32(seed);
      ctx.fillStyle = "#222222";
      ctx.fillRect(0, 0, w, h);
      const rows = 16;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rowH;
        let x = (r % 2) * -54 - Math.floor(r2() * 24);
        while (x < w + 64) {
          const bw = 74 + r2() * 62;
          const v = Math.round(178 + r2() * 62);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.beginPath();
          ctx.roundRect(x + 4, y + 4, bw - 8, rowH - 8, 6);
          ctx.fill();

          for (let s = 0; s < 14; s++) {
            const sx = x + 6 + r2() * Math.max(4, bw - 12);
            const sy = y + 6 + r2() * (rowH - 12);
            const rad = 1.5 + r2() * 3.5;
            const dv = r2() > 0.5 ? v + 18 : v - 22;
            ctx.fillStyle = `rgb(${dv},${dv},${dv})`;
            ctx.beginPath();
            ctx.arc(sx, sy, rad, 0, Math.PI * 2);
            ctx.fill();
          }
          x += bw;
        }
      }
    },
    { srgb: false },
  );
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(repeatX, repeatY);

  return { colorTex, bumpTex };
}

function createStratifiedCliffTextures(repeatX = 3, repeatY = 3, seed = 211) {
  const size = 1024;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext("2d");
  const cImg = cCtx.createImageData(size, size);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext("2d");
  const bImg = bCtx.createImageData(size, size);

  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      // Horizontal sedimentary limestone strata + vertical angular fractures
      const warp = (tileableFbm2D(u, v, 6, 3, seed) - 0.5) * 0.14;
      const strataWave = Math.sin((v + warp) * Math.PI * 22);
      const sharpLedge = Math.pow(Math.abs(strataWave), 0.45) * Math.sign(strataWave);
      const vertCrack = Math.pow(
        1.0 - Math.abs(tileableFbm2D(u * 1.5, v * 0.5, 10, 4, seed + 41) * 2 - 1),
        5.0,
      );
      const grain = tileableFbm2D(u, v, 24, 3, seed + 83);

      let heightVal = 0.58 + sharpLedge * 0.24 + (grain - 0.5) * 0.22 - vertCrack * 0.42;
      heightVal = THREE.MathUtils.clamp(heightVal, 0, 1);

      const idx = (py * size + px) * 4;
      const shade = 0.72 + heightVal * 0.38;
      cImg.data[idx] = Math.min(255, Math.round(232 * shade));
      cImg.data[idx + 1] = Math.min(255, Math.round(224 * shade));
      cImg.data[idx + 2] = Math.min(255, Math.round(208 * shade));
      cImg.data[idx + 3] = 255;

      const bv = Math.round(heightVal * 255);
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(repeatX, repeatY);

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(repeatX, repeatY);

  return { colorTex, bumpTex };
}

function createShingleTextures(palette, mossTint, repeatX = 4, repeatY = 5, seed = 29) {
  const size = 1024;
  const colorTex = labelCanvasTexture(size, size, (ctx, w, h) => {
    const rand = mulberry32(seed);
    ctx.fillStyle = "#231a15";
    ctx.fillRect(0, 0, w, h);

    const rows = 20;
    const rowH = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      let x = (r % 2) * -28;
      while (x < w + 48) {
        const tw = 46 + rand() * 14;
        const base = palette[Math.floor(rand() * palette.length)];
        const grad = ctx.createLinearGradient(0, y, 0, y + rowH);
        grad.addColorStop(0, "rgba(0,0,0,0.22)");
        grad.addColorStop(0.22, "rgba(255,255,255,0.06)");
        grad.addColorStop(0.84, "rgba(255,255,255,0.10)");
        grad.addColorStop(1, "rgba(0,0,0,0.38)");

        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 1.5, tw - 4, rowH - 2.5, [2, 2, 6, 6]);
        ctx.fill();

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 1.5, tw - 4, rowH - 2.5, [2, 2, 6, 6]);
        ctx.fill();

        // Occasional weathered moss/lichen fleck near tile overlap
        if (mossTint && rand() > 0.78) {
          ctx.fillStyle = mossTint;
          ctx.beginPath();
          ctx.ellipse(x + tw * 0.5, y + 6, 8 + rand() * 8, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        x += tw;
      }
    }
  });
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(repeatX, repeatY);

  const bumpTex = labelCanvasTexture(
    size,
    size,
    (ctx, w, h) => {
      const rand = mulberry32(seed);
      ctx.fillStyle = "#181818";
      ctx.fillRect(0, 0, w, h);
      const rows = 20;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rowH;
        let x = (r % 2) * -28;
        while (x < w + 48) {
          const tw = 46 + rand() * 14;
          const topV = Math.round(135 + rand() * 25);
          const botV = Math.round(215 + rand() * 35);
          const g = ctx.createLinearGradient(0, y, 0, y + rowH);
          g.addColorStop(0, `rgb(${topV},${topV},${topV})`);
          g.addColorStop(0.88, `rgb(${botV},${botV},${botV})`);
          g.addColorStop(1, "rgb(40,40,40)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(x + 2.5, y + 2, tw - 5, rowH - 3.5, [2, 2, 6, 6]);
          ctx.fill();
          x += tw;
        }
      }
    },
    { srgb: false },
  );
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(repeatX, repeatY);

  return { colorTex, bumpTex };
}

function createLimePlasterTexture() {
  const tex = labelCanvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#eee1c6");
    grad.addColorStop(0.18, "#f5ebd4");
    grad.addColorStop(0.82, "#f2e5cb");
    grad.addColorStop(1, "#dfd0b2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const rand = mulberry32(314);
    for (let i = 0; i < 900; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 2 + rand() * 9;
      ctx.fillStyle =
        rand() > 0.5 ? "rgba(255,252,244,0.09)" : "rgba(150,128,96,0.06)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createLeadedWindowTextures() {
  return labelCanvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.66);
    grad.addColorStop(0, "#fff0bd");
    grad.addColorStop(0.55, "#f7a83b");
    grad.addColorStop(1, "#9d4a14");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#2a1f18";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.lineWidth = 4;
    for (let d = -w; d <= w * 2; d += 64) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + w, h);
      ctx.moveTo(d, h);
      ctx.lineTo(d + w, 0);
      ctx.stroke();
    }
  });
}

/**
 * Multi-scatter Ghibli Cumulus Volumetric Surface Shader:
 * Perturbs normals and density with 3D cauliflower FBM billows, applies wrap + Henyey-Greenstein
 * forward sun scattering, Beer-Powder crest illumination, and lavender-periwinkle self-shadowing.
 */
export function createVolumetricCloudMaterial() {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(-0.52, 0.62, 0.58).normalize() },
    uDusk: { value: 0.16 },
    uTime: { value: 0.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vMeta;

      void main() {
        vMeta = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uDusk;
      uniform float uTime;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vMeta;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);

        float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);

        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }

      // Billowy cauliflower cumulus FBM (rounded ridges like puffy water-vapor lobes)
      float billowFbm(vec3 p) {
        float v = 0.0;
        float amp = 0.52;
        for (int i = 0; i < 4; i++) {
          float n = noise3(p);
          float billow = 1.0 - abs(n * 2.0 - 1.0);
          v += amp * mix(n, billow * billow, 0.55);
          p = p * 2.07 + vec3(1.7, -2.3, 1.1);
          amp *= 0.48;
        }
        return v;
      }

      void main() {
        vec3 N0 = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Evaluate 3D cauliflower FBM gradient to sculpt crisp cumulus cloudlets
        vec3 drift = vec3(uTime * 0.012, 0.0, uTime * 0.006);
        vec3 sp = vWorldPos * 4.4 + drift;
        float eps = 0.038;
        float c0 = billowFbm(sp);
        float cx = billowFbm(sp + vec3(eps, 0.0, 0.0));
        float cy = billowFbm(sp + vec3(0.0, eps, 0.0));
        float cz = billowFbm(sp + vec3(0.0, 0.0, eps));
        vec3 grad = vec3(cx - c0, cy - c0, cz - c0) / eps;

        float fine = noise3(vWorldPos * 16.0 - drift * 1.5);
        vec3 N = normalize(N0 - grad * 0.52);

        // vMeta.x = macro puff AO (0.22 deep pocket .. 1.0 exposed crown)
        // vMeta.y = normalized height inside cloud bank (0 belly .. 1 top)
        float macroAO = clamp(vMeta.x, 0.0, 1.0);
        float bankH = clamp(vMeta.y, 0.0, 1.0);

        // Crisp volumetric wrap + cauliflower crest contrast matching Ghibli painted cumulus
        float sunWrap = clamp((dot(N, uSunDir) + 0.28) / 1.28, 0.0, 1.0);
        float microCrest = smoothstep(0.28, 0.76, c0 * 0.84 + fine * 0.16);
        float pocketShadow = pow(macroAO, 1.35);
        float lightEnergy = sunWrap * (0.38 + 0.62 * pocketShadow) * (0.72 + 0.36 * microCrest);
        lightEnergy = clamp(lightEnergy + bankH * 0.12 - (1.0 - pocketShadow) * 0.26, 0.0, 1.0);

        // Forward/rim multiple scattering ("silver lining" / Beer-Powder effect)
        float cosTheta = dot(-V, uSunDir);
        float phaseHG = pow(clamp(cosTheta * 0.5 + 0.5, 0.0, 1.0), 3.0);
        float rim = pow(1.0 - clamp(dot(N0, V), 0.0, 1.0), 2.2);
        float scatterGlow = (0.38 * phaseHG + 0.62 * rim) * smoothstep(0.24, 0.86, sunWrap + bankH * 0.35);

        // Ghibli Cumulus Palette: Dusty Lavender-Mauve Shadows -> Warm Golden-Cream Crowns
        vec3 dayDeepShadow = vec3(0.42, 0.44, 0.62); // Deep dusty-violet cumulus pocket
        vec3 dayMidShadow  = vec3(0.66, 0.68, 0.82); // Painterly lavender-slate shade
        vec3 dayBody       = vec3(0.92, 0.90, 0.92); // Warm pearlescent cloud body
        vec3 daySunCrest   = vec3(1.05, 0.96, 0.84); // Golden-hour sunlit ivory-peach crown

        vec3 duskDeepShadow = vec3(0.29, 0.24, 0.45);
        vec3 duskMidShadow  = vec3(0.56, 0.44, 0.65);
        vec3 duskBody       = vec3(0.95, 0.72, 0.62);
        vec3 duskSunCrest   = vec3(1.10, 0.76, 0.50);

        vec3 cDeep  = mix(dayDeepShadow, duskDeepShadow, uDusk);
        vec3 cMid   = mix(dayMidShadow,  duskMidShadow,  uDusk);
        vec3 cBody  = mix(dayBody,       duskBody,       uDusk);
        vec3 cCrest = mix(daySunCrest,   duskSunCrest,   uDusk);

        vec3 col;
        if (lightEnergy < 0.34) {
          col = mix(cDeep, cMid, smoothstep(0.0, 0.34, lightEnergy));
        } else if (lightEnergy < 0.68) {
          col = mix(cMid, cBody, smoothstep(0.34, 0.68, lightEnergy));
        } else {
          col = mix(cBody, cCrest, smoothstep(0.68, 1.0, lightEnergy));
        }

        // Add subsurface golden rim scatter on sunlit cauliflower edges
        col += cCrest * scatterGlow * 0.22;

        // Subtle aerial perspective blend for far outer cloud banks
        float camDist = length(vWorldPos - cameraPosition);
        vec3 hazeCol = mix(vec3(0.84, 0.88, 0.94), vec3(0.88, 0.58, 0.44), uDusk);
        float haze = smoothstep(3.6, 7.8, camDist) * 0.42;
        col = mix(col, hazeCol, haze);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  return { material: mat, uniforms };
}

/**
 * Soft FBM Cloud-Wisp Impostor Sprite Material:
 * Creates feathery, semi-transparent cumulus tendrils that cradle the rocky island base
 * and soften silhouette transitions between solid rock/arches and the sea of clouds.
 */
export function createCloudWispMaterial(sharedUniforms) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);

  for (let py = 0; py < size; py++) {
    const ny = (py / (size - 1)) * 2 - 1;
    for (let px = 0; px < size; px++) {
      const nx = (px / (size - 1)) * 2 - 1;
      const r = Math.sqrt(nx * nx + ny * ny);
      const u = px / size;
      const v = py / size;
      const n1 = tileableFbm2D(u, v, 4, 4, 509);
      const n2 = tileableFbm2D(u + 0.3, v - 0.2, 8, 3, 613);
      const radial = THREE.MathUtils.clamp(1.0 - Math.pow(r, 1.75), 0, 1);
      const alpha = THREE.MathUtils.smoothstep(radial * (0.55 + n1 * 0.72), 0.14, 0.68);
      // Encode pseudo-dome height in R, billow detail in G
      const dome = THREE.MathUtils.clamp((1 - ny * 0.5) * 0.6 + n2 * 0.4, 0, 1);

      const idx = (py * size + px) * 4;
      img.data[idx] = Math.round(dome * 255);
      img.data[idx + 1] = Math.round(n1 * 255);
      img.data[idx + 2] = Math.round(THREE.MathUtils.clamp(1 - r, 0, 1) * 255);
      img.data[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const wispTex = new THREE.CanvasTexture(canvas);

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      tWisp: { value: wispTex },
      uSunDir: sharedUniforms.uSunDir,
      uDusk: sharedUniforms.uDusk,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vTint;

      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #else
          vTint = vec3(0.85, 0.6, 0.55);
        #endif

        // Camera-facing billboard around each instance's world center & scale
        vec4 worldCenter = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sx = length((modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        float sy = length((modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);

        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 worldPos = worldCenter.xyz + camRight * (position.x * sx) + camUp * (position.y * sy);

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tWisp;
      uniform vec3 uSunDir;
      uniform float uDusk;
      varying vec2 vUv;
      varying vec3 vTint;

      void main() {
        vec4 tex = texture2D(tWisp, vUv);
        float alpha = tex.a * vTint.z;
        if (alpha < 0.01) discard;

        // Soft directional cloud shading matching 3D volumetric cumulus shader
        vec2 p = vUv * 2.0 - 1.0;
        float sunLit = clamp(0.55 - p.x * 0.25 + p.y * 0.35 + (tex.g - 0.5) * 0.35, 0.0, 1.0);
        sunLit *= vTint.x;

        vec3 dayShadow = vec3(0.62, 0.70, 0.87);
        vec3 dayCrest  = vec3(1.00, 0.97, 0.90);
        vec3 duskShadow = vec3(0.52, 0.42, 0.65);
        vec3 duskCrest  = vec3(1.05, 0.76, 0.52);

        vec3 cShade = mix(dayShadow, duskShadow, uDusk);
        vec3 cLight = mix(dayCrest, duskCrest, uDusk);
        vec3 col = mix(cShade, cLight, smoothstep(0.18, 0.82, sunLit));

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createCastlePalette() {
  const stoneWallSet = createAshlarStoneTextures(3.4, 3.4, 19);
  const stoneBridgeSet = createAshlarStoneTextures(5.2, 2.6, 43);
  const cliffSet = createStratifiedCliffTextures(3.2, 2.8, 211);
  const stuccoColorTex = createLimePlasterTexture();
  const fineBump = noiseBumpTexture({ size: 256, contrast: 26, repeat: 12, seed: 88 });
  const grassBump = noiseBumpTexture({ size: 256, contrast: 40, repeat: 22, seed: 303 });

  const terracottaSet = createShingleTextures(
    ["#be5735", "#ae4b2c", "#ca6440", "#9e4125", "#c35b39", "#b54f30"],
    "rgba(104, 128, 56, 0.22)",
    4.2,
    4.5,
    51,
  );
  const slateBlueSet = createShingleTextures(
    ["#4d6b8d", "#425e7d", "#5b799c", "#3b5470", "#537193", "#6281a4"],
    "rgba(190, 208, 225, 0.14)",
    5.5,
    6.5,
    73,
  );

  const oakTex = woodGrainTexture({
    size: 512,
    baseHex: "#543723",
    grainHex: "#352012",
    seed: 91,
  });
  const plankTex = woodGrainTexture({
    size: 512,
    baseHex: "#895e3c",
    grainHex: "#593a21",
    seed: 95,
  });

  const windowMap = createLeadedWindowTextures();
  const windowGlowMat = new THREE.MeshStandardMaterial({
    map: windowMap,
    emissive: new THREE.Color(0xff9d2e),
    emissiveMap: windowMap,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.05,
  });

  const volumetricCloud = createVolumetricCloudMaterial();
  const cloudWispMat = createCloudWispMaterial(volumetricCloud.uniforms);

  return {
    stoneWall: new THREE.MeshPhysicalMaterial({
      map: stoneWallSet.colorTex,
      bumpMap: stoneWallSet.bumpTex,
      bumpScale: 0.0048,
      roughness: 0.88,
      metalness: 0.0,
    }),
    stoneBridge: new THREE.MeshPhysicalMaterial({
      map: stoneBridgeSet.colorTex,
      bumpMap: stoneBridgeSet.bumpTex,
      bumpScale: 0.0045,
      roughness: 0.9,
      metalness: 0.0,
    }),
    creamStucco: new THREE.MeshPhysicalMaterial({
      map: stuccoColorTex,
      bumpMap: fineBump,
      bumpScale: 0.0016,
      roughness: 0.85,
      metalness: 0.0,
    }),
    darkTimber: new THREE.MeshPhysicalMaterial({
      map: oakTex,
      bumpMap: oakTex,
      bumpScale: 0.0024,
      roughness: 0.76,
      metalness: 0.0,
    }),
    warmPlank: new THREE.MeshPhysicalMaterial({
      map: plankTex,
      bumpMap: plankTex,
      bumpScale: 0.0022,
      roughness: 0.7,
      metalness: 0.0,
    }),
    terracottaRoof: new THREE.MeshPhysicalMaterial({
      map: terracottaSet.colorTex,
      bumpMap: terracottaSet.bumpTex,
      bumpScale: 0.0046,
      roughness: 0.76,
      metalness: 0.0,
    }),
    slateRoof: new THREE.MeshPhysicalMaterial({
      map: slateBlueSet.colorTex,
      bumpMap: slateBlueSet.bumpTex,
      bumpScale: 0.0042,
      roughness: 0.62,
      metalness: 0.05,
      clearcoat: 0.08,
      clearcoatRoughness: 0.52,
    }),
    cliffRock: new THREE.MeshPhysicalMaterial({
      map: cliffSet.colorTex,
      vertexColors: true,
      bumpMap: cliffSet.bumpTex,
      bumpScale: 0.0075,
      roughness: 0.93,
      metalness: 0.0,
    }),
    lushGrass: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      bumpMap: grassBump,
      bumpScale: 0.0038,
      roughness: 0.88,
      sheen: 0.22,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(0xa6e660),
    }),
    grassBlade: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    mossFoliage: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      bumpMap: grassBump,
      bumpScale: 0.0022,
      roughness: 0.82,
      metalness: 0.0,
    }),
    dirtPath: new THREE.MeshPhysicalMaterial({
      color: 0xcab693,
      bumpMap: stoneWallSet.bumpTex,
      bumpScale: 0.0028,
      roughness: 0.92,
    }),
    treeFoliageA: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      bumpMap: grassBump,
      bumpScale: 0.0026,
      roughness: 0.82,
      sheen: 0.22,
      sheenColor: new THREE.Color(0x9ce056),
    }),
    treeFoliageB: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      bumpMap: grassBump,
      bumpScale: 0.0026,
      roughness: 0.85,
    }),
    sailCanvas: new THREE.MeshPhysicalMaterial({
      color: 0xf4ead3,
      bumpMap: fineBump,
      bumpScale: 0.0014,
      roughness: 0.8,
      side: THREE.DoubleSide,
    }),
    redPennant: new THREE.MeshPhysicalMaterial({
      color: 0xc9352b,
      roughness: 0.65,
      sheen: 0.3,
      side: THREE.DoubleSide,
    }),
    weatheredBrass: new THREE.MeshPhysicalMaterial({
      color: 0xc89d46,
      metalness: 0.86,
      roughness: 0.3,
    }),
    darkIron: new THREE.MeshPhysicalMaterial({
      color: 0x2a2d32,
      metalness: 0.7,
      roughness: 0.48,
    }),
    windowGlow: windowGlowMat,
    cloudVolumetric: volumetricCloud.material,
    cloudUniforms: volumetricCloud.uniforms,
    cloudWisp: cloudWispMat,
  };
}
