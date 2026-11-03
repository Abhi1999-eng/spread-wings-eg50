import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
const BEATS = [
  { stamp: 'T−00:20', place: 'Stratosphere · 18.0 km', mega: 'Stratosphere', title: 'Kestrel-07 on station',
    text: 'A stripped, high-altitude EG-50 holds station above the curve of the earth. Under its belly hangs SUNDOWN, a payload nobody on the ground has ever seen opened.' },
  { stamp: 'T+00:08', place: 'Cloudline · 14.2 km', mega: 'Cloudline', title: 'Clean separation',
    text: 'The release lug lets go. Kestrel-07 banks away and turns its sensor head onto the falling payload. From here on, it never looks away.' },
  { stamp: 'T+00:24', place: 'High Himalaya · 10.6 km', mega: 'Himalaya', title: 'Scan mode: live',
    text: 'The drone paints the payload in a live X-ray. On screen, the outer shell turns to glass. The teardown begins mid-air.' },
  { stamp: 'T+00:41', place: 'Pine valley · 7.1 km', mega: 'Pine Valley', title: 'The autopsy',
    text: 'Nine modules, pulled apart in the scan while the payload keeps falling. Hover any part to zoom in on it.' },
  { stamp: 'T+00:57', place: 'Monsoon gorge · 4.4 km', mega: 'Monsoon', title: 'The core',
    text: 'Inside the cradle sits the one module even the scan cannot see into. Ground station NEST names it SUNDOWN CORE and stops asking questions.' },
  { stamp: 'T+01:13', place: 'Western coast · 2.0 km', mega: 'Coastline', title: 'Reassembly',
    text: 'The scan folds every module back into place. The payload goes dark on screen again. Terminal phase.' },
  { stamp: 'T+01:28', place: 'Kharsa Flats · 0.3 km', mega: 'Ground Zero', title: 'Four seconds',
    text: 'Three red beacons on the salt flat. Kestrel-07 is already twelve kilometres away, still recording.' },
  { stamp: 'T+01:32', place: 'Kharsa Flats · 0 m', mega: '', title: 'Sundown',
    text: 'Impact. Shockwave. A column of fire climbs over the desert, and one aircraft sends home every second of it.' },
];

// Part dossiers (fictional, cinematic)
const INFO = {
  nose: { code: 'ARROWHEAD', name: 'Nose fairing',
    text: 'Ceramic-composite nose cone. It meets the air first, takes the heat, and keeps the forward sensor window clean all the way down.',
    stats: [['Material', 'Ceramic'], ['Mass', '6.2 kg'], ['Skin temp', '410 °C']] },
  sensor: { code: 'WHISPER', name: 'Ground-sense ring',
    text: 'Six small radar heads in a ring. They read height above ground and stream it up to the EG-50 for the record.',
    stats: [['Heads', '6'], ['Update', '200 Hz'], ['Range', '3 km']] },
  telemetry: { code: 'LANTERN', name: 'Telemetry bay',
    text: 'The payload’s voice. Spin, attitude, temperature and position, sent to Kestrel-07 forty times a second.',
    stats: [['Link', 'Encrypted'], ['Rate', '40 Hz'], ['Channels', '12']] },
  power: { code: 'EMBER', name: 'Power cell stack',
    text: 'Seven cells that keep every sensor alive for the fall, and not a second longer.',
    stats: [['Cells', '7'], ['Runtime', '240 s'], ['Bus', '28 V']] },
  core: { code: 'CLASSIFIED', name: 'Sundown core',
    text: 'Sealed vessel at the heart of the payload. The scan shows its outline and nothing else. Even this page does not know what is inside.',
    stats: [['Access', 'None'], ['Clearance', 'L-5'], ['Contents', '████']] },
  cradle: { code: 'SPINE', name: 'Shock cradle',
    text: 'Three titanium rails and two rings that hold every module in line through release, spin and buffeting.',
    stats: [['Rails', '3'], ['Material', 'Ti-6Al'], ['Rated', '40 g']] },
  shell: { code: 'SHELL', name: 'Outer casing',
    text: 'Two-piece steel-composite casing. In the scan it opens like a book. In reality it never opens at all.',
    stats: [['Pieces', '2'], ['Length', '3.2 m'], ['Finish', 'Matte']] },
  tail: { code: 'FEATHERS', name: 'Tail fin assembly',
    text: 'Four fins and a box ring. They keep the payload nose-down and give it a slow, steady spin.',
    stats: [['Fins', '4'], ['Spin', '1.5 rev/s'], ['Ring', 'Ø 1.2 m']] },
  lug: { code: 'TALON', name: 'Release lug',
    text: 'The single hook that tied SUNDOWN to Kestrel-07’s pylon. Opened at T+00:00 and never used again.',
    stats: [['Rated', '50 kg'], ['Opened', 'T+00:00'], ['Reuse', 'None']] },
};
const PART_ORDER = ['nose', 'sensor', 'telemetry', 'power', 'core', 'cradle', 'shell', 'tail', 'lug'];

/* =========================================================
   Natural sceneries (procedural SVG parallax layers)
   ========================================================= */
