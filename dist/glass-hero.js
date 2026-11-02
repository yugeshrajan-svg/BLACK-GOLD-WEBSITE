/*
 * Black Gold — glass oil barrel (home hero)
 *
 * A glass oil drum turns in front of the words "Black Gold."; the glass bends the words
 * with a little colour dispersion (screen-space refraction: back faces first, then front
 * faces). Drag it or use the arrows; it drifts slowly on its own unless motion is paused
 * (the site's Pause motion switch or the reduced-motion setting).
 *
 * three.js comes from jsDelivr. If it or WebGL isn't available, the hero keeps the words
 * as text (.hero-words) and the arrows stay hidden.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

const stage = document.querySelector('[data-glass-stage]');
const canvas = document.getElementById('glass-hero');
if (stage && canvas) import(THREE_URL).then(start).catch(() => {});

function start(THREE) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch {
    return;
  }
  const root = document.documentElement;
  const background = getComputedStyle(stage).getPropertyValue('--bg').trim() || '#050607';
  const compactQuery = matchMedia('(max-width: 1024px), (max-aspect-ratio: 1/1)');
  const isPhone = matchMedia('(pointer: coarse)').matches;
  renderer.setClearColor(background, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  /* ---------- The words behind the glass, drawn on a 2D canvas ---------- */
  const LINES = [
    { text: 'Black', font: '700', color: '#f3eee2' },
    { text: 'Gold.', font: 'italic 600', gold: true },
  ];
  const textCanvas = document.createElement('canvas');
  const ctx = textCanvas.getContext('2d');
  let wordsTexture = null;
  const wordsMaterial = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(uTex, vUv);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const wordsScene = new THREE.Scene();
  const wordsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wordsMaterial);
  wordsQuad.frustumCulled = false;
  wordsScene.add(wordsQuad);

  // Matches .hero-words in home.css, so the text and the 3D words line up.
  function composition(W, H) {
    return compactQuery.matches
      ? { cx: 0.5, cy: 0.58, size: Math.min(H * 0.56, W * 0.58), font: Math.min(H * 0.25, W * 0.25), maxW: 0.9 }
      : { cx: 0.645, cy: 0.47, size: Math.min(H * 0.54, W * 0.29), font: Math.min(H * 0.27, W * 0.135), maxW: 0.48 };
  }

  function metallicGold(y, size) {
    const g = ctx.createLinearGradient(0, y - size * 0.78, 0, y + size * 0.14);
    g.addColorStop(0, '#fbeec4');
    g.addColorStop(0.36, '#e9c262');
    g.addColorStop(0.62, '#c8922e');
    g.addColorStop(1, '#8a5f1c');
    return g;
  }

  function drawWords(W, H, dpr) {
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    const resized = textCanvas.width !== cw || textCanvas.height !== ch;
    textCanvas.width = cw;
    textCanvas.height = ch;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
    const c = composition(W, H);
    let size = c.font;
    const widest = Math.max(...LINES.map((l) => { ctx.font = `${l.font} ${size}px Fraunces`; return ctx.measureText(l.text).width; }));
    if (widest > W * c.maxW) size *= (W * c.maxW) / widest;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const gap = size * 1.02, cap = size * 0.68;
    LINES.forEach((l, i) => {
      const y = H * c.cy + cap / 2 + (i - (LINES.length - 1) / 2) * gap;
      ctx.font = `${l.font} ${size}px Fraunces`;
      ctx.fillStyle = l.gold ? metallicGold(y, size) : l.color;
      ctx.fillText(l.text, W * c.cx, y);
    });
    // A texture can't change size once uploaded, so a resized canvas gets a new one.
    if (!wordsTexture || resized) {
      if (wordsTexture) wordsTexture.dispose();
      wordsTexture = new THREE.CanvasTexture(textCanvas);
      wordsTexture.colorSpace = THREE.SRGBColorSpace;
      wordsTexture.minFilter = wordsTexture.magFilter = THREE.LinearFilter;
      wordsTexture.generateMipmaps = false;
      wordsMaterial.uniforms.uTex.value = wordsTexture;
    }
    wordsTexture.needsUpdate = true;
  }

  /* ---------- Gold-tinted glass: refraction with six-band colour dispersion ---------- */
  const glassVertex = `
    varying vec3 vNormal;
    varying vec3 vEye;
    void main() {
      vec4 mvPos = viewMatrix * modelMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPos;
      vNormal = normalize(normalMatrix * normal);
      vEye = normalize(mvPos.xyz);
    }
  `;
  const glassFragment = `
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uRefractPower;
    uniform float uBackside;
    uniform vec3 uTint;
    uniform float uTintAmount;
    varying vec3 vNormal;
    varying vec3 vEye;

    float specular(vec3 light, float shininess, float diffuseness, vec3 n, vec3 eye) {
      vec3 l = normalize(-light);
      vec3 h = normalize(-eye + l);
      return pow(max(dot(n, h), 0.0), shininess) + max(0.0, dot(n, l)) * diffuseness;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      vec3 n = normalize(vNormal);
      // three.js flips the winding for BackSide, so gl_FrontFacing can't tell; the uniform does.
      if (uBackside > 0.5) n = -n;
      vec3 eye = normalize(vEye);
      vec3 rR = refract(eye, n, 1.0 / 1.15);
      vec3 rY = refract(eye, n, 1.0 / 1.16);
      vec3 rG = refract(eye, n, 1.0 / 1.18);
      vec3 rC = refract(eye, n, 1.0 / 1.22);
      vec3 rB = refract(eye, n, 1.0 / 1.22);
      vec3 rP = refract(eye, n, 1.0 / 1.22);
      vec3 color = vec3(0.0);
      for (int i = 0; i < LOOP; i++) {
        float slide = float(i) / float(LOOP) * 0.045;
        vec3 tR = texture2D(uTexture, uv + rR.xy * (uRefractPower + slide * 1.0) * 0.5).rgb;
        vec3 tY = texture2D(uTexture, uv + rY.xy * (uRefractPower + slide * 1.0) * 0.5).rgb;
        vec3 tG = texture2D(uTexture, uv + rG.xy * (uRefractPower + slide * 2.0) * 0.5).rgb;
        vec3 tC = texture2D(uTexture, uv + rC.xy * (uRefractPower + slide * 2.5) * 0.5).rgb;
        vec3 tB = texture2D(uTexture, uv + rB.xy * (uRefractPower + slide * 3.0) * 0.5).rgb;
        vec3 tP = texture2D(uTexture, uv + rP.xy * (uRefractPower + slide * 1.0) * 0.5).rgb;
        float r = tR.x * 0.5;
        float y = (tY.x * 2.0 + tY.y * 2.0 - tY.z) / 6.0;
        float g = tG.y * 0.5;
        float c = (tC.y * 2.0 + tC.z * 2.0 - tC.x) / 6.0;
        float b = tB.z * 0.5;
        float p = (tP.z * 2.0 + tP.x * 2.0 - tP.y) / 6.0;
        color += vec3(r + (2.0 * p + 2.0 * y - c) / 3.0, g + (2.0 * y + 2.0 * c - p) / 3.0, b + (2.0 * c + 2.0 * p - y) / 3.0);
      }
      color /= float(LOOP);
      color = mix(vec3(dot(color, vec3(0.2125, 0.7154, 0.0721))), color, 1.08);
      color = mix(color, color * uTint, uTintAmount);          // a little amber, like oil behind glass
      float spec = specular(vec3(-1.0, 1.0, 1.0), 90.0, 0.02, n, eye) + 0.6 * specular(vec3(1.0, 1.0, -1.0), 54.0, 0.01, n, eye);
      color += spec * vec3(1.0, 0.94, 0.8) * (uBackside > 0.5 ? 0.35 : 1.0);
      float f = pow(clamp(1.0 + dot(eye, n), 0.0, 1.0), 5.0);
      color = mix(color, vec3(1.0, 0.9, 0.68), f * (uBackside > 0.5 ? 0.25 : 0.55));
      color += vec3(0.006, 0.005, 0.003);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }
  `;
  function glass(backside) {
    return new THREE.ShaderMaterial({
      defines: { LOOP: isPhone ? 8 : 16 },   // half the samples on phones: same look, lighter on the GPU
      uniforms: {
        uTexture: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uRefractPower: { value: backside ? 0.22 : 0.3 },
        uBackside: { value: backside ? 1 : 0 },
        uTint: { value: new THREE.Vector3(1.0, 0.84, 0.55) },
        uTintAmount: { value: backside ? 0.22 : 0.32 },
      },
      vertexShader: glassVertex,
      fragmentShader: glassFragment,
      side: backside ? THREE.BackSide : THREE.FrontSide,
    });
  }
  const front = glass(false);
  const back = glass(true);
  const backTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const frontTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  back.uniforms.uTexture.value = backTarget.texture;
  front.uniforms.uTexture.value = frontTarget.texture;

  /* ---------- The barrel: a lathed drum with rounded lids, rolled rims and two hoops ---------- */
  function barrelGeometry() {
    const R = 0.5, H2 = 0.75, E = 0.05;                       // radius, half height, lid edge radius
    const bump = (y, at, height, width) => height * Math.exp(-(((y - at) / width) ** 2));
    const side = (y) => R
      + bump(y, -0.25, 0.024, 0.026) + bump(y, 0.25, 0.024, 0.026)            // rolling hoops
      + bump(y, -(H2 - E - 0.03), 0.016, 0.015) + bump(y, H2 - E - 0.03, 0.016, 0.015); // rims
    const points = [];
    const add = (r, y) => points.push(new THREE.Vector2(Math.max(r, 0), y));
    for (let i = 0; i <= 8; i++) add((R - E) * (i / 8), -H2);                // bottom lid, centre outwards
    for (let i = 1; i <= 10; i++) {                                           // rounded bottom edge
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / 10);
      add(R - E + E * Math.cos(a), -H2 + E + E * Math.sin(a));
    }
    for (let i = 1; i < 200; i++) {                                           // the wall, bottom to top
      const y = -H2 + E + (2 * (H2 - E)) * (i / 200);
      add(side(y), y);
    }
    for (let i = 0; i <= 10; i++) {                                           // rounded top edge
      const a = (Math.PI / 2) * (i / 10);
      add(R - E + E * Math.cos(a), H2 - E + E * Math.sin(a));
    }
    for (let i = 7; i >= 0; i--) add((R - E) * (i / 8), H2);                 // top lid, inwards to the centre
    const geometry = new THREE.LatheGeometry(points, 128);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    const s = 1 / Math.max(size.x, size.y, size.z);
    geometry.scale(s, s, s);
    return geometry;
  }

  const scene = new THREE.Scene();
  const pivot = new THREE.Group();
  const spinner = new THREE.Group();
  spinner.rotation.set(0.42, 0.5, -0.2);                     // lid tilted towards you
  const barrel = new THREE.Mesh(barrelGeometry(), front);
  spinner.add(barrel);
  pivot.add(spinner);
  scene.add(pivot);

  /* ---------- Layout ---------- */
  const bufferSize = new THREE.Vector2();
  let W = 1, H = 1, DPR = 1;
  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    DPR = Math.min(devicePixelRatio || 1, isPhone ? 1.5 : 2);
    renderer.setPixelRatio(DPR);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(bufferSize);
    backTarget.setSize(bufferSize.x, bufferSize.y);
    frontTarget.setSize(bufferSize.x, bufferSize.y);
    front.uniforms.uResolution.value.copy(bufferSize);
    back.uniforms.uResolution.value.copy(bufferSize);
    drawWords(W, H, DPR);
    const c = composition(W, H);
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10;
    const visW = visH * camera.aspect;
    pivot.position.set((c.cx - 0.5) * visW, (0.5 - c.cy) * visH, 0);
    pivot.scale.setScalar((c.size / H) * visH);
  }

  function render() {
    renderer.autoClear = true;
    renderer.setRenderTarget(backTarget);
    renderer.render(wordsScene, camera);
    renderer.setRenderTarget(frontTarget);
    renderer.render(wordsScene, camera);
    renderer.autoClear = false;
    barrel.material = back;
    renderer.render(scene, camera);
    renderer.autoClear = true;
    renderer.setRenderTarget(null);
    renderer.render(wordsScene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    barrel.material = front;
    renderer.render(scene, camera);
    renderer.autoClear = true;
  }

  /* ---------- Turning: drag, inertia, slow drift, quarter turns ---------- */
  const AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_X = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion();
  function turn(y, x) {
    if (y) spinner.quaternion.premultiply(q.setFromAxisAngle(AXIS_Y, y));
    if (x) spinner.quaternion.premultiply(q.setFromAxisAngle(AXIS_X, x));
  }
  const velocity = { x: 0, y: 0 };                           // radians per 16.67 ms frame
  let dragging = false, pointer = null, lastX = 0, lastY = 0, lastAt = 0;
  let idleSince = performance.now() - 600, turnLeft = 0;
  const paused = () => root.classList.contains('motion-paused');

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    pointer = e.pointerId;
    canvas.setPointerCapture(pointer);
    canvas.classList.add('dragging');
    lastX = e.clientX; lastY = e.clientY; lastAt = performance.now();
    velocity.x = velocity.y = 0;
    turnLeft = 0;
    wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointer) return;
    const now = performance.now();
    const dx = (e.clientX - lastX) * 0.008, dy = (e.clientY - lastY) * 0.008;
    lastX = e.clientX; lastY = e.clientY;
    turn(dx, dy);
    const frames = Math.max((now - lastAt) / 16.67, 0.5);
    velocity.x = dx / frames; velocity.y = dy / frames;
    lastAt = now;
    wake();
  });
  function release(e) {
    if (!dragging || e.pointerId !== pointer) return;
    dragging = false;
    canvas.classList.remove('dragging');
    if (performance.now() - lastAt > 100) velocity.x = velocity.y = 0;   // held still before letting go
    idleSince = performance.now();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);       // a vertical swipe on a phone scrolls instead

  const arrows = document.querySelector('[data-glass-turn]');
  document.querySelectorAll('[data-glass-turn-by]').forEach((button) => {
    button.addEventListener('click', () => {
      turnLeft += Number(button.dataset.glassTurnBy) * Math.PI / 2;
      velocity.x = velocity.y = 0;
      wake();
    });
  });

  /* Only draw while the hero is on screen and something is moving. */
  let onScreen = true, frameId = 0, previous = 0;
  new IntersectionObserver((entries) => { onScreen = entries[0].isIntersecting; wake(); }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  new MutationObserver(() => { idleSince = performance.now() - 600; wake(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  function busy() {
    return dragging || turnLeft !== 0 || Math.abs(velocity.x) + Math.abs(velocity.y) > 1e-5 || !paused();
  }
  function wake() {
    if (!frameId && onScreen && !document.hidden) { previous = 0; frameId = requestAnimationFrame(frame); }
  }
  function frame(now) {
    frameId = 0;
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    const f = dt * 60;
    if (!dragging) {
      if (velocity.x || velocity.y) {
        turn(velocity.x * f, velocity.y * f);
        const damp = Math.pow(0.94, f);
        velocity.x *= damp; velocity.y *= damp;
        if (Math.abs(velocity.x) < 1e-5 && Math.abs(velocity.y) < 1e-5) velocity.x = velocity.y = 0;
      }
      if (!paused()) {
        const blend = THREE.MathUtils.clamp((now - idleSince) / 1000 - 0.6, 0, 1);
        if (blend > 0) turn(0.0035 * blend * f, 0.0009 * blend * f);
      }
    }
    if (turnLeft !== 0) {
      if (Math.abs(turnLeft) < 0.0005) turnLeft = 0;
      else { const step = turnLeft * Math.min(1, 0.09 * f); turn(step, 0); turnLeft -= step; }
    }
    render();
    if (busy() && onScreen && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function relayout() { layout(); render(); }
  addEventListener('resize', relayout);
  compactQuery.addEventListener('change', relayout);
  const fonts = Promise.all([
    document.fonts.load('700 100px Fraunces'),
    document.fonts.load('italic 600 100px Fraunces'),
    document.fonts.ready,
  ]).catch(() => {});
  Promise.race([fonts, new Promise((resolve) => setTimeout(resolve, 2500))]).then(() => {
    layout();
    render();
    stage.classList.add('is-ready');
    if (arrows) arrows.hidden = false;
    document.fonts.addEventListener('loadingdone', () => { drawWords(W, H, DPR); render(); });
    wake();
  });
}
