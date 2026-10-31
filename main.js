import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =========================================================
   Scene setup
   ========================================================= */
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.6, 9);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x0b1730, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 6, 5);
scene.add(key);
const rim = new THREE.PointLight(0xe0313b, 18, 20);
rim.position.set(-4, 1, -3);
scene.add(rim);

/* =========================================================
   Procedural EG-50 airframe (1 unit = 1 m, nose along +X)
   Proportions from the brochure: 3.3 m long, 2.8 m span.
   ========================================================= */
const mat = {
  body: new THREE.MeshPhysicalMaterial({ color: 0xc8cfd8, metalness: 0.55, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  wing: new THREE.MeshPhysicalMaterial({ color: 0xd9dee5, metalness: 0.3, roughness: 0.45, clearcoat: 0.3 }),
  nose: new THREE.MeshPhysicalMaterial({ color: 0xd2343d, metalness: 0.2, roughness: 0.25, clearcoat: 1 }),
  fin: new THREE.MeshPhysicalMaterial({ color: 0x46526a, metalness: 0.4, roughness: 0.5 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1a2232, metalness: 0.7, roughness: 0.4 }),
};

const droneRoot = new THREE.Group();   // animated by scroll
const drone = new THREE.Group();       // the aircraft itself
droneRoot.add(drone);
scene.add(droneRoot);

// Fuselage: lathe profile along Y, rotated so +Y becomes +X
function lathe(points, material, segments = 64) {
  const geo = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  const m = new THREE.Mesh(geo, material);
  m.rotation.z = -Math.PI / 2;
  return m;
}
const fuselage = lathe([[0.0, -1.62], [0.11, -1.6], [0.16, -1.45], [0.18, -1.2], [0.18, 0.95], [0.178, 1.0]], mat.body);
const nose = lathe([[0.178, 1.0], [0.175, 1.15], [0.16, 1.35], [0.12, 1.52], [0.06, 1.62], [0.0, 1.66]], mat.nose);
drone.add(fuselage, nose);

// Panel seams on the fuselage (like the segmented CAD body)
[-0.9, -0.3, 0.3, 0.95].forEach((x) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.181, 0.004, 6, 64), mat.dark);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = x;
  drone.add(ring);
});
// Dorsal spine
const spine = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.08), mat.body);
spine.position.set(-0.35, 0.18, 0);
drone.add(spine);

// Delta wing halves (separate so they can explode apart)
function wingHalf(side) {
  const s = new THREE.Shape();
  s.moveTo(0.55, 0);
  s.lineTo(-1.32, 1.36);
  s.lineTo(-1.5, 1.36);
  s.lineTo(-1.5, 0);
  s.lineTo(0.55, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  geo.rotateX(Math.PI / 2);            // shape Y -> -Z
  const m = new THREE.Mesh(geo, mat.wing);
  m.scale.z = side;                     // mirror for the other side
  m.position.y = -0.04;
  return m;
}
const wingL = wingHalf(-1);
const wingR = wingHalf(1);
drone.add(wingL, wingR);

// Tip fins
function tipFin(side) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.14);
  s.lineTo(0.22, -0.14);
  s.lineTo(0.02, 0.3);
  s.lineTo(-0.16, 0.3);
  s.lineTo(0, -0.14);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat.fin);
  m.position.set(-1.5, -0.04, side * 1.36 - 0.01);
  return m;
}
const finL = tipFin(-1);
const finR = tipFin(1);
drone.add(finL, finR);

// Rear engine + pusher propeller
const engine = new THREE.Group();
const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 24), mat.dark);
housing.rotation.z = Math.PI / 2;
housing.position.x = -1.7;
const hub = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 16), mat.nose);
hub.rotation.z = Math.PI / 2;
hub.position.x = -1.86;
const prop = new THREE.Group();
prop.position.x = -1.83;
for (let i = 0; i < 2; i++) {
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.72, 0.06), mat.dark);
  blade.rotation.x = i * Math.PI;
  blade.position.y = 0;
  prop.add(blade);
}
// motion blur disc for the spinning prop
const disc = new THREE.Mesh(
  new THREE.CircleGeometry(0.37, 48),
  new THREE.MeshBasicMaterial({ color: 0x8fa9c7, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })
);
disc.rotation.y = Math.PI / 2;
prop.add(disc);
engine.add(housing, hub, prop);
drone.add(engine);