const W = 1600, H = 1400;
function rand(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function heights({ seed, base, amp, oct = 5, rough = 0.5, freq = 1, ridged = false, step = 8 }) {
  const r = rand(seed);
  const ph = Array.from({ length: oct }, () => r() * 6.283);
  const pts = [];
  for (let x = -step; x <= W + step; x += step) {
    let v = 0, a = 1, f = freq, n = 0;
    for (let o = 0; o < oct; o++) {
      let k = Math.sin((x / W) * 6.283 * f + ph[o]);
      if (ridged) k = 1 - Math.abs(k) * 2;
      v += k * a; n += a; a *= rough; f *= 2.03;
    }
    pts.push([x, base - (v / n) * amp]);
  }
  return pts;
}
const fillPath = (pts) => `M${pts[0][0]} ${H} ` + pts.map(([x, y]) => `L${x} ${y.toFixed(1)}`).join(' ') + ` L${pts.at(-1)[0]} ${H} Z`;
const linePath = (pts) => 'M' + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L');

function pines(pts, seed, size, every = 3) {
  const r = rand(seed);
  let d = '';
  for (let i = 0; i < pts.length; i += every) {
    if (r() < 0.25) continue;
    const [x, y0] = pts[i];
    const y = y0 + 6;
    const h = size * (0.6 + r() * 0.8), w = h * 0.28;
    d += `M${x} ${y - h} L${x - w} ${y - h * 0.45} L${x - w * 0.55} ${y - h * 0.45} L${x - w * 1.25} ${y} L${x + w * 1.25} ${y} L${x + w * 0.55} ${y - h * 0.45} L${x + w} ${y - h * 0.45} Z `;
  }
  return d;
}
function cloudBank(seed, y, minW, maxW, minH, maxH) {
  const r = rand(seed);
  let x = -80, d = `M-80 ${H} L-80 ${y}`;
  while (x < W + 80) {
    const w = minW + r() * (maxW - minW);
    const h = minH + r() * (maxH - minH);
    const yy = y + (r() - 0.5) * 30;
    d += ` A${(w / 2).toFixed(0)} ${h.toFixed(0)} 0 0 1 ${(x + w).toFixed(0)} ${yy.toFixed(0)}`;
    x += w;
  }
  return d + ` L${x} ${H} Z`;
}
function starField(seed, n, maxY) {
  const r = rand(seed);
  let c = '';
  for (let i = 0; i < n; i++) {
    const rr = r() < 0.08 ? 1.8 : 0.5 + r() * 0.9;
    c += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * maxY).toFixed(0)}" r="${rr.toFixed(2)}" fill="#fff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
  }
  return c;
}
const svg = (inner, defs = '') => `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice"><defs>${defs}</defs>${inner}</svg>`;
const vgrad = (id, stops, y1 = 0, y2 = H) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">` +
  stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('') + '</linearGradient>';
