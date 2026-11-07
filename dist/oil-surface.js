/*
 * Black Gold — one oil pour
 *
 * A real-time WebGL scene: a still, black pool of oil seen in perspective, lit by
 * a warm strip light so every ripple catches a line of gold. It plays a single
 * pour of about four and a half seconds and then stops drawing:
 *
 *   0    – 0.4 s  the leading edge of a dense stream comes down into view
 *   0.4  – 2.6 s  it meets the pool: a shallow dimple, then soft rings move out
 *   2.6  – 3.0 s  the supply stops and the tail falls in
 *   3.0  – 4.5 s  the dimple rebounds into a low meniscus and the pool settles
 *
 * The pool begins and ends with the faint rings of an earlier, identical pour, so
 * its first and last frames match the still poster (oil-poster*.webp) shown before
 * it starts, when motion is off and when WebGL is unavailable.
 *
 * No dependencies. Works from file:// and on any static host.
 * Usage: var oil = OilSurface(canvas, { impact: [0.7, 0.42] }); oil.play();
 */
(function () {
  'use strict';

  // Seconds of visible playback. The shader uses the same values.
  var TOP = 0.62;      // the stream starts above the top of the frame (screen heights from centre)
  var V0 = 0.55;       // its speed as it enters
  var G = 5.4;         // how quickly it gathers speed
  var CUT = 2.55;      // the supply stops; the tail starts to fall
  var END = 4.5;       // the pool has settled: the last frame

  var VERTEX = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  var FRAGMENT = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;   // seconds since the pour began
uniform vec2  uImpact; // where the oil lands, screen uv (y up)
uniform float uHit;    // when the leading edge reaches the pool
uniform float uLand;   // when the tail reaches it
uniform float uLight;

const vec3  RO = vec3(0.0, 1.0, 0.0);
const float FOCAL = 1.4;
const float TILT = 0.55;
const float TOP = ${TOP.toFixed(2)};
const float V0 = ${V0.toFixed(2)};
const float G = ${G.toFixed(2)};
const float CUT = ${CUT.toFixed(2)};
const float PREV = ${END.toFixed(2)};

vec2 toP(vec2 uv) { return (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0); }
vec3 rayFromP(vec2 p) { return normalize(vec3(p.x, p.y - TILT, FOCAL)); }
vec2 hitPlane(vec3 rd, out float dist) { dist = RO.y / max(-rd.y, 1e-4); return (RO + rd * dist).xz; }
vec2 projectP(vec2 q) { vec3 v = vec3(q.x, 0.0, q.y) - RO; return vec2(v.x / v.z, v.y / v.z) * FOCAL + vec2(0.0, TILT); }
float fallen(float s) { s = max(s, 0.0); return V0 * s + 0.5 * G * s * s; }

float ring(vec2 q, vec2 c, float age, float amp) {
  if (age <= 0.0 || age > 30.0) return 0.0;
  float r = length(q - c);
  float behind = age * 0.62 - r;
  if (behind < -0.12) return 0.0;
  float env = exp(-max(-behind, 0.0) * 45.0) * exp(-max(behind, 0.0) * 2.4);
  float decay = exp(-age * 0.42) * exp(-r * 0.9) / (1.0 + r * 2.2);
  return amp * sin(behind * 30.0) * env * decay;
}

// How strongly the stream feeds the pool: rising as it lands, falling as the tail lands.
float feed(float t) {
  return smoothstep(uHit, uHit + 0.2, t) * (1.0 - smoothstep(uLand - 0.1, uLand + 0.3, t));
}

// Everything one pour does to the surface, t seconds after it began.
float pour(vec2 q, vec2 c, float t) {
  if (t < uHit) return 0.0;
  float r = length(q - c);
  // The stream presses a shallow dimple where it lands.
  float h = -0.010 * feed(t) * exp(-r * r * 900.0);
  // While it feeds, soft rings travel out, each as strong as the stream was when it left.
  h += 0.017 * feed(t - r / 0.34) * sin(r * 30.0 - t * 6.5) * exp(-r * 2.2) / (1.0 + r * 3.0);
  // The first touch sends one clear ring.
  h += ring(q, c, t - uHit, 0.035);
  // The tail lands: the dimple rebounds into a low, rounded meniscus and settles.
  float a = t - uLand;
  if (a > 0.0) {
    h += 0.008 * sin(a * 8.0) * exp(-a * 2.4) * exp(-r * r * 500.0);
    h += ring(q, c, a, 0.016);
  }
  return h;
}

float height(vec2 q, vec2 c, float t) {
  // The pool's own slow swell, held still: heavy oil barely moves without a reason.
  float h = 0.0035 * sin(q.x * 2.1 + 2.7) * sin(q.y * 1.7 - 1.8)
          + 0.0025 * sin(q.x * 4.3 - q.y * 3.1 + 4.2);
  return h + pour(q, c, t) + pour(q, c, t + PREV);
}

vec3 env(vec3 r) {
  vec3 gold = vec3(1.0, 0.64, 0.22);
  float strip = exp(-pow((r.y - 0.36) * 11.0, 2.0)) * exp(-pow((r.x - 0.3) * 1.6, 2.0));
  float strip2 = exp(-pow((r.y - 0.62) * 9.0, 2.0)) * exp(-pow((r.x - 0.05) * 2.2, 2.0));
  float glow = exp(-pow((r.x - 0.28) * 1.1, 2.0)) * smoothstep(-0.1, 0.7, r.y) * 0.03;
  float spot = pow(max(dot(r, normalize(vec3(0.42, 0.5, 0.75))), 0.0), 3000.0);
  return gold * (strip * 2.1 + strip2 * 0.05 + glow) + vec3(1.0, 0.86, 0.6) * spot * 2.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = toP(uv);
  float t = uTime;
  float dist;
  vec2 c0 = hitPlane(rayFromP(toP(uImpact)), dist);

  vec3 rd = rayFromP(p);
  vec2 q = hitPlane(rd, dist);
  float e = 0.0016 * dist;
  float h  = height(q, c0, t);
  float hx = height(q + vec2(e, 0.0), c0, t);
  float hz = height(q + vec2(0.0, e), c0, t);
  vec3 n = normalize(vec3(h - hx, e, h - hz));
  vec3 r = reflect(rd, n);
  float F = mix(0.14, 1.0, pow(1.0 - max(dot(n, -rd), 0.0), 4.0));
  vec3 col = vec3(0.012, 0.009, 0.006) + env(r) * F;
  col *= smoothstep(18.0, 3.0, dist);
  col *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length((uv - vec2(uImpact.x - 0.04, 0.48)) * vec2(1.0, 1.25)));

  // The stream, from its tail (above the frame until the supply stops) to its leading edge.
  vec2 cp = projectP(c0);
  float head = max(TOP - fallen(t), cp.y);
  float tail = TOP - fallen(t - CUT);
  float falling = step(cp.y + 0.002, head);
  if (tail > cp.y && p.y > max(head, cp.y - 0.003) - 0.03 && p.y < tail) {
    float s = clamp((TOP - p.y) / (TOP - cp.y), 0.0, 1.0);
    float w = mix(0.011, 0.0055, sqrt(s)) * mix(1.0, 0.6, smoothstep(CUT - 0.6, CUT, t));
    w *= sqrt(smoothstep(0.0, 0.07, tail - p.y));                    // the falling tail narrows to a point
    w *= 1.0 + 0.3 * falling * exp(-max(p.y - head, 0.0) * 70.0);   // a fuller, rounded leading edge
    float xc = cp.x + 0.0025 * sin(p.y * 38.0 - t * 4.0) * s;
    float dx = (p.x - xc) / max(w, 1e-4);
    float cap = falling * max(w - (p.y - head), 0.0) / max(w, 1e-4);
    float l = length(vec2(dx, cap));
    float aa = 1.5 / (max(w, 1e-4) * uRes.y);
    float mask = (1.0 - smoothstep(1.0 - aa, 1.0 + aa, l)) * smoothstep(0.45, 0.3, p.y) * step(cp.y - 0.003, p.y);
    if (mask > 0.0) {
      float nz = sqrt(max(1.0 - l * l, 0.0));
      float rim = pow(1.0 - nz, 1.5);
      float streak = exp(-pow((dx + 0.42) * 6.0, 2.0)) * (0.7 + 0.3 * sin(p.y * 90.0 + t * 26.0));
      vec3 sc = vec3(0.03, 0.02, 0.01) + vec3(1.0, 0.66, 0.26) * (rim * 0.8 + streak * 0.95);
      col = mix(col, sc, mask);
    }
  }
  // A warm glint where the oil meets the pool; it stays faintly after the pour as the focal point.
  vec2 g = (p - cp) * vec2(1.0, 3.0);
  col += vec3(1.0, 0.7, 0.3) * exp(-dot(g, g) * 900.0) * 0.3 * (0.35 + 0.65 * feed(t));

  col *= uLight;
  col = 1.0 - exp(-col * 1.6);
  col = pow(col, vec3(0.9, 0.97, 1.12));
  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
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

  // Seconds for the stream to fall from above the frame to a pool at screen height y (uv, y up).
  function fallTime(y) {
    var d = TOP - (y - 0.5);
    return (-V0 + Math.sqrt(V0 * V0 + 2 * G * d)) / G;
  }

  function OilSurface(canvas, options) {
    var o = Object.assign({
      impact: [0.7, 0.42],          // landing point on wide screens (screen uv, y up)
      impactNarrow: [0.62, 0.5],    // landing point on portrait screens
      light: 1,
      quality: 1                    // render scale; 1 = the screen's own resolution, within the budget below
    }, options || {});

    var gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    if (!gl) return null;

    var program, uniforms = {};
    var time = 0, settled = false;
    var scale = o.quality;
    var fit = 1;                    // below 1 when the screen has more pixels than the budget
    var running = false, wanted = false, visible = true, contextLost = false;
    var raf = 0, last = 0;
    var warmup = 0, times = [], frameTime = 0;

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

      ['uRes', 'uTime', 'uImpact', 'uHit', 'uLand', 'uLight']
        .forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
      return true;
    }

    if (!init()) return null;

    // Laptops and monitors: device pixels (up to 2 per CSS pixel), never more than a 4K frame.
    // Phones and tablets have dense but small screens; there the pour reads just as well at
    // 1.5 device pixels, within a smaller budget, and the GPU keeps up.
    function compact() {
      return canvas.clientWidth <= 760 || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }
    function resize() {
      var small = compact();
      var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      var budget = small ? 2.4e6 : 3840 * 2160;
      var cw = canvas.clientWidth * dpr, ch = canvas.clientHeight * dpr;
      fit = Math.min(1, Math.sqrt(budget / Math.max(cw * ch, 1)));
      var w = Math.max(2, Math.round(cw * Math.min(scale, fit)));
      var h = Math.max(2, Math.round(ch * Math.min(scale, fit)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function draw() {
      resize();
      var impact = canvas.clientWidth / Math.max(canvas.clientHeight, 1) < 0.9 ? o.impactNarrow : o.impact;
      var hit = fallTime(impact[1]);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform2f(uniforms.uImpact, impact[0], impact[1]);
      gl.uniform1f(uniforms.uHit, hit);
      gl.uniform1f(uniforms.uLand, CUT + hit);
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

    // Time only moves while the pour is visible and playing. A long frame (a busy page, a
    // background tab that just returned) counts as at most 1/20 s, so the landing is never skipped.
    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      time = Math.min(END, time + dt);
      adapt(dt);
      draw();
      if (time >= END) {
        // The final, settled frame stays on the canvas; nothing else is scheduled.
        settled = true;
        running = false;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function sync() {
      var go = wanted && visible && !document.hidden && !contextLost && !settled;
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

    // A new size or orientation redraws the current frame; it never restarts the pour.
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
      // Draws the pour at a given moment (seconds); used to make the matching posters.
      seek: function (t) {
        time = Math.max(0, Math.min(END, t));
        settled = time >= END;
        draw();
        sync();
      },
      get playing() { return wanted; },
      get settled() { return settled; },
      get time() { return time; },
      duration: END
    };
  }

  window.OilSurface = OilSurface;
})();
