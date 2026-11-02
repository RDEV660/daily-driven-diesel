// =========================================================
// Daily Driven Diesel — UI / interactions
// =========================================================
const state = { boostTarget: 0, spool: 0, teardown: 0, onReady: null, dragged: false, onDrag: null };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
state.onDrag = () => { const h = $('#dragHint'); if (h) h.classList.add('is-gone'); };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

document.body.classList.add('is-loading');
$('#year').textContent = new Date().getFullYear();

// ---------- Loader ----------
const loader = $('#loader');
const loaderFill = $('#loaderFill');
const loaderText = $('#loaderText');
const loaderMsgs = ['Warming glow plugs…', 'Priming fuel system…', 'Building boost…', 'Ready to roll.'];
let fakeProgress = 0;
const loaderTimer = setInterval(() => {
  fakeProgress = Math.min(fakeProgress + Math.random() * 18, 88);
  loaderFill.style.width = fakeProgress + '%';
  loaderText.textContent = loaderMsgs[Math.min(2, Math.floor(fakeProgress / 30))];
}, 160);
const t0 = performance.now();
let revealed = false;
function reveal() {
  if (revealed) return;
  revealed = true;
  clearInterval(loaderTimer);
  loaderFill.style.width = '100%';
  loaderText.textContent = loaderMsgs[3];
  const wait = Math.max(0, 1100 - (performance.now() - t0));
  setTimeout(() => {
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.documentElement.classList.add('is-ready');
    document.body.classList.add('is-ready');
  }, wait + 250);
}
state.onReady = () => (document.fonts ? document.fonts.ready.then(reveal) : reveal());
setTimeout(reveal, 7000); // safety net

// ---------- 3D scene ----------
let sceneApi = null;
(async () => {
  try {
    const test = document.createElement('canvas');
    if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('no webgl');
    const { initScene } = await import('./scene.js');
    sceneApi = initScene({ canvas: $('#scene'), state, labelsEl: $('#partLabels') });
  } catch (err) {
    console.warn('[DDD] 3D disabled:', err);
    document.body.classList.add('no-webgl');
    reveal();
  }
})();

// ---------- Nav ----------
const nav = $('#nav');
let lastY = window.scrollY;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  nav.classList.toggle('is-scrolled', y > 40);
  nav.classList.toggle('is-hidden', y > lastY && y > 600);
  lastY = y;
}, { passive: true });

// ---------- Split headings ----------
$$('[data-split]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');
});

// ---------- Reveal on scroll ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
$$('[data-reveal], [data-split]').forEach((el) => io.observe(el));
// stagger cards
$$('.cards .card').forEach((c, i) => c.style.setProperty('--d', `${(i % 3) * 110}ms`));
$$('.specs .spec').forEach((c, i) => c.style.setProperty('--d', `${i * 90}ms`));

// ---------- Count up ----------
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target;
    const to = +el.dataset.count, from = +el.dataset.from || 0;
    if (reduceMotion) { el.textContent = to; return; }
    const start = performance.now(), dur = 1600;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => countIO.observe(el));