// Wireframe "blueprint" overlay used in the manufacturing chapter
const wireMat = new THREE.LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0 });
const wire = new THREE.Group();
drone.traverse((o) => {
  if (o.isMesh && o.geometry && o !== disc) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), wireMat);
    e.position.copy(o.position); e.rotation.copy(o.rotation); e.scale.copy(o.scale);
    o.parent === drone ? wire.add(e) : null;
  }
});
drone.add(wire);
const solidMats = [mat.body, mat.wing, mat.nose, mat.fin, mat.dark];
solidMats.forEach((m) => { m.transparent = true; });

// Towed launch rail (12 m in reality; shown compressed)
const rail = new THREE.Group();
const railMat = new THREE.MeshStandardMaterial({ color: 0x2b3446, metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0 });
const railBeam = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 0.32), railMat);
railBeam.position.set(-1.2, -0.3, 0);
rail.add(railBeam);
[-0.12, 0.12].forEach((z) => {
  const track = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.04, 0.03), railMat);
  track.position.set(-1.2, -0.24, z);
  rail.add(track);
});
// trailer legs and wheels
// rail is pitched nose-up by the keyframe, so front legs are longer
const legs = [[-3.4, 0.25], [-1.2, 0.68], [0.9, 1.1]];
legs.forEach(([x, h]) => {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), railMat);
  leg.position.set(x, -0.3 - h / 2, 0);
  rail.add(leg);
});
[-0.32, 0.32].forEach((z) => {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 24), railMat);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(-3.4, -0.55, z);
  rail.add(wheel);
});
const railMats = [railMat];
droneRoot.add(rail);

// Particle field: drifting "airflow" points
const pCount = 900;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(pCount * 3);
for (let i = 0; i < pCount; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 30;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x8fa9c7, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false }));
scene.add(particles);

/* =========================================================
   Scroll storytelling: one keyframe per chapter
   ========================================================= */
const isMobile = () => window.innerWidth < 900;

// pos, rot (euler), scale, explode, wire, rail, opacity
const desktopKeys = [
  { pos: [1.3, 0.0, 0], rot: [0.45, -0.7, 0.18], s: 1.15, ex: 0, wi: 0, ra: 0, op: 1 },   // hero
  { pos: [-1.9, 0.35, 0], rot: [0.25, 0.5, -0.45], s: 1.0, ex: 0, wi: 0, ra: 0, op: 1 },  // concept: banking flight
  { pos: [1.9, 0.1, 0], rot: [1.15, 0.25, 0.0], s: 1.05, ex: 1, wi: 0, ra: 0, op: 1 },    // design: exploded top view
  { pos: [-1.9, 0.0, 0], rot: [0.3, 2.3, 0.1], s: 1.1, ex: 0, wi: 1, ra: 0, op: 1 },      // build: blueprint
  { pos: [1.7, 0.4, 0], rot: [0.2, -2.55, 0.05], s: 1.05, ex: 0, wi: 0, ra: 0, op: 1 },   // product: rear 3/4 view
  { pos: [-1.6, 0.3, 0], rot: [0.12, -0.45, 0.2], s: 0.8, ex: 0, wi: 0, ra: 1, op: 1 },  // launcher: on the rail
  { pos: [0.0, 1.55, -2], rot: [1.45, 0.0, 0.0], s: 0.75, ex: 0, wi: 0, ra: 0, op: 0.35 }, // specs: plan view, dimmed
  { pos: [7, 3.5, -6], rot: [0.2, 0.3, -0.5], s: 0.6, ex: 0, wi: 0, ra: 0, op: 0 },       // contact: flies off
];
const mobileKeys = desktopKeys.map((k, i) => ({
  ...k,
  pos: i === 7 ? k.pos : [0, i === 0 ? 0.9 : 1.3, 0],
  s: k.s * 0.62,
  op: i === 6 ? 0.2 : k.op,
}));

