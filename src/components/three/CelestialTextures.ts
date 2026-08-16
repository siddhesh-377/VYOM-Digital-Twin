import * as THREE from 'three';

// Utility for creating high-resolution procedural textures using HTML5 Canvas
export class CelestialTextures {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  // Simple pseudo-noise helper
  private static noise(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return n - Math.floor(n);
  }

  // Smooth interpolated noise
  private static smoothNoise(x: number, y: number): number {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = this.noise(i, j);
    const n10 = this.noise(i + 1, j);
    const n01 = this.noise(i, j + 1);
    const n11 = this.noise(i + 1, j + 1);

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;
    return nx0 * (1 - sy) + nx1 * sy;
  }

  // Fractal Brownian Motion (FBM)
  private static fbm(x: number, y: number, octaves = 5): number {
    let v = 0;
    let a = 0.5;
    let scale = 1;
    for (let i = 0; i < octaves; i++) {
      v += a * this.smoothNoise(x * scale, y * scale);
      scale *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  // 1. SUN TEXTURE (High-res turbulent plasma, granulation, sunspots)
  static getSunTexture(): THREE.CanvasTexture {
    if (this.cache.has('sun')) return this.cache.get('sun')!;
    const w = 1024, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const n1 = this.fbm(nx * 12, ny * 12, 6);
        const n2 = this.fbm(nx * 24 + 1.7, ny * 24 + 2.3, 4);
        const heat = Math.pow((n1 * 0.7 + n2 * 0.3), 1.2);

        // Sunspot threshold
        const spotNoise = this.fbm(nx * 8 + 4.2, ny * 8 + 5.1, 4);
        const isSpot = spotNoise < 0.22 && Math.abs(ny - 0.5) < 0.25;

        let r = Math.min(255, Math.floor(255 * heat * 1.4));
        let g = Math.min(255, Math.floor(180 * heat * 1.2));
        let b = Math.min(255, Math.floor(40 * heat));

        if (isSpot) {
          r = Math.floor(r * 0.2);
          g = Math.floor(g * 0.15);
          b = Math.floor(b * 0.1);
        }

        const idx = (y * w + x) * 4;
        data[idx] = Math.max(160, r);
        data[idx + 1] = Math.max(80, g);
        data[idx + 2] = Math.max(10, b);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    this.cache.set('sun', tex);
    return tex;
  }

  // 2. MERCURY TEXTURE (Cratered basalt regolith)
  static getMercuryTexture(): THREE.CanvasTexture {
    if (this.cache.has('mercury')) return this.cache.get('mercury')!;
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const base = this.fbm(nx * 8, ny * 8, 5);
        const fine = this.fbm(nx * 32, ny * 32, 3);
        const crater = Math.sin(nx * 40) * Math.cos(ny * 40) * 0.1;
        const val = Math.min(255, Math.max(30, Math.floor((base * 0.7 + fine * 0.3 + crater) * 200)));

        const idx = (y * w + x) * 4;
        data[idx] = val + 10;
        data[idx + 1] = val + 8;
        data[idx + 2] = val + 5;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('mercury', tex);
    return tex;
  }

  // 3. VENUS TEXTURE (Sulfuric acid dense clouds)
  static getVenusTexture(): THREE.CanvasTexture {
    if (this.cache.has('venus')) return this.cache.get('venus')!;
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const swirls = this.fbm(nx * 6 + ny * 2, ny * 10, 5);
        const streaks = Math.sin(ny * 25 + swirls * 4) * 0.15 + 0.5;
        const val = swirls * 0.6 + streaks * 0.4;

        const idx = (y * w + x) * 4;
        data[idx] = Math.floor(225 * val + 30);
        data[idx + 1] = Math.floor(190 * val + 25);
        data[idx + 2] = Math.floor(130 * val + 15);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('venus', tex);
    return tex;
  }

  // 4. MARS TEXTURE (Rust terrain, Olympus Mons volcanic regions, Polar caps)
  static getMarsTexture(): THREE.CanvasTexture {
    if (this.cache.has('mars')) return this.cache.get('mars')!;
    const w = 1024, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const land = this.fbm(nx * 6, ny * 6, 6);
        const rocky = this.fbm(nx * 20, ny * 20, 3);
        const combined = land * 0.75 + rocky * 0.25;

        // Polar ice caps
        const polarDist = Math.abs(ny - 0.5);
        const isPole = polarDist > 0.42 + this.noise(nx * 10, 0) * 0.03;

        let r = Math.floor(180 * combined + 45);
        let g = Math.floor(75 * combined + 25);
        let b = Math.floor(30 * combined + 15);

        // Dark volcanic plains (Acidalia, Syrtis Major)
        if (combined < 0.42) {
          r = Math.floor(r * 0.65);
          g = Math.floor(g * 0.65);
          b = Math.floor(b * 0.65);
        }

        if (isPole) {
          r = 235; g = 240; b = 250;
        }

        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('mars', tex);
    return tex;
  }

  // 5. JUPITER TEXTURE (Cloud belts, zones, Great Red Spot storm vortex)
  static getJupiterTexture(): THREE.CanvasTexture {
    if (this.cache.has('jupiter')) return this.cache.get('jupiter')!;
    const w = 1024, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        // Strong horizontal banding with turbulent perturbations
        const turbulence = this.fbm(nx * 15, ny * 35, 5) * 0.12;
        const band = Math.sin((ny + turbulence) * 45) * 0.5 + 0.5;

        // Great Red Spot around (0.6, 0.65)
        const dx = (nx - 0.58) * 6;
        const dy = (ny - 0.68) * 12;
        const spotDist = Math.sqrt(dx * dx + dy * dy);
        const isSpot = spotDist < 0.6;

        let r = Math.floor(190 + band * 45);
        let g = Math.floor(140 + band * 35);
        let b = Math.floor(90 + band * 25);

        if (isSpot) {
          const spotWeight = 1 - spotDist / 0.6;
          r = Math.floor(r * (1 - spotWeight) + 210 * spotWeight);
          g = Math.floor(g * (1 - spotWeight) + 60 * spotWeight);
          b = Math.floor(b * (1 - spotWeight) + 40 * spotWeight);
        }

        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('jupiter', tex);
    return tex;
  }

  // 6. SATURN TEXTURE & RINGS
  static getSaturnTexture(): THREE.CanvasTexture {
    if (this.cache.has('saturn')) return this.cache.get('saturn')!;
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const band = Math.sin(ny * 50 + this.fbm(nx * 8, ny * 15, 3) * 0.05) * 0.5 + 0.5;
        const idx = (y * w + x) * 4;
        data[idx] = Math.floor(220 + band * 25);
        data[idx + 1] = Math.floor(195 + band * 30);
        data[idx + 2] = Math.floor(140 + band * 35);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('saturn', tex);
    return tex;
  }

  static getSaturnRingTexture(): THREE.CanvasTexture {
    if (this.cache.has('saturn_ring')) return this.cache.get('saturn_ring')!;
    const w = 512, h = 1;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, 1);
    const data = imgData.data;

    for (let x = 0; x < w; x++) {
      const u = x / w;
      // Cassini Division around u = 0.65 to 0.70
      let alpha = 0.85;
      if (u < 0.1) alpha = u * 8.5; // inner fade
      if (u > 0.63 && u < 0.70) alpha = 0.05; // Cassini division
      if (u > 0.95) alpha = (1 - u) * 17; // outer edge fade

      const bandPattern = Math.sin(u * 120) * 0.15 + 0.85;
      const idx = x * 4;
      data[idx] = Math.floor(215 * bandPattern);
      data[idx + 1] = Math.floor(195 * bandPattern);
      data[idx + 2] = Math.floor(155 * bandPattern);
      data[idx + 3] = Math.floor(alpha * 255);
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('saturn_ring', tex);
    return tex;
  }

  // 7. URANUS TEXTURE (Cyan atmosphere with faint banding)
  static getUranusTexture(): THREE.CanvasTexture {
    if (this.cache.has('uranus')) return this.cache.get('uranus')!;
    const w = 256, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#8be5f5');
    grad.addColorStop(0.5, '#4bb9dd');
    grad.addColorStop(1, '#8be5f5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('uranus', tex);
    return tex;
  }

  // 8. NEPTUNE TEXTURE (Deep azure blue with storm spots and cirrus clouds)
  static getNeptuneTexture(): THREE.CanvasTexture {
    if (this.cache.has('neptune')) return this.cache.get('neptune')!;
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const bands = this.fbm(nx * 10, ny * 20, 4);
        const streak = Math.sin(ny * 30 + bands * 2) * 0.1;
        const darkSpot = Math.sqrt(Math.pow((nx - 0.4) * 4, 2) + Math.pow((ny - 0.5) * 8, 2)) < 0.4;

        let r = Math.floor(25 + bands * 20 + streak * 30);
        let g = Math.floor(65 + bands * 35 + streak * 40);
        let b = Math.floor(180 + bands * 55);

        if (darkSpot) {
          r = Math.floor(r * 0.4);
          g = Math.floor(g * 0.4);
          b = Math.floor(b * 0.5);
        }

        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('neptune', tex);
    return tex;
  }

  // 9. MOON TEXTURE
  static getMoonTexture(): THREE.CanvasTexture {
    if (this.cache.has('moon')) return this.cache.get('moon')!;
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const f = this.fbm(nx * 12, ny * 12, 5);
        const val = Math.floor(f * 180 + 35);
        const idx = (y * w + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val + 5;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('moon', tex);
    return tex;
  }

  // 10. WORMHOLE ACCRETION DISK (Luminous relativistic plasma swirl)
  static getAccretionDiskTexture(): THREE.CanvasTexture {
    if (this.cache.has('accretion')) return this.cache.get('accretion')!;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const theta = Math.atan2(dy, dx);

        if (r < 0.22 || r > 0.98) {
          const idx = (y * size + x) * 4;
          data[idx + 3] = 0;
          continue;
        }

        // Swirling logarithmic spiral arms
        const armNoise = this.fbm((theta / (Math.PI * 2) + Math.log(r) * 1.5) * 6, r * 8, 4);
        const radialFalloff = Math.sin((r - 0.22) / 0.76 * Math.PI);
        const intensity = Math.pow(armNoise * radialFalloff, 0.85);

        // Relativistic Doppler beaming (left side brighter)
        const doppler = 1.0 - (dx * 0.45);

        const rCol = Math.min(255, Math.floor(intensity * 255 * doppler * 1.2));
        const gCol = Math.min(255, Math.floor(intensity * 160 * doppler));
        const bCol = Math.min(255, Math.floor(intensity * 230 * (1 - r)));

        const idx = (y * size + x) * 4;
        data[idx] = rCol;
        data[idx + 1] = gCol;
        data[idx + 2] = bCol;
        data[idx + 3] = Math.floor(intensity * 240);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    this.cache.set('accretion', tex);
    return tex;
  }
}
