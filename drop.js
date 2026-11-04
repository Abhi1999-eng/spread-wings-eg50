import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import Lenis from 'lenis';
import { L10N, LANGS } from './drop-i18n.js?v=11';

/* =========================================================
   Helpers
   ========================================================= */
const $ = (id) => document.getElementById(id);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const range = (s, a, b) => clamp01((s - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (x) => x * x * x;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const isMobile = () => window.innerWidth < 900;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const damp = THREE.MathUtils.damp;

// Story clock: s runs 0..8, one unit per scroll beat
const RELEASE = 0.55;
const IMPACT = 6.86;
const FALL_SECONDS = 92;

/* =========================================================
   Story (fictional)
   ========================================================= */
/* =========================================================
   Language
   ========================================================= */
function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && L10N[q]) return q;
  try { const saved = localStorage.getItem('sw-lang'); if (saved && L10N[saved]) return saved; } catch (e) { /* storage blocked */ }
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : nav.startsWith('ja') ? 'ja' : 'en';
}
let lang = pickLang();
const T = () => L10N[lang];

// Client story: one chapter per scroll beat. Beat 0 is the hero, beat 7 the finale.
const BEATS = [null, { n: 1 }, { n: 2 }, { n: 3 }, { n: 4, href: 'index.html' }, { n: 5 }, { n: 6 }, null];
const chapter = (b) => T().ch[b.n - 1];

// Part dossiers (illustrative concept payload)
const CODES = { nose: 'ARROWHEAD', sensor: 'WHISPER', telemetry: 'LANTERN', power: 'EMBER', core: 'CLASSIFIED', cradle: 'SPINE', shell: 'SHELL', tail: 'FEATHERS', lug: 'TALON' };
const info = (k) => { const [name, text, stats] = T().parts[k]; return { code: CODES[k], name, text, stats }; };
const PART_ORDER = ['nose', 'sensor', 'telemetry', 'power', 'core', 'cradle', 'shell', 'tail', 'lug'];

