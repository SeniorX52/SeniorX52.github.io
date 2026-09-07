import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const host = document.getElementById('cloud3d');
if (host) {
  const status = host.querySelector('.status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 200000;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';
  controls.enableDamping = true; controls.dampingFactor = .06;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 1.1;
  controls.enablePan = false;

  const size = () => {
    const w = host.clientWidth || 300, h = host.clientHeight || 300;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  size(); addEventListener('resize', size, { passive: true });

  const stops = [[20, 40, 255], [30, 200, 255], [70, 255, 120], [250, 235, 60], [255, 70, 40]];
  const ramp = (t, out, i) => {
    t = Math.max(0, Math.min(.9999, t)) * (stops.length - 1);
    const k = Math.floor(t), f = t - k, a = stops[k], b = stops[k + 1];
    out[i] = (a[0] + (b[0] - a[0]) * f) / 255; out[i + 1] = (a[1] + (b[1] - a[1]) * f) / 255; out[i + 2] = (a[2] + (b[2] - a[2]) * f) / 255;
  };

  const texPixels = (map) => {
    const img = map && map.image; if (!img) return null;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    return { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
  };

  const loader = new GLTFLoader();
  const draco = new DRACOLoader(); draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);

  loader.load(host.dataset.src, (gltf) => {
    const meshes = []; gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => { if (o.isMesh && o.geometry) meshes.push(o); });
    if (!meshes.length) { status.textContent = 'no mesh in file'; return; }

    const areaOf = (m) => { const g = m.geometry, p = g.attributes.position, idx = g.index, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let s = 0; const n = idx ? idx.count : p.count; for (let i = 0; i < n; i += 3) { const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2; a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2); s += b.sub(a).cross(c.sub(a)).length() * .5; } return s; };
    const areas = meshes.map(areaOf), total = areas.reduce((x, y) => x + y, 0) || 1;

    const pos = new Float32Array(N * 3), colTex = new Float32Array(N * 3), colEle = new Float32Array(N * 3);
    const p = new THREE.Vector3(), nrm = new THREE.Vector3(), uv = new THREE.Vector2(), upright = new THREE.Vector3(0, 0, 1);
    let k = 0;
    meshes.forEach((m, mi) => {
      const count = mi === meshes.length - 1 ? N - k : Math.round(N * areas[mi] / total);
      const sampler = new MeshSurfaceSampler(m).build();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const tex = texPixels(mats[0] && mats[0].map);
      const base = (mats[0] && mats[0].color) || new THREE.Color(1, 1, 1);
      for (let i = 0; i < count && k < N; i++, k++) {
        sampler.sample(p, nrm, null, uv);
        p.applyMatrix4(m.matrixWorld).applyAxisAngle(upright, -Math.PI / 2);
        pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
        if (tex) {
          const x = Math.min(tex.w - 1, Math.max(0, (uv.x % 1 + 1) % 1 * tex.w | 0));
          const y = Math.min(tex.h - 1, Math.max(0, (uv.y % 1 + 1) % 1 * tex.h | 0));
          const j = (y * tex.w + x) * 4;
          colTex[k * 3] = tex.d[j] / 255 * base.r; colTex[k * 3 + 1] = tex.d[j + 1] / 255 * base.g; colTex[k * 3 + 2] = tex.d[j + 2] / 255 * base.b;
        } else { colTex[k * 3] = base.r; colTex[k * 3 + 1] = base.g; colTex[k * 3 + 2] = base.b; }
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeBoundingBox();
    const bb = geo.boundingBox, ctr = bb.getCenter(new THREE.Vector3()), ext = bb.getSize(new THREE.Vector3()), maxDim = Math.max(ext.x, ext.y, ext.z) || 1;
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (pos[i * 3] - ctr.x) / maxDim; pos[i * 3 + 1] = (pos[i * 3 + 1] - ctr.y) / maxDim; pos[i * 3 + 2] = (pos[i * 3 + 2] - ctr.z) / maxDim;
      ramp((pos[i * 3 + 1] + ext.y / maxDim / 2) / (ext.y / maxDim), colEle, i * 3);
    }
    geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
    geo.setAttribute('color', new THREE.BufferAttribute(colTex, 3));

    const mat = new THREE.PointsMaterial({ size: .0042, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: .95 });
    const points = new THREE.Points(geo, mat); scene.add(points);

    const grid = new THREE.GridHelper(1.6, 16, 0x3a4661, 0x232b3a); grid.position.y = -.5 * ext.y / maxDim - .02;
    grid.material.transparent = true; grid.material.opacity = .45; scene.add(grid);

    camera.position.set(1.3, .76, 1.43); controls.target.set(0, 0, 0); controls.update();

    host.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      host.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b === btn));
      geo.setAttribute('color', new THREE.BufferAttribute(btn.dataset.mode === 'height' ? colEle : colTex, 3));
      geo.attributes.color.needsUpdate = true;
    }));
    status.textContent = `${N.toLocaleString('en-US')} pts · surface-sampled from the reconstruction`;

    let visible = false, raf = 0;
    const loop = () => { if (!visible) return; controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    new IntersectionObserver(en => { visible = en[0].isIntersecting; cancelAnimationFrame(raf); if (visible) loop(); }, { threshold: .1 }).observe(host);
    renderer.render(scene, camera);
    host.classList.add('ready');
  }, (xhr) => { if (xhr.total) status.textContent = `loading ${Math.round(xhr.loaded / xhr.total * 100)}%`; },
  (err) => { status.textContent = 'could not load the model'; console.error(err); });
}