const blur = (id, sd) => `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;

const SCENES = [
  // 0 · Stratosphere at dawn: curve of the earth
  {
    sky: 'linear-gradient(#000106 0%, #020716 35%, #071739 55%, #18386f 64%, #4a7cc0 69%, #f3a46b 72%, #2a4f8c 74%)',
    layers: [
      { d: 0, svg: svg(starField(7, 220, 760)) },
      { d: 0.3, svg: svg(
        `<circle cx="800" cy="4900" r="4170" fill="url(#atm0)" filter="url(#b0)"/>` +
        `<circle cx="800" cy="4900" r="4120" fill="url(#earth0)"/>` +
        `<ellipse cx="300" cy="830" rx="520" ry="26" fill="#fff" opacity=".35" filter="url(#b1)"/>` +
        `<ellipse cx="1150" cy="870" rx="640" ry="34" fill="#fff" opacity=".3" filter="url(#b1)"/>` +
        `<ellipse cx="760" cy="980" rx="900" ry="60" fill="#dfeaff" opacity=".22" filter="url(#b1)"/>` +
        `<circle cx="180" cy="770" r="40" fill="#fff2d6" filter="url(#b0)"/>`,
        vgrad('earth0', [[0, '#5d9ee8'], [0.04, '#2a65ad'], [0.15, '#123a72'], [0.4, '#0a2147']], 780, 1400) +
        `<radialGradient id="atm0"><stop offset=".97" stop-color="#ffbf80"/><stop offset="1" stop-color="#ff8a4a" stop-opacity="0"/></radialGradient>` +
        blur('b0', 14) + blur('b1', 10)) },
      { d: 0.9, svg: svg(
        `<ellipse cx="1300" cy="1080" rx="420" ry="20" fill="#fff" opacity=".18" filter="url(#b2)"/>` +
        `<ellipse cx="260" cy="1180" rx="380" ry="16" fill="#fff" opacity=".15" filter="url(#b2)"/>`, blur('b2', 8)) },
    ],
  },
  // 1 · Above the clouds at golden hour
  {
    sky: 'linear-gradient(#173a78 0%, #3f6db4 30%, #8fa9d4 52%, #f2c38f 66%, #ffe2b5 74%)',
    layers: [
      { d: 0, svg: svg(`<circle cx="1180" cy="700" r="70" fill="#fff6e2"/><circle cx="1180" cy="700" r="200" fill="#ffe1a8" opacity=".35" filter="url(#bs)"/>`, blur('bs', 40)) },
      { d: 0.2, svg: svg(`<path d="${cloudBank(11, 760, 120, 260, 30, 70)}" fill="url(#c1a)"/>`, vgrad('c1a', [[0, '#fff1de'], [0.08, '#f0c9a6'], [0.25, '#b9a3b8']], 700, 1100)) },
      { d: 0.45, svg: svg(`<path d="${cloudBank(12, 860, 160, 360, 50, 110)}" fill="url(#c1b)"/>`, vgrad('c1b', [[0, '#ffffff'], [0.1, '#f6dcc4'], [0.3, '#b7a7bf']], 760, 1200)) },
      { d: 0.75, svg: svg(`<path d="${cloudBank(13, 990, 220, 480, 70, 150)}" fill="url(#c1c)"/>`, vgrad('c1c', [[0, '#ffffff'], [0.12, '#f3e3d6'], [0.35, '#9d95b4']], 860, 1350)) },
      { d: 1.15, svg: svg(`<path d="${cloudBank(14, 1150, 300, 640, 90, 190)}" fill="url(#c1d)" opacity=".95"/>`, vgrad('c1d', [[0, '#ffffff'], [0.2, '#ece7ee'], [0.5, '#8d8aa8']], 980, 1400)) },
    ],
  },
  // 2 · High Himalaya, snow peaks
  {
    sky: 'linear-gradient(#4f7fbd 0%, #86aedb 40%, #c9dcef 64%, #eef4fa 76%)',
    layers: [
      { d: 0.1, svg: svg(`<path d="${fillPath(heights({ seed: 21, base: 690, amp: 120, ridged: true, freq: 1.2, rough: 0.55 }))}" fill="url(#h0)"/>`,
        vgrad('h0', [[0, '#ffffff'], [0.25, '#d4e0ee'], [1, '#aabdd6']], 560, 900)) },
      { d: 0.3, svg: svg(`<path d="${fillPath(heights({ seed: 22, base: 780, amp: 190, ridged: true, freq: 0.9, rough: 0.55 }))}" fill="url(#h1)"/>`,
        vgrad('h1', [[0, '#ffffff'], [0.18, '#e2ebf5'], [0.45, '#9fb3cf'], [1, '#7d93b4']], 590, 1100)) },
      { d: 0.55, svg: svg(`<path d="${fillPath(heights({ seed: 23, base: 900, amp: 230, ridged: true, freq: 0.7, rough: 0.6 }))}" fill="url(#h2)"/>`,
        vgrad('h2', [[0, '#fbfdff'], [0.2, '#c8d6e8'], [0.5, '#6f86aa'], [1, '#4b6189']], 670, 1250)) },
      { d: 0.85, svg: svg(`<path d="${fillPath(heights({ seed: 24, base: 1040, amp: 210, ridged: true, freq: 0.6, rough: 0.6 }))}" fill="url(#h3)"/>`,
        vgrad('h3', [[0, '#e9f0f8'], [0.18, '#8fa3c2'], [0.5, '#3f5278'], [1, '#263557']], 830, 1400)) },
      { d: 1.2, svg: svg(`<path d="${fillPath(heights({ seed: 25, base: 1210, amp: 110, ridged: true, freq: 0.8, rough: 0.65 }))}" fill="#1a2440"/>`) },
    ],
  },
  // 3 · Pine valley in morning mist
  (() => {
    const p3 = heights({ seed: 33, base: 1000, amp: 90, freq: 0.9, rough: 0.45 });
    const p4 = heights({ seed: 34, base: 1150, amp: 80, freq: 1.1, rough: 0.45 });
    return {
      sky: 'linear-gradient(#f3c98f 0%, #f6dcae 40%, #d9e2c4 62%, #aac7b6 78%)',
      layers: [
        { d: 0, svg: svg(`<circle cx="420" cy="640" r="60" fill="#fff4d6"/><circle cx="420" cy="640" r="220" fill="#ffe7b0" opacity=".45" filter="url(#bf)"/>`, blur('bf', 40)) },
        { d: 0.15, svg: svg(`<path d="${fillPath(heights({ seed: 31, base: 760, amp: 80, freq: 0.8, rough: 0.4 }))}" fill="#9fb9a6"/><rect y="760" width="${W}" height="140" fill="url(#m0)"/>`,
          vgrad('m0', [[0, '#f4ead2', 0], [0.5, '#f4ead2', 0.7], [1, '#f4ead2', 0]], 760, 900)) },
        { d: 0.35, svg: svg(`<path d="${fillPath(heights({ seed: 32, base: 860, amp: 100, freq: 1, rough: 0.45 }))}" fill="#6f9681"/><rect y="860" width="${W}" height="160" fill="url(#m1)"/>`,
          vgrad('m1', [[0, '#eef0de', 0], [0.5, '#eef0de', 0.6], [1, '#eef0de', 0]], 860, 1020)) },
        { d: 0.6, svg: svg(`<path d="${fillPath(p3)}" fill="#3f6a55"/><path d="${pines(p3, 35, 46, 3)}" fill="#3f6a55"/><rect y="1010" width="${W}" height="150" fill="url(#m2)"/>`,
          vgrad('m2', [[0, '#e6ecd9', 0], [0.5, '#e6ecd9', 0.45], [1, '#e6ecd9', 0]], 1010, 1160)) },
        { d: 0.95, svg: svg(`<path d="${fillPath(p4)}" fill="#1f3c30"/><path d="${pines(p4, 36, 120, 4)}" fill="#1f3c30"/>`) },
        { d: 1.3, svg: svg(`<path d="${pines(heights({ seed: 37, base: 1340, amp: 40, freq: 1.4 }), 38, 300, 9)}" fill="#0d1f19"/><rect y="1330" width="${W}" height="80" fill="#0d1f19"/>`) },
      ],
    };
  })(),
  // 4 · Monsoon gorge with a river and waterfall
  {
    sky: 'linear-gradient(#34514f 0%, #5f7f7a 30%, #9fb8ac 58%, #d4e0d3 74%)',
    layers: [
      { d: 0.12, svg: svg(`<path d="${fillPath(heights({ seed: 41, base: 760, amp: 140, freq: 0.7, rough: 0.5 }))}" fill="#7d9a92"/>`) },
      { d: 0.35, svg: svg(
        `<path d="M0 ${H} L0 700 C 220 640, 360 720, 520 760 L 640 820 L 660 ${H} Z" fill="#4f6e67"/>` +
        `<path d="M${W} ${H} L${W} 650 C 1380 620, 1200 700, 1080 760 L 960 840 L 940 ${H} Z" fill="#4f6e67"/>` +
        `<rect x="1000" y="760" width="26" height="320" fill="url(#wf)"/><ellipse cx="1012" cy="1080" rx="90" ry="26" fill="#eef6f3" opacity=".7" filter="url(#bw)"/>`,
        vgrad('wf', [[0, '#e9f5f2'], [1, '#bcd6d0', 0.6]], 760, 1080) + blur('bw', 12)) },
      { d: 0.6, svg: svg(
        `<path d="M0 ${H} L0 980 L ${W} 980 L ${W} ${H} Z" fill="#2f4d45"/>` +
        `<path d="M 760 980 C 700 1040, 880 1090, 760 1160 S 560 1260, 700 ${H} L 980 ${H} C 860 1260, 1060 1210, 960 1150 S 860 1040, 840 980 Z" fill="url(#rv)"/>`,
        vgrad('rv', [[0, '#d6e6e1'], [0.5, '#9ec0bb'], [1, '#6f9d98']], 980, 1400)) },
      { d: 0.95, svg: svg(
        `<path d="M0 ${H} L0 900 C 120 880, 220 960, 300 1040 L 380 1160 L 420 ${H} Z" fill="#183029"/>` +
        `<path d="M${W} ${H} L${W} 860 C 1480 870, 1380 950, 1300 1050 L 1220 1170 L 1180 ${H} Z" fill="#183029"/>` +
        `<path d="${pines(heights({ seed: 43, base: 900, amp: 30, freq: 3 }).filter(([x]) => x < 300 || x > 1300), 44, 90, 2)}" fill="#183029"/>`) },
      { d: 1.25, svg: svg(`<path d="${fillPath(heights({ seed: 45, base: 1290, amp: 60, freq: 2.2, rough: 0.6 }))}" fill="#0a1714"/>`) },
    ],
  },
  // 5 · Coast at dusk
  {
    sky: 'linear-gradient(#170f36 0%, #3b2363 28%, #9a3d78 48%, #ee6f6d 60%, #ffb36e 68%, #ffd796 71%)',
    layers: [
      { d: 0, svg: svg(starField(51, 60, 380)) },
      { d: 0.12, svg: svg(`<circle cx="800" cy="1000" r="110" fill="#fff0c2"/><circle cx="800" cy="1000" r="320" fill="#ffc27a" opacity=".45" filter="url(#bsun)"/>`, blur('bsun', 50)) },
      { d: 0.3, svg: svg(
        `<rect y="990" width="${W}" height="${H - 990}" fill="url(#sea)"/>` +
        Array.from({ length: 40 }, (_, i) => { const r = rand(500 + i); const y = 1000 + Math.pow(r(), 1.6) * 380; const w = 30 + r() * 140 * (y - 960) / 300; return `<rect x="${(800 - w / 2 + (r() - 0.5) * (y - 980) * 1.4).toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="3" fill="#ffe0a8" opacity="${(0.25 + r() * 0.5).toFixed(2)}"/>`; }).join(''),
        vgrad('sea', [[0, '#c76a7a'], [0.25, '#6a3a6e'], [1, '#1b1638']], 990, 1400)) },
      { d: 0.65, svg: svg(
        `<path d="M0 ${H} L0 820 C 120 800, 260 840, 330 900 L 420 990 L 470 1060 L 520 ${H} Z" fill="#2a1838"/>` +
        `<path d="M${W} ${H} L${W} 760 C 1500 760, 1420 820, 1360 900 L 1290 1010 L 1250 ${H} Z" fill="#2a1838"/>` +
        `<path d="M 600 640 l 14 8 l 14 -8 M 660 610 l 10 6 l 10 -6 M 980 700 l 12 7 l 12 -7" stroke="#2a1838" stroke-width="3" fill="none"/>`) },
      { d: 1.1, svg: svg(`<path d="M0 ${H} L0 1100 C 160 1090, 240 1180, 300 ${H} Z M${W} ${H} L${W} 1060 C 1420 1080, 1340 1180, 1300 ${H} Z" fill="#120a1c"/>`) },
    ],
  },
  // 6 · Desert test range at night (ground zero)
  (() => {
    const dune1 = heights({ seed: 62, base: 880, amp: 30, freq: 0.6, rough: 0.35, oct: 3 });
    const dune2 = heights({ seed: 63, base: 1000, amp: 55, freq: 0.5, rough: 0.35, oct: 3 });
    return {
      sky: 'linear-gradient(#01030a 0%, #050b1e 45%, #0f1c40 62%, #2a3866 70%)',
      boom: true,
      lift: -22,
      layers: [
        { d: 0, svg: svg(starField(61, 260, 760) + `<circle cx="1260" cy="420" r="34" fill="#f3f1e6"/><circle cx="1260" cy="420" r="120" fill="#cfd8ff" opacity=".25" filter="url(#bm)"/>`, blur('bm', 30)) },
        { d: 0.15, svg: svg(`<path d="${fillPath(heights({ seed: 64, base: 820, amp: 26, freq: 1.4, ridged: true, rough: 0.5 }))}" fill="#151d3a"/>`) },
        { d: 0.4, svg: svg(
          `<path d="${fillPath(dune1)}" fill="url(#du1)"/><path d="${linePath(dune1)}" stroke="#7d86b8" stroke-width="2" fill="none" opacity=".6"/>` +
          `<g fill="none" stroke="#ff4a4a" opacity=".6"><ellipse cx="800" cy="905" rx="70" ry="8" stroke-width="2"/><ellipse cx="800" cy="905" rx="160" ry="18" stroke-width="1.5"/><ellipse cx="800" cy="905" rx="280" ry="30" stroke-width="1"/></g>` +
          `<g class="beacons" fill="#ff3b3b"><circle cx="640" cy="900" r="4"/><circle cx="960" cy="902" r="4"/><circle cx="800" cy="930" r="4"/></g>`,
          vgrad('du1', [[0, '#3a4170'], [1, '#141a35']], 860, 1100)) },
        { d: 0.7, svg: svg(`<path d="${fillPath(dune2)}" fill="url(#du2)"/><path d="${linePath(dune2)}" stroke="#a3a6c9" stroke-width="2.5" fill="none" opacity=".55"/>`,
          vgrad('du2', [[0, '#4a4f7d'], [0.3, '#2a2f55'], [1, '#0f1328']], 960, 1300)) },
        { d: 1.15, svg: svg(`<path d="${fillPath(heights({ seed: 65, base: 1180, amp: 50, freq: 0.7, rough: 0.35, oct: 3 }))}" fill="#0a0d1d"/>`) },
      ],
    };
  })(),
];