function rand(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* =========================================================
   Three.js stage
   ========================================================= */
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// render resolution never drops below the CSS pixel grid; it only climbs toward retina when the GPU has headroom
const PR_MAX = Math.min(window.devicePixelRatio, 2);
const PR_MIN = Math.min(window.devicePixelRatio, 1);
let pixelRatio = Math.min(window.devicePixelRatio, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping;   // keep the footage colours exactly as graded
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 120);
const zoomCam = new THREE.PerspectiveCamera(30, 16 / 10, 0.05, 60);
zoomCam.layers.set(0);

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x10182a, 0.35);
const key = new THREE.DirectionalLight(0xffffff, 1.7);
key.position.set(5, 6, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 30 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
const rim = new THREE.PointLight(0xffd6a0, 10, 24);
rim.position.set(-4, 1.5, -3);
scene.add(hemi, key, key.target, rim);

// key light tint per scenery (sampled from the footage)
const TINT = [0xcfe0ff, 0xffc98a, 0xeef3ff, 0xd8e4dc, 0xe6efd4, 0xffa060, 0x9fb0e0, 0xffa050].map((c) => new THREE.Color(c));
const HEMI_SKY = [0x2a4a80, 0xf0b070, 0xc8d4e8, 0x8aa0a0, 0x9ab890, 0xd07040, 0x404c78, 0xff8a40].map((c) => new THREE.Color(c));

/* =========================================================
   Real footage sceneries, drawn as the WebGL background
   ========================================================= */
const CLIPS = ['strat', 'clouds', 'himalaya', 'forest', 'river', 'coast', 'desert'];
const vidBox = document.createElement('div');
vidBox.className = 'vids';
vidBox.setAttribute('aria-hidden', 'true');
document.body.appendChild(vidBox);
const texLoader = new THREE.TextureLoader();
const clips = CLIPS.map((name) => {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  vidBox.appendChild(v);
  const tex = new THREE.VideoTexture(v);
  tex.colorSpace = THREE.SRGBColorSpace;
  const poster = texLoader.load(`assets/drop/${name}.jpg`);
  poster.colorSpace = THREE.SRGBColorSpace;
  return { name, v, tex, poster, loaded: false };
});
const clipTex = (c) => (c.v.readyState >= 2 ? c.tex : c.poster);

function manageClips(sv, rate) {
  const cur = THREE.MathUtils.clamp(Math.floor(sv), 0, 6);
  clips.forEach((c, i) => {
    if (!c.loaded && i >= cur - 1 && i <= cur + 1) { c.v.src = `assets/drop/${c.name}.mp4`; c.loaded = true; }
    const active = c.loaded && sv > i - 0.45 && (i === 6 || sv < i + 1.25);   // start decoding early so the cut is clean
    if (active && c.v.paused) c.v.play().catch(() => {});
    if (!active && !c.v.paused) c.v.pause();
    if (active && Math.abs(c.v.playbackRate - rate) > 0.05) c.v.playbackRate = rate;
  });
}

const bgUniforms = {
  texA: { value: clips[0].poster }, texB: { value: clips[0].poster }, mixAB: { value: 0 },
  zoomA: { value: 1 }, zoomB: { value: 1 }, driftA: { value: 0 }, driftB: { value: 0 }, shiftA: { value: 0 }, shiftB: { value: 0 },
  viewAspect: { value: 1 }, wipe: { value: 0 }, wipeY: { value: 0 }, time: { value: 0 },
  focusBlur: { value: 0 }, speedBlur: { value: 0 }, boom: { value: 0 }, shake: { value: new THREE.Vector2() },
  fogTint: { value: new THREE.Color(0xeef2f6) },
};
const NOISE_GLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;
const bgMat = new THREE.ShaderMaterial({
  uniforms: bgUniforms,
  depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D texA, texB;
    uniform float mixAB, zoomA, zoomB, driftA, driftB, shiftA, shiftB, viewAspect, wipe, wipeY, time, focusBlur, speedBlur, boom;
    uniform vec2 shake;
    uniform vec3 fogTint;
    varying vec2 vUv;
    ${NOISE_GLSL}
    const float VA = 16.0 / 9.0;
    vec2 cover(vec2 uv) {
      vec2 s = viewAspect > VA ? vec2(1.0, VA / viewAspect) : vec2(viewAspect / VA, 1.0);
      return (uv - 0.5) * s + 0.5;
    }
    vec3 night(vec2 uv) {
      vec3 c = mix(vec3(0.035, 0.05, 0.11), vec3(0.002, 0.004, 0.015), smoothstep(0.55, 1.0, uv.y));
      vec2 g = uv * vec2(viewAspect, 1.0) * 220.0;
      float st = step(0.996, hash(floor(g))) * (0.4 + 0.6 * hash(floor(g) + 7.0));
      return c + st * smoothstep(0.62, 0.9, uv.y) * 0.8;
    }
    vec3 clip(sampler2D t, vec2 uv, float zoom, float drift, float shift) {
      vec2 tuv = (cover(uv + shake) - 0.5) / zoom + 0.5;
      tuv.y += drift + shift;
      float r = focusBlur * 0.012;
      float sp = speedBlur * 0.05;
      if (r + sp < 0.0005) {
        vec3 c0 = texture2D(t, clamp(tuv, 0.001, 0.999)).rgb;
        return shift > 0.0 ? mix(c0, night(uv), smoothstep(0.9, 1.0, tuv.y)) : c0;
      }
      vec3 c = vec3(0.0);
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float a = fi * 2.39996;
        vec2 o = vec2(cos(a), sin(a)) * r * sqrt(fi / 8.0) + vec2(0.0, (fi / 8.0 - 0.5) * sp);
        c += texture2D(t, clamp(tuv + o, 0.001, 0.999)).rgb;
      }
      c /= 9.0;
      if (shift > 0.0) c = mix(c, night(uv), smoothstep(0.9, 1.0, tuv.y));
      return c;
    }
    void main() {
      vec3 a = clip(texA, vUv, zoomA, driftA, shiftA);
      vec3 col = mixAB > 0.001 ? mix(a, clip(texB, vUv, zoomB, driftB, shiftB), mixAB) : a;
      // punching through a cloud bank between sceneries
      if (wipe > 0.001) {
        vec2 p = vec2(vUv.x * viewAspect, vUv.y) * 2.2 + vec2(0.0, wipeY * 2.5) + time * 0.03;
        float n = fbm(p) * 0.65 + fbm(p * 3.1 + 4.0) * 0.35;
        float d = smoothstep(0.62, 0.32, n + 0.55 - wipe * 0.95);
        col = mix(col, fogTint * (0.86 + 0.2 * n), clamp(d * wipe * 1.25, 0.0, 1.0));
      }
      // fireball light washing over the desert
      if (boom > 0.001) {
        float dd = distance(vUv * vec2(viewAspect, 1.0), vec2(0.5 * viewAspect, 0.3));
        col += vec3(1.0, 0.5, 0.2) * boom * (exp(-dd * 2.6) * 1.1 + 0.12);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bgQuad.frustumCulled = false;
const bgScene = new THREE.Scene();
bgScene.add(bgQuad);
const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// image-based lighting from each scene's footage, prebuilt once from the posters while the boot screen runs,
// so a scene change only swaps a texture (a PMREM bake costs tens of ms and used to hitch the transition)
// (frames go through a small canvas: PMREM sizes itself from image.width, which is 0 on a <video>)
const envCanvas = document.createElement('canvas');
envCanvas.width = 256; envCanvas.height = 128;
const envCtx = envCanvas.getContext('2d');
const envTex = new THREE.CanvasTexture(envCanvas);
envTex.colorSpace = THREE.SRGBColorSpace;
const envMaps = new Array(CLIPS.length).fill(null);
function bakeNextEnv() {
  const i = envMaps.findIndex((m, k) => !m && clips[k].poster.image && clips[k].poster.image.complete);
  if (i < 0) return;
  envCtx.drawImage(clips[i].poster.image, 0, 0, 256, 128);
  envTex.needsUpdate = true;
  envMaps[i] = pmrem.fromEquirectangular(envTex).texture;
}
function updateEnv(i) {
  if (envMaps.includes(null)) bakeNextEnv();      // at most one bake per frame, done during boot
  const m = envMaps[i];
  if (m && scene.environment !== m) scene.environment = m;
}

/* ---------- Post: bloom + lens (grain, vignette, chromatic aberration) ---------- */
const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
const bgPass = new RenderPass(bgScene, bgCam);
const mainPass = new RenderPass(scene, camera);
mainPass.clear = false;
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.55, 0.65, 0.88);
const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.045 }, vignette: { value: 0.55 }, ca: { value: 0.002 }, aspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, ca, aspect; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d * vec2(aspect, 1.0), d * vec2(aspect, 1.0));
      vec2 off = d * ca * (0.5 + r2 * 2.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c += (hash(vUv * 1000.0 + fract(time * 13.0) * 91.0) - 0.5) * grain;
      c *= 1.0 - vignette * smoothstep(0.15, 1.1, r2);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(bgPass);
composer.addPass(mainPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(lens);

const grainTile = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  const r = rand(77);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
})();
function grain(g, w, h, alpha, mode = 'overlay') {
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = mode;
  g.fillStyle = g.createPattern(grainTile, 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const glowTex = canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

// value-noise puff: used for passing clouds and the mushroom cloud
function noisePuff(size, seed, density) {
  return canvasTex(size, size, (g, w) => {
    const r = rand(seed);
    const grid = 9, pts = Array.from({ length: (grid + 1) * (grid + 1) }, () => r());
    const val = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const p = (a, b) => pts[(b % grid) * (grid + 1) + (a % grid)];
      return lerp(lerp(p(xi, yi), p(xi + 1, yi), u), lerp(p(xi, yi + 1), p(xi + 1, yi + 1), u), v);
    };
    const img = g.createImageData(w, w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      let n = 0, a = 0.5, f = grid / w;
      for (let o = 0; o < 4; o++) { n += a * val((x * f) % grid, (y * f) % grid); a *= 0.5; f *= 2; }
      const dx = x / w - 0.5, dy = y / w - 0.5;
      const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
      const al = Math.max(0, Math.min(1, (n * 1.4 - (1 - fall) * 0.9) * fall * density));
      const i = (y * w + x) * 4;
      const sh = 190 + n * 65;
      img.data[i] = sh; img.data[i + 1] = sh; img.data[i + 2] = sh; img.data[i + 3] = al * 255;
    }
    g.putImageData(img, 0, 0);
  });
}
const cloudTex = noisePuff(256, 99, 1.6);
const smokeTex = noisePuff(128, 17, 2.2);

// weathered olive-drab paint, stencils, panel seams and rivets
function paintTex(withText) {
  return canvasTex(2048, 1024, (g, w, h) => {
    const r = rand(withText ? 3 : 4);
    g.fillStyle = '#4a4e30'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(90,92,60,.06)' : 'rgba(30,32,18,.07)';
      g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 260, 20 + r() * 120, r() * 3, 0, 7); g.fill();
    }
    // airflow streaks run along the length (canvas y)
    for (let i = 0; i < 420; i++) {
      g.strokeStyle = r() < 0.6 ? `rgba(20,20,12,${0.04 + r() * 0.08})` : `rgba(150,145,110,${0.03 + r() * 0.05})`;
      g.lineWidth = 1 + r() * 3;
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 60 + r() * 380); g.stroke();
    }
    // panel seams + rivets
    g.strokeStyle = 'rgba(10,10,5,.55)'; g.lineWidth = 3;
    [0.2, 0.5, 0.8].forEach((v) => { g.beginPath(); g.moveTo(0, v * h); g.lineTo(w, v * h); g.stroke(); });
    g.beginPath(); g.moveTo(w * 0.62, 0); g.lineTo(w * 0.62, h); g.stroke();
    g.fillStyle = 'rgba(120,118,90,.7)';
    [0.2, 0.5, 0.8].forEach((v) => { for (let x = 12; x < w; x += 34) { g.beginPath(); g.arc(x, v * h + 9, 2.6, 0, 7); g.fill(); g.beginPath(); g.arc(x, v * h - 9, 2.6, 0, 7); g.fill(); } });
    // chipped paint and scratches
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = `rgba(170,165,135,${0.12 + r() * 0.3})`;
      g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 50, y + (r() - 0.5) * 18); g.stroke();
    }
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(105,100,85,${0.3 + r() * 0.4})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 7, 1 + r() * 4, r() * 3, 0, 7); g.fill();
    }
    if (withText) {
      g.save();
      g.translate(w * 0.27, h * 0.5);
      g.rotate(Math.PI / 2);
      g.fillStyle = 'rgba(226,218,180,.82)';
      g.font = '700 92px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillText('SPREADWINGS', 0, 0);
      g.font = '500 30px "JetBrains Mono", monospace';
      g.fillText('SW-EG50/HX  ·  CONCEPT ITEM', 0, 52);
      g.fillText('ENGINEERING BEYOND BOUNDARIES', 0, 92);
      g.restore();
      g.fillStyle = 'rgba(226,218,180,.75)';
      g.font = '500 26px "JetBrains Mono", monospace';
      g.fillText('▲ FWD', w * 0.07, h * 0.12);
      g.fillText('LIFT', w * 0.42, h * 0.56);
    }
    grain(g, w, h, 0.14);
  });
}
// packed roughness (G) + metalness (B): scratches show bare metal
const wearTex = canvasTex(1024, 512, (g, w, h) => {
  const r = rand(11);
  g.fillStyle = 'rgb(0,175,18)'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 600; i++) {
    const x = r() * w, y = r() * h;
    g.strokeStyle = `rgb(0,${70 + r() * 60},${160 + r() * 90})`;
    g.lineWidth = 0.5 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 26, y + (r() - 0.5) * 9); g.stroke();
  }
  grain(g, w, h, 0.16);
}, false);
const bumpTex = canvasTex(1024, 512, (g, w, h) => {
  const r = rand(12);
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#202020'; g.lineWidth = 2;
  [0.2, 0.5, 0.8].forEach((v) => { g.beginPath(); g.moveTo(0, v * h); g.lineTo(w, v * h); g.stroke(); });
  g.beginPath(); g.moveTo(w * 0.62, 0); g.lineTo(w * 0.62, h); g.stroke();
  g.fillStyle = '#e0e0e0';
  [0.2, 0.5, 0.8].forEach((v) => { for (let x = 6; x < w; x += 17) { g.beginPath(); g.arc(x, v * h + 4.5, 1.4, 0, 7); g.fill(); g.beginPath(); g.arc(x, v * h - 4.5, 1.4, 0, 7); g.fill(); } });
  grain(g, w, h, 0.09, 'source-over');
}, false);
const paintA = paintTex(true), paintB = paintTex(false);
const painted = (map, extra = {}) => new THREE.MeshPhysicalMaterial({
  transparent: true, map, roughnessMap: wearTex, metalnessMap: wearTex, bumpMap: bumpTex, bumpScale: 1.2,
  roughness: 1, metalness: 1, emissive: 0x000000, ...extra,
});
const circuitTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#062019'; g.fillRect(0, 0, w, h);
  const r = rand(5);
  g.strokeStyle = 'rgba(70,255,180,.75)'; g.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    let x = r() * w, y = r() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { if (r() < 0.5) x += (r() - 0.5) * 120; else y += (r() - 0.5) * 80; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle = '#0d1116'; const cw = 20 + r() * 50, ch = 14 + r() * 30;
    const x = r() * w, y = r() * h; g.fillRect(x, y, cw, ch);
    g.fillStyle = '#d9b44a'; for (let p = 0; p < cw; p += 6) { g.fillRect(x + p, y - 3, 3, 3); g.fillRect(x + p, y + ch, 3, 3); }
  }
});

