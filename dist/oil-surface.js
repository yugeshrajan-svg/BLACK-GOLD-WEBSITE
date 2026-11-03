/*
 * Black Gold — golden oil pool
 *
 * A real-time WebGL scene: a still, black pool of oil seen in perspective,
 * lit by a warm strip light so every ripple catches a line of gold.
 *   mode 'pour' — a thin stream of golden oil pours into the pool
 *   mode 'drop' — a single drop falls every few seconds
 * Clicking or tapping the pool sends out extra ripples.
 *
 * No dependencies. Works from file:// and on any static host.
 * Usage: var oil = OilSurface(canvas, { mode: 'pour' }); oil.play();
 */
(function () {
  'use strict';

  var VERTEX = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  var FRAGMENT = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uMode;       // 0 = drops, 1 = pour
uniform vec2  uImpact;     // where the oil lands, screen uv
uniform vec3  uClicks[3];  // xy = screen uv, z = seconds since the click (negative = unused)
uniform float uScroll;
uniform float uLight;

const vec3  RO = vec3(0.0, 1.0, 0.0);
const float FOCAL = 1.4;
const float PERIOD = 4.4;
const float FALL = 0.8;
float gTilt;

vec2 toP(vec2 uv) { return (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0); }
vec3 rayFromP(vec2 p) { return normalize(vec3(p.x, p.y - gTilt, FOCAL)); }
vec2 hitPlane(vec3 rd, out float dist) { dist = RO.y / max(-rd.y, 1e-4); return (RO + rd * dist).xz; }
vec2 projectP(vec2 q) { vec3 v = vec3(q.x, 0.0, q.y) - RO; return vec2(v.x / v.z, v.y / v.z) * FOCAL + vec2(0.0, gTilt); }
float hash(float n) { return fract(sin(n * 127.1 + 3.7) * 43758.5453); }

float ring(vec2 q, vec2 c, float age, float amp) {
  // Unused click slots are ~100 s old; past 30 s a ring has decayed to nothing, so skip the maths.
  if (age <= 0.0 || age > 30.0) return 0.0;
  float r = length(q - c);
  float behind = age * 0.62 - r;
  if (behind < -0.12) return 0.0;
  float env = exp(-max(-behind, 0.0) * 45.0) * exp(-max(behind, 0.0) * 2.4);
  float decay = exp(-age * 0.42) * exp(-r * 0.9) / (1.0 + r * 2.2);
  return amp * sin(behind * 30.0) * env * decay;
}

float height(vec2 q, vec2 c0, vec2 k0, vec2 k1, vec2 k2, float t) {
  float h = 0.0035 * sin(q.x * 2.1 + t * 0.45) * sin(q.y * 1.7 - t * 0.3)
          + 0.0025 * sin(q.x * 4.3 - q.y * 3.1 + t * 0.7);
  if (uMode < 0.5) {
    for (int i = 0; i < 3; i++) {
      float n = floor(t / PERIOD) - float(i);
      vec2 c = c0 + (vec2(hash(n), hash(n + 7.3)) - 0.5) * vec2(0.3, 0.25);
      float age = t - (n * PERIOD + FALL);
      h += ring(q, c, age, 0.05);
      h += ring(q, c, age - 0.95, 0.02);
    }
  } else {
    float r = length(q - c0);
    h += 0.022 * sin(r * 30.0 - t * 6.5) * exp(-r * 1.1) / (1.0 + r * 3.0);
    h += 0.008 * sin(r * 47.0 - t * 10.0 + sin(t * 2.3)) * exp(-r * 3.5);
  }
  h += ring(q, k0, uClicks[0].z, 0.045);
  h += ring(q, k1, uClicks[1].z, 0.045);
  h += ring(q, k2, uClicks[2].z, 0.045);
  return h;
}

vec3 env(vec3 r) {
  vec3 gold = vec3(1.0, 0.64, 0.22);
  float strip = exp(-pow((r.y - 0.36) * 11.0, 2.0)) * exp(-pow((r.x - 0.3) * 1.6, 2.0));
  float strip2 = exp(-pow((r.y - 0.62) * 9.0, 2.0)) * exp(-pow((r.x - 0.05) * 2.2, 2.0));
  float glow = exp(-pow((r.x - 0.28) * 1.1, 2.0)) * smoothstep(-0.1, 0.7, r.y) * 0.03;
  float spot = pow(max(dot(r, normalize(vec3(0.42, 0.5, 0.75))), 0.0), 3000.0);
  return gold * (strip * 2.1 + strip2 * 0.05 + glow) + vec3(1.0, 0.86, 0.6) * spot * 2.5;
}

vec3 drawDrop(vec3 col, vec2 p, vec2 c, float R, float stretch) {
  vec2 d = (p - c) / vec2(R, R * stretch);
  d.x *= 1.0 + 0.6 * max(d.y, 0.0) * (stretch - 1.0);
  float l = length(d);
  float aa = 1.5 / (R * uRes.y);
  float mask = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, l);
  if (mask <= 0.0) return col;
  vec3 n = normalize(vec3(d.x, d.y, sqrt(max(1.0 - l * l, 0.0))));
  float rim = pow(1.0 - n.z, 1.5);
  float spec = pow(max(dot(n, normalize(vec3(0.45, 0.55, 0.7))), 0.0), 40.0);
  vec3 dc = vec3(0.03, 0.02, 0.01) + vec3(1.0, 0.66, 0.26) * rim + vec3(1.0, 0.92, 0.72) * spec * 1.8;
  return mix(col, dc, mask);
}

void main() {
  gTilt = 0.55 + uScroll * 0.12;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = toP(uv);
  float t = uTime;
  float dist;
  vec2 c0 = hitPlane(rayFromP(toP(uImpact)), dist);
  vec2 k0 = hitPlane(rayFromP(toP(uClicks[0].xy)), dist);
  vec2 k1 = hitPlane(rayFromP(toP(uClicks[1].xy)), dist);
  vec2 k2 = hitPlane(rayFromP(toP(uClicks[2].xy)), dist);

  vec3 rd = rayFromP(p);
  vec2 q = hitPlane(rd, dist);
  float e = 0.0016 * dist;
  float h  = height(q, c0, k0, k1, k2, t);
  float hx = height(q + vec2(e, 0.0), c0, k0, k1, k2, t);
  float hz = height(q + vec2(0.0, e), c0, k0, k1, k2, t);
  vec3 n = normalize(vec3(h - hx, e, h - hz));
  vec3 r = reflect(rd, n);
  float F = mix(0.14, 1.0, pow(1.0 - max(dot(n, -rd), 0.0), 4.0));
  vec3 col = vec3(0.012, 0.009, 0.006) + env(r) * F;
  col *= smoothstep(18.0, 3.0, dist);
  col *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length((uv - vec2(uImpact.x - 0.04, 0.48)) * vec2(1.0, 1.25)));

  float topY = 0.62;
  if (uMode < 0.5) {
    float k = floor(t / PERIOD);
    float local = t - k * PERIOD;
    vec2 c = c0 + (vec2(hash(k), hash(k + 7.3)) - 0.5) * vec2(0.3, 0.25);
    vec2 cp = projectP(c);
    if (local < FALL) {
      float s = local / FALL;
      col = drawDrop(col, p, vec2(cp.x, mix(topY, cp.y, s * s)), 0.016, 1.0 + 1.2 * s);
    }
    float a = local - FALL;
    if (a > 0.1 && a < 0.95) {
      float s = (a - 0.1) / 0.85;
      col = drawDrop(col, p, vec2(cp.x, cp.y + 0.07 * sin(3.14159 * s)), 0.007, 1.0);
    }
  } else {
    vec2 cp = projectP(c0);
    if (p.y > cp.y - 0.003 && p.y < topY) {
      float s = clamp((topY - p.y) / (topY - cp.y), 0.0, 1.0);
      float w = mix(0.011, 0.0055, sqrt(s));
      float xc = cp.x + 0.0025 * sin(p.y * 38.0 - t * 4.0) * s;
      float dx = (p.x - xc) / w;
      float aa = 1.5 / (w * uRes.y);
      float mask = (1.0 - smoothstep(1.0 - aa, 1.0 + aa, abs(dx))) * smoothstep(0.45, 0.3, p.y);
      if (mask > 0.0) {
        float nz = sqrt(max(1.0 - dx * dx, 0.0));
        float rim = pow(1.0 - nz, 1.5);
        float streak = exp(-pow((dx + 0.38) * 4.0, 2.0)) * (0.65 + 0.35 * sin(p.y * 90.0 + t * 26.0));
        vec3 sc = vec3(0.03, 0.02, 0.01) + vec3(1.0, 0.66, 0.26) * (rim * 0.8 + streak * 0.95);
        col = mix(col, sc, mask);
      }
    }
    vec2 g = (p - cp) * vec2(1.0, 3.0);
    col += vec3(1.0, 0.7, 0.3) * exp(-dot(g, g) * 900.0) * 0.3;
  }

  col *= uLight;
  col = 1.0 - exp(-col * 1.6);
  col = pow(col, vec3(0.9, 0.97, 1.12));
  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + t) * 43758.5453);
  col += (d - 0.5) / 160.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[OilSurface] shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function OilSurface(canvas, options) {
    var o = Object.assign({
      mode: 'pour',                 // 'pour' or 'drop'
      impact: [0.7, 0.42],          // landing point on wide screens (screen uv, y up)
      impactNarrow: [0.62, 0.5],    // landing point on portrait screens
      light: 1,
      quality: 1,                   // render scale; 1 = the screen's own resolution, up to 4K
      startTime: 3.2,
      interactive: true,            // click / tap to ripple
      parallax: 1                   // camera tilt as the section scrolls
    }, options || {});

    var gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    if (!gl) return null;

    var program, uniforms = {};
    var time = o.startTime;
    var scale = o.quality;
    var fit = 1;                    // below 1 when the screen has more pixels than a 4K frame
    var running = false, wanted = false, visible = true, contextLost = false;
    var raf = 0, last = 0;
    var warmup = 0, times = [], frameTime = 0;
    var clicks = [[0.5, 0.3, -100], [0.5, 0.3, -100], [0.5, 0.3, -100]];
    var nextClick = 0;

    function init() {
      var vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
      var fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
      if (!vs || !fs) return false;
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('[OilSurface] link error:', gl.getProgramInfoLog(program));
        return false;
      }
      gl.useProgram(program);

      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      ['uRes', 'uTime', 'uMode', 'uImpact', 'uClicks', 'uScroll', 'uLight']
        .forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
      return true;
    }

    if (!init()) return null;

    // Device pixels (up to 2 per CSS pixel), never more than a 4K frame's worth.
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cw = canvas.clientWidth * dpr, ch = canvas.clientHeight * dpr;
      fit = Math.min(1, Math.sqrt(3840 * 2160 / Math.max(cw * ch, 1)));
      var w = Math.max(2, Math.round(cw * Math.min(scale, fit)));
      var h = Math.max(2, Math.round(ch * Math.min(scale, fit)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function scrollOffset() {
      if (!o.parallax) return 0;
      var rect = canvas.getBoundingClientRect();
      return Math.max(-1, Math.min(1, rect.top / Math.max(rect.height, 1))) * o.parallax;
    }

    function draw() {
      resize();
      var impact = canvas.clientWidth / Math.max(canvas.clientHeight, 1) < 0.9 ? o.impactNarrow : o.impact;
      var packed = [];
      clicks.forEach(function (c) { packed.push(c[0], c[1], time - c[2]); });
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uMode, o.mode === 'drop' ? 0 : 1);
      gl.uniform2f(uniforms.uImpact, impact[0], impact[1]);
      gl.uniform3fv(uniforms.uClicks, packed);
      gl.uniform1f(uniforms.uScroll, scrollOffset());
      gl.uniform1f(uniforms.uLight, o.light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!canvas.classList.contains('is-ready')) canvas.classList.add('is-ready');
    }

    // Drop the render scale if the device can't hold a smooth frame rate: frames slower than 24 ms
    // on average, or stutter (over a quarter of them under 50 fps and twice as long as the quickest).
    // The first frames after starting are skipped (the page is often still loading); then every half
    // second, slow frames cut the pixel count in proportion, so a slow GPU recovers in one step.
    function adapt(dt) {
      if (warmup > 0) { warmup--; return; }
      times.push(dt);
      frameTime += dt;
      if (frameTime < 0.5 || times.length < 10) return;
      times.sort(function (a, b) { return a - b; });
      var avg = frameTime / times.length;
      var quick = times[Math.floor(times.length * 0.1)];
      var late = times[Math.floor(times.length * 0.75)];
      times = [];
      frameTime = 0;
      if ((avg > 0.024 || (late > 0.02 && late > quick * 1.5)) && scale > 0.35) {
        scale = Math.max(0.35, Math.min(scale, fit) * Math.min(0.85, Math.max(0.6, Math.sqrt(0.0167 / avg))));
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      last = now;
      time += dt;
      adapt(dt);
      draw();
    }

    function sync() {
      var go = wanted && visible && !document.hidden && !contextLost;
      if (go && !running) {
        running = true;
        last = 0;
        warmup = 20;
        times = [];
        frameTime = 0;
        raf = requestAnimationFrame(frame);
      } else if (!go && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }

    if (o.interactive) {
      // Listen on the section so clicks pass through the overlay copy;
      // links, buttons and form controls keep their own behaviour.
      (canvas.parentElement || canvas).addEventListener('pointerdown', function (e) {
        if (!running || e.target.closest('a, button, input, select, textarea, label')) return;
        var r = canvas.getBoundingClientRect();
        var y = 1 - (e.clientY - r.top) / r.height;
        clicks[nextClick] = [(e.clientX - r.left) / r.width, Math.min(y, 0.92), time];
        nextClick = (nextClick + 1) % clicks.length;
      });
    }

    // Scrolling and resizing keep the rest of the page busy too; those slow frames are not the
    // oil's, so measuring starts again once they stop (otherwise every scroll would blur it).
    ['scroll', 'resize'].forEach(function (type) {
      window.addEventListener(type, function () { warmup = 20; times = []; frameTime = 0; }, { passive: true });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        sync();
      }, { rootMargin: '80px' }).observe(canvas);
    }
    document.addEventListener('visibilitychange', sync);

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { if (!running && !contextLost) draw(); }).observe(canvas);
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      contextLost = true;
      running = false;
      cancelAnimationFrame(raf);
      canvas.classList.remove('is-ready');
    });
    canvas.addEventListener('webglcontextrestored', function () {
      if (init()) { contextLost = false; draw(); sync(); }
    });

    return {
      play: function () { wanted = true; sync(); },
      pause: function () { wanted = false; sync(); },
      renderOnce: function () { draw(); },
      get playing() { return wanted; }
    };
  }

  window.OilSurface = OilSurface;
})();