const world = $('world');
const scenes = SCENES.map((def) => {
  const el = document.createElement('div');
  el.className = 'scene';
  el.innerHTML = `<div class="sky" style="background:${def.sky}"></div>` +
    def.layers.map((l) => `<div class="layer" data-d="${l.d}">${l.svg}</div>`).join('') +
    (def.boom ? '<div class="boom"></div>' : '');
  world.appendChild(el);
  return { el, lift: def.lift || 0, boom: el.querySelector('.boom'), layers: [...el.querySelectorAll('.layer')].map((n) => ({ n, d: +n.dataset.d })) };
});
const wipe = $('wipe');

function updateWorld(s, boomGlow) {
  scenes.forEach((sc, k) => {
    const fin = k === 0 ? 1 : range(s, k - 0.06, k + 0.06);
    const fout = k === scenes.length - 1 ? 0 : range(s, k + 0.94, k + 1.06);
    const o = fin * (1 - fout);
    sc.el.style.opacity = o.toFixed(3);
    sc.el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
    if (o <= 0.001) return;
    let t = THREE.MathUtils.clamp(s - k, -0.1, 1.1);
    let rush = 0;
    if (k === 6) {
      if (s >= IMPACT) t = 0.12;                         // cut to a wide shot under the flash
      else rush = easeIn(range(s, 6.25, IMPACT));          // ground rushes up
    }
    sc.layers.forEach(({ n, d }) => {
      const y = (d > 0 ? sc.lift : 0) - (t * d * 30 + rush * d * 26);
      const sc2 = 1 + t * d * 0.16 + rush * d * 1.6;
      n.style.transform = `translate3d(0, ${y.toFixed(2)}vh, 0) scale(${sc2.toFixed(4)})`;
    });
    if (sc.boom) sc.boom.style.opacity = boomGlow.toFixed(3);
  });

  // cloud punch-through between sceneries
  let w = 0, wd = 0;
  for (let k = 1; k <= 6; k++) {
    const d = s - k;
    if (Math.abs(d) < 0.14) { w = 1 - Math.abs(d) / 0.14; wd = d; }
  }
  const ww = w * w * (3 - 2 * w);
  wipe.style.opacity = (ww * 0.96).toFixed(3);
  wipe.style.transform = `translate3d(0, ${(-wd / 0.14 * 70).toFixed(1)}vh, 0) scale(${(1.3 + ww * 0.5).toFixed(3)})`;
}