/* ---------- EG-50 drone (same proportions as the main site) ---------- */
const dmat = {
  body: new THREE.MeshPhysicalMaterial({ color: 0xb9bec4, metalness: 0.2, roughness: 0.55, roughnessMap: wearTex, bumpMap: bumpTex, bumpScale: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
  wing: new THREE.MeshPhysicalMaterial({ color: 0xc4c8cc, metalness: 0.15, roughness: 0.6, roughnessMap: wearTex, clearcoat: 0.2 }),
  nose: new THREE.MeshPhysicalMaterial({ color: 0xb8302f, metalness: 0.1, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.4 }),
  fin: new THREE.MeshPhysicalMaterial({ color: 0x46526a, metalness: 0.4, roughness: 0.5 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1a2232, metalness: 0.7, roughness: 0.4 }),
};
const droneRig = new THREE.Group();
const drone = new THREE.Group();
droneRig.add(drone);
scene.add(droneRig);
function latheX(points, material, segments = 48) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), material);
  m.rotation.z = -Math.PI / 2;
  return m;
}
drone.add(latheX([[0.0, -1.62], [0.11, -1.6], [0.16, -1.45], [0.18, -1.2], [0.18, 0.95], [0.178, 1.0]], dmat.body));
drone.add(latheX([[0.178, 1.0], [0.175, 1.15], [0.16, 1.35], [0.12, 1.52], [0.06, 1.62], [0.0, 1.66]], dmat.nose));
function droneWing(side) {
  const s = new THREE.Shape();
  s.moveTo(0.55, 0); s.lineTo(-1.32, 1.36); s.lineTo(-1.5, 1.36); s.lineTo(-1.5, 0); s.lineTo(0.55, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, dmat.wing);
  m.scale.z = side; m.position.y = -0.04;
  return m;
}
drone.add(droneWing(-1), droneWing(1));
[-1, 1].forEach((side) => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.14); s.lineTo(0.22, -0.14); s.lineTo(0.02, 0.3); s.lineTo(-0.16, 0.3); s.lineTo(0, -0.14);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), dmat.fin);
  m.position.set(-1.5, -0.04, side * 1.36 - 0.01);
  drone.add(m);
});
const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 24), dmat.dark);
housing.rotation.z = Math.PI / 2; housing.position.x = -1.7;
const prop = new THREE.Group();
prop.position.x = -1.83;
prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.72, 0.06), dmat.dark));
const propDisc = new THREE.Mesh(new THREE.CircleGeometry(0.37, 48), new THREE.MeshBasicMaterial({ color: 0x8fa9c7, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
propDisc.rotation.y = Math.PI / 2;
prop.add(propDisc);
const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), dmat.dark);
pylon.position.set(0.05, -0.2, 0);
const navLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff3040, blending: THREE.AdditiveBlending, depthWrite: false }));
navLight.position.set(-1.45, 0.25, 0); navLight.scale.setScalar(0.4);
drone.add(housing, prop, pylon, navLight);

/* ---------- Payload (axis = local Y, nose at −Y) ---------- */
const bombRig = new THREE.Group();   // position, scale, yaw, wobble
const tiltG = new THREE.Group();     // nose-down ↔ horizontal
const spinG = new THREE.Group();     // roll around own axis
bombRig.add(tiltG); tiltG.add(spinG);
scene.add(bombRig);

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lathe = (pts, mat, seg = 64, phiStart = 0, phiLen = Math.PI * 2) =>
  new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLen), mat);
const wireMat = new THREE.LineBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const wireOf = (pts, phiStart = 0, phiLen = Math.PI * 2, seg = 18) =>
  new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * 1.004, y)), seg, phiStart, phiLen)), wireMat);

const parts = {};
const pickables = [];
function addPart(key, group, center, offset, delay, opts = {}) {
  const mats = [];
  group.traverse((o) => {
    if (o.isMesh) {
      o.userData.part = key;
      pickables.push(o);
      if (o.material.emissive && !mats.includes(o.material)) {
        o.material.userData.baseEmissive = o.material.emissive.clone();
        mats.push(o.material);
      }
    }
  });
  spinG.add(group);
  parts[key] = { key, group, center, offset, delay, mats, glow: 0, xray: !!opts.xray, flip: opts.flip || 1, idx: PART_ORDER.indexOf(key) + 1 };
  return parts[key];
}
const phys = (o) => new THREE.MeshPhysicalMaterial({ transparent: true, ...o });

// Outer casing: two halves so the scan can open it like a book
const SHELL_PTS = [[0.36, -1.0], [0.41, -0.85], [0.44, -0.6], [0.44, 0.62], [0.42, 0.85], [0.36, 1.02], [0.3, 1.12]];
const shell = new THREE.Group();
const shellMats = [painted(paintA, { side: THREE.DoubleSide }), painted(paintB, { side: THREE.DoubleSide })];
const shellMat = shellMats[0];
const bandMat = phys({ color: 0xc9a227, roughnessMap: wearTex, metalnessMap: wearTex, roughness: 1, metalness: 1, bumpMap: bumpTex, bumpScale: 0.8, emissive: 0x000000 });
const halves = [0, Math.PI].map((phi, i) => {
  const h = new THREE.Group();
  h.add(lathe(SHELL_PTS, shellMats[i], 64, phi, Math.PI));
  h.add(lathe([[0.444, -0.5], [0.444, -0.38]], bandMat, 48, phi, Math.PI));
  h.add(lathe([[0.444, 0.48], [0.444, 0.52]], bandMat, 48, phi, Math.PI));
  h.add(wireOf(SHELL_PTS, phi, Math.PI, 10));
  shell.add(h);
  return h;
});
addPart('shell', shell, V(0, 0, 0), V(0, 0, 0), 0, { xray: true });

// Nose fairing
const NOSE_PTS = [[0.0, -1.66], [0.09, -1.63], [0.19, -1.54], [0.28, -1.38], [0.34, -1.18], [0.36, -1.0]];
const nose = new THREE.Group();
nose.add(lathe(NOSE_PTS, painted(paintB, { color: 0xd8d4c4 })));
nose.add(wireOf(NOSE_PTS));
const sensorWindow = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), phys({ color: 0x0b1a2a, metalness: 0.9, roughness: 0.05, emissive: 0x2ad8ff, emissiveIntensity: 0.6 }));
sensorWindow.position.y = -1.665; sensorWindow.rotation.x = Math.PI / 2;
nose.add(sensorWindow);
addPart('nose', nose, V(0, -1.3, 0), V(0, -1.75, 0), 0, { xray: true });

// Ground-sense ring
const sensor = new THREE.Group();
const sensorMat = phys({ color: 0x2a3240, metalness: 0.7, roughness: 0.35, emissive: 0x29d6ff, emissiveIntensity: 0 });
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 12, 48), sensorMat);
ring.rotation.x = Math.PI / 2;
sensor.add(ring);
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  const pod = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.05), sensorMat);
  pod.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
  pod.rotation.y = -a;
  sensor.add(pod);
}
sensor.position.y = -0.86;
addPart('sensor', sensor, V(0, 0, 0), V(0, -1.3, 0), 0.12);

// Telemetry bay
const tele = new THREE.Group();
const teleMat = phys({ map: circuitTex, color: 0xffffff, metalness: 0.4, roughness: 0.5, emissive: 0xffffff, emissiveMap: circuitTex, emissiveIntensity: 0 });
const rimMat = phys({ color: 0x9aa3ad, metalness: 1, roughness: 0.35, roughnessMap: wearTex, emissive: 0x000000 });
tele.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.34, 32), teleMat));
[-0.17, 0.17].forEach((y) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.018, 8, 40), rimMat); t.rotation.x = Math.PI / 2; t.position.y = y; tele.add(t); });
const ant = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), rimMat);
ant.position.set(0.22, 0, 0.12); ant.rotation.y = 0.6;
tele.add(ant);
tele.position.y = -0.5;
addPart('telemetry', tele, V(0, 0, 0), V(0, -0.85, 0), 0.2);

// Power cell stack
const power = new THREE.Group();
const cellMat = phys({ color: 0xc8743a, metalness: 0.9, roughness: 0.3, emissive: 0xff7a2a, emissiveIntensity: 0 });
const capMat = phys({ color: 0x20252e, metalness: 0.6, roughness: 0.4, emissive: 0x000000 });
[[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3) * 0.19, Math.sin(i * Math.PI / 3) * 0.19])].forEach(([x, z]) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.36, 20), cellMat);
  c.position.set(x, 0, z);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.04, 20), capMat);
  cap.position.set(x, 0.19, z);
  power.add(c, cap);
});
power.position.y = -0.1;
addPart('power', power, V(0, 0, 0), V(0, -0.4, 0), 0.26);

// Sundown core
const core = new THREE.Group();
const coreMat = phys({ color: 0x1a0a06, metalness: 0.3, roughness: 0.15, clearcoat: 1, emissive: 0xff5a1f, emissiveIntensity: 0.2 });
core.add(new THREE.Mesh(new THREE.SphereGeometry(0.27, 48, 32), coreMat));
const coreWireMat = new THREE.LineBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
const coreWire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.34, 1)), coreWireMat);
core.add(coreWire);
[0, Math.PI / 2].forEach((r) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 48), rimMat); t.rotation.y = r; core.add(t); });
const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff6a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
coreGlow.scale.setScalar(1.6);
core.add(coreGlow);
core.position.y = 0.34;
addPart('core', core, V(0, 0, 0), V(0, 0.15, 0), 0.32);