// ---------- Tilt cards ----------
if (finePointer && !reduceMotion) {
  $$('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.classList.add('is-tilting');
      card.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  // Magnetic buttons
  $$('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

// ---------- Open / closed status (shop time: America/Detroit) ----------
function shopNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  let h = +get('hour'); if (h === 24) h = 0;
  return { wd, mins: h * 60 + +get('minute') };
}
function updateStatus() {
  const { wd, mins } = shopNow();
  const weekday = wd >= 1 && wd <= 5;
  const open = weekday && mins >= 480 && mins < 1020;
  let text;
  if (open) {
    const left = 1020 - mins;
    text = left <= 60 ? `Open now · Closes in ${left} min` : 'Open now · Until 5PM';
  } else if (weekday && mins < 480) text = 'Closed · Opens today at 8AM';
  else if (wd >= 1 && wd <= 4) text = 'Closed · Opens tomorrow at 8AM';
  else text = 'Closed · Opens Monday at 8AM';
  $$('[data-open-status]').forEach((el) => {
    el.classList.toggle('open', open);
    el.classList.toggle('closed', !open);
    el.querySelector('.status-text').textContent = text;
  });
  $$('.hours tr').forEach((tr) => tr.classList.toggle('today', +tr.dataset.day === wd));
}
updateStatus();
setInterval(updateStatus, 30000);

// ---------- Boost gauge ----------
const gaugeTicks = $('#gaugeTicks');
for (let i = 0; i <= 10; i++) {
  const a = (-120 + i * 24) * (Math.PI / 180);
  const major = i % 2 === 0;
  const r1 = major ? 36 : 39, r2 = 43;
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  ln.setAttribute('x1', 60 + Math.sin(a) * r1); ln.setAttribute('y1', 60 - Math.cos(a) * r1);
  ln.setAttribute('x2', 60 + Math.sin(a) * r2); ln.setAttribute('y2', 60 - Math.cos(a) * r2);
  if (major) ln.setAttribute('class', 'major');
  gaugeTicks.appendChild(ln);
}
const gaugeFill = $('#gaugeFill');
const gaugeNeedle = $('#gaugeNeedle');
const gaugePsi = $('#gaugePsi');
const spoolBtn = $('#spoolBtn');
const soundBtn = $('#soundBtn');
const ARC = 209.4; // 240deg of r=50 circumference
const MAX_PSI = 45;

// ---------- Turbo audio (WebAudio, only after user gesture) ----------
let audio = null;
let soundOn = true;
function createAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  // turbo whistle (two partials)
  const w1 = ctx.createOscillator(); w1.type = 'sine'; w1.frequency.value = 900;
  const w2 = ctx.createOscillator(); w2.type = 'triangle'; w2.frequency.value = 1350;
  const wG = ctx.createGain(); wG.gain.value = 0;
  const w2G = ctx.createGain(); w2G.gain.value = 0.35;
  w1.connect(wG); w2.connect(w2G).connect(wG); wG.connect(master);

  // air rush
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
  const nG = ctx.createGain(); nG.gain.value = 0;
  noise.connect(bp).connect(nG).connect(master);

  // diesel rumble with clatter
  const rum = ctx.createOscillator(); rum.type = 'sawtooth'; rum.frequency.value = 34;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const rG = ctx.createGain(); rG.gain.value = 0.3;
  const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 11;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.12;
  lfo.connect(lfoG).connect(rG.gain);
  rum.connect(lp).connect(rG).connect(master);

  [w1, w2, noise, rum, lfo].forEach((n) => n.start());
  return { ctx, master, w1, w2, wG, bp, nG, rum, lp, lfo, rG };
}
function updateAudio(spool, held) {
  if (!audio) return;
  const { ctx } = audio;
  const now = ctx.currentTime;
  const active = soundOn && (held || spool > 0.015);
  audio.master.gain.setTargetAtTime(active ? 0.55 : 0, now, active ? 0.08 : 0.25);
  audio.w1.frequency.setTargetAtTime(700 + spool * 5600, now, 0.05);
  audio.w2.frequency.setTargetAtTime(1050 + spool * 8400, now, 0.05);
  audio.wG.gain.setTargetAtTime(0.015 + spool * spool * 0.07, now, 0.05);
  audio.bp.frequency.setTargetAtTime(500 + spool * 3200, now, 0.05);
  audio.nG.gain.setTargetAtTime(0.02 + spool * 0.16, now, 0.05);
  audio.rum.frequency.setTargetAtTime(34 + spool * 34, now, 0.08);
  audio.lp.frequency.setTargetAtTime(220 + spool * 380, now, 0.08);
  audio.lfo.frequency.setTargetAtTime(11 + spool * 22, now, 0.08);
}

let held = false;
function press(e) {
  e.preventDefault();
  held = true;
  state.boostTarget = 1;
  spoolBtn.classList.add('is-held');
  if (spoolBtn.setPointerCapture && e.pointerId != null) { try { spoolBtn.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } }
  if (soundOn) {
    if (!audio) audio = createAudio();
    if (audio && audio.ctx.state === 'suspended') audio.ctx.resume();
  }
  if (navigator.vibrate) navigator.vibrate(15);
}
function release() {
  if (!held) return;
  held = false;
  state.boostTarget = 0;
  spoolBtn.classList.remove('is-held');
}
spoolBtn.addEventListener('pointerdown', press);
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => spoolBtn.addEventListener(ev, release));
spoolBtn.addEventListener('contextmenu', (e) => e.preventDefault());
spoolBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(e); });
spoolBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') release(); });
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
});

// ---------- UI frame loop ----------
const meter = $('#teardownMeter');
const meterPct = $('#teardownPct');
let shownPsi = -1;
let fallbackSpool = 0;
function uiLoop() {
  // if 3D is unavailable, animate the gauge ourselves
  if (!sceneApi) {
    fallbackSpool += (state.boostTarget - fallbackSpool) * 0.04;
    state.spool = fallbackSpool;
  }
  const s = state.spool;
  gaugeFill.style.strokeDasharray = `${(ARC * s).toFixed(1)} 314.16`;
  gaugeNeedle.style.transform = `rotate(${-120 + 240 * s + (s > 0.05 ? (Math.random() - 0.5) * 2 * s : 0)}deg)`;
  const psi = Math.round(s * MAX_PSI);
  if (psi !== shownPsi) { gaugePsi.textContent = String(psi).padStart(2, '0'); shownPsi = psi; }
  spoolBtn.style.setProperty('--spool', s.toFixed(3));
  if (meter) {
    meter.style.transform = `scaleX(${state.teardown.toFixed(3)})`;
    meterPct.textContent = Math.round(state.teardown * 100) + '%';
  }
  updateAudio(s, held);
  requestAnimationFrame(uiLoop);
}
requestAnimationFrame(uiLoop);