const chapterEls = [...document.querySelectorAll('main > section')];
const names = chapterEls.map((el) => el.dataset.name || 'Contact');

function scrollState() {
  const mid = window.scrollY + window.innerHeight * 0.5;
  for (let i = 0; i < chapterEls.length; i++) {
    const el = chapterEls[i];
    const top = el.offsetTop;
    const h = el.offsetHeight;
    if (mid < top + h || i === chapterEls.length - 1) {
      const t = THREE.MathUtils.clamp((mid - top) / h, 0, 1);
      return { i, t };
    }
  }
  return { i: 0, t: 0 };
}

// Move between keyframes during the last 40% of each chapter
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function targetFrame() {
  const keys = isMobile() ? mobileKeys : desktopKeys;
  const { i, t } = scrollState();
  const a = keys[Math.min(i, keys.length - 1)];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const k = ease(THREE.MathUtils.clamp((t - 0.6) / 0.4, 0, 1));
  const mix = (x, y) => x + (y - x) * k;
  return {
    i, t,
    pos: a.pos.map((v, j) => mix(v, b.pos[j])),
    rot: a.rot.map((v, j) => mix(v, b.rot[j])),
    s: mix(a.s, b.s), ex: mix(a.ex, b.ex), wi: mix(a.wi, b.wi), ra: mix(a.ra, b.ra), op: mix(a.op, b.op),
  };
}

const cur = { pos: [0, -3, 0], rot: [0.6, -1.5, 0.3], s: 0.4, ex: 0, wi: 0, ra: 0, op: 0 };
const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* =========================================================
   DOM-side motion graphics
   ========================================================= */
const progressBar = document.getElementById('progressBar');
const hudAlt = document.getElementById('hudAlt');
const hudSpd = document.getElementById('hudSpd');
const hudHdg = document.getElementById('hudHdg');
const hudIdx = document.getElementById('hudIdx');
const hudName = document.getElementById('hudName');
const missionSteps = [...document.querySelectorAll('.mission li')];
const railMeter = document.getElementById('railMeter');
const flightPath = document.getElementById('flightPath');
const navLinks = [...document.querySelectorAll('.nav-links a')];
const pathLen = flightPath.getTotalLength();
flightPath.style.strokeDasharray = `${pathLen}`;