// Shock cradle
const cradle = new THREE.Group();
const cradleMat = phys({ color: 0x8b95a3, metalness: 1, roughness: 0.45, roughnessMap: wearTex, emissive: 0x000000 });
[30, 150, 270].forEach((deg) => {
  const a = THREE.MathUtils.degToRad(deg);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.9, 8), cradleMat);
  rod.position.set(Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36);
  cradle.add(rod);
});
[-0.72, 0.76].forEach((y) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.016, 8, 48), cradleMat); t.rotation.x = Math.PI / 2; t.position.y = y; cradle.add(t); });
addPart('cradle', cradle, V(0, 0, 0), V(0, 0, -1.0), 0.36);

// Tail fin assembly
const TAIL_PTS = [[0.3, 1.12], [0.22, 1.35], [0.14, 1.55], [0.06, 1.68], [0.0, 1.7]];
const tail = new THREE.Group();
const tailMat = painted(paintB, { side: THREE.DoubleSide, color: 0xc8c8c0 });
tail.add(lathe(TAIL_PTS, tailMat, 48));
tail.add(wireOf(TAIL_PTS));
const finShape = new THREE.Shape();
finShape.moveTo(0.18, 1.05); finShape.lineTo(0.62, 1.44); finShape.lineTo(0.62, 1.82); finShape.lineTo(0.1, 1.82); finShape.lineTo(0.18, 1.05);
const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.03, bevelEnabled: false });
finGeo.translate(0, 0, -0.015);
for (let i = 0; i < 4; i++) {
  const f = new THREE.Mesh(finGeo, tailMat);
  f.rotation.y = i * Math.PI / 2 + Math.PI / 4;
  tail.add(f);
}
const boxRing = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.34, 48, 1, true), tailMat);
boxRing.position.y = 1.64;
tail.add(boxRing);
addPart('tail', tail, V(0, 1.45, 0), V(0, 1.0, 0), 0.04, { xray: true });

// Release lug (rides on the +X shell half)
const lug = new THREE.Group();
const lugMat = phys({ color: 0x8d9095, metalness: 1, roughness: 0.42, roughnessMap: wearTex, bumpMap: bumpTex, bumpScale: 0.6, emissive: 0x000000 });
const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 10, 24), lugMat);
loop.position.set(0.52, 0.12, 0);
const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.12), lugMat);
plate.position.set(0.455, 0.12, 0);
lug.add(loop, plate);
addPart('lug', lug, V(0.5, 0.12, 0), V(1.55, 0, 0), 0.1, { xray: true });

const xrayMats = [...shellMats, bandMat, nose.children[0].material, tailMat, lugMat];

// self-shadowing makes the teardown read as real hardware
spinG.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
drone.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

// Scan sweep ring
const sweepMat = new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const sweep = new THREE.Group();
const sweepRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.008, 6, 64), sweepMat);
sweepRing.rotation.x = Math.PI / 2;
const sweepDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
sweepDisc.rotation.x = Math.PI / 2;
sweep.add(sweepRing, sweepDisc);
spinG.add(sweep);

/* ---------- Speed streaks + passing clouds (layer 1: hidden from zoom view) ---------- */
const STREAKS = 160;
const stPos = new Float32Array(STREAKS * 6);
const stSeed = Array.from({ length: STREAKS }, () => [(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 14, -8 + Math.random() * 11, 0.5 + Math.random()]);
const stGeo = new THREE.BufferGeometry();
stGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
const stMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const streaks = new THREE.LineSegments(stGeo, stMat);
streaks.layers.set(1);
streaks.frustumCulled = false;
scene.add(streaks);

const PUFFS = 22;
const puffs = Array.from({ length: PUFFS }, (_, i) => {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  m.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, -6 + Math.random() * 10);
  m.scale.setScalar(3 + Math.random() * 5);
  m.userData.v = 0.6 + Math.random() * 0.8;
  m.layers.set(1);
  scene.add(m);
  return m;
});
const PUFF_OPACITY = [0.04, 0.75, 0.3, 0.5, 0.35, 0.12, 0.04, 0];
const PUFF_TINT = [0xc8d4ee, 0xffe2c4, 0xf4f6fa, 0xd6dee0, 0xdfe6dd, 0xffb890, 0x6c78a0, 0x6c78a0].map((c) => new THREE.Color(c));
const FOG_TINT = [0xdfe6f2, 0xffe6cc, 0xf2f5f8, 0xd8dfe0, 0xe0e7de, 0xffcfae, 0x8a94b8].map((c) => new THREE.Color(c));
camera.layers.enable(1);

/* ---------- Mushroom cloud ---------- */
const MN = 2200;
const mPos = new Float32Array(MN * 3), mCol = new Float32Array(MN * 3), mSize = new Float32Array(MN), mAlpha = new Float32Array(MN);
const mSeed = Array.from({ length: MN }, (_, i) => {
  const r = Math.random();
  return { type: r < 0.3 ? 0 : r < 0.78 ? 1 : 2, a: Math.random() * Math.PI * 2, b: Math.random(), c: Math.random() * Math.PI * 2, j: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], sz: 0.6 + Math.random() * 0.9, rot: Math.random() * 6.28 };
});
const mGeo = new THREE.BufferGeometry();
mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
mGeo.setAttribute('aColor', new THREE.BufferAttribute(mCol, 3));
mGeo.setAttribute('aSize', new THREE.BufferAttribute(mSize, 1));
mGeo.setAttribute('aAlpha', new THREE.BufferAttribute(mAlpha, 1));
mGeo.setAttribute('aRot', new THREE.BufferAttribute(Float32Array.from(mSeed, (p) => p.rot), 1));
const mMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 1 }, uSmoke: { value: smokeTex } },
  vertexShader: `
    uniform float uScale;
    attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aRot;
    varying vec3 vC; varying float vA; varying float vR;
    void main() {
      vC = aColor; vA = aAlpha; vR = aRot;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uScale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D uSmoke;
    varying vec3 vC; varying float vA; varying float vR;
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float cs = cos(vR), sn = sin(vR);
      p = mat2(cs, -sn, sn, cs) * p;
      vec4 t = texture2D(uSmoke, p + 0.5);
      float glow = max(0.0, vC.r - 0.8) * 4.0;           // white-hot parts bloom
      vec3 c = pow(vC, vec3(2.2)) * (0.55 + 0.6 * t.r) * (1.0 + glow);
      gl_FragColor = vec4(c, t.a * vA);
    }`,
  transparent: true, depthWrite: false,
});
const mushroom = new THREE.Points(mGeo, mMat);
mushroom.frustumCulled = false;
mushroom.visible = false;
const fireball = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
fireball.material.color.setRGB(3.2, 1.9, 0.8);
const ringTex = canvasTex(256, 256, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,0)');
  gr.addColorStop(0.9, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
const shockRing = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringTex, color: 0xffd8a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
shockRing.rotation.x = -Math.PI / 2;
shockRing.position.y = 0.05;
const mushRig = new THREE.Group();
mushRig.add(mushroom, fireball, shockRing);
shockRing.layers.set(1);
mushRig.layers.set(1);
mushroom.layers.set(1); fireball.layers.set(1);
scene.add(mushRig);

const HEAT = [[1, [1, 0.98, 0.9]], [0.75, [1, 0.82, 0.38]], [0.5, [1, 0.46, 0.13]], [0.25, [0.56, 0.21, 0.1]], [0, [0.33, 0.28, 0.27]]];
function heat(t, out) {
  t = clamp01(t);
  for (let i = 0; i < HEAT.length - 1; i++) {
    const [ta, ca] = HEAT[i], [tb, cb] = HEAT[i + 1];
    if (t <= ta && t >= tb) {
      const k = (t - tb) / (ta - tb);
      out[0] = lerp(cb[0], ca[0], k); out[1] = lerp(cb[1], ca[1], k); out[2] = lerp(cb[2], ca[2], k);
      return;
    }
  }
}
const tmpC = [0, 0, 0];
function updateMushroom(e, appear, time) {
  const H2 = lerp(0.3, 3.7, easeOut(e));
  const R = lerp(0.35, 1.9, easeOut(e));
  const hot = clamp01(1.25 - e * 1.5);
  for (let i = 0; i < MN; i++) {
    const p = mSeed[i];
    let x, y, z, T, size, alpha;
    if (p.type === 0) {               // stem, drifting upward
      const h = (p.b + time * 0.06) % 1;
      const rs = (0.16 + 0.3 * e) * (1 + 1.4 * Math.pow(1 - h, 3));
      const a = p.a + time * 0.35;
      x = Math.cos(a) * rs + p.j[0] * 0.12; z = Math.sin(a) * rs + p.j[2] * 0.12;
      y = h * (H2 - R * 0.2);
      T = hot * 0.9 + (1 - h) * 0.3 * hot + (e > 0.4 ? 0.14 * (1 - h) : 0);
      size = p.sz * (0.55 + e * 0.5); alpha = 0.75;
    } else if (p.type === 1) {        // rolling toroidal cap
      const Rm = R * 0.62, rm = R * 0.44;
      const v = p.c + time * 0.55;
      const rho = Rm + rm * Math.cos(v);
      x = Math.cos(p.a) * rho + p.j[0] * R * 0.18;
      z = Math.sin(p.a) * rho + p.j[2] * R * 0.18;
      y = H2 + rm * Math.sin(v) * 0.75 + p.j[1] * R * 0.15;
      const under = (1 - Math.sin(v)) * 0.5;
      T = hot + under * 0.28 - 0.08;
      size = p.sz * (0.5 + e * 1.0); alpha = 0.82;
    } else {                          // ground skirt
      const Rd = (0.3 + 5.6 * easeOut(e)) * (0.6 + p.b * 0.4);
      x = Math.cos(p.a) * Rd; z = Math.sin(p.a) * Rd * 0.6;
      y = p.j[1] * 0.25 * (0.3 + e) + 0.1;
      T = hot * 0.55;
      size = p.sz * (0.5 + e * 0.6); alpha = 0.6 * (1 - e * 0.45);
    }
    heat(T, tmpC);
    mPos[i * 3] = x; mPos[i * 3 + 1] = y; mPos[i * 3 + 2] = z;
    mCol[i * 3] = tmpC[0]; mCol[i * 3 + 1] = tmpC[1]; mCol[i * 3 + 2] = tmpC[2];
    mSize[i] = size; mAlpha[i] = alpha * appear;
  }
  mGeo.attributes.position.needsUpdate = true;
  mGeo.attributes.aColor.needsUpdate = true;
  mGeo.attributes.aSize.needsUpdate = true;
  mGeo.attributes.aAlpha.needsUpdate = true;
  fireball.position.set(0, lerp(0.2, H2 * 0.5, e), 0);
  fireball.scale.setScalar(lerp(4, 7, e));
  fireball.material.opacity = appear * (Math.pow(1 - e, 2.5) * 0.95 + 0.04);
}

/* =========================================================
   DOM: timeline, log, tags, dossier, parts index
   ========================================================= */
const tlList = $('tlList');
BEATS.forEach((b, i) => {
  if (!b) return;
  const li = document.createElement('li');
  li.tabIndex = 0;
  li.innerHTML = `${String(b.n).padStart(2, '0')}<b></b>`;
  const go = () => scrollToBeat(i + 0.05);
  li.addEventListener('click', go);
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  tlList.appendChild(li);
});
const tlItems = [...tlList.children];

// leader length (px) per label, + above the part, − below; alternating so neighbours never collide
const TAG_ROW = { tail: 78, cradle: -78, core: 124, power: -124, telemetry: 78, sensor: -78, nose: 124, shell: 56, lug: 44 };
const tagsEl = $('tags');
const tags = {};
const partsNav = $('parts');
partsNav.innerHTML = '<div class="hint" data-i18n="partsHint"></div>';
PART_ORDER.forEach((k) => {
  const p = parts[k];
  const n = String(p.idx).padStart(2, '0');
  const t = document.createElement('div');
  t.className = `tag ${TAG_ROW[k] > 0 ? 'up' : 'down'}`;
  t.style.setProperty('--len', `${Math.abs(TAG_ROW[k])}px`);
  t.innerHTML = `<span><em>${n}</em>${CODES[k]}</span>`;
  t.addEventListener('pointerenter', () => setHover(k));
  t.addEventListener('pointerleave', () => setHover(null));
  t.addEventListener('click', () => togglePin(k));
  tagsEl.appendChild(t);
  tags[k] = t;

  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = n;
  b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setHover(k); });
  b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setHover(null); });
  b.addEventListener('focus', () => setHover(k));
  b.addEventListener('blur', () => setHover(null));
  b.addEventListener('click', () => togglePin(k));
  b.dataset.key = k;
  partsNav.appendChild(b);
});
const partButtons = [...partsNav.querySelectorAll('button')];

