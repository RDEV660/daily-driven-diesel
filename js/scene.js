// =========================================================
// Daily Driven Diesel — 3D stage (Three.js)
// Silver & black studio turbocharger: billet compressor wheel,
// cast-aluminium compressor housing, ceramic-black turbine housing,
// wastegate actuator, braided oil line. Drag-to-rotate, scroll
// choreography, exploded teardown, adaptive quality.
// =========================================================
import * as THREE from 'three';

const { lerp, clamp, smoothstep } = THREE.MathUtils;
const TAU = Math.PI * 2;

export function initScene({ canvas, state, labelsEl }) {
  const mqMobile = window.matchMedia('(max-width: 820px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isMobile = mqMobile.matches;

  // ---------- Renderer (native MSAA — zero post-processing artifacts) ----------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  let maxDpr = isMobile ? 1.5 : 2.0;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050506);
  scene.fog = new THREE.FogExp2(0x050506, 0.045);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = buildStudioEnv();

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0.3, 7.2);

  // ---------- Lights (neutral / silver studio lighting) ----------
  scene.add(new THREE.HemisphereLight(0x9aa0a8, 0x08080a, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(3.5, 5, 4.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdce4f2, 2.2);
  rim.position.set(-5, 3, -4);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffffff, 1.1);
  rim2.position.set(5, -1.5, -3);
  scene.add(rim2);

  // ---------- Procedural textures ----------
  const castTex = makeCastTexture();
  castTex.wrapS = castTex.wrapT = THREE.RepeatWrapping;
  castTex.repeat.set(6, 3);
  const braidTex = makeBraidTexture();
  braidTex.wrapS = braidTex.wrapT = THREE.RepeatWrapping;
  braidTex.repeat.set(60, 2);

  // ---------- Materials ----------
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const M = {
    billet: std({ color: 0xf4f6fa, emissive: 0x1c1e22, metalness: 0.75, roughness: 0.25 }),
    billetHub: std({ color: 0xeef1f6, emissive: 0x16181c, metalness: 0.78, roughness: 0.24 }),
    alu: std({ color: 0xc8ccd2, emissive: 0x0a0b0d, metalness: 0.82, roughness: 0.34, roughnessMap: castTex, bumpMap: castTex, bumpScale: 0.012 }),
    aluMachined: std({ color: 0xe6e9ee, emissive: 0x121417, metalness: 0.82, roughness: 0.22 }),
    chrome: std({ color: 0xffffff, emissive: 0x181a1e, metalness: 0.9, roughness: 0.14 }),
    black: std({ color: 0x1e2024, metalness: 0.6, roughness: 0.46, roughnessMap: castTex, bumpMap: castTex, bumpScale: 0.015 }),
    blackGloss: std({ color: 0x16181c, metalness: 0.75, roughness: 0.28 }),
    inconel: std({ color: 0xb8bcc4, emissive: 0x141619, metalness: 0.78, roughness: 0.28 }),
    inconelHub: std({ color: 0xb8bcc4, emissive: 0x141619, metalness: 0.78, roughness: 0.28 }),
    braid: std({ color: 0xced2d8, emissive: 0x0c0d0f, metalness: 0.82, roughness: 0.36, bumpMap: braidTex, bumpScale: 0.02 }),
    rubber: std({ color: 0x121316, metalness: 0.08, roughness: 0.65 }),
    bore: new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.DoubleSide }),
  };

  // ---------- Geometry helpers ----------
  function latheX(profile, segs = 96) {
    const pts = profile.map(([r, h]) => new THREE.Vector2(Math.max(0.002, r), h));
    const g = new THREE.LatheGeometry(pts, segs);
    g.rotateZ(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }
  function interp(profile, h) {
    if (h <= profile[0][0]) return profile[0][1];
    for (let i = 1; i < profile.length; i++) {
      if (h <= profile[i][0]) {
        const [h0, r0] = profile[i - 1];
        const [h1, r1] = profile[i];
        return lerp(r0, r1, (h - h0) / (h1 - h0));
      }
    }
    return profile[profile.length - 1][1];
  }
  function bladeGeo({ len, uMax = 1, rIn, rOut, sweep, segU = 30, segV = 10 }) {
    const g = new THREE.PlaneGeometry(1, 1, segU, segV);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) + 0.5) * uMax;
      const v = p.getY(i) + 0.5;
      p.setXYZ(i, -u * len, lerp(rIn(u), rOut(u), v), sweep(u, v));
    }
    g.computeVertexNormals();
    return g;
  }
  function ringOfBlades(geo, mat, count, offset = 0) {
    const grp = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Object3D();
      pivot.rotation.x = (i / count) * TAU + offset;
      pivot.add(new THREE.Mesh(geo, mat));
      grp.add(pivot);
    }
    return grp;
  }
  function hexBolt(scale = 1, mat = M.chrome) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 6), mat);
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.015, 28), M.aluMachined);
    washer.position.y = -0.043;
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 16), M.aluMachined);
    shank.position.y = -0.17;
    g.add(head, washer, shank);
    g.scale.setScalar(scale);
    return g;
  }
  function hollowTube(curve, radius, outer, tubular = 64) {
    const geo = new THREE.TubeGeometry(curve, tubular, radius, 40, false);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, outer));
    return g;
  }
  const UP = new THREE.Vector3(0, 1, 0);
  const ZAX = new THREE.Vector3(0, 0, 1);

  // Parametric volute (snail shell) with analytical normals — no atan2 or r=0 singularity.
  function volute({ R0, R1, s0, s1, A, gapCenter, mat }) {
    const frame = new THREE.Group();
    frame.rotation.set(-A / 2 - gapCenter, Math.PI / 2, 0);
    const segU = 160, segV = 40;
    const geo = new THREE.PlaneGeometry(1, 1, segU, segV);
    const p = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      const ang = u * A;
      const theta = v * TAU;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      const ct = Math.cos(theta), st = Math.sin(theta);
      const R = lerp(R0, R1, u);
      const s = lerp(s0, s1, Math.pow(u, 0.82));
      const r = R + ct * s;
      p.setXYZ(i, cx * r, cy * r, st * s);
      nrm.setXYZ(i, cx * ct, cy * ct, st);
    }
    p.needsUpdate = true;
    nrm.needsUpdate = true;
    geo.computeBoundingSphere();

    frame.add(new THREE.Mesh(geo, mat));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(s0, 16, 12), mat);
    cap.position.set(R0, 0, 0);
    frame.add(cap);
    const C = new THREE.Vector3(Math.cos(A) * R1, Math.sin(A) * R1, 0);
    const T = new THREE.Vector3(-Math.sin(A), Math.cos(A), 0);
    const N = new THREE.Vector3(Math.cos(A), Math.sin(A), 0);
    return { frame, C, T, N, r: s1 };
  }

  // =========================================================
  // TURBOCHARGER (axis = X). Compressor on -X, turbine on +X.
  // =========================================================
  const rig = new THREE.Group();     // scroll-driven transform
  const turbo = new THREE.Group();   // drag rotation + idle sway
  rig.add(turbo);
  scene.add(rig);
  const parts = [];

  // ---- Billet compressor wheel ----
  const hubR = (h) => interp([[0, 0.55], [0.025, 0.45], [0.07, 0.28], [0.17, 0.17], [0.3, 0.12], [0.45, 0.09], [0.56, 0.07]], h);
  const C_LEN = 0.5;
  const cOut = (t) => 0.44 + 0.24 * (1 - Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))));
  const compWheel = new THREE.Group();
  {
    compWheel.add(new THREE.Mesh(latheX([
      [0.01, -0.13], [0.14, -0.13], [0.24, -0.08], [0.67, -0.06], [0.7, -0.03], [0.69, 0.0], [0.45, 0.025],
      [0.28, 0.07], [0.17, 0.17], [0.12, 0.3], [0.09, 0.45], [0.07, 0.56], [0.04, 0.595], [0.01, 0.6],
    ]), M.billetHub));
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.09, 6).rotateZ(Math.PI / 2), M.chrome);
    nut.position.x = -0.64;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), M.chrome);
    tip.position.x = -0.69;
    compWheel.add(nut, tip);
    const rIn = (u) => Math.max(0.04, hubR(u * C_LEN) - 0.02);
    const sweep = (u, v) => 0.3 * u * u * (0.55 + 0.6 * v) - 0.02 * v;
    const full = bladeGeo({ len: C_LEN, rIn, rOut: cOut, sweep });
    const split = bladeGeo({ len: C_LEN, uMax: 0.62, rIn, rOut: cOut, sweep, segU: 20 });
    compWheel.add(ringOfBlades(full, M.billet, 6));
    compWheel.add(ringOfBlades(split, M.billet, 6, Math.PI / 6));
  }
  compWheel.position.x = -0.62;
  turbo.add(compWheel);

  // ---- Compressor housing (cast aluminium) ----
  const compHousing = new THREE.Group();
  {
    const inner = [];
    for (let i = 0; i <= 16; i++) { const t = 1 - i / 16; inner.push([cOut(t) + 0.025, t * C_LEN]); }
    const prof = [
      [0.74, -0.04], [1.0, -0.04], [1.0, 0.02], [0.9, 0.16], [0.74, 0.3], [0.65, 0.46], [0.62, 0.7],
      [0.64, 0.82], [0.7, 0.86], [0.7, 0.93], [0.64, 0.97], [0.52, 0.98], [0.47, 0.94],
      [cOut(1) + 0.025, 0.6], ...inner.slice(1), [0.74, -0.04],
    ];
    compHousing.add(new THREE.Mesh(latheX(prof), M.alu));
    const face = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.06, 16, 96).rotateY(Math.PI / 2), M.aluMachined);
    face.position.x = -0.955;
    compHousing.add(face);

    const v = volute({ R0: 0.98, R1: 1.24, s0: 0.06, s1: 0.36, A: TAU * 0.93, gapCenter: Math.PI / 2, mat: M.alu });
    v.frame.position.x = 0.04;
    compHousing.add(v.frame);
    const P0 = v.C.clone();
    const P1 = v.C.clone().addScaledVector(v.T, 0.5);
    const P2 = v.C.clone().addScaledVector(v.T, 0.95).addScaledVector(v.N, 0.18);
    const curve = new THREE.QuadraticBezierCurve3(P0, P1, P2);
    v.frame.add(hollowTube(curve, v.r, M.alu));
    const endT = P2.clone().sub(P1).normalize();
    const bead = new THREE.Mesh(new THREE.TorusGeometry(v.r + 0.01, 0.035, 14, 64), M.aluMachined);
    bead.quaternion.setFromUnitVectors(ZAX, endT);
    bead.position.copy(P2).addScaledVector(endT, -0.06);
    const boreCap = new THREE.Mesh(new THREE.CircleGeometry(v.r * 0.92, 32), M.bore);
    boreCap.quaternion.setFromUnitVectors(ZAX, endT);
    boreCap.position.copy(P2).addScaledVector(endT, -0.08);
    v.frame.add(bead, boreCap);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.645, 0.03, 12, 96).rotateY(Math.PI / 2), M.chrome);
    band.position.x = -0.78;
    compHousing.add(band);
  }
  compHousing.position.x = -0.62;
  turbo.add(compHousing);

  // ---- Back plate ----
  const backPlate = new THREE.Group();
  {
    backPlate.add(new THREE.Mesh(latheX([[0.06, -0.05], [1.02, -0.05], [1.05, 0.0], [1.02, 0.05], [0.06, 0.05]]), M.aluMachined));
    for (let i = 0; i < 8; i++) {
      const b = hexBolt(0.5);
      const a = (i / 8) * TAU + 0.2;
      b.rotation.z = Math.PI / 2;
      b.position.set(-0.07, Math.cos(a) * 0.9, Math.sin(a) * 0.9);
      backPlate.add(b);
    }
  }
  backPlate.position.x = -0.5;
  turbo.add(backPlate);

  // ---- Center housing (CHRA) ----
  const chra = new THREE.Group();
  {
    chra.add(new THREE.Mesh(latheX([
      [0.06, -0.42], [0.5, -0.42], [0.5, -0.32], [0.42, -0.26], [0.42, -0.2], [0.45, -0.17], [0.45, -0.13], [0.38, -0.1], [0.38, 0.1],
      [0.45, 0.13], [0.45, 0.17], [0.42, 0.2], [0.42, 0.26], [0.36, 0.32], [0.36, 0.4], [0.3, 0.45], [0.06, 0.45],
    ]), M.blackGloss));
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.26, 24), M.black);
    feed.position.y = 0.5;
    const an = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 6), M.chrome);
    an.position.y = 0.66;
    const oilCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.68, 0), new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(0.08, 1.25, -0.35),
      new THREE.Vector3(0.25, 1.45, -1.05), new THREE.Vector3(0.4, 1.5, -1.9),
    ]);
    const oil = new THREE.Mesh(new THREE.TubeGeometry(oilCurve, 80, 0.05, 16, false), M.braid);
    const drain = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.34), M.black);
    drain.position.y = -0.47;
    const drainFl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.44), M.aluMachined);
    drainFl.position.y = -0.57;
    const drainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.58, 0), new THREE.Vector3(0, -0.85, 0), new THREE.Vector3(-0.05, -1.2, -0.25), new THREE.Vector3(-0.1, -1.7, -0.6),
    ]);
    const drainHose = new THREE.Mesh(new THREE.TubeGeometry(drainCurve, 48, 0.09, 18, false), M.rubber);
    const clamp1 = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 10, 32).rotateX(Math.PI / 2), M.chrome);
    clamp1.position.y = -0.72;
    chra.add(feed, an, oil, drain, drainFl, drainHose, clamp1);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 16).rotateZ(Math.PI / 2), M.chrome);
    shaft.position.x = -0.05;
    chra.add(shaft);
  }
  turbo.add(chra);

  // ---- Turbine wheel (inconel) ----
  const turbWheel = new THREE.Group();
  {
    const inner = new THREE.Group();
    inner.add(new THREE.Mesh(latheX([
      [0.01, -0.08], [0.16, -0.08], [0.55, -0.06], [0.6, -0.03], [0.56, 0.01], [0.34, 0.05], [0.2, 0.12], [0.14, 0.24], [0.11, 0.36], [0.08, 0.42], [0.01, 0.42],
    ]), M.inconelHub));
    const tIn = (u) => interp([[0, 0.5], [0.05, 0.3], [0.12, 0.2], [0.24, 0.14], [0.36, 0.11], [0.42, 0.08]], u * 0.4) - 0.03;
    const tOut = (u) => lerp(0.58, 0.44, Math.pow(u, 0.7));
    const tb = bladeGeo({ len: 0.4, rIn: tIn, rOut: tOut, sweep: (u, v) => 0.2 * u * u * (0.5 + 0.6 * v) });
    inner.add(ringOfBlades(tb, M.inconel, 12, 0, 0.014));
    inner.rotation.y = Math.PI;
    turbWheel.add(inner);
  }
  turbWheel.position.x = 0.6;
  turbo.add(turbWheel);

  // ---- Turbine housing (ceramic black) ----
  const turbHousing = new THREE.Group();
  {
    const prof = [
      [0.62, -0.02], [1.02, -0.04], [1.06, 0.04], [0.92, 0.16], [0.72, 0.3], [0.6, 0.46], [0.58, 0.66], [0.66, 0.7], [0.66, 0.8], [0.58, 0.84], [0.44, 0.84],
      [0.46, 0.44], [0.6, 0.06], [0.62, -0.02],
    ];
    const g = latheX(prof);
    g.rotateY(Math.PI);
    turbHousing.add(new THREE.Mesh(g, M.black));

    const v = volute({ R0: 1.0, R1: 1.24, s0: 0.06, s1: 0.38, A: TAU * 0.92, gapCenter: Math.PI * 1.5, mat: M.black });
    v.frame.position.x = 0.12;
    turbHousing.add(v.frame);
    const P0 = v.C.clone();
    const P1 = v.C.clone().addScaledVector(v.T, 0.45);
    const P2 = v.C.clone().addScaledVector(v.T, 0.6).addScaledVector(v.N, 0.5);
    v.frame.add(hollowTube(new THREE.QuadraticBezierCurve3(P0, P1, P2), v.r, M.black));
    const endT = P2.clone().sub(P1).normalize();
    const flange = new THREE.Group();
    flange.quaternion.setFromUnitVectors(UP, endT);
    flange.position.copy(P2);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), M.black);
    flange.add(plate);
    [[0.36, 0.36], [-0.36, 0.36], [0.36, -0.36], [-0.36, -0.36]].forEach(([x, z]) => {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12), M.aluMachined);
      stud.position.set(x, 0.12, z);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 6), M.chrome);
      nut.position.set(x, 0.09, z);
      flange.add(stud, nut);
    });
    v.frame.add(flange);
    const outFl = new THREE.Mesh(latheX([[0.44, -0.04], [0.72, -0.04], [0.72, 0.04], [0.44, 0.04]]), M.black);
    outFl.position.x = 0.84;
    const vband = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.055, 16, 96).rotateY(Math.PI / 2), M.chrome);
    vband.position.x = 0.86;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.26), M.chrome);
    latch.position.set(0.86, 0.8, 0);
    const latchBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10).rotateX(Math.PI / 2), M.aluMachined);
    latchBolt.position.set(0.86, 0.84, 0);
    turbHousing.add(outFl, vband, latch, latchBolt);
  }
  turbHousing.position.x = 0.6;
  turbo.add(turbHousing);

  // ---- Wastegate actuator ----
  const wastegate = new THREE.Group();
  {
    const can = new THREE.Mesh(latheX([
      [0.01, -0.22], [0.2, -0.22], [0.27, -0.18], [0.29, -0.06], [0.3, -0.02], [0.3, 0.02], [0.29, 0.06], [0.27, 0.13], [0.2, 0.19], [0.08, 0.21], [0.01, 0.21],
    ], 64), M.aluMachined);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 10, 64).rotateY(Math.PI / 2), M.chrome);
    const nipple = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10).rotateZ(Math.PI / 2), M.chrome);
    nipple.position.x = -0.26;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 12).rotateZ(Math.PI / 2), M.chrome);
    rod.position.x = 0.45;
    const rodEnd = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), M.chrome);
    rodEnd.position.x = 0.7;
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.32, 0, 0), new THREE.Vector3(-0.45, 0.02, 0.05), new THREE.Vector3(-0.55, 0.3, 0.05), new THREE.Vector3(-0.6, 0.55, -0.05),
    ]);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 32, 0.03, 10, false), M.rubber);
    wastegate.add(can, seam, nipple, rod, rodEnd, hose);
  }
  wastegate.position.set(-0.02, -0.5, 1.02);
  turbo.add(wastegate);

  function reg(obj, explode) {
    parts.push({ obj, base: obj.position.clone(), explode });
  }
  reg(compHousing, new THREE.Vector3(-1.55, 0.1, 0));
  reg(compWheel, new THREE.Vector3(-0.85, 0, 0));
  reg(backPlate, new THREE.Vector3(-0.42, 0, 0));
  reg(chra, new THREE.Vector3(0, 0.05, -0.2));
  reg(turbWheel, new THREE.Vector3(0.85, 0, 0));
  reg(turbHousing, new THREE.Vector3(1.55, -0.1, 0));
  reg(wastegate, new THREE.Vector3(0, -0.55, 0.55));
  if (labelsEl) labelsEl.innerHTML = '';
  turbo.position.x = -0.05;

  // =========================================================
  // Waving distressed flag (far background plane z = -5)
  // =========================================================
  const flagTex = new THREE.CanvasTexture(makeFlagCanvas());
  flagTex.colorSpace = THREE.SRGBColorSpace;
  flagTex.anisotropy = 4;
  const flagMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: flagTex }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color(0x3a3d42) } },
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec2 vUv; varying float vShade;
      void main(){
        vUv = uv;
        vec3 p = position;
        float pin = smoothstep(-5.0, -2.0, p.x) * 0.8 + 0.2;
        float a = p.x * 0.9 - uTime * 1.2;
        float b = p.x * 1.9 + p.y * 1.2 - uTime * 1.7;
        p.z += (sin(a) * 0.3 + sin(b) * 0.1) * pin;
        p.y += sin(a * 0.5) * 0.05 * pin;
        vShade = 0.72 + (cos(a) * 0.27 + cos(b) * 0.19) * pin * 0.6;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform float uOpacity; uniform vec3 uColor;
      varying vec2 vUv; varying float vShade;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        float a = t.a * uOpacity;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor * vShade, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.5, 120, 60), flagMat);
  flag.position.set(0.4, 0.4, -5);
  scene.add(flag);

  // =========================================================
  // Silver background dust (strictly behind the 3D turbo, valid GLSL smoothstep)
  // =========================================================
  const rand = mulberry32(19);
  const DUST = isMobile ? 120 : 220;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST), dSize = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dPos[i * 3] = (rand() - 0.5) * 16;
    dPos[i * 3 + 1] = (rand() - 0.5) * 10;
    dPos[i * 3 + 2] = -7.5 + rand() * 5.0; // strictly behind turbo (z in [-7.5, -2.5])
    dSeed[i] = rand();
    dSize[i] = 0.6 + Math.pow(rand(), 2.5) * 1.8;
  }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
  dGeo.setAttribute('aSize', new THREE.BufferAttribute(dSize, 1));
  const dMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRise: { value: 0 }, uPR: { value: dpr }, uBoost: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uRise; uniform float uPR; uniform float uBoost;
      attribute float aSeed; attribute float aSize;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + 5.0 + uRise * (0.3 + aSeed * 0.7), 10.0) - 5.0;
        p.x += sin(uTime * 0.4 + aSeed * 40.0) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPR * (6.5 / max(1.5, -mv.z)), 1.0, 10.0);
        float life = smoothstep(-5.0, -3.5, p.y) * (1.0 - smoothstep(3.0, 5.0, p.y));
        vAlpha = life * (0.3 + 0.3 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 60.0)) * (0.65 + uBoost * 0.5);
      }`,
    fragmentShader: /* glsl */`
      varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = 1.0 - smoothstep(0.0, 0.5, d);
        float alpha = a * a * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vec3(0.85, 0.88, 0.93), alpha);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dGeo, dMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // =========================================================
  // Scroll choreography
  // =========================================================
  const KF = [
    { sel: '#hero', a: 0, d: { x: 1.65, y: -0.05, z: 0, rx: 0.3, ry: -0.75, rz: 0.06, s: 0.9, ex: 0, flag: 1 }, m: { x: 0, y: 1.05, z: -0.6, rx: 0.3, ry: -0.75, rz: 0.08, s: 0.72, ex: 0, flag: 1 } },
    { sel: '#services', a: 0.25, d: { x: 2.7, y: 0.9, z: -1.2, rx: 0.55, ry: -1.6, rz: 0.15, s: 0.85, ex: 0.1, flag: 0.35 }, m: { x: 1.2, y: 2.2, z: -2, rx: 0.5, ry: -1.5, rz: 0.2, s: 0.6, ex: 0.1, flag: 0.3 } },
    { sel: '#teardown', a: 0.0, d: { x: 0.75, y: -0.45, z: 0, rx: 0.38, ry: -0.42, rz: 0.0, s: 0.78, ex: 0.0, flag: 0.2 }, m: { x: 0, y: -0.4, z: -1.2, rx: 0.45, ry: -0.45, rz: 0, s: 0.62, ex: 0, flag: 0.2 } },
    { sel: '#teardown', a: 0.45, d: { x: 0.95, y: -0.55, z: 0, rx: 0.34, ry: -0.34, rz: 0.0, s: 0.68, ex: 1.0, flag: 0.2 }, m: { x: 0, y: -0.5, z: -1.4, rx: 0.4, ry: -0.95, rz: 0, s: 0.55, ex: 1, flag: 0.2 } },
    { sel: '#teardown', a: 1.0, d: { x: 0.95, y: -0.55, z: 0, rx: 0.18, ry: -0.12, rz: 0.0, s: 0.68, ex: 1.0, flag: 0.2 }, m: { x: 0, y: -0.5, z: -1.4, rx: 0.2, ry: -0.6, rz: 0, s: 0.55, ex: 1, flag: 0.2 } },
    { sel: '#process', a: 0.2, d: { x: -2.3, y: 0.7, z: -1.0, rx: 0.4, ry: 0.9, rz: -0.1, s: 0.85, ex: 0.0, flag: 0.5 }, m: { x: -1.0, y: 2.2, z: -2, rx: 0.4, ry: 0.9, rz: -0.1, s: 0.55, ex: 0, flag: 0.4 } },
    { sel: '#visit', a: 0.2, d: { x: 3.4, y: 1.7, z: -2.6, rx: 0.3, ry: 2.2, rz: 0.1, s: 0.62, ex: 0, flag: 0.5 }, m: { x: 1.2, y: 2.6, z: -2.5, rx: 0.3, ry: 2.2, rz: 0.1, s: 0.5, ex: 0, flag: 0.4 } },
    { sel: '#contact', a: 0.5, d: { x: 0, y: -2.2, z: -0.4, rx: 0.5, ry: TAU - 0.62, rz: 0.0, s: 1.0, ex: 0, flag: 1 }, m: { x: 0, y: -2.9, z: -1.2, rx: 0.55, ry: TAU - 0.7, rz: 0, s: 0.7, ex: 0, flag: 1 } },
  ];
  const keys = ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'ex', 'flag'];
  let kfPos = [];
  function measure() {
    const vh = window.innerHeight;
    kfPos = KF.map((k) => {
      const el = document.querySelector(k.sel);
      if (!el) return 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      return top + k.a * Math.max(0, el.offsetHeight - vh);
    });
  }
  measure();
  const cur = { ...KF[0][isMobile ? 'm' : 'd'] };
  const tgt = { ...cur };
  function computeTarget(y) {
    const set = isMobile ? 'm' : 'd';
    let i = 0;
    while (i < KF.length - 1 && y >= kfPos[i + 1]) i++;
    const a = KF[i][set];
    const b = KF[Math.min(i + 1, KF.length - 1)][set];
    const span = (kfPos[i + 1] ?? kfPos[i]) - kfPos[i];
    let t = span > 0 ? clamp((y - kfPos[i]) / span, 0, 1) : 0;
    t = t * t * (3 - 2 * t);
    for (const k of keys) tgt[k] = lerp(a[k], b[k], t);
  }
  const tdEl = document.querySelector('#teardown');
  new ResizeObserver(() => measure()).observe(document.body);
  if (document.fonts) document.fonts.ready.then(measure);

  // =========================================================
  // Drag to rotate (mouse: both axes; touch: horizontal, vertical still scrolls)
  // =========================================================
  const drag = { active: false, id: null, type: 'mouse', lx: 0, ly: 0, yaw: 0, pitch: 0, vy: 0, vp: 0, releasedAt: -1e9 };
  const blocked = (el) => el.closest('a,button,input,textarea,select,iframe,label,[data-tilt],.visit-card,.step,.nav');
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (!e.target.closest('[data-drag]') || blocked(e.target)) return;
    drag.active = true; drag.id = e.pointerId; drag.type = e.pointerType;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.vy = 0; drag.vp = 0;
    if (e.pointerType === 'mouse') e.preventDefault();
    document.body.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    drag.lx = e.clientX; drag.ly = e.clientY;
    const k = drag.type === 'mouse' ? 0.008 : 0.012;
    drag.vy = dx * k;
    drag.vp = drag.type === 'mouse' ? dy * k : 0;
    drag.yaw += drag.vy;
    drag.pitch = clamp(drag.pitch + drag.vp, -0.9, 0.9);
    if (Math.abs(dx) > 2 && !state.dragged) { state.dragged = true; state.onDrag && state.onDrag(); }
  }, { passive: true });
  const endDrag = (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    drag.active = false;
    drag.releasedAt = performance.now();
    document.body.classList.remove('is-dragging');
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // ---------- Pointer parallax ----------
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // ---------- Resize (ignore mobile URL-bar height jitter) ----------
  let lastW = window.innerWidth, lastH = window.innerHeight;
  function resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 160 && isMobile) return;
    lastW = w; lastH = h;
    isMobile = mqMobile.matches;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = isMobile ? 42 : 35;
    camera.updateProjectionMatrix();
    dMat.uniforms.uPR.value = dpr;
    measure();
  }
  window.addEventListener('resize', () => resize(false));
  resize(true);

  // ---------- Adaptive quality ----------
  let tier = 0, fAcc = 0, fN = 0, warm = 0;
  function adapt(dt) {
    warm += dt;
    if (warm < 3) return;
    fAcc += dt; fN++;
    if (fAcc < 2) return;
    const avg = fAcc / fN; fAcc = 0; fN = 0;
    if (avg > 1 / 45 && tier < 3) {
      tier++;
      if (tier === 1) dpr = Math.min(dpr, 1.25);
      if (tier === 2) dpr = 1;
      if (tier === 3) { dpr = 0.85; dust.visible = false; }
      resize(true);
    }
  }

  // Pre-compile shaders to avoid a first-frame hitch
  renderer.compile(scene, camera);

  // =========================================================
  // Loop
  // =========================================================
  const clock = new THREE.Clock();
  let spool = 0, wheelAngle = 0, firstFrame = true;
  const tmpV = new THREE.Vector3();

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    adapt(dt);

    const sy = window.scrollY;
    computeTarget(sy);
    const ease = 1 - Math.exp(-dt * (reduceMotion ? 20 : 3.0));
    for (const k of keys) cur[k] = lerp(cur[k], tgt[k], ease);

    // spool
    const want = clamp(state.boostTarget, 0, 1);
    spool += (want - spool) * (1 - Math.exp(-dt * (want > spool ? 1.9 : 1.2)));
    state.spool = spool;

    // rig
    rig.position.set(cur.x, cur.y, cur.z);
    rig.rotation.set(cur.rx, cur.ry, cur.rz);
    rig.scale.setScalar(cur.s);

    // drag inertia + gentle return to the designed pose
    if (!drag.active) {
      const damp = Math.pow(0.9, dt * 60);
      drag.yaw += drag.vy; drag.vy *= damp;
      drag.pitch = clamp(drag.pitch + drag.vp, -0.9, 0.9); drag.vp *= damp;
      if (performance.now() - drag.releasedAt > 2500) {
        const home = Math.round(drag.yaw / TAU) * TAU;
        drag.yaw = lerp(drag.yaw, home, 1 - Math.exp(-dt * 1.4));
        drag.pitch = lerp(drag.pitch, 0, 1 - Math.exp(-dt * 1.4));
      }
    }
    const sway = reduceMotion ? 0 : 1;
    const shake = spool * spool * 0.012;
    const n1 = Math.sin(t * 53.1) * 0.6 + Math.sin(t * 77.7) * 0.4;
    const n2 = Math.sin(t * 61.3) * 0.6 + Math.sin(t * 89.9) * 0.4;
    turbo.rotation.set(Math.sin(t * 0.27) * 0.035 * sway + drag.pitch, Math.sin(t * 0.33) * 0.07 * sway + drag.yaw, 0);
    turbo.position.set(-0.05 + n1 * shake, Math.sin(t * 0.8) * 0.045 * sway + n2 * shake, 0);

    // wheels
    const omega = (reduceMotion ? 0.5 : 1.8) + spool * 26;
    wheelAngle += omega * dt;
    compWheel.rotation.x = wheelAngle;
    turbWheel.rotation.x = -wheelAngle;

    // explode
    const ex = smoothstep(cur.ex, 0, 1);
    for (const p of parts) p.obj.position.copy(p.base).addScaledVector(p.explode, ex);

    if (tdEl) {
      const r = tdEl.getBoundingClientRect();
      const h = window.innerHeight;
      state.teardown = clamp((-r.top / Math.max(1, r.height - h)) * 2.2, 0, 1);
    }

    // flag
    flagMat.uniforms.uTime.value = t;
    flagMat.uniforms.uOpacity.value = cur.flag;

    // dust
    dMat.uniforms.uTime.value = t;
    dMat.uniforms.uRise.value += dt * (reduceMotion ? 0.05 : 0.22 + spool * 2.2);
    dMat.uniforms.uBoost.value = spool;

    // camera parallax
    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 2.2));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 2.2));
    camera.position.set(pointer.sx * 0.4, 0.3 - pointer.sy * 0.25, (isMobile ? 7.6 : 7.2) - spool * 0.3);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    if (firstFrame) { firstFrame = false; state.onReady && state.onReady(); }
  }
  renderer.setAnimationLoop(tick);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.setAnimationLoop(null);
    else { clock.getDelta(); renderer.setAnimationLoop(tick); }
  });

  return { measure };

  // ---------- Studio environment (softboxes) ----------
  function buildStudioEnv() {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x24272c);
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 18, 30), new THREE.MeshBasicMaterial({ color: 0x24272c, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(20, 4, 0, 8, 0, 3.8);         // wide overhead strip
    panel(4, 12, -12, 2, 4, 3.0);       // left tall softbox
    panel(4, 12, 12, 2, -4, 2.6);       // right tall softbox
    panel(12, 7, 2, 3, 13, 1.8);        // front key fill
    panel(14, 6, 0, 1, -13, 1.2);       // back fill
    panel(24, 4, 0, -8, 3, 0.9);        // floor bounce
    panel(3, 8, -6, -2, -11, 2.0);      // rim kicker
    const tex = pmrem.fromScene(env, 0.035).texture;
    return tex;
  }
}

