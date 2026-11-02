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
    if (card && target) target.textContent = card.dataset.previewDescription || $$('.points li', card).map(function (point) { return point.textContent; }).join(' · ');
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

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menu.focus(); }
  });
  window.matchMedia('(min-width: 1025px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });

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
    $$('.hero, .page-hero-visual, .promise-journey, .route--pickup, #what-we-collect, .sj-panel, [data-install-preview]').forEach(function (visual) { visualObserver.observe(visual); });
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
    $$('.home-section-head, .home-oil, .card, .section-head, .faq-list').forEach(function (element) { arrivals.observe(element); });
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

  /* ---------- Home and About: one illustrated promise scene at a time ---------- */

  var promiseJourney = $('.promise-journey');
  if (promiseJourney) (function () {
    var HOLD = 5600;
    var section = promiseJourney.closest('.promise-section');
    var buttons = $$('[data-promise-stage]', section);
    var scenes = $$('[data-promise-scene]', promiseJourney);
    var milestones = $$('.promise-milestone', promiseJourney);
    var details = buttons.map(function (button) { return $('.promise-choice-detail', button).textContent; });
    var announcement = $('[data-promise-announcement]', section);
    var current = 0, elapsed = 0, manualHold = 0;
    var hovered = null;

    function clamp(value) { return Math.max(0, Math.min(1, value)); }

    // One clock drives the artwork and timeline, so pause, visibility and
    // reduced-motion preferences also stop every detail inside each scene.
    function draw() {
      var time = reduce.matches ? HOLD : elapsed;
      var action = easeInOut(clamp((time - 400) / 2700));
      var complete = easeInOut(clamp((time - 2700) / 900));
      var art = scenes[current];
      art.style.setProperty('--promise-action', String(action));
      art.style.setProperty('--promise-complete', String(complete));
      promiseJourney.style.setProperty('--promise-phase', String(clamp(time / HOLD)));
      art.style.setProperty('--promise-pour', String(reduce.matches ? 0 : clamp(time / 350) * (1 - clamp((time - 2600) / 500))));
      art.style.setProperty('--promise-time', String(time));
      art.style.setProperty('--promise-float', (reduce.matches ? 0 : Math.sin(time / 900) * -3).toFixed(2) + 'px');
    }

    function setStage(index, announce) {
      current = index;
      promiseJourney.dataset.stage = String(index);
      $('[data-promise-count]', promiseJourney).textContent = '0' + (index + 1);
      scenes.forEach(function (scene, i) { scene.classList.toggle('is-active', i === index); });
      milestones.forEach(function (milestone, i) {
        milestone.classList.toggle('is-current', i === index);
        milestone.classList.toggle('is-done', i < index);
      });
      pressChoice(buttons, index);
      $('.promise-caption-title', promiseJourney).textContent = $('.promise-choice-label', buttons[index]).textContent;
      $('.promise-caption-detail', promiseJourney).textContent = details[index];
      if (announce) announcement.textContent = 'Promise ' + (index + 1) + ' of ' + scenes.length + '. ' + $('.promise-choice-label', buttons[index]).textContent + '. ' + details[index];
      draw();
    }

    function choose(index) {
      elapsed = doc.classList.contains('motion-paused') ? HOLD : 0;
      manualHold = 7500;
      setStage(index, true);
    }

    buttons.forEach(function (button, index) {
      button.addEventListener('pointerenter', function (event) {
        if (event.pointerType !== 'mouse') return;
        hovered = index;
        if (current === index) return;
        elapsed = doc.classList.contains('motion-paused') ? HOLD : 0;
        setStage(index);
      });
      button.addEventListener('pointerleave', function () {
        if (hovered !== index) return;
        hovered = null;
        manualHold = Math.max(manualHold, 2000);
      });
      button.addEventListener('click', function () { choose(index); });
      button.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(index + 1, buttons.length - 1);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(index - 1, 0);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next].focus();
        choose(next);
      });
    });
    setStage(0);
    reduce.addEventListener('change', draw);
    live(promiseJourney, function (dt) {
      elapsed += dt;
      if (hovered !== null) { draw(); return; }
      if (manualHold > 0) {
        manualHold = Math.max(0, manualHold - dt);
        draw();
        return;
      }
      if (elapsed >= HOLD) { elapsed = 0; setStage((current + 1) % scenes.length); }
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

  /* ---------- Seller App story: scroll selects the scene; manual controls stay in charge ---------- */

  // Decorative only: this sequence never searches a store or downloads an app.
  var installPreview = $('[data-install-preview]');
  if (installPreview) (function () {
    var query = $('[data-install-query]', installPreview);
    var suggestion = $('[data-install-suggestion]', installPreview);
    var action = $('[data-install-action]', installPreview);
    var secondary = $('[data-install-secondary]', installPreview);
    var ring = $('[data-install-ring]', installPreview);
    var subtitle = $('[data-install-subtitle]', installPreview);
    var percent = $('[data-install-percent]', installPreview);
    var status = $('[data-install-status]', installPreview);
    var markers = $$('[data-install-marker]', installPreview);
    var keys = $$('[data-install-key]', installPreview);
    var searchText = 'Black Gold Seller';
    var durations = [4000, 2800, 5200, 4200];
    var labels = ['Search for Black Gold Seller.', 'Open the listing and choose Install.', 'Downloading and installing Black Gold…', 'Installed. Open your seller app.'];
    var phase = 0, elapsed = 0, currentKey = '';

    function stateValue(name, value) {
      var next = String(value);
      if (installPreview.dataset[name] !== next) installPreview.dataset[name] = next;
    }

    function render() {
      var state = String(phase);
      if (installPreview.dataset.phase !== state) {
        installPreview.dataset.phase = state;
        markers.forEach(function (marker, i) { marker.classList.toggle('is-current', i === phase); });
      }
      var typed = phase === 0 ? searchText.slice(0, Math.max(0, Math.floor((elapsed - 500) / 105))) : searchText;
      if (query.textContent !== typed) query.textContent = typed;
      if (suggestion.textContent !== typed) suggestion.textContent = typed;
      stateValue('searchReady', typed.length === searchText.length);
      var label = phase < 2 ? 'Install' : 'Open';
      if (action.textContent !== label) action.textContent = label;
      var progress = phase === 3 ? 1 : phase === 2 ? Math.min(1, elapsed / durations[2]) : 0;
      var downloaded = Math.min(1, progress / .82);
      var installing = phase === 2 && downloaded === 1;
      stateValue('installing', installing);
      ring.style.strokeDashoffset = (226.2 * (1 - downloaded)).toFixed(2);
      var amount = Math.round(downloaded * 100) + '%';
      if (percent.textContent !== amount) percent.textContent = amount;
      var detail = phase === 3 ? 'Installed' : phase === 2 ? installing ? 'Installing…' : 'Downloading…' : 'Business';
      if (subtitle.textContent !== detail) subtitle.textContent = detail;
      var secondaryLabel = phase === 3 ? 'Uninstall' : 'Cancel';
      if (secondary.textContent !== secondaryLabel) secondary.textContent = secondaryLabel;
      var launched = phase === 3 && elapsed >= 2300 && !reduce.matches;
      stateValue('launched', launched);
      var statusLabel = launched ? 'Black Gold is ready for your first collection.' : labels[phase];
      if (status.textContent !== statusLabel) status.textContent = statusLabel;
      var typing = phase === 0 && typed.length > 0 && typed.length < searchText.length && (elapsed - 500) % 105 < 75;
      var pressedKey = typing ? typed.slice(-1).toLowerCase() : '';
      if (pressedKey !== currentKey) {
        keys.forEach(function (key) { key.classList.toggle('is-pressed', key.dataset.installKey === pressedKey); });
        currentKey = pressedKey;
      }
    }

    function applyPreference() {
      phase = reduce.matches ? 3 : 0;
      elapsed = 0;
      render();
    }

    applyPreference();
    reduce.addEventListener('change', applyPreference);
    live(installPreview, function (dt) {
      elapsed += dt;
      while (elapsed >= durations[phase]) {
        elapsed -= durations[phase];
        phase = (phase + 1) % durations.length;
      }
      render();
    });
  })();

  var sellerJourney = $('.seller-journey');
  if (sellerJourney) (function () {
    var panel = $('.sj-panel', sellerJourney);
    var steps = $$('.seller-journey-step', sellerJourney);
    var scenes = $$('[data-journey-scene]', sellerJourney);
    var buttons = $$('[data-journey-go]', sellerJourney);
    var truck = $('.sj-truck', sellerJourney);
    var road = $('.sj-road', sellerJourney);
    var current = -1;

    function show(index, announce) {
      index = Math.max(0, Math.min(steps.length - 1, index));
      if (index !== current) {
        current = index;
        sellerJourney.dataset.step = String(index);
        steps.forEach(function (step, i) {
          step.classList.toggle('is-current', i === index);
          if (i === index) step.setAttribute('aria-current', 'step');
          else step.removeAttribute('aria-current');
        });
        scenes.forEach(function (scene, i) { scene.classList.toggle('is-active', i === index); });
        pressChoice(buttons, index);
        buttons.forEach(function (button, i) { button.classList.toggle('is-complete', i < index); });
        $('[data-journey-count]', panel).textContent = '0' + (index + 1);
        $('[data-journey-role]', panel).textContent = steps[index].dataset.journeyRole;
        $('[data-journey-title]', panel).textContent = $('h3', steps[index]).textContent;
        $('[data-journey-description]', panel).textContent = steps[index].dataset.journeySummary;
        var progress = index / (steps.length - 1);
        truck.style.transform = 'translateX(' + (30 + progress * 396).toFixed(2) + 'px)';
        road.style.strokeDashoffset = (448 * (1 - progress)).toFixed(2);
      }
      // Scroll does not flood screen readers with announcements or move focus.
      if (announce) $('[data-journey-announcement]', panel).textContent = 'Step ' + (index + 1) + ' of ' + steps.length + '. ' + $('h3', steps[index]).textContent + ' ' + steps[index].dataset.journeySummary;
      measurePanel();
    }

    function measurePanel() {
      sellerJourney.style.setProperty('--sj-panel-height', Math.ceil(panel.getBoundingClientRect().height) + 'px');
    }

    function followScroll() {
      if (document.hidden || reduce.matches || doc.classList.contains('motion-paused') || doc.classList.contains('menu-locked')) return;
      var bounds = sellerJourney.getBoundingClientRect();
      if (bounds.top > window.innerHeight * .9 || bounds.bottom < 0) return;
      var compact = window.innerWidth <= 1080 && window.innerHeight > 740;
      var panelBottom = panel.getBoundingClientRect().bottom;
      var anchor = compact ? Math.min(window.innerHeight - 40, panelBottom + Math.max(30, (window.innerHeight - panelBottom) * .4)) : window.innerHeight * .55;
      var nearest = 0, distance = Infinity;
      steps.forEach(function (step, i) {
        var rect = step.getBoundingClientRect();
        var nextDistance = Math.abs(rect.top + rect.height * .5 - anchor);
        if (nextDistance < distance) { distance = nextDistance; nearest = i; }
      });
      show(nearest, false);
    }

    sellerJourney.classList.add('is-enhanced');
    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () { show(index, true); });
      button.addEventListener('keydown', function (event) {
        var target;
        if (event.key === 'ArrowRight') target = Math.min(index + 1, steps.length - 1);
        else if (event.key === 'ArrowLeft') target = Math.max(index - 1, 0);
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = steps.length - 1;
        else return;
        event.preventDefault();
        buttons[target].focus();
        show(target, true);
      });
    });
    steps.forEach(function (step, index) {
      step.setAttribute('tabindex', '0');
      step.addEventListener('focusin', function () { show(index, false); });
      step.addEventListener('pointerenter', function (event) {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') show(index, false);
      });
    });
    scrollVisuals.push(followScroll);
    window.addEventListener('resize', measurePanel);
    liveSyncs.push(function () { if (!document.hidden) followScroll(); });
    show(0, false);
    if (window.scrollY > 0) followScroll();
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
      $$('.phone-nav > span', phone).forEach(function (tab, i) { tab.classList.toggle('on', i === (index === 0 ? 0 : 1)); });
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

  /* ---------- FAQ search filters the actual questions and answers ---------- */

  var search = $('#faq-search');
  var resetFaqSearch = null;
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
    resetFaqSearch = function () { search.value = ''; filter(); };
    filter();
  })();

  /* ---------- FAQs hero: a chat box that answers from the questions below ----------
     No server and no AI service: each question is matched against the FAQ list on
     the page (its words plus the data-keywords on each answer), so replies only ever
     repeat published answers. Rare words count for more than common ones like "oil". */

  var chatBox = $('[data-faq-chat]');
  if (chatBox) (function () {
    var log = $('[data-chat-log]', chatBox);
    var typing = $('[data-chat-typing]', chatBox);
    var suggest = $('[data-chat-suggest]', chatBox);
    var chatForm = $('[data-chat-form]', chatBox);
    var input = $('input', chatForm);
    var STOP = ' a an the is are am was were be been i im me my we our us you your it its this that these those do does did can could will would should shall may might must to of for in on at by from with and or but if so as about please tell know want need there here have has had any some what how which why also just really get got ';
    var GREETING = /^(hi|hello|hey|hai|vanakkam|namaste|good (morning|afternoon|evening))\b/;
    var THANKS = /\b(thanks|thank you|thankyou|thx)\b/;
    var MATCH = 3, FIELD_WEIGHTS = [3, 2, 1];
    var STARTERS = ['faq-price', 'faq-minimum', 'faq-payment', 'faq-area', 'faq-pickup-code', 'faq-oils'];
    var pending = 0;

    function stem(word) {
      if (word.length > 5 && /ing$/.test(word)) return word.slice(0, -3);
      if (word.length > 4 && /ed$/.test(word)) return word.slice(0, -2);
      if (word.length > 3 && /[^s]s$/.test(word)) return word.slice(0, -1);
      return word;
    }
    function words(text, keepAll) {
      return (text.toLocaleLowerCase().match(/[a-z0-9]+/g) || []).filter(function (word) {
        return keepAll || STOP.indexOf(' ' + word + ' ') === -1;
      }).map(stem);
    }
    // "measur" matches "measurement"; short words must match exactly.
    function same(a, b) {
      var short = a.length <= b.length ? a : b, long = short === a ? b : a;
      return a === b || (short.length >= 4 && long.indexOf(short) === 0);
    }
    function mentions(list, word) { return list.some(function (item) { return same(item, word); }); }

    var faqs = $$('#faq-answers details').map(function (item) {
      var body = $('.faq-body', item);
      var question = $('summary', item).textContent.trim();
      return {
        item: item, question: question, asked: false,
        points: $$('li', body).map(function (point) { return point.textContent.trim(); }),
        text: $$('p', body).map(function (para) { return para.textContent.trim(); }).join(' '),
        fields: [words(item.dataset.keywords || '', true), words(question, true), words(body.textContent, true)]
      };
    });

    function rank(query) {
      var terms = words(query).map(function (term) {
        var found = faqs.filter(function (faq) { return faq.fields.some(function (field) { return mentions(field, term); }); }).length;
        return { term: term, weight: found ? Math.log(1 + faqs.length / found) : 0 };
      });
      return faqs.map(function (faq, index) {
        var score = 0;
        terms.forEach(function (t) {
          for (var f = 0; f < FIELD_WEIGHTS.length; f++) {
            if (mentions(faq.fields[f], t.term)) { score += t.weight * FIELD_WEIGHTS[f]; break; }
          }
        });
        return { faq: faq, score: score, index: index };
      }).sort(function (a, b) { return b.score - a.score || a.index - b.index; });
    }

    function add(tag, parent, text, className) {
      var el = document.createElement(tag);
      if (className) el.setAttribute('class', className);
      if (text) el.textContent = text;
      parent.appendChild(el);
      return el;
    }

    // Suggested questions under the conversation, never one already answered.
    function offer(list) {
      suggest.textContent = '';
      list.filter(function (faq) { return !faq.asked; }).slice(0, 3).forEach(function (faq) {
        var chip = add('button', suggest, faq.question);
        chip.setAttribute('type', 'button');
        chip.setAttribute('data-chat-ask', faq.question);
      });
    }
    function starters() {
      return STARTERS.map(function (id) { return faqs.filter(function (faq) { return faq.item.id === id; })[0]; }).filter(Boolean).concat(faqs);
    }

    function reply(query) {
      var bubble = add('div', log, '', 'faq-msg faq-msg--bot');
      var lower = query.toLocaleLowerCase();
      var ranked = rank(query);
      var best = ranked[0];
      if (!best || best.score < MATCH) {
        if (GREETING.test(lower)) add('p', bubble, 'Hello! Ask me about prices, the 50-litre minimum, payment, pickup codes or where we collect.');
        else if (THANKS.test(lower)) add('p', bubble, 'You’re welcome. Anything else about selling your used oil?');
        else {
          add('p', bubble, 'I couldn’t find that in our FAQs. Try other words, or prepare a pickup enquiry and Black Gold will answer you.');
          var action = add('button', bubble, 'Prepare pickup enquiry', 'faq-msg-action');
          action.setAttribute('type', 'button');
          action.setAttribute('data-chat-enquiry', '');
        }
        offer(starters());
        return;
      }
      var faq = best.faq;
      faq.asked = true;
      add('p', bubble, faq.question, 'faq-msg-title');
      if (faq.points.length) {
        var list = add('ul', bubble);
        faq.points.forEach(function (point) { add('li', list, point); });
      }
      if (faq.text) add('p', bubble, faq.text);
      var link = add('a', bubble, 'See it in all questions', 'faq-msg-link');
      link.setAttribute('href', '#' + faq.item.id);
      link.setAttribute('data-chat-open', '');
      add('span', link, ' ↓').setAttribute('aria-hidden', 'true');
      offer(ranked.slice(1).filter(function (r) { return r.score > 0; }).map(function (r) { return r.faq; }).concat(starters()));
    }

    function scrollToEnd() { log.scrollTop = log.scrollHeight; }

    function ask(text) {
      text = text.trim().slice(0, 200);
      if (!text) { input.focus(); return; }
      add('div', log, text, 'faq-msg faq-msg--user');
      scrollToEnd();
      pending++;
      typing.hidden = reduce.matches;
      setTimeout(function () {
        reply(text);
        if (!--pending) typing.hidden = true;
        scrollToEnd();
      }, reduce.matches ? 0 : 650);
    }

    chatForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = input.value;
      input.value = '';
      ask(text);
      input.focus();
    });
    suggest.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-chat-ask]');
      if (chip) ask(chip.dataset.chatAsk);
    });
    log.addEventListener('click', function (event) {
      if (event.target.closest('[data-chat-enquiry]')) { openDialog(pickup); return; }
      var link = event.target.closest('[data-chat-open]');
      if (!link) return;
      var item = document.getElementById(link.getAttribute('href').slice(1));
      if (!item) return;
      if (item.hidden && resetFaqSearch) resetFaqSearch();
      item.open = true;
    });

    offer(starters());
    chatBox.hidden = false;
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
  var whatsappLink = $('#whatsapp-enquiry');
  var whatsappRecipient = whatsappLink.getAttribute('href');
  var emailLink = $('#email-enquiry');
  var emailRecipient = emailLink.getAttribute('href');

  function quantityRules() {
    var litres = $('input[name="unit"]:checked', form).value === 'Litres';
    var input = $('input[name="quantity"]', form);
    input.setAttribute('min', litres ? '50' : '1');
    input.setAttribute('placeholder', litres ? 'Minimum 50 litres' : 'Number of barrels');
    $('.field-error', input.closest('.field')).textContent = litres ? 'Enter 50 to 100,000 litres.' : 'Enter 1 to 100,000 barrels; confirm at least 50 litres total.';
    if (input.value.trim() && isFinite(Number(input.value)) && Number(input.value) >= (litres ? 50 : 1) && Number(input.value) <= 100000) {
      input.closest('.field').classList.remove('invalid');
      input.removeAttribute('aria-invalid');
    }
  }
  $$('input[name="unit"]', form).forEach(function (input) { input.addEventListener('change', quantityRules); });
  quantityRules();

  // Ten digits, typed with or without +91, 91 or a leading 0 (mobile or landline with its STD code).
  function phoneDigits(value) {
    var digits = value.replace(/[\s().-]/g, '').replace(/^(\+91|91(?=\d{10}$)|0(?=\d{10}$))/, '');
    return /^\d{10}$/.test(digits) ? digits : null;
  }

  // The area is picked from a scrolling list; "Other area" opens a box to type it in.
  var areaSelect = $('select[name="area"]', form);
  var areaOther = $('.area-other', form);
  areaSelect.addEventListener('change', function () {
    if (areaSelect.value) {
      areaSelect.closest('.field').classList.remove('invalid');
      areaSelect.removeAttribute('aria-invalid');
    }
    areaOther.hidden = areaSelect.value !== 'Other';
    if (areaOther.hidden) {
      areaOther.classList.remove('invalid');
      $('input', areaOther).removeAttribute('aria-invalid');
    } else {
      $('input', areaOther).focus();
    }
  });

  function validate() {
    var firstBad = null;
    $$('.field', form).forEach(function (field) {
      if (field.hidden) return;
      var input = $('input, select', field);
      var value = input.value.trim();
      var ok = value.length > 0;
      if (ok && input.type === 'number') {
        var n = Number(value);
        ok = isFinite(n) && n >= Number(input.getAttribute('min')) && n <= 100000;
      }
      if (ok && input.type === 'tel') ok = phoneDigits(value) !== null;
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
    var phone = phoneDigits(f.get('phone'));
    var area = f.get('area') === 'Other' ? f.get('areaOther').trim() : f.get('area');
    summary = 'BLACK GOLD — PICKUP ENQUIRY\n\n' +
      'Business: ' + f.get('business').trim() + '\n' +
      'Phone: +91 ' + phone.slice(0, 5) + ' ' + phone.slice(5) + '\n' +
      'Area: ' + area + '\n' +
      'Oil type: ' + (key ? oilText(key, 'title') : f.get('oil')) + '\n' +
      'Approximate quantity: ' + Number(f.get('quantity')) + ' ' + f.get('unit') + '\n\n' +
      'Minimum collection: 50 litres. For barrels, please confirm the total volume.\n' +
      'Please confirm the current rate, collection charges and pickup availability.\n\n' +
      'Prepared enquiry only — no pickup has been booked.';
    $('#enquiry-text').textContent = summary;
    whatsappLink.href = whatsappRecipient + '?text=' + encodeURIComponent(summary);
    emailLink.href = emailRecipient + '?subject=' + encodeURIComponent('Black Gold pickup enquiry') + '&body=' + encodeURIComponent(summary.replace(/\n/g, '\r\n'));
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