const dossier = $('dossier');
const dZoom = $('dZoom');
let shownPart = null;
function showDossier(k) {
  if (k === shownPart) return;
  shownPart = k;
  dossier.classList.toggle('on', !!k);
  $('log').classList.toggle('hide-mobile', !!k);
  partButtons.forEach((b) => b.classList.toggle('active', b.dataset.key === k));
  Object.entries(tags).forEach(([kk, t]) => t.classList.toggle('active', kk === k));
  if (!k) return;
  const inf = info(k);
  $('dIdx').textContent = `${String(parts[k].idx).padStart(2, '0')} / 09`;
  $('dCode').textContent = inf.code;
  $('dName').textContent = inf.name;
  $('dText').textContent = inf.text;
  $('dStats').innerHTML = inf.stats.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}

let hoverPart = null, pinnedPart = null;
function setHover(k) { hoverPart = k; }
function togglePin(k) { pinnedPart = pinnedPart === k ? null : k; }

// Chapter card: lines rise in one after another each time the chapter changes
const log = $('log'), logStamp = $('logStamp'), logTitle = $('logTitle'), logText = $('logText');
let shownBeat = -1;
function showBeat(i) {
  if (i === shownBeat) return;
  shownBeat = i;
  const b = BEATS[i];
  document.body.classList.toggle('hero-on', i === 0);
  log.classList.toggle('hide', !b);
  tlItems.forEach((li, n) => { li.classList.toggle('now', n === i - 1); li.classList.toggle('past', n < i - 1); });
  const c = b && chapter(b);
  buildMega(c ? c.mega : '');
  if (!b) return;
  logStamp.textContent = c.name;
  logTitle.textContent = c.title;
  let k = 0;
  const line = (html) => `<span class="ln" style="--d:${(0.12 + 0.09 * k++).toFixed(2)}s">${html}</span>`;
  logText.innerHTML =
    c.body.slice(0, c.list ? 1 : 99).map((t) => `<p>${line(t)}</p>`).join('') +
    (c.list ? `<ul class="caps">${c.list.map((t) => `<li>${line(t)}</li>`).join('')}</ul>` : '') +
    (c.list ? c.body.slice(1).map((t) => `<p>${line(t)}</p>`).join('') : '') +
    (c.cta ? `<a class="btn btn-sm log-cta" href="${b.href}">${line(c.cta + ' →')}</a>` : '');
  log.classList.remove('in');
  void log.offsetWidth;
  log.classList.add('in');
}
// swap every piece of copy to the chosen language, in place
const words = (chunks) => chunks.map((w) => (w === '|' ? '<br>' : `<span><i>${w}</i></span>`)).join(' ');
function applyLang(code) {
  lang = code;
  const t = T();
  document.documentElement.lang = LANGS[code].html;
  document.title = t.title;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t[el.dataset.i18n]; });
  $('heroTitle').innerHTML = words(t.hero);
  $('finaleTitle').innerHTML = words(t.finale);
  BEATS.filter(Boolean).forEach((b, i) => { tlItems[i].querySelector('b').textContent = chapter(b).name; });
  partButtons.forEach((btn) => {
    const inf = info(btn.dataset.key);
    btn.title = inf.name;
    btn.setAttribute('aria-label', `${inf.name}, ${inf.code}`);
  });
  document.querySelectorAll('.lang button').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.lang === code)));
  const beat = shownBeat; shownBeat = -1; if (beat >= 0) showBeat(beat);
  const part = shownPart; shownPart = undefined; showDossier(part);
  try { localStorage.setItem('sw-lang', code); } catch (e) { /* storage blocked */ }
}
document.querySelectorAll('.lang button').forEach((btn) => btn.addEventListener('click', () => applyLang(btn.dataset.lang)));
applyLang(lang);

// write text only when it changes
const setText = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };

// Kinetic scene titles
const mega = $('mega');
let megaLetters = [];
function buildMega(word) {
  mega.innerHTML = '';
  mega.style.fontSize = `min(${Math.min(17, 150 / Math.max(word.length, 1)).toFixed(2)}vw, 300px)`;
  megaLetters = [...word].map((ch, i) => {
    const sp = document.createElement('span');
    sp.textContent = ch === ' ' ? ' ' : ch;
    mega.appendChild(sp);
    return { el: sp, i, rx: (Math.random() - 0.5) * 900, ry: (Math.random() - 0.5) * 600, rr: (Math.random() - 0.5) * 180 };
  });
}
function updateMega(t) {
  const n = megaLetters.length;
  megaLetters.forEach(({ el, i, rx, ry, rr }) => {
    const d = (i / Math.max(n, 1)) * 0.12;
    const a = easeOut(range(t, 0.02 + d, 0.3 + d));
    const b = easeIn(range(t, 0.74 + d, 0.96 + d * 0.5));
    const k = 1 - a;
    el.style.transform = `translate3d(${(k * rx).toFixed(1)}px, ${(k * ry - b * 260).toFixed(1)}px, 0) rotate(${(k * rr).toFixed(1)}deg) scale(${(1 + k * 1.8 + b * 0.4).toFixed(3)})`;
    el.style.opacity = (a * (1 - b)).toFixed(3);
  });
}

/* =========================================================
   Scroll → story clock
   ========================================================= */