/* =========================================================
   Three.js stage
   ========================================================= */
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 120);
const zoomCam = new THREE.PerspectiveCamera(30, 16 / 10, 0.05, 60);
zoomCam.layers.set(0);

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x10182a, 0.7);
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(5, 6, 6);
const rim = new THREE.PointLight(0xe0313b, 26, 24);
rim.position.set(-4, 1.5, -3);
scene.add(hemi, key, rim);

// key light tint per scenery
const TINT = [0xffd2a8, 0xffe0b0, 0xf2f6ff, 0xfff1d0, 0xd8efe4, 0xff9f7a, 0x9fb4ff, 0xffb070].map((c) => new THREE.Color(c));
const HEMI_SKY = [0x7aa0ff, 0xbfd4ff, 0xdfe9ff, 0xf7e6c0, 0xb7d2c6, 0xd98aa0, 0x5266aa, 0xff9a50].map((c) => new THREE.Color(c));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
const cloudTex = canvasTex(256, 256, (g, w) => {
  const r = rand(99);
  for (let i = 0; i < 14; i++) {
    const x = w * (0.25 + r() * 0.5), y = w * (0.3 + r() * 0.4), rr = w * (0.12 + r() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(255,255,255,.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }
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
  body: new THREE.MeshPhysicalMaterial({ color: 0xc8cfd8, metalness: 0.55, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  wing: new THREE.MeshPhysicalMaterial({ color: 0xd9dee5, metalness: 0.3, roughness: 0.45, clearcoat: 0.3 }),
  nose: new THREE.MeshPhysicalMaterial({ color: 0xd2343d, metalness: 0.2, roughness: 0.25, clearcoat: 1 }),
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

/* ---------- SUNDOWN payload (axis = local Y, nose at −Y) ---------- */
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
const shellMat = phys({ color: 0x525b67, metalness: 0.8, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide, emissive: 0x000000 });
const bandMat = phys({ color: 0xe0313b, metalness: 0.3, roughness: 0.4, emissive: 0x000000 });
const halves = [0, Math.PI].map((phi) => {
  const h = new THREE.Group();
  h.add(lathe(SHELL_PTS, shellMat, 48, phi, Math.PI));
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
nose.add(lathe(NOSE_PTS, phys({ color: 0xdfe3e8, metalness: 0.15, roughness: 0.3, clearcoat: 1, emissive: 0x000000 })));
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
const rimMat = phys({ color: 0x9aa3ad, metalness: 1, roughness: 0.25, emissive: 0x000000 });
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
const cradleMat = phys({ color: 0x8b95a3, metalness: 0.9, roughness: 0.3, emissive: 0x000000 });
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
const tailMat = phys({ color: 0x3a414c, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide, emissive: 0x000000 });
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
const lugMat = phys({ color: 0x9aa3ad, metalness: 1, roughness: 0.22, emissive: 0x000000 });
const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 10, 24), lugMat);
loop.position.set(0.52, 0.12, 0);
const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.12), lugMat);
plate.position.set(0.455, 0.12, 0);
lug.add(loop, plate);
addPart('lug', lug, V(0.5, 0.12, 0), V(1.55, 0, 0), 0.1, { xray: true });

const xrayMats = [shellMat, bandMat, nose.children[0].material, tailMat, lugMat];

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

const PUFFS = 26;
const puffs = Array.from({ length: PUFFS }, (_, i) => {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  m.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, -6 + Math.random() * 10);
  m.scale.setScalar(3 + Math.random() * 5);
  m.userData.v = 0.6 + Math.random() * 0.8;
  m.layers.set(1);
  scene.add(m);
  return m;
});
const PUFF_OPACITY = [0.12, 0.8, 0.35, 0.28, 0.3, 0.16, 0.05, 0];
const PUFF_TINT = [0xdfe8ff, 0xfff1e0, 0xffffff, 0xf3f1e0, 0xe6f0ea, 0xffc7b5, 0x9aa6d6, 0x9aa6d6].map((c) => new THREE.Color(c));
camera.layers.enable(1);

/* ---------- Mushroom cloud ---------- */
const MN = 1500;
const mPos = new Float32Array(MN * 3), mCol = new Float32Array(MN * 3), mSize = new Float32Array(MN), mAlpha = new Float32Array(MN);
const mSeed = Array.from({ length: MN }, (_, i) => {
  const r = Math.random();
  return { type: r < 0.33 ? 0 : r < 0.8 ? 1 : 2, a: Math.random() * Math.PI * 2, b: Math.random(), c: Math.random() * Math.PI * 2, j: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], sz: 0.6 + Math.random() * 0.8 };
});
const mGeo = new THREE.BufferGeometry();
mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
mGeo.setAttribute('aColor', new THREE.BufferAttribute(mCol, 3));
mGeo.setAttribute('aSize', new THREE.BufferAttribute(mSize, 1));
mGeo.setAttribute('aAlpha', new THREE.BufferAttribute(mAlpha, 1));
const mMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: 1 } },
  vertexShader: `
    uniform float uScale;
    attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
    varying vec3 vC; varying float vA;
    void main() {
      vC = aColor; vA = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uScale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vC; varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vC, a * a * vA);
    }`,
  transparent: true, depthWrite: false,
});
const mushroom = new THREE.Points(mGeo, mMat);
mushroom.frustumCulled = false;
mushroom.visible = false;
const fireball = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
const mushRig = new THREE.Group();
mushRig.add(mushroom, fireball);
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
  const H2 = lerp(0.3, 4.4, easeOut(e));
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
  fireball.scale.setScalar(lerp(5, 9, e));
  fireball.material.opacity = appear * lerp(1, 0.28, easeOut(e));
}

