import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const host = document.getElementById('rtk3d');
if (host) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const status = host.querySelector('.status'), ov = host.querySelector('svg.ov'), L = host.querySelector('.labels');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls) => { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); ov.appendChild(e); return e; };
  const lab = (cls) => { const d = document.createElement('div'); d.className = 'lab ' + cls; L.appendChild(d); return d; };
  const WPS = [[-2.3, 1.3], [-2.3, -1.3], [3, -1.3], [3, 1.3]];
  const BASE = [3.9, -3.4];
  const SATS = [[-3.7, 3.05, -5.6, 2.5, .6, -1.1], [.9, 3.5, -7.2, 2.9, .45, -1.3], [4, 3.2, -5.6, 2.5, .5, -.95]];

  let started = false;
  const io = new IntersectionObserver(en => { if (en[0].isIntersecting && !started) { started = true; io.disconnect(); start().catch(err => { status.textContent = '3D view unavailable'; console.error(err); }); } }, { rootMargin: '500px' });
  io.observe(host);

  async function start() {
    host.querySelectorAll('a.zoom').forEach(z => z.remove());
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'gl'; renderer.domElement.style.touchAction = 'pan-y';
    host.insertBefore(renderer.domElement, ov);

    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a0c12, 11, 42);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
    const camera = new THREE.PerspectiveCamera(32, 1.6, .1, 200); camera.position.set(1.9, 2.6, 7.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(.3, 1.3, -1); controls.enableDamping = true; controls.dampingFactor = .07; controls.screenSpacePanning = false; controls.zoomSpeed = .8; controls.panSpeed = .8;
    controls.minDistance = 1.2; controls.maxDistance = 34; controls.minPolarAngle = .1; controls.maxPolarAngle = 1.52; controls.update();
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    renderer.domElement.tabIndex = 0; controls.listenToKeyEvents(renderer.domElement);
    const home = { p: camera.position.clone(), t: controls.target.clone() };
    const ctl = document.createElement('div'); ctl.className = 'ctl'; host.appendChild(ctl);
    const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); ctl.appendChild(b); return b; };
    btn('reset view', () => { camera.position.copy(home.p); controls.target.copy(home.t); controls.update(); });
    if (document.fullscreenEnabled) { const fb = btn('fullscreen', () => document.fullscreenElement === host ? document.exitFullscreen() : host.requestFullscreen()); document.addEventListener('fullscreenchange', () => { fb.textContent = document.fullscreenElement === host ? 'exit fullscreen' : 'fullscreen'; }); }
    const cap = host.querySelector('.caption'); if (cap) cap.textContent = matchMedia('(hover: none)').matches ? 'RTK localization on the rover · drag to orbit · pinch to zoom' : 'RTK localization on the rover · drag to orbit · scroll to zoom · right-drag to pan';

    const sun = new THREE.DirectionalLight(0xfff2dc, 2.4); sun.position.set(5, 9, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, far: 40 }); sun.shadow.bias = -.0005; sun.shadow.radius = 4;
    scene.add(sun, new THREE.HemisphereLight(0x8fa3ff, 0x0b0d14, .35));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: .95, metalness: 0, envMapIntensity: .25 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(16, 16, 0x2f3b52, 0x1b2331); grid.position.y = .005; grid.material.transparent = true; grid.material.opacity = .9; scene.add(grid);

    const size = () => {
      const w = host.clientWidth || 600, h = host.clientHeight || 375;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      host.style.setProperty('--k', (w / 1600).toFixed(3)); host.classList.toggle('compact', w < 760);
    };
    size(); new ResizeObserver(size).observe(host);

    const loader = new GLTFLoader(); const draco = new DRACOLoader(); draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'); loader.setDRACOLoader(draco);
    const load = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
    const shadows = o => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    status.textContent = 'loading models';
    const [husky, base, satSrc] = await Promise.all([load(host.dataset.husky), load(host.dataset.base), load(host.dataset.sat)]);

    husky.traverse(m => { if (m.isMesh && m.material) { m.material.envMapIntensity = .8; if (m.material.roughness !== undefined && !/ant/.test(m.name)) { m.material.roughness = Math.min(m.material.roughness, .55); m.material.metalness = .15; } } });
    shadows(husky); const rover = new THREE.Group(); rover.add(husky); husky.position.y = .145; scene.add(rover);
    const wheels = ['wheel0', 'wheel1', 'wheel2', 'wheel3'].map(n => husky.getObjectByName(n)).filter(Boolean);
    const antA = husky.getObjectByName('antA'), antB = husky.getObjectByName('antB');
    shadows(base); base.position.set(BASE[0], 0, BASE[1]); scene.add(base); const baseAnt = base.getObjectByName('baseAnt') || base;

    satSrc.traverse(m => { if (m.isMesh && m.material) { const ms = Array.isArray(m.material) ? m.material : [m.material]; for (const mt of ms) mt.envMapIntensity = 1.35; } });
    const sb = new THREE.Box3().setFromObject(satSrc), sc = sb.getCenter(new THREE.Vector3()), ss = sb.getSize(new THREE.Vector3()), smax = Math.max(ss.x, ss.y, ss.z);
    const sats = SATS.map(([x, y, z, sz, rx, ry], i) => {
      const g = new THREE.Group(); const s = i ? satSrc.clone(true) : satSrc; const k = sz / smax;
      s.scale.setScalar(k); s.position.copy(sc).multiplyScalar(-k); g.add(s); g.rotation.set(rx, ry, 0); g.position.set(x, y, z); scene.add(g);
      const b = new THREE.Box3().setFromObject(g); return { g, y0: y, ry0: ry, nadir: new THREE.Vector3(x, b.min.y + .1, z) };
    });

    const rings = WPS.map(() => el('polygon', 'ring')), wpTags = WPS.map((_, i) => { const d = document.createElement('div'); d.className = 'wp'; d.textContent = 'WP' + (i + 1); L.appendChild(d); return d; });
    const route = el('polyline', 'route'); const fixes = Array.from({ length: 90 }, () => el('circle', 'fix'));
    const sigs = sats.flatMap(() => [el('line', 'sig'), el('line', 'sig')]); const corr = el('path', 'corr');
    const labSat = lab('amber'), labCorr = lab('mint'), labBase = lab('mint'), labRover = lab('indigo'), legend = lab('legend');
    labSat.textContent = 'GNSS satellites'; labCorr.innerHTML = 'RTK corrections<small>base → rover</small>'; labBase.innerHTML = 'RTK base station<small>fixed reference point</small>';
    labRover.innerHTML = 'rover · dual-antenna RTK<small>10 Hz fixes · 50 Hz EKF with wheel odometry</small>';
    legend.innerHTML = '<span style="color:#3ee6b0">●</span> logged fixes &nbsp;<span style="color:#9aa3b5">- -</span> planned route';

    const v3 = new THREE.Vector3(), P = (x, y, z) => { const p = v3.set(x, y, z).project(camera); return [(p.x + 1) * 800, (1 - p.y) * 500]; };
    const top = o => { const b = new THREE.Box3().setFromObject(o); return P((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2); };
    const put = (d, x, y) => { d.style.left = (x / 16) + '%'; d.style.top = (y / 10) + '%'; };
    const pts = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

    const SPEED = .55, TURN = .9, R = .1651, TRACK = .555; let seg = 0, s = 0, turning = 0, yaw = 0, yawFrom = 0, yawTo = 0;
    const trail = []; let trailAcc = 0;
    const segVec = i => { const a = WPS[i], b = WPS[(i + 1) % 4]; return [b[0] - a[0], b[1] - a[1]]; };
    const headingOf = i => { const d = segVec(i); return Math.atan2(-d[1], d[0]); };
    yaw = headingOf(0);
    const pos = [WPS[0][0], WPS[0][1]];
    const step = dt => {
      if (turning > 0) { turning -= dt; const t = 1 - Math.max(0, turning) / TURN; let d = yawTo - yawFrom; d = Math.atan2(Math.sin(d), Math.cos(d)); const prev = yaw; yaw = yawFrom + d * (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); const vr = (yaw - prev) / dt * TRACK / 2; [1, 3].forEach(i => { if (wheels[i]) wheels[i].rotation.y += vr * dt / R; }); [0, 2].forEach(i => { if (wheels[i]) wheels[i].rotation.y -= vr * dt / R; }); return; }
      const d = segVec(seg), len = Math.hypot(d[0], d[1]); s += SPEED * dt;
      if (s >= len) { s = 0; seg = (seg + 1) % 4; yawFrom = yaw; yawTo = headingOf(seg); turning = TURN; }
      const a = WPS[seg]; pos[0] = a[0] + d[0] * s / len; pos[1] = a[1] + d[1] * s / len;
      for (const w of wheels) w.rotation.y += SPEED * dt / R;
      trailAcc += SPEED * dt; if (trailAcc >= .13) { trailAcc = 0; trail.push([pos[0], pos[1]]); if (trail.length > fixes.length) trail.shift(); }
    };
    if (reduce) { s = 2.6; const d = segVec(1); pos[0] = WPS[1][0] + d[0] * s / 5.3; pos[1] = WPS[1][1] + d[1] * s / 5.3; seg = 1; yaw = headingOf(1); for (let k = 0; k < 40; k++) trail.push([WPS[1][0] + d[0] * (s - k * .13) / 5.3, WPS[1][1]]); }

    const overlay = t => {
      rover.position.set(pos[0], 0, pos[1]); rover.rotation.y = yaw; rover.updateMatrixWorld(true);
      sats.forEach((o, i) => { if (!reduce) { o.g.position.y = o.y0 + .08 * Math.sin(t * .5 + i * 2); o.g.rotation.y = o.ry0 + .07 * Math.sin(t * .27 + i); } });
      const aA = top(antA), aB = top(antB), aBase = top(baseAnt);
      const routePts = [...WPS, WPS[0]].map(w => P(w[0], .01, w[1])); route.setAttribute('points', pts(routePts));
      WPS.forEach((w, i) => { const ring = []; for (let k = 0; k < 24; k++) ring.push(P(w[0] + .34 * Math.cos(k / 24 * 2 * Math.PI), .01, w[1] + .34 * Math.sin(k / 24 * 2 * Math.PI))); rings[i].setAttribute('points', pts(ring)); const q = P(w[0] + .55, .01, w[1] - .5); put(wpTags[i], q[0], q[1]); });
      fixes.forEach((c, i) => { const f = trail[trail.length - 1 - i]; if (!f) { c.setAttribute('r', 0); return; } const q = P(f[0], .01, f[1]); c.setAttribute('cx', q[0].toFixed(1)); c.setAttribute('cy', q[1].toFixed(1)); c.setAttribute('r', 2.6); c.setAttribute('opacity', (1 - i / fixes.length * .85).toFixed(2)); });
      sats.forEach((o, i) => { const n = P(o.nadir.x, o.nadir.y, o.nadir.z); [aBase, aA].forEach((tip, j) => { const l = sigs[i * 2 + j]; l.setAttribute('x1', n[0].toFixed(1)); l.setAttribute('y1', n[1].toFixed(1)); l.setAttribute('x2', tip[0].toFixed(1)); l.setAttribute('y2', tip[1].toFixed(1)); }); });
      const cx = (aBase[0] + aB[0]) / 2, cy = Math.min(aBase[1], aB[1]) - 150;
      corr.setAttribute('d', `M${aBase[0].toFixed(1)},${(aBase[1] - 6).toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${(aB[0] + 6).toFixed(1)},${(aB[1] - 4).toFixed(1)}`);
      const s0 = P(sats[0].nadir.x, sats[0].nadir.y, sats[0].nadir.z); put(labSat, s0[0] - 30, s0[1] + 26);
      put(labCorr, cx, cy - 8); const bp = P(BASE[0], .01, BASE[1]); put(labBase, bp[0] - 250, bp[1] - 150);
      const rp = P(pos[0], .01, pos[1]); put(labRover, Math.min(1380, Math.max(220, rp[0])), rp[1] > 760 ? rp[1] - 215 : rp[1] + 95);
    };
    legend.style.cssText = 'left:auto;right:2.5%;top:auto;bottom:4%;transform:none';

    let visible = false, raf = 0, last = performance.now(), t = 0;
    const loop = now => {
      if (!visible) return; const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      if (!reduce) step(dt); controls.update(); overlay(t); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    new IntersectionObserver(en => { visible = en[0].isIntersecting; cancelAnimationFrame(raf); if (visible) { last = performance.now(); raf = requestAnimationFrame(loop); } }, { threshold: .05 }).observe(host);
    controls.addEventListener('change', () => { if (!visible) { overlay(t); renderer.render(scene, camera); } });
    overlay(t); renderer.render(scene, camera);
    host.classList.add('ready');
  }
}