const sections = [...document.querySelectorAll('.track section')];
// section geometry is cached: reading offsetTop every frame forces a layout after each DOM write
let secTops = [], secHs = [], scrollMax = 1;
function measureSections() {
  secTops = sections.map((el) => el.offsetTop);
  secHs = sections.map((el) => el.offsetHeight);
  scrollMax = document.documentElement.scrollHeight - window.innerHeight;
}
function readScroll() {
  const y = window.scrollY;
  const max = scrollMax;
  for (let i = 0; i < sections.length; i++) {
    const top = secTops[i];
    const last = i === sections.length - 1;
    const h = last ? Math.max(1, max - top) : secHs[i];
    if (y < top + h || last) return THREE.MathUtils.clamp(i + (y - top) / h, 0, sections.length);
  }
  return 0;
}
// inertial wheel/trackpad scrolling; touch keeps the native feel
const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
function scrollToBeat(sv) {
  const i = Math.min(Math.floor(sv), sections.length - 1);
  const top = secTops[i] + (sv - i) * secHs[i];
  if (lenis) lenis.scrollTo(top, { duration: 2.2 });
  else window.scrollTo({ top, behavior: 'smooth' });
}
$('replay').addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 4 }) : window.scrollTo({ top: 0, behavior: 'smooth' })));

/* =========================================================
   Pointer + picking
   ========================================================= */
const mouse = { x: 0, y: 0, px: -1, py: -1, isMouse: true };
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  mouse.isMouse = e.pointerType === 'mouse';
  const onCanvas = e.target === canvas;
  mouse.px = onCanvas && mouse.isMouse ? e.clientX : -1;
  mouse.py = e.clientY;
  mouse.dirty = true;
});
let lastHit = null;   // keeps a hover alive while the part drifts a little under the cursor
let canvasHover = null;
let pickEnabled = false;
let scanAmt = 0;
function pick(x, y) {
  if (!pickEnabled) return null;
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, false).filter((h) => h.object.visible);
  if (!hits.length) return null;
  if (scanAmt > 0.5) {
    const inner = hits.find((h) => !parts[h.object.userData.part].xray);
    if (inner) return inner.object.userData.part;
  }
  return hits[0].object.userData.part;
}
canvas.addEventListener('click', (e) => {
  const k = pick(e.clientX, e.clientY);
  pinnedPart = k && k !== pinnedPart ? k : null;
});

/* =========================================================
   Layout-dependent values
   ========================================================= */
const HORIZON = 0.3;    // desert horizon, as a fraction of screen height from the bottom
const DESERT_SHIFT = 0.56;  // pushes the footage down so its horizon (86% up the frame) lands there
let baseZ = 9;
let gz = new THREE.Vector3();
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w * pixelRatio / 2, h * pixelRatio / 2);
  bgUniforms.viewAspect.value = w / h;
  lens.uniforms.aspect.value = w / h;
  camera.aspect = w / h;
  baseZ = isMobile() ? 13 : 9;
  camera.updateProjectionMatrix();
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (baseZ + 7);
  gz.set(0, (2 * HORIZON - 1) * half, -7);   // sits on the desert horizon in the wide shot
  mushRig.position.copy(gz);
  mMat.uniforms.uScale.value = (h * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  measureSections();
}
window.addEventListener('resize', layout);
window.addEventListener('load', measureSections);
layout();

// hold ~60 fps: trim render resolution (never below native CSS pixels) when frames run long, add it back with headroom
let ftAvg = 16.7, ftCount = 0;
function adaptQuality(ms) {
  if (ms > 100) return;                      // tab was hidden
  ftAvg = ftAvg * 0.94 + ms * 0.06;
  if (++ftCount < 50) return;
  let next = pixelRatio;
  if (ftAvg > 19 && pixelRatio > PR_MIN) next = Math.max(PR_MIN, pixelRatio - 0.125);
  else if (ftAvg < 12.5 && pixelRatio < PR_MAX) next = Math.min(PR_MAX, pixelRatio + 0.1);
  if (next === pixelRatio) return;
  pixelRatio = next;
  ftCount = 0;
  renderer.setPixelRatio(pixelRatio);
  composer.setPixelRatio(pixelRatio);
  layout();
}

/* =========================================================
   Render loop
   ========================================================= */
