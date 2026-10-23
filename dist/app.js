(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var selectedOilKey = null;

  function pressChoice(buttons, index) {
    buttons.forEach(function (button, i) { button.setAttribute('aria-pressed', String(i === index)); });
  }

  function describeCard(card, target) {
    if (card && target) target.textContent = $$('.points li', card).map(function (point) { return point.textContent; }).join(' · ');
  }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  var OILS = {
    engine: { value: 'Used engine oil', title: 'Used engine oil', name: 'Engine oil', label: 'ENGINE', sample: 'SAMPLE · 01' },
    hydraulic: { value: 'Used hydraulic oil', title: 'Used hydraulic oil', name: 'Hydraulic oil', label: 'HYDRAULIC', sample: 'SAMPLE · 02' },
    transfer: { value: 'Used transfer oil', title: 'Used transfer oil', name: 'Transfer oil', label: 'TRANSFER', sample: 'SAMPLE · 03' }
  };
  var OIL_KEYS = Object.keys(OILS);
  function oilText(key, field) { return OILS[key][field]; }

  // Native smooth scrolling handles the journey; keyboard focus follows the link.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute('href');
    if (id.length < 2) return;
    var target = document.getElementById(id.slice(1));
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------- Mobile menu ---------- */

  var header = $('.header');
  var menu = $('.menu');
  var nav = $('#navigation');
  var main = $('#main');
  var footer = $('.footer');

  function labelMenu() {
    var open = menu.getAttribute('aria-expanded') === 'true';
    menu.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
  }
  labelMenu();

  function setMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    labelMenu();
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    header.classList.remove('is-hidden');
    doc.classList.toggle('menu-locked', open);
    main.inert = open;
    footer.inert = open;
  }
  menu.addEventListener('click', function () { setMenu(menu.getAttribute('aria-expanded') !== 'true'); });
  $$('a, .nav-mobile-cta', nav).forEach(function (el) { el.addEventListener('click', function () { setMenu(false); }); });

  // Services panel (desktop): opens on hover in CSS, and on click or keyboard here.
  var group = $('.nav-group', nav);
  if (group) {
    var groupToggle = $('.nav-group-toggle', group);
    var setGroup = function (open) {
      group.classList.toggle('open', open);
      groupToggle.setAttribute('aria-expanded', String(open));
    };
    groupToggle.addEventListener('click', function () { setGroup(!group.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!group.contains(e.target)) setGroup(false); });
    group.addEventListener('focusout', function (e) { if (!group.contains(e.relatedTarget)) setGroup(false); });
    group.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && group.classList.contains('open')) { e.stopPropagation(); setGroup(false); groupToggle.focus(); }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menu.focus(); }
  });
  window.matchMedia('(min-width: 1181px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });

  /* ---------- Live visuals: one switch for every page's motion ---------- */

  var liveSyncs = [];
  function syncLive() {
    doc.classList.toggle('tab-hidden', document.hidden);
    liveSyncs.forEach(function (sync) { sync(); });
  }
  document.addEventListener('visibilitychange', syncLive);

  // Calls fn(dt) every frame, but only while `el` is on screen, the tab is
  // visible and motion is on, so nothing runs in the background.
  function live(el, fn) {
    var frame = 0, last = 0, inView = !('IntersectionObserver' in window);
    function playable() { return inView && !document.hidden && !reduce.matches && !doc.classList.contains('motion-paused'); }
    function tick(now) {
      var dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      fn(dt);
      frame = playable() ? requestAnimationFrame(tick) : 0;
    }
    function sync() {
      if (playable()) {
        if (!frame) { last = 0; frame = requestAnimationFrame(tick); }
      } else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }
    if (!inView) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }).observe(el);
    }
    liveSyncs.push(sync);
    sync();
  }

  if ('IntersectionObserver' in window) {
    var visualObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('is-offscreen', !entry.isIntersecting); });
    });
    $$('.hero, .page-hero-visual, .promise-journey, .route--pickup').forEach(function (visual) { visualObserver.observe(visual); });
  }

  var motionButtons = $$('[data-motion]');

  function labelMotion() {
    var paused = doc.classList.contains('motion-paused');
    motionButtons.forEach(function (btn) {
      btn.toggleAttribute('data-paused', paused);
      $('.motion-label', btn).textContent = paused ? 'Play motion' : 'Pause motion';
    });
  }

  function setMotion(on, remember) {
    doc.classList.toggle('motion-paused', !on);
    labelMotion();
    syncLive();
    if (remember) store('bg-motion', on ? 'on' : 'off');
  }

  function applyMotionPreference() {
    if (reduce.matches) {
      doc.classList.add('motion-paused');
      labelMotion();
      syncLive();
    } else {
      setMotion(store('bg-motion') !== 'off', false);
    }
  }
  applyMotionPreference();
  reduce.addEventListener('change', applyMotionPreference);
  motionButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { setMotion(doc.classList.contains('motion-paused'), true); });
  });

  /* ---------- Home: a continuous oil pour and spreading surface ripples ---------- */

  var oilCanvas = $('#oil-flow');
  if (oilCanvas && window.OilSurface) (function () {
    var oil = null, failed = false;
    function syncOil() {
      var play = !reduce.matches && !document.hidden && !doc.classList.contains('motion-paused');
      if (!oil && !failed && play) {
        try {
          oil = window.OilSurface(oilCanvas, {
            mode: 'pour', impact: [.7, .42], impactNarrow: [.78, .23],
            quality: .6, interactive: false, parallax: 0
          });
          if (oil) oil.renderOnce();
          else failed = true;
        } catch (e) {
          failed = true;
          oil = null;
          oilCanvas.classList.remove('is-ready');
        }
      }
      if (oil) { if (play) oil.play(); else oil.pause(); }
    }
    liveSyncs.push(syncOil);
    syncOil();
  })();

  /* ---------- Home: choosing an oil carries through to the enquiry ---------- */

  var homeTabs = $$('[data-home-oil]');
  if (homeTabs.length) (function () {
    var panel = $('#home-oil-panel');
    var current = 0;

    function select(index, focus) {
      current = index;
      var button = homeTabs[index];
      var key = button.dataset.homeOil;
      selectedOilKey = key;
      homeTabs.forEach(function (tab, i) {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      panel.dataset.tone = key;
      panel.setAttribute('aria-labelledby', button.id);
      $('.home-selected-name', panel).textContent = oilText(key, 'title');
      $('.home-selected-description', panel).textContent = $('.home-oil-text', button).textContent;
      $('[data-home-enquire]', panel).dataset.preset = key;
      if (focus) button.focus();
    }

    homeTabs.forEach(function (button, index) {
      button.addEventListener('click', function () { select(index, false); });
      button.addEventListener('keydown', function (event) {
        var next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % homeTabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + homeTabs.length - 1) % homeTabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = homeTabs.length - 1;
        else return;
        event.preventDefault();
        select(next, true);
      });
    });
    select(0, false);
  })();

  /* A short entrance on arrival; content is visible if scripting is unavailable. */
  if ('IntersectionObserver' in window && !reduce.matches) {
    var arrivals = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (!doc.classList.contains('motion-paused')) entry.target.classList.add('entrance');
        arrivals.unobserve(entry.target);
      });
    }, { threshold: .1 });
    $$('.home-section-head, .home-oil, .home-checks > div, .card, .promises li, .section-head, .faq-list').forEach(function (element) { arrivals.observe(element); });
  }

  // A local wash of colour follows the pointer inside each card.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce.matches) {
    $$('.card, .home-oil').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        if (reduce.matches || doc.classList.contains('motion-paused')) return;
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', (event.clientX - rect.left).toFixed(1) + 'px');
        card.style.setProperty('--my', (event.clientY - rect.top).toFixed(1) + 'px');
      });
    });
  }

  /* ---------- Header and progress line ---------- */

  var progressBar = $('.progress');
  var darkZones = $$('.hero, .page-hero, .footer');
  var lastY = window.scrollY;
  var ticking = false;
  var scrollVisuals = [];

  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    header.classList.toggle('is-scrolled', y > 24);
    // Light text over the dark areas; the light style everywhere else.
    var mid = header.offsetHeight / 2;
    header.classList.toggle('on-light', !darkZones.some(function (z) {
      var r = z.getBoundingClientRect();
      return r.top <= mid && r.bottom >= mid;
    }));
    if (!nav.classList.contains('open')) {
      if (y > lastY + 6 && y > vh * 0.7) header.classList.add('is-hidden');
      else if (y < lastY - 6 || y < vh * 0.7) header.classList.remove('is-hidden');
    }
    lastY = y;

    var max = doc.scrollHeight - vh;
    progressBar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    scrollVisuals.forEach(function (sync) { sync(); });
  }
  function requestScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll);
  onScroll();

  var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  // Fade text out, change it, fade it back in.
  function swap(el, update) {
    clearTimeout(el._swap);
    el.classList.add('is-swapping');
    el._swap = setTimeout(function () { update(); el.classList.remove('is-swapping'); }, reduce.matches ? 0 : 220);
  }

  /* ---------- About: oil moves through an illustrated refinery ---------- */

  var refinery = $('.refinery');
  if (refinery) (function () {
    var stations = $$('.refinery-stage', refinery);
    var cards = $$('.stage-card');
    var buttons = $$('[data-refinery-stage]');
    var description = $('[data-refinery-description]');
    var current = 0, elapsed = 0, manualHold = 0;

    function setStage(index) {
      current = index;
      refinery.dataset.stage = String(index);
      refinery.style.setProperty('--journey-progress', ((index + 1) / stations.length).toFixed(2));
      stations.forEach(function (station, i) {
        station.classList.toggle('is-current', i === index);
        station.classList.toggle('is-done', i < index);
      });
      cards.forEach(function (card, i) { card.classList.toggle('is-current', i === index); });
      pressChoice(buttons, index);
      describeCard(cards[index], description);
      $('.refinery-step', refinery).textContent = '0' + (index + 1);
      $('.refinery-caption-title', refinery).textContent = cards[index] ? $('h3', cards[index]).textContent : '';
    }

    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { elapsed = 0; manualHold = 7500; setStage(index); });
    });
    setStage(0);
    live(refinery, function (dt) {
      if (manualHold > 0) { manualHold = Math.max(0, manualHold - dt); return; }
      elapsed += dt;
      if (elapsed >= 4300) { elapsed = 0; setStage((current + 1) % stations.length); }
    });
  })();

  /* ---------- About promises: follow the oil through four clear checkpoints ---------- */

  var promiseJourney = $('.promise-journey');
  if (promiseJourney) (function () {
    var buttons = $$('[data-promise-stage]');
    var stations = $$('.promise-station', promiseJourney);
    var drop = $('.promise-drop', promiseJourney);
    var points = [[160, 110], [460, 110], [460, 350], [160, 350]];
    var routes = [
      [points[0], points[1]],
      [points[1], [575, 110], [575, 350], points[2]],
      [points[2], points[3]],
      [points[3], points[3]]
    ].map(function (route) {
      var lengths = route.slice(1).map(function (point, index) { return Math.abs(point[0] - route[index][0]) + Math.abs(point[1] - route[index][1]); });
      return { points: route, lengths: lengths, total: lengths.reduce(function (sum, length) { return sum + length; }, 0) };
    });
    var details = [
      'Your oil is measured at your premises, where you can see it.',
      'Check the rate per litre for your oil type and confirm it before pickup.',
      'Receive payment when your oil is collected.',
      'Keep a digital receipt as a record of your collection.'
    ];
    var current = 0, elapsed = 0, manualHold = 0;

    function draw() {
      var travel = easeInOut(Math.max(0, Math.min(1, (elapsed - 2800) / 1400)));
      var route = routes[current];
      var distance = travel * route.total;
      var segment = 0;
      while (segment < route.lengths.length - 1 && distance > route.lengths[segment]) { distance -= route.lengths[segment]; segment++; }
      var from = route.points[segment], to = route.points[segment + 1];
      var fraction = route.lengths[segment] ? distance / route.lengths[segment] : 0;
      drop.setAttribute('transform', 'translate(' + (from[0] + (to[0] - from[0]) * fraction).toFixed(2) + ' ' + (from[1] + (to[1] - from[1]) * fraction).toFixed(2) + ')');
      drop.style.opacity = current === points.length - 1 ? String(1 - travel) : '1';
    }

    function setStage(index) {
      current = index;
      promiseJourney.dataset.stage = String(index);
      promiseJourney.style.setProperty('--promise-progress', String((index + 1) / points.length));
      stations.forEach(function (station, i) {
        station.classList.toggle('is-current', i === index);
        station.classList.toggle('is-done', i < index);
      });
      pressChoice(buttons, index);
      $('.promise-caption-title', promiseJourney).textContent = $('.promise-choice-label', buttons[index]).textContent;
      $('.promise-caption-detail', promiseJourney).textContent = details[index];
      draw();
    }

    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { elapsed = 0; manualHold = 7500; setStage(index); });
    });
    setStage(0);
    live(promiseJourney, function (dt) {
      if (manualHold > 0) { manualHold = Math.max(0, manualHold - dt); return; }
      elapsed += dt;
      if (elapsed >= 4200) { elapsed = 0; setStage((current + 1) % points.length); }
      else draw();
    });
  })();

  /* ---------- What we collect: the sample jar changes oil on its own ---------- */

  var oilStage = $('.oil-stage');
  if (oilStage) (function () {
    var HOLD = 4200;
    var index = 0, elapsed = 0;
    var dots = $$('.oil-dots i', oilStage);
    var name = $('.oil-stage-name', oilStage);
    var buttons = $$('[data-oil-preview]');
    var cards = $$('.oil-card');
    var description = $('[data-oil-description]');
    var manualSelection = false;

    function show(i) {
      index = i;
      var key = OIL_KEYS[i];
      oilStage.dataset.tone = key;
      $('.jar-label-type', oilStage).textContent = OILS[key].label;
      $('.jar-label-no', oilStage).textContent = OILS[key].sample;
      dots.forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
      cards.forEach(function (card, j) { card.classList.toggle('is-selected', j === i); });
      pressChoice(buttons, i);
      description.textContent = $('.points li', cards[i]).textContent;
      swap(oilStage, function () { name.textContent = oilText(key, 'name'); });
    }

    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () {
        selectedOilKey = OIL_KEYS[index];
        manualSelection = true;
        elapsed = 0;
        show(index);
      });
    });

    show(0);
    live(oilStage, function (dt) {
      if (manualSelection) return;
      elapsed += dt;
      if (elapsed >= HOLD) { elapsed = 0; show((index + 1) % OIL_KEYS.length); }
    });
  })();

  /* ---------- Pickup journeys: a marker travels the four selectable steps ---------- */

  var route = $('.route');
  if (route) (function () {
    var nodes = $$('.route-node', route);
    var fill = $('.route-fill', route);
    var drop = $('.route-drop', route);
    var caption = $('.route-caption', route);
    var homeJourney = route.classList.contains('route--pickup');
    var cards = homeJourney ? $$('.home-steps li', route) : $$('.step-card');
    var activeClass = homeJourney ? 'is-highlighted' : 'is-current';
    var buttons = $$('[data-route-step]');
    var description = $('[data-route-description]');
    var manualHold = 0;
    var last = nodes.length - 1;

    var REST = homeJourney ? 3400 : 2800, TRAVEL = homeJourney ? 1600 : 1300, FADE = 800;
    var STEPS = [];
    for (var k = 0; k < last; k++) STEPS.push({ rest: k }, { travel: k });
    STEPS.push({ rest: last }, { fade: true });
    var lengthOf = function (s) { return s.rest !== undefined ? REST : s.travel !== undefined ? TRAVEL : FADE; };
    var step = 0, stepTime = 0, current = -1;
    var homeControlled = false, homeTarget = 0, visualPosition = 0;

    function setStep(i) {
      if (i === current) return;
      current = i;
      route.dataset.step = String(i);
      cards.forEach(function (c, j) { c.classList.toggle(activeClass, j === i); });
      pressChoice(buttons, i);
      describeCard(cards[i], description);
      swap(caption, function () {
        $('.route-caption-no', caption).textContent = '0' + (i + 1);
        $('.route-caption-title', caption).textContent = cards[i] ? $('h3', cards[i]).textContent : '';
      });
    }

    function renderPosition(p, travelling, opacity, activeNode) {
      visualPosition = p;
      fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      fill.style.opacity = opacity === 1 ? '' : opacity.toFixed(3);
      drop.style.left = (12.5 + p * 75).toFixed(3) + '%';
      drop.style.opacity = opacity === 1 ? '' : opacity.toFixed(3);
      route.classList.toggle('is-travelling', travelling && !reduce.matches);
      nodes.forEach(function (node, j) {
        node.classList.toggle('is-on', p >= j / last - 0.001 && !(opacity < 1 && j > 0));
        node.classList.toggle('is-current', activeNode === j);
      });
    }

    function draw() {
      var s = STEPS[step];
      var x = stepTime / lengthOf(s);
      var p = s.rest !== undefined ? s.rest / last : s.travel !== undefined ? (s.travel + easeInOut(x)) / last : 1;
      renderPosition(p, s.travel !== undefined, s.fade ? 1 - x : 1, s.rest);
    }

    function followHome(p) {
      homeControlled = true;
      homeTarget = Math.max(0, Math.min(1, p));
      setStep(Math.round(homeTarget * last));
      if (!reduce.matches && doc.classList.contains('motion-paused')) renderPosition(homeTarget, false, 1, current);
    }

    function advance(dt) {
      if (homeJourney && homeControlled) {
        var next = visualPosition + (homeTarget - visualPosition) * (1 - Math.exp(-dt / 110));
        if (Math.abs(homeTarget - next) < .0005) next = homeTarget;
        renderPosition(next, Math.abs(homeTarget - next) > .0005, 1, current);
        return;
      }
      if (manualHold > 0) { manualHold = Math.max(0, manualHold - dt); return; }
      stepTime += dt;
      while (stepTime >= lengthOf(STEPS[step])) {
        stepTime -= lengthOf(STEPS[step]);
        step = STEPS[step].fade ? 0 : step + 1;
        if (STEPS[step].rest !== undefined) setStep(STEPS[step].rest);
      }
      draw();
    }

    function setStatic() {
      var isStatic = reduce.matches;
      route.classList.toggle('is-static', isStatic);
      if (isStatic) {
        fill.style.transform = '';
        fill.style.opacity = '';
        route.classList.remove('is-travelling');
      } else if (homeJourney && homeControlled) {
        renderPosition(homeTarget, false, 1, current);
      } else {
        draw();
      }
      cards.forEach(function (c, j) { c.classList.toggle(activeClass, j === current); });
    }

    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () {
        if (homeJourney) { followHome(index / last); return; }
        step = index * 2;
        stepTime = 0;
        manualHold = 7500;
        setStep(index);
        if (!reduce.matches) draw();
      });
    });

    setStep(0);
    setStatic();
    reduce.addEventListener('change', setStatic);
    live(route, advance);

    if (homeJourney) {
      // Use native page scrolling; one shared animation frame batches geometry reads.
      function followScroll() {
        if (document.hidden || reduce.matches || doc.classList.contains('motion-paused') || doc.classList.contains('menu-locked')) return;
        var bounds = route.getBoundingClientRect();
        if (bounds.top > window.innerHeight * .9 || bounds.bottom < 0) return;
        followHome((window.innerHeight * .55 - bounds.top) / Math.max(bounds.height, 1));
      }
      scrollVisuals.push(followScroll);
      cards.forEach(function (card, index) {
        card.addEventListener('pointerenter', function (event) {
          if (event.pointerType === 'mouse' || event.pointerType === 'pen') followHome(index / last);
        });
        card.addEventListener('focusin', function () { followHome(index / last); });
      });
      if (window.scrollY > 0) followScroll();
    }
  })();

  /* ---------- Seller app: switch real preview screens, without a fake booking ---------- */

  var phone = $('.phone');
  if (phone) (function () {
    var screens = $$('.screen', phone);
    var buttons = $$('[data-app-screen]');
    var indicators = $$('.phone-status i', phone);
    var description = $('[data-app-description]');
    var features = $$('[data-app-feature]');
    var current = 0, elapsed = 0, manualHold = 0;

    function show(index) {
      current = index;
      screens.forEach(function (screen, i) { screen.classList.toggle('is-active', i === index); });
      indicators.forEach(function (indicator, i) { indicator.classList.toggle('is-on', i === index); });
      features.forEach(function (card, i) { card.classList.toggle('is-current', i === index); });
      pressChoice(buttons, index);
      describeCard(features[index], description);
    }

    phone.classList.add('is-controlled');
    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { elapsed = 0; manualHold = 8000; show(index); });
    });
    show(0);
    live(phone, function (dt) {
      if (manualHold > 0) { manualHold = Math.max(0, manualHold - dt); return; }
      elapsed += dt;
      if (elapsed >= 4500) { elapsed = 0; show((current + 1) % screens.length); }
    });
  })();

  /* ---------- FAQs: the quick-answers chat types itself ---------- */

  var chat = $('.chat');
  if (chat) (function () {
    var bubbles = $$('.bubble', chat);
    var typing = $('.typing', chat);

    // Each pair: the question appears, the answer is "typed", then the next pair.
    var events = [];
    var at = 500;
    for (var p = 0; p + 1 < bubbles.length; p += 2) {
      events.push({ at: at, show: bubbles[p] });
      events.push({ at: at + 700, typing: true });
      events.push({ at: at + 2100, show: bubbles[p + 1], typing: false });
      at += 3900;
    }
    var FADE_AT = at + 1800, END = FADE_AT + 900;
    var time = 0, next = 0;

    function reset() {
      time = 0;
      next = 0;
      bubbles.forEach(function (b) { b.classList.remove('is-shown'); });
      typing.classList.remove('is-shown');
      chat.classList.remove('is-fading');
    }

    function advance(dt) {
      time += dt;
      while (next < events.length && time >= events[next].at) {
        var e = events[next++];
        if (e.show) e.show.classList.add('is-shown');
        if (e.typing !== undefined) typing.classList.toggle('is-shown', e.typing);
      }
      if (time >= FADE_AT) chat.classList.add('is-fading');
      if (time >= END) reset();
    }

    // Without motion every answer simply shows.
    function setStatic() {
      chat.classList.toggle('is-live', !reduce.matches);
      if (reduce.matches) reset();
    }
    setStatic();
    reduce.addEventListener('change', setStatic);
    live(chat, advance);
  })();

  /* ---------- FAQ search filters the actual questions and answers ---------- */

  var search = $('#faq-search');
  if (search) (function () {
    var answers = $$('#faq-answers details');
    var status = $('#faq-search-status');
    var empty = $('.faq-no-results');
    var beforeSearch = [];
    var searching = false;

    function filter() {
      var query = search.value.trim().toLocaleLowerCase();
      var words = query.split(/\s+/).filter(Boolean);
      if (query && !searching) beforeSearch = answers.map(function (answer) { return answer.open; });
      var count = 0;
      answers.forEach(function (answer, index) {
        var text = answer.textContent.toLocaleLowerCase();
        var match = words.every(function (word) { return text.indexOf(word) !== -1; });
        answer.hidden = !match;
        if (match) count++;
        if (query) answer.open = match;
        else if (searching) answer.open = beforeSearch[index];
      });
      searching = !!query;
      empty.hidden = count > 0;
      status.textContent = count + (query ? ' answers found' : ' questions');
    }

    search.addEventListener('input', filter);
    $('[data-clear-search]').addEventListener('click', function () { search.value = ''; filter(); search.focus(); });
    filter();
  })();

  /* ---------- Dialogs ---------- */

  var pickup = $('#pickup-dialog');
  var appDialog = $('#app-dialog');
  var form = $('#pickup-form');
  var result = $('#enquiry-result');

  function presetOil(key) {
    if (!OILS[key]) return;
    var radio = form.querySelector('input[name="oil"][value="' + OILS[key].value + '"]');
    if (radio) radio.checked = true;
  }

  function openDialog(d) {
    if (d.open) return;
    d.showModal();
    doc.classList.add('menu-locked');
  }

  $$('[data-pickup]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.preset || selectedOilKey) presetOil(btn.dataset.preset || selectedOilKey);
      openDialog(pickup);
    });
  });
  $$('[data-app]').forEach(function (btn) {
    btn.addEventListener('click', function () { openDialog(appDialog); });
  });

  $$('dialog').forEach(function (d) {
    $$('.close, [data-close]', d).forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.addEventListener('click', function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
    d.addEventListener('close', function () {
      if ($$('dialog').some(function (x) { return x.open; })) return;
      doc.classList.remove('menu-locked');
    });
  });

  /* ---------- Pickup enquiry ---------- */

  var summary = '';

  function validate() {
    var firstBad = null;
    $$('.field', form).forEach(function (field) {
      var input = $('input', field);
      var value = input.value.trim();
      var ok = value.length > 0;
      if (ok && input.type === 'number') {
        var n = Number(value);
        ok = isFinite(n) && n >= 1 && n <= 100000;
      }
      field.classList.toggle('invalid', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  $$('.field input', form).forEach(function (input) {
    input.addEventListener('input', function () {
      var field = input.closest('.field');
      if (field.classList.contains('invalid') && input.value.trim()) {
        field.classList.remove('invalid');
        input.removeAttribute('aria-invalid');
      }
    });
  });

  function writeSummary() {
    var f = new FormData(form);
    var key = OIL_KEYS.filter(function (k) { return OILS[k].value === f.get('oil'); })[0];
    summary = 'BLACK GOLD — PICKUP ENQUIRY\n\n' +
      'Business: ' + f.get('business').trim() + '\n' +
      'Locality: ' + f.get('area').trim() + ', Chennai\n' +
      'Oil type: ' + (key ? oilText(key, 'title') : f.get('oil')) + '\n' +
      'Approximate quantity: ' + Number(f.get('quantity')) + ' ' + f.get('unit') + '\n\n' +
      'Please confirm the current rate, minimum quantity, collection charges and pickup availability.\n\n' +
      'Prepared enquiry only — no pickup has been booked.';
    $('#enquiry-text').textContent = summary;
    $('#whatsapp-enquiry').href = 'https://wa.me/?text=' + encodeURIComponent(summary);
    $('.copy-status').textContent = '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    writeSummary();
    form.hidden = true;
    result.hidden = false;
    $('h3', result).focus();
  });

  $('#edit-enquiry').addEventListener('click', function () {
    result.hidden = true;
    form.hidden = false;
    $('input[name="business"]', form).focus();
  });

  $('#download-enquiry').addEventListener('click', function () {
    var url = URL.createObjectURL(new Blob([summary], { type: 'text/plain;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Black-Gold-Pickup-Enquiry.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  $('#copy-enquiry').addEventListener('click', function () {
    var status = $('.copy-status');
    function fallback() {
      var area = document.createElement('textarea');
      area.value = summary;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      pickup.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      area.remove();
      status.textContent = ok ? 'Copied. Paste it into a message to Black Gold.' : 'Copy is unavailable here — download the summary instead.';
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(summary).then(function () {
        status.textContent = 'Copied. Paste it into a message to Black Gold.';
      }, fallback);
    } else {
      fallback();
    }
  });

  $('#year').textContent = new Date().getFullYear();
})();