/* =========================================================
   DOM: timeline, log, tags, dossier, parts index
   ========================================================= */
const tlList = $('tlList');
BEATS.forEach((b, i) => {
  const li = document.createElement('li');
  li.tabIndex = 0;
  li.innerHTML = `${b.stamp}<b>${b.title}</b>`;
  const go = () => scrollToBeat(i + 0.05);
  li.addEventListener('click', go);
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  tlList.appendChild(li);
});
const tlItems = [...tlList.children];

const tagsEl = $('tags');
const tags = {};
const partsNav = $('parts');
partsNav.innerHTML = '<div class="hint">HOVER ANY PART · OR PICK ONE</div>';
PART_ORDER.forEach((k) => {
  const p = parts[k];
  const n = String(p.idx).padStart(2, '0');
  const t = document.createElement('div');
  t.className = 'tag';
  t.innerHTML = `<span><em>${n}</em>${INFO[k].code}</span>`;
  t.addEventListener('pointerenter', () => setHover(k));
  t.addEventListener('pointerleave', () => setHover(null));
  t.addEventListener('click', () => togglePin(k));
  tagsEl.appendChild(t);
  tags[k] = t;

  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = n;
  b.title = INFO[k].name;
  b.setAttribute('aria-label', `${INFO[k].name}, ${INFO[k].code}`);
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
  const info = INFO[k];
  $('dIdx').textContent = `${String(parts[k].idx).padStart(2, '0')} / 09`;
  $('dCode').textContent = info.code;
  $('dName').textContent = info.name;
  $('dText').textContent = info.text;
  $('dStats').innerHTML = info.stats.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}

let hoverPart = null, pinnedPart = null;
function setHover(k) { hoverPart = k; }
function togglePin(k) { pinnedPart = pinnedPart === k ? null : k; }

// Typewriter story log
const logStamp = $('logStamp'), logPlace = $('logPlace'), logTitle = $('logTitle'), logText = $('logText');
let typing = { text: '', start: 0 };
let shownBeat = -1;
function showBeat(i, now) {
  if (i === shownBeat) return;
  shownBeat = i;
  const b = BEATS[i];
  logStamp.textContent = b.stamp;
  logPlace.textContent = b.place;
  logTitle.textContent = b.title;
  typing = { text: b.text, start: now };
  tlItems.forEach((li, n) => { li.classList.toggle('now', n === i); li.classList.toggle('past', n < i); });
  buildMega(b.mega);
}
function updateTyping(now) {
  const n = Math.floor((now - typing.start) * 70);
  const done = n >= typing.text.length;
  logText.innerHTML = (done ? typing.text : typing.text.slice(0, n)) + (done ? '' : '<span class="caret"></span>');
}

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
function readScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  for (let i = 0; i < sections.length; i++) {
    const top = sections[i].offsetTop;
    const last = i === sections.length - 1;
    const h = last ? Math.max(1, max - top) : sections[i].offsetHeight;
    if (y < top + h || last) return THREE.MathUtils.clamp(i + (y - top) / h, 0, sections.length);
  }
  return 0;
}
function scrollToBeat(sv) {
  const i = Math.floor(sv);
  const sec = sections[Math.min(i, sections.length - 1)];
  window.scrollTo({ top: sec.offsetTop + (sv - i) * sec.offsetHeight, behavior: 'smooth' });
}
$('replay').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

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
let baseZ = 9;
let gz = new THREE.Vector3();
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  baseZ = isMobile() ? 13 : 9;
  camera.updateProjectionMatrix();
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (baseZ + 7);
  gz.set(0, -0.56 * half, -7);           // matches the horizon line of the desert scene
  mushRig.position.copy(gz);
  mMat.uniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