function updateDom(f) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  progressBar.style.width = `${p * 100}%`;

  hudAlt.textContent = String(Math.round(p * 3500)).padStart(4, '0');
  hudSpd.textContent = String(Math.round(95 + Math.sin(p * Math.PI) * 125)).padStart(3, '0');
  hudHdg.textContent = String(Math.round((f.rot[1] * 57.3 + 360) % 360)).padStart(3, '0');
  const idx = Math.min(f.i, 6);
  hudIdx.textContent = String(idx + 1).padStart(2, '0');
  hudName.textContent = names[f.i] || 'Contact';

  // Concept: light up mission steps + draw the flight path
  const concept = f.i === 1 ? f.t : f.i > 1 ? 1 : 0;
  missionSteps.forEach((li, n) => li.classList.toggle('on', concept > 0.12 + n * 0.14));
  flightPath.style.strokeDashoffset = `${pathLen * (1 - THREE.MathUtils.clamp(concept * 1.4, 0, 1))}`;

  // Launcher: rail meter fills to 12 m
  const launch = f.i === 5 ? f.t : f.i > 5 ? 1 : 0;
  railMeter.style.width = `${THREE.MathUtils.clamp(launch * 1.6, 0, 1) * 100}%`;

  const activeId = chapterEls[f.i]?.id;
  navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${activeId}`));
}

/* =========================================================
   Render loop
   ========================================================= */
const clock = new THREE.Clock();
const damp = (a, b, l, dt) => THREE.MathUtils.damp(a, b, l, dt);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const f = targetFrame();

  for (let j = 0; j < 3; j++) {
    cur.pos[j] = damp(cur.pos[j], f.pos[j], 3.2, dt);
    cur.rot[j] = damp(cur.rot[j], f.rot[j], 3.2, dt);
  }
  ['s', 'ex', 'wi', 'ra', 'op'].forEach((k) => { cur[k] = damp(cur[k], f[k], 3.2, dt); });

  // idle hover + mouse parallax
  const bob = Math.sin(time * 1.2) * 0.06;
  droneRoot.position.set(cur.pos[0], cur.pos[1] + bob * (1 - cur.ra), cur.pos[2]);
  droneRoot.rotation.set(
    cur.rot[0] + mouse.y * 0.08,
    cur.rot[1] + mouse.x * 0.12,
    cur.rot[2] + Math.sin(time * 0.9) * 0.03
  );
  droneRoot.scale.setScalar(cur.s);

  // exploded view
  const ex = cur.ex;
  nose.position.x = ex * 0.55;
  wingL.position.z = -ex * 0.45; wingL.position.y = -0.04 - ex * 0.25;
  wingR.position.z = ex * 0.45;  wingR.position.y = -0.04 - ex * 0.25;
  finL.position.z = -1.37 - ex * 0.75; finR.position.z = 1.35 + ex * 0.75;
  engine.position.x = -ex * 0.5;
  spine.position.y = 0.18 + ex * 0.25;
  wire.visible = cur.wi > 0.01;

  // blueprint mode: fade solids, show edges
  wireMat.opacity = cur.wi * 0.9;
  solidMats.forEach((m) => { m.opacity = cur.op * (1 - cur.wi * 0.85); });
  disc.material.opacity = 0.08 * cur.op;

  // launch rail
  railMat.opacity = cur.ra;
  rail.visible = cur.ra > 0.01;

  // propeller spin (faster when not on the rail)
  prop.rotation.x += dt * (cur.ra > 0.5 ? 8 : 40);

  // airflow drift
  const arr = pGeo.attributes.position.array;
  for (let i = 0; i < pCount; i++) {
    arr[i * 3] -= dt * (1.2 + (i % 5) * 0.4);
    if (arr[i * 3] < -15) arr[i * 3] = 15;
  }
  pGeo.attributes.position.needsUpdate = true;

  camera.position.x = damp(camera.position.x, mouse.x * 0.25, 2, dt);
  camera.position.y = damp(camera.position.y, 0.6 - mouse.y * 0.15, 2, dt);
  camera.lookAt(0, 0, 0);

  updateDom(f);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =========================================================
   Reveal, counters, compare slider, spec tabs, loader
   ========================================================= */
function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.dec || '0', 10);
  const start = performance.now();
  const dur = 1600;
  const step = (now) => {
    const k = Math.min((now - start) / dur, 1);
    el.textContent = (target * (1 - Math.pow(1 - k, 3))).toFixed(dec);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll('[data-count]').forEach(countUp);
    io.unobserve(e.target);
  });
}, { threshold: 0.2 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

const compare = document.getElementById('compare');
const compareTop = document.getElementById('compareTop');
document.getElementById('compareRange').addEventListener('input', (e) => {
  const v = e.target.value;
  compareTop.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
  compare.style.setProperty('--pos', `${v}%`);
});

document.querySelectorAll('.spec-tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.spec-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.spec-grid').forEach((g) => {
      const show = g.dataset.panel === btn.dataset.tab;
      g.hidden = !show;
      if (show) g.querySelectorAll('.spec').forEach((s) => { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; });
    });
  });
});

const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
let lp = 0;
const li = setInterval(() => {
  lp = Math.min(lp + 18 + Math.random() * 20, 100);
  loaderBar.style.width = `${lp}%`;
  if (lp >= 100) {
    clearInterval(li);
    setTimeout(() => loader.classList.add('done'), 250);
  }
}, 120);

tick();