// ---------- Procedural textures ----------
function makeCastTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d0d0d0';
  g.fillRect(0, 0, 256, 256);
  const r = mulberry32(3);
  for (let i = 0; i < 9000; i++) {
    const v = 150 + Math.floor(r() * 105);
    g.fillStyle = `rgb(${v},${v},${v})`;
    const s = 0.6 + r() * 1.6;
    g.fillRect(r() * 256, r() * 256, s, s);
  }
  g.globalAlpha = 0.08;
  for (let i = 0; i < 120; i++) {
    const v = r() > 0.5 ? 255 : 120;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 14, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}
function makeBraidTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 64, 64);
  g.lineWidth = 5;
  for (let i = -64; i < 128; i += 10) {
    g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke();
    g.strokeStyle = '#303030'; g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function makeFlagCanvas() {
  const W = 1400, H = 770;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = mulberry32(7);
  const sh = H / 13;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 13; i += 2) {
    const y = i * sh;
    const x0 = i < 7 ? W * 0.4 : 30;
    const endX = W - 40 - r() * 260;
    g.beginPath();
    g.moveTo(x0, y + r() * 3);
    let x = x0;
    while (x < endX) { x += 30 + r() * 60; g.lineTo(Math.min(x, endX), y + (r() - 0.5) * 6); }
    g.lineTo(endX + r() * 60, y + sh * 0.3);
    g.lineTo(endX - r() * 30, y + sh * 0.55);
    g.lineTo(endX + r() * 40, y + sh * 0.8);
    x = endX;
    while (x > x0) { x -= 30 + r() * 60; g.lineTo(Math.max(x, x0 - 10), y + sh + (r() - 0.5) * 6); }
    g.closePath();
    g.fill();
  }
  const cw = W * 0.4, ch = sh * 7;
  g.beginPath();
  g.moveTo(10, 4);
  for (let x = 10; x < cw; x += 40) g.lineTo(x, 2 + r() * 6);
  g.lineTo(cw + 4, 0); g.lineTo(cw + 4, ch);
  for (let x = cw; x > 10; x -= 40) g.lineTo(x, ch + (r() - 0.5) * 6);
  for (let y = ch; y > 0; y -= 30) g.lineTo(r() * 26, y);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let rI = 0; rI < 9; rI++) {
    const n = rI % 2 ? 5 : 6;
    for (let k = 0; k < n; k++) {
      star(g, (cw / 6) * (k + (rI % 2 ? 1 : 0.5)), (ch / 9.6) * (rI + 0.8), ch / 24, ch / 52);
    }
  }
  for (let i = 0; i < 900; i++) {
    const x = Math.pow(r(), 0.6) * W;
    const y = r() * H;
    const edge = x / W;
    if (r() > 0.25 + edge * 0.6) continue;
    g.beginPath();
    g.ellipse(x, y, 1 + r() * (4 + edge * 16), 0.6 + r() * 2.5, r() * 0.4 - 0.2, 0, Math.PI * 2);
    g.fill();
  }
  for (let y = 0; y < H; y += 6) {
    g.beginPath(); g.ellipse(0, y, 8 + r() * 40, 2 + r() * 5, 0, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}
function star(g, cx, cy, R, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    i ? g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad) : g.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