window.addEventListener('resize', layout);
layout();

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
const tlFill = $('tlFill'), flash = $('flash'), shock = $('shock'), outro = $('outro'), cue = $('cue');
const reticle = $('reticle'), reticleZoom = $('reticleZoom');

function dronePose(sv, out) {
  // fly in, hold for release, then climb away banking
  const a = easeOut(range(sv, 0, 0.5));
  const b = easeIn(range(sv, 0.58, 1.3));
  out.pos.set(lerp(-10, -0.2, a) + b * 11, lerp(1.6, 1.0, a) + b * 4.5, lerp(-2, 0, a) - b * 3);
  out.rot.set(lerp(0.7, 0.42, a) + b * 0.5, lerp(-0.5, -0.2, a) + b * 0.3, b * 0.5);
}
const dp = { pos: new THREE.Vector3(), rot: new THREE.Euler() };

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const now = performance.now() / 1000;

  s = damp(s, readScroll(), reduced ? 20 : 4.5, dt);
  const sv = s;
  const mobile = isMobile();
  const beat = Math.min(7, Math.floor(sv));
  showBeat(beat, now);
  updateTyping(now);
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
      Math.sin(time * 1.3) * 0.05 * calm * (1 - ex) + mouse.y * 0.08 * ex * calm,
      (Math.sin(time * 0.28) * 0.2 + mouse.x * 0.15) * ex * calm,
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
    m.opacity = 1 - scan * 0.84;
    m.depthWrite = scan < 0.3;
  });
  if (focusKey && parts[focusKey].xray) parts[focusKey].mats.forEach((m) => { m.opacity = Math.max(m.opacity, 0.92); });
  wireMat.opacity = scan * 0.55;
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
  hud.scan.textContent = focusKey ? `FOCUS · ${INFO[focusKey].code}` : scan > 0.5 ? 'SCAN · LIVE' : 'SCAN · OFF';
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
  tmpV.set(mouse.x * 0.35 * (1 - fw), startLook + 0.1 - mouse.y * 0.2 * (1 - fw), baseZ);
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
  const sh = (speedShake * (1 - focusAmt) + impactShake);
  shakeT += dt * 60;
  const sx = (Math.sin(shakeT * 1.7) + Math.sin(shakeT * 2.9)) * sh;
  const sy = (Math.cos(shakeT * 2.3) + Math.sin(shakeT * 3.7)) * sh;
  camera.position.x += sx; camera.position.y += sy;
  camera.lookAt(camLook);
  document.documentElement.style.setProperty('--shake-x', `${(sx * 60).toFixed(1)}px`);
  document.documentElement.style.setProperty('--shake-y', `${(sy * 60).toFixed(1)}px`);
  world.style.filter = focusAmt > 0.02 ? `blur(${(focusAmt * 5).toFixed(1)}px) brightness(${(1 - focusAmt * 0.3).toFixed(2)})` : '';

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
  stMat.opacity = after ? 0 : Math.min(0.6, 0.1 + fallT * 0.25 + terminal * 0.5) * (1 - focusAmt * 0.8);

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
  const ringK = range(sv, IMPACT + 0.02, IMPACT + 0.6);
  shock.style.setProperty('--ring', (easeOut(ringK) * 3.2).toFixed(3));
  shock.style.setProperty('--ring-o', (ringK > 0 && ringK < 1 ? 1 - ringK : 0).toFixed(3));
  mushroom.visible = after;
  if (after) updateMushroom(e, range(sv, IMPACT, IMPACT + 0.05), time);
  else fireball.material.opacity = 0;
  const boomGlow = after ? lerp(1, 0.45, e) : terminal * 0.15;
  updateWorld(sv, boomGlow);
  outro.classList.toggle('on', sv > 7.45);
  document.body.classList.toggle('outro-on', sv > 7.3);

  // ---- HUD ----
  const T = released ? fallT * FALL_SECONDS : -20 * (1 - sv / RELEASE);
  const tt = Math.abs(T);
  hud.t.textContent = `${T < 0 ? '−' : '+'}${String(Math.floor(tt / 60)).padStart(2, '0')}:${(tt % 60).toFixed(1).padStart(4, '0')}`;
  const alt = 18000 * (1 - Math.pow(fallT, 1.25));
  hud.alt.textContent = Math.round(alt).toLocaleString('en-IN').replace(/,/g, ' ');
  const vel = released ? 295 * (1 - Math.exp(-(fallT * FALL_SECONDS) / 11)) + Math.sin(time * 7) * 2 : 0;
  hud.vel.textContent = String(Math.max(0, Math.round(vel))).padStart(3, '0');
  hud.bar.style.top = `${(1 - alt / 18000) * 100}%`;
  tlFill.style.height = `${(Math.min(sv, 7) / 7) * 100}%`;
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
    const x = (tmpV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
    t.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
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
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);

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
      renderer.setScissorTest(true);
      renderer.setScissor(r.left, y, r.width, r.height);
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setClearColor(0x050b16, 1);
      renderer.clear();
      renderer.render(scene, zoomCam);
      renderer.setClearColor(0x000000, 0);
      renderer.setScissorTest(false);
    }
  }

  requestAnimationFrame(tick);
}

/* =========================================================
   Boot sequence
   ========================================================= */
const BOOT = [
  'SPREAD WINGS // GROUND STATION <b>NEST</b>',
  '> link KESTREL-07 ............ <b>OK</b>',
  '> airframe EG-50/HX .......... <b>NOMINAL</b>',
  '> payload SUNDOWN ............ <b>ON PYLON</b>',
  '> scan head .................. <b>STANDBY</b>',
  '> altitude ................... <b>18 000 m</b>',
  '> recording .................. <b>●</b>',
];
const bootLog = $('bootLog'), bootBar = $('bootBar');
let bl = 0;
const bootTimer = setInterval(() => {
  bootLog.innerHTML = BOOT.slice(0, ++bl).join('\n');
  bootBar.style.width = `${(bl / BOOT.length) * 100}%`;
  if (bl >= BOOT.length) {
    clearInterval(bootTimer);
    setTimeout(() => $('boot').classList.add('done'), 450);
  }
}, reduced ? 40 : 190);

tick();