const clock = new THREE.Clock();
let s = 0;
let spin = 0;
let focusAmt = 0;
const focusPos = new THREE.Vector3();
const camLook = new THREE.Vector3(0, 0, 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const carry = new THREE.Vector3();
const tint = new THREE.Color();
let shakeT = 0;

const hud = { alt: $('hAlt'), vel: $('hVel'), t: $('hT'), scan: $('hScan'), bar: $('hAltBar') };
const tlFill = $('tlFill'), flash = $('flash'), outro = $('outro'), cue = $('cue');
const reticle = $('reticle'), reticleZoom = $('reticleZoom');

// which footage is on screen, how far we've dived into it, and the cloud punch between clips
function clipLook(i, sv, terminal) {
  const t = THREE.MathUtils.clamp(sv - i, -0.1, 1.1);
  let zoom = 1.06 + t * 0.2;
  let shift = 0;
  if (i === 6) {
    if (sv >= IMPACT) { zoom = 1.0 + range(sv, IMPACT, 8) * 0.05; shift = DESERT_SHIFT; }   // wide shot, cut under the flash
    else zoom += terminal * 1.4;                                                              // ground rushing up
  }
  const margin = 0.5 * (1 - 1 / zoom);
  return { zoom, drift: shift ? 0 : -margin * 0.85 * clamp01(t), shift };
}
function updateBackground(sv, time, boomGlow, terminal, now) {
  const b = Math.round(sv);
  let A, B, m = 0;
  if (b >= 1 && b <= 6 && Math.abs(sv - b) < 0.06) { A = b - 1; B = b; m = range(sv, b - 0.06, b + 0.06); }
  else { A = THREE.MathUtils.clamp(Math.floor(sv), 0, 6); B = A; }
  const la = clipLook(A, sv, terminal), lb = clipLook(B, sv, terminal);
  const u = bgUniforms;
  u.texA.value = clipTex(clips[A]); u.texB.value = clipTex(clips[B]); u.mixAB.value = m;
  u.zoomA.value = la.zoom; u.driftA.value = la.drift; u.shiftA.value = la.shift;
  u.zoomB.value = lb.zoom; u.driftB.value = lb.drift; u.shiftB.value = lb.shift;
  u.time.value = time;
  u.boom.value = boomGlow;
  u.focusBlur.value = focusAmt;
  u.speedBlur.value = sv < IMPACT ? terminal : 0;

  let w = 0, wd = 0;
  for (let k = 1; k <= 6; k++) { const d = sv - k; if (Math.abs(d) < 0.16) { w = 1 - Math.abs(d) / 0.16; wd = d; } }
  u.wipe.value = w * w * (3 - 2 * w);
  u.wipeY.value = wd / 0.16;
  u.fogTint.value.copy(FOG_TINT[Math.min(6, Math.max(0, Math.round(sv)))]);

  // playback speeds up with the fall; footage freezes nearly still while you inspect a part
  manageClips(sv, lerp(0.85 + range(sv, 5, IMPACT) * 0.6, 0.25, focusAmt));
  updateEnv(m > 0.5 ? B : A);
}

function dronePose(sv, out) {
  // fly in, hold for release, then climb away banking
  const a = easeOut(range(sv, 0, 0.5));
  const b = easeIn(range(sv, 0.58, 1.3));
  out.pos.set(lerp(-10, -0.2, a) + b * 11, lerp(1.6, 1.0, a) + b * 4.5, lerp(-2, 0, a) - b * 3);
  out.rot.set(lerp(0.7, 0.42, a) + b * 0.5, lerp(-0.5, -0.2, a) + b * 0.3, b * 0.5);
}
const dp = { pos: new THREE.Vector3(), rot: new THREE.Euler() };

function tick() {
  if (!ready) { if (envMaps.includes(null)) bakeNextEnv(); requestAnimationFrame(tick); return; }
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  adaptQuality(rawDt * 1000);
  if (lenis) lenis.raf(performance.now());
  const time = clock.elapsedTime;
  const now = performance.now() / 1000;

  s = damp(s, readScroll(), reduced ? 20 : lenis ? 9 : 5, dt);
  const sv = s;
  const mobile = isMobile();
  const beat = Math.min(7, Math.floor(sv));
  showBeat(beat);
  updateMega(sv - beat);

  // ---- story curves ----
  const released = range(sv, RELEASE, RELEASE + 0.01) > 0;
  const fallT = clamp01((sv - RELEASE) / (IMPACT - RELEASE));
  const scan = range(sv, 1.6, 2.0) * (1 - range(sv, 5.6, 6.0));
  const ex = easeIO(range(sv, 2.35, 3.5)) * (1 - easeIO(range(sv, 5.15, 5.8)));
  const tiltTarget = mobile ? 0 : easeIO(range(sv, 2.05, 2.8)) * (1 - easeIO(range(sv, 5.3, 5.95)));
  const coreBoost = range(sv, 3.9, 4.3) * (1 - range(sv, 4.9, 5.3));
  const terminal = easeIn(range(sv, 6.35, IMPACT));
  const after = sv >= IMPACT;
  const e = easeOut(range(sv, IMPACT, 7.85));
  scanAmt = scan;

  // ---- drone ----
  dronePose(sv, dp);
  droneRig.position.copy(dp.pos);
  droneRig.rotation.copy(dp.rot);
  droneRig.visible = sv < 1.4;
  prop.rotation.x += dt * 45;
  navLight.material.opacity = 0.4 + 0.6 * (Math.sin(time * 9) > 0.6 ? 1 : 0);

  // ---- payload ----
  if (!released) {
    droneRig.updateMatrixWorld(true);
    carry.set(0.05, -0.48, 0).applyMatrix4(drone.matrixWorld);
    bombRig.position.copy(carry);
    bombRig.scale.setScalar(0.4);
    bombRig.rotation.copy(droneRig.rotation);
    tiltG.rotation.z = Math.PI / 2;
  } else {
    // from the pylon to center frame, nose swinging down
    const k = easeIO(range(sv, RELEASE, 1.25));
    dronePose(RELEASE, dp);
    tmpV.set(0.05 - 0.2, 1.0 - 0.48, 0);
    const fall = Math.sin(k * Math.PI) * 0.7;
    bombRig.position.set(lerp(tmpV.x, 0, k), lerp(tmpV.y, 0, k) - fall, lerp(0, 0, k));
    // terminal plunge toward ground zero
    if (terminal > 0) bombRig.position.lerp(tmpV2.set(gz.x, gz.y + 0.2, gz.z), terminal);
    bombRig.scale.setScalar(lerp(0.4, 0.8, easeOut(k)) * (mobile ? 0.95 : 1));
    const swing = lerp(Math.PI / 2, 0, k) + Math.sin(k * Math.PI) * 0.35;
    const settle = k < 1 ? swing : 0;
    tiltG.rotation.z = settle + tiltTarget * (Math.PI / 2);
    const calm = 1 - focusAmt * 0.85;
    bombRig.rotation.set(
      Math.sin(time * 1.3) * 0.05 * calm * (1 - ex),
      0,
      Math.sin(time * 1.7) * 0.04 * calm * (1 - ex),
    );
  }
  bombRig.visible = !after;

  // spin around own axis while falling; square up for the teardown
  if (released && ex < 0.02 && tiltTarget < 0.02) spin += dt * (1.2 + fallT * 4);
  else spin = damp(spin, Math.round(spin / (Math.PI * 2)) * Math.PI * 2, 4, dt);
  spinG.rotation.y = spin;

  // teardown with staggered delays and a little flourish in transit
  const mobX = mobile ? 0.62 : 1;
  Object.values(parts).forEach((p) => {
    const k = easeIO(clamp01((ex - p.delay) / (1 - 0.36)));
    const o = p.offset;
    if (p.key === 'shell') {
      halves[0].position.x = k * 1.05 * mobX;
      halves[1].position.x = -k * 1.05 * mobX;
      halves[0].rotation.y = -k * 0.35; halves[1].rotation.y = k * 0.35;
    } else {
      p.group.position.set(o.x * k * mobX, (p.base ?? (p.base = p.group.position.y)) + o.y * k, o.z * k);
      p.group.rotation.x = Math.sin(k * Math.PI) * 0.6;
      p.group.rotation.z = Math.sin(k * Math.PI) * 0.35;
    }
  });
  core.children[1].rotation.y += dt * 0.6;
  core.children[1].rotation.x += dt * 0.25;

  // x-ray look
  const focusKey = pickEnabled ? (canvasHover || hoverPart || pinnedPart) : null;
  xrayMats.forEach((m) => {
    m.opacity = 1 - scan * 0.7;
    m.depthWrite = scan < 0.3;
  });
  if (focusKey && parts[focusKey].xray) parts[focusKey].mats.forEach((m) => { m.opacity = Math.max(m.opacity, 0.92); });
  wireMat.opacity = scan * 0.35;
  sensorMat.emissiveIntensity = scan * 1.2;
  teleMat.emissiveIntensity = scan * 0.9;
  cellMat.emissiveIntensity = scan * 0.25;
  const corePulse = 0.5 + 0.5 * Math.sin(time * 3.2);
  coreMat.emissiveIntensity = 0.15 + scan * 0.6 + coreBoost * (1.4 + corePulse);
  coreGlow.material.opacity = scan * 0.35 + coreBoost * (0.6 + corePulse * 0.4);
  coreGlow.scale.setScalar(1.3 + coreBoost * 1.2);
  coreWireMat.opacity = 0.2 + scan * 0.5;

  // focus highlight (amber pulse)
  Object.values(parts).forEach((p) => {
    const on = p.key === focusKey;
    p.mats.forEach((m) => {
      if (m === coreMat || m === sensorMat || m === teleMat || m === cellMat) {
        if (on) m.emissiveIntensity += 0.4 + 0.3 * Math.sin(time * 8);
        return;
      }
      if (on) { m.emissive.setHex(0xff9a2e); m.emissiveIntensity = 0.25 + 0.2 * Math.sin(time * 8); }
      else { m.emissive.copy(m.userData.baseEmissive); }
    });
  });

  // sweep ring while scan powers up and during the teardown
  const sweepOn = scan * (1 - ex * 0.6);
  sweep.position.y = -1.8 + ((time * 0.9) % 1) * 3.6;
  sweepMat.opacity = sweepOn * 0.9;
  sweepDisc.material.opacity = sweepOn * 0.12;
  sweep.visible = sweepOn > 0.01;

  // ---- picking ----
  pickEnabled = sv > 1.1 && sv < IMPACT - 0.35;
  if (mouse.px < 0) { canvasHover = null; lastHit = null; }
  else if (mouse.dirty) {
    mouse.dirty = false;
    const k = pick(mouse.px, mouse.py);
    if (k) { canvasHover = k; lastHit = [mouse.px, mouse.py]; }
    else if (!lastHit || Math.hypot(mouse.px - lastHit[0], mouse.py - lastHit[1]) > 60) { canvasHover = null; lastHit = null; }
  }
  if (!pickEnabled) { canvasHover = null; if (pinnedPart) pinnedPart = null; }
  canvas.classList.toggle('hovering', !!canvasHover);
  showDossier(focusKey);
  document.body.classList.toggle('focusing', !!focusKey);
  partsNav.classList.toggle('on', sv > 2.6 && sv < 5.4);
  setText(hud.scan, focusKey ? `FOCUS · ${CODES[focusKey]}` : scan > 0.5 ? 'SCAN · LIVE' : 'SCAN · OFF');
  hud.scan.classList.toggle('on', !focusKey && scan > 0.5);
  hud.scan.classList.toggle('lock', !!focusKey);

  // ---- camera ----
  focusAmt = damp(focusAmt, focusKey ? 1 : 0, 4, dt);
  const autoCore = focusKey ? 0 : coreBoost * 0.45;
  if (focusKey) {
    const p = parts[focusKey];
    p.group.updateMatrixWorld(true);
    tmpV.copy(p.center);
    p.group.localToWorld(tmpV);
    focusPos.x = damp(focusPos.x, tmpV.x, 8, dt);
    focusPos.y = damp(focusPos.y, tmpV.y, 8, dt);
    focusPos.z = damp(focusPos.z, tmpV.z, 8, dt);
  } else if (autoCore > 0.001) {
    core.updateMatrixWorld(true);
    core.getWorldPosition(tmpV);
    focusPos.lerp(tmpV, 0.1);
  }
  const fw = easeIO(Math.max(focusAmt, autoCore));
  const fDist = mobile ? 5 : 3.2;
  const startLook = 0.45 * (1 - range(sv, 0.4, 1.2));
  const hold = (1 - fw) * (1 - ex);
  tmpV.set(mouse.x * 0.35 * hold, startLook + 0.1 - mouse.y * 0.2 * hold, baseZ);
  camLook.set(0, startLook, 0);
  // dolly along the line of sight: the focused part grows in place, right under the cursor
  tmpV2.subVectors(focusPos, tmpV);
  const dl = tmpV2.length();
  tmpV2.multiplyScalar(dl > fDist ? (1 - fDist / dl) * fw : 0);
  camera.position.copy(tmpV).add(tmpV2);
  camLook.add(tmpV2);

  // shake: buffeting grows with speed, impact is violent
  const speedShake = reduced ? 0 : 0.006 + fallT * 0.02 + terminal * 0.09;
  const impactShake = reduced ? 0 : (after ? Math.exp(-(sv - IMPACT) * 7) * 0.35 : 0);
  const sh = (speedShake * (1 - focusAmt) * (1 - ex) + impactShake);
  shakeT += dt * 60;
  const sx = (Math.sin(shakeT * 1.7) + Math.sin(shakeT * 2.9)) * sh;
  const sy = (Math.cos(shakeT * 2.3) + Math.sin(shakeT * 3.7)) * sh;
  camera.position.x += sx; camera.position.y += sy;
  camera.lookAt(camLook);
  bgUniforms.shake.value.set(sx * 0.012, sy * 0.012);

  // ---- lights follow the scenery ----
  const sc = Math.min(sv, 7);
  const i0 = Math.floor(sc), i1 = Math.min(i0 + 1, 7), kk = range(sc - i0, 0.85, 1);
  key.color.copy(TINT[i0]).lerp(TINT[i1], kk);
  hemi.color.copy(HEMI_SKY[i0]).lerp(HEMI_SKY[i1], kk);

  // ---- streaks + passing clouds ----
  const speed = released ? 0.4 + fallT * 1.6 + terminal * 5 : 0.6;
  const dirX = released ? lerp(-1, 0, range(sv, RELEASE, 1.0)) : -1;
  const dirY = released ? lerp(0, 1, range(sv, RELEASE, 1.0)) : 0;
  const len = 0.4 + speed * 0.9;
  for (let i = 0; i < STREAKS; i++) {
    const q = stSeed[i];
    q[0] += dirX * dt * speed * 9 * q[3];
    q[1] += dirY * dt * speed * 9 * q[3];
    if (q[1] > 8) q[1] -= 16;
    if (q[0] < -10) q[0] += 20;
    stPos[i * 6] = q[0]; stPos[i * 6 + 1] = q[1]; stPos[i * 6 + 2] = q[2];
    stPos[i * 6 + 3] = q[0] - dirX * len * q[3]; stPos[i * 6 + 4] = q[1] - dirY * len * q[3]; stPos[i * 6 + 5] = q[2];
  }
  stGeo.attributes.position.needsUpdate = true;
  stMat.opacity = after ? 0 : terminal * 0.14 * (1 - focusAmt * 0.8);

  const pi = Math.min(Math.floor(sv), 7);
  const pk = range(sv - pi, 0.85, 1);
  const pOp = lerp(PUFF_OPACITY[pi], PUFF_OPACITY[Math.min(pi + 1, 7)], pk) * (1 - focusAmt * 0.7);
  tint.copy(PUFF_TINT[pi]).lerp(PUFF_TINT[Math.min(pi + 1, 7)], pk);
  puffs.forEach((m) => {
    m.position.x += dirX * dt * speed * 3 * m.userData.v;
    m.position.y += dirY * dt * speed * 3 * m.userData.v;
    if (m.position.y > 9) { m.position.y = -9; m.position.x = (Math.random() - 0.5) * 16; }
    if (m.position.x < -11) { m.position.x = 11; m.position.y = (Math.random() - 0.5) * 12; }
    m.material.opacity = after ? 0 : pOp * (m.position.z > 1 ? 0.55 : 1);
    m.material.color.copy(tint);
  });

  // ---- impact ----
  const flashO = after ? 1 - easeOut(range(sv, IMPACT + 0.06, IMPACT + 0.4)) : 0;
  flash.style.opacity = flashO.toFixed(3);
  const ringK = range(sv, IMPACT + 0.02, IMPACT + 0.7);
  shockRing.scale.setScalar(0.2 + easeOut(ringK) * 9);
  shockRing.material.opacity = ringK > 0 && ringK < 1 ? (1 - ringK) * 0.7 : 0;
  mushroom.visible = after;
  if (after) updateMushroom(e, range(sv, IMPACT, IMPACT + 0.05), time);
  else fireball.material.opacity = 0;
  const boomGlow = after ? lerp(1.1, 0.12, e) : 0;
  updateBackground(sv, time, boomGlow, terminal, now);
  outro.classList.toggle('on', sv > 7.45);
  document.body.classList.toggle('outro-on', sv > 7.3);

  // ---- HUD ----
  const T = released ? fallT * FALL_SECONDS : -20 * (1 - sv / RELEASE);
  const tt = Math.abs(T);
  setText(hud.t, `${T < 0 ? '−' : '+'}${String(Math.floor(tt / 60)).padStart(2, '0')}:${(tt % 60).toFixed(1).padStart(4, '0')}`);
  const alt = 18000 * (1 - Math.pow(fallT, 1.25));
  setText(hud.alt, String(Math.round(alt / 10) * 10).replace(/\B(?=(\d{3})+(?!\d))/g, ' '));
  const vel = released ? 295 * (1 - Math.exp(-(fallT * FALL_SECONDS) / 11)) + Math.sin(time * 7) * 2 : 0;
  setText(hud.vel, String(Math.max(0, Math.round(vel))).padStart(3, '0'));
  hud.bar.style.top = `${(1 - alt / 18000) * 100}%`;
  tlFill.style.height = `${(clamp01((sv - 1) / 6)) * 100}%`;
  cue.classList.toggle('gone', sv > 0.08);

  // ---- tags + reticle ----
  const tagOn = ex > 0.55 && !after;
  PART_ORDER.forEach((k) => {
    const p = parts[k];
    const t = tags[k];
    if (!tagOn) { t.style.opacity = 0; t.style.pointerEvents = 'none'; return; }
    p.group.updateMatrixWorld(true);
    tmpV.copy(p.center);
    if (k === 'shell') tmpV.set(0.44, 0.2, 0).applyMatrix4(halves[0].matrixWorld);
    else p.group.localToWorld(tmpV);
    tmpV.project(camera);
    // eased and snapped to whole pixels so nothing shimmers
    const x = (tmpV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
    t._x = t._x === undefined || t.style.opacity === '0' ? x : damp(t._x, x, 14, dt);
    t._y = t._y === undefined || t.style.opacity === '0' ? y : damp(t._y, y, 14, dt);
    const px = Math.round(t._x), py = Math.round(t._y);
    if (px !== t._px || py !== t._py) { t._px = px; t._py = py; t.style.transform = `translate3d(${px}px, ${py}px, 0)`; }
    t.style.opacity = (range(ex, 0.55, 0.85) * (1 - focusAmt * 0.6)).toFixed(3);
    t.style.pointerEvents = 'auto';
  });
  if (focusKey) {
    tmpV.copy(focusPos).project(camera);
    reticle.style.left = `${((tmpV.x * 0.5 + 0.5) * window.innerWidth).toFixed(1)}px`;
    reticle.style.top = `${((-tmpV.y * 0.5 + 0.5) * window.innerHeight).toFixed(1)}px`;
    reticleZoom.textContent = `×${(dl / Math.max(0.1, dl - tmpV2.length())).toFixed(1)}`;
    dossier.classList.toggle('left', tmpV.x > 0.12);
  }
  reticle.classList.toggle('on', !!focusKey && focusAmt > 0.5);

  // ---- render ----
  lens.uniforms.time.value = time;
  lens.uniforms.ca.value = 0.0015 + terminal * 0.012 + (after ? Math.exp(-(sv - IMPACT) * 6) * 0.03 : 0);
  key.target.position.copy(bombRig.position);
  key.position.copy(bombRig.position).add(tmpV.set(5, 6, 6));
  halves.forEach((h) => { h.children[0].castShadow = scan < 0.3; });
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  composer.render();

  // live zoom window inside the dossier
  if (focusKey && !mobile && dossier.classList.contains('on')) {
    const r = dZoom.getBoundingClientRect();
    if (r.width > 10) {
      const p = parts[focusKey];
      tmpV.copy(p.center);
      if (focusKey === 'shell') tmpV.set(0.3, 0.3, 0).applyMatrix4(halves[0].matrixWorld);
      else p.group.localToWorld(tmpV);
      const a = time * 0.6;
      const zd = focusKey === 'shell' || focusKey === 'cradle' ? 3.2 : focusKey === 'tail' ? 2.4 : 1.4;
      zoomCam.position.set(tmpV.x + Math.sin(a) * zd, tmpV.y + 0.35 * zd, tmpV.z + Math.cos(a) * zd);
      zoomCam.lookAt(tmpV);
      zoomCam.aspect = r.width / r.height;
      zoomCam.updateProjectionMatrix();
      const y = window.innerHeight - r.bottom;
      renderer.setRenderTarget(null);
      renderer.setScissorTest(true);
      renderer.setScissor(r.left, y, r.width, r.height);
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setClearColor(0x050b16, 1);
      renderer.clear();
      renderer.render(scene, zoomCam);
      renderer.setScissorTest(false);
    }
  }

  requestAnimationFrame(tick);
}

// Warm-up behind the boot screen: bake the first footage lighting, then compile every shader
// without blocking the main thread (KHR_parallel_shader_compile), so the boot animation never freezes
// and the first impact / first hover never hitch.
let ready = false;
// a frame, or 50 ms if frames are paused (background tab), so warm-up never stalls on rAF
const nextFrame = () => new Promise((r) => { requestAnimationFrame(r); setTimeout(r, 50); });
async function warmUp() {
  const t0 = performance.now();
  while (!(clips[0].poster.image && clips[0].poster.image.complete) && performance.now() - t0 < 4000) await nextFrame();
  bakeNextEnv();
  if (envMaps[0]) scene.environment = envMaps[0];
  await nextFrame();
  mushroom.visible = true;
  try {
    await renderer.compileAsync(scene, camera);
    await renderer.compileAsync(bgScene, bgCam);
  } catch (e) { /* fall back to compiling on first render */ }
  mushroom.visible = false;
  ready = true;
  await nextFrame();
  await nextFrame();
  window.__swReady = true;
  window.dispatchEvent(new Event('sw-ready'));
}
warmUp();
tick();
