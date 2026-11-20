/* Where visitors come from, and Meta ad measurement. Loaded only when src/config/site.json
   sets leadsEndpoint or metaPixelId. app.js reads window.BlackGoldTracking when it sends a
   website enquiry, so the office can see which advert or listing brought it. */
(function () {
  var STORE_KEY = 'bg-touch';
  var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  var FIELDS = { utm_source: 'utmSource', utm_medium: 'utmMedium', utm_campaign: 'utmCampaign', utm_content: 'utmContent', utm_term: 'utmTerm', fbclid: 'fbclid', gclid: 'gclid' };

  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return saved && Date.now() - saved.at < MAX_AGE_MS ? saved : null;
    } catch (err) { return null; }
  }
  function write(touch) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(touch)); } catch (err) { /* private mode: keep it for this page only */ }
  }
  function clip(value, max) { return value ? String(value).slice(0, max) : undefined; }

  // The latest visit that came from somewhere (an ad, a search, another site) wins; plain
  // visits and moves between our own pages keep the last one for up to 30 days.
  var touch = read();
  var here = new URL(location.href);
  var fromLink = {};
  var tagged = false;
  Object.keys(FIELDS).forEach(function (param) {
    var value = here.searchParams.get(param);
    if (value) { fromLink[FIELDS[param]] = clip(value.trim(), param === 'fbclid' || param === 'gclid' ? 500 : 200); tagged = true; }
  });
  var referrer = '';
  try {
    var ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.hostname !== here.hostname && ref.hostname !== 'www.' + here.hostname) referrer = ref.origin + ref.pathname;
  } catch (err) { referrer = ''; }
  if (tagged || referrer) {
    touch = fromLink;
    touch.referrer = clip(referrer, 500);
    touch.landingPage = clip(here.href, 500);
    touch.at = Date.now();
    write(touch);
  }
  var current = touch || { landingPage: clip(here.href, 500), at: Date.now() };

  function cookie(name) {
    var match = (document.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  /* ---------- Meta Pixel (only with a Pixel ID in site.json) ---------- */
  var pixelTag = document.querySelector('meta[name="bg-meta-pixel"]');
  var pixelId = pixelTag && pixelTag.getAttribute('content');
  if (pixelId) {
    /* Meta's standard loader, kept in this file so the page needs no inline script. */
    var fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
    // No automatic button or form scanning: Meta gets page views and the events below only,
    // as the privacy policy says. The phone number reaches Meta hashed, from the server.
    fbq('set', 'autoConfig', false, pixelId);
    fbq('init', pixelId);
    fbq('track', 'PageView');
  }

  function track(name, params, eventId) {
    if (typeof window.fbq !== 'function') return;
    window.fbq('track', name, params || {}, eventId ? { eventID: eventId } : undefined);
  }
  function trackCustom(name, params) {
    if (typeof window.fbq === 'function') window.fbq('trackCustom', name, params || {});
  }

  // Google Play links carry where the visitor came from (Play's "referrer" parameter), so
  // Play Console can show store visits and installs per ad campaign. Visitors without a
  // campaign count as the website itself.
  function playReferrer() {
    var params = new URLSearchParams();
    params.set('utm_source', current.utmSource || 'myblackgold.app');
    params.set('utm_medium', current.utmMedium || (current.utmSource ? 'unknown' : 'website'));
    params.set('utm_campaign', current.utmCampaign || (document.body && document.body.getAttribute('data-page')) || 'website');
    if (current.utmContent) params.set('utm_content', current.utmContent);
    return params.toString();
  }

  // Calls, WhatsApp chats and emails started from the site count as contacts; a tap on a
  // Google Play button is "PlayStoreClick" (a custom event to build a Meta custom conversion on).
  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    var play = event.target.closest('a[data-app-download="googlePlay"][href]');
    if (play) {
      try {
        var url = new URL(play.getAttribute('href'));
        url.searchParams.set('referrer', playReferrer());
        play.setAttribute('href', url.href);
      } catch (err) { /* keep the plain store link */ }
      trackCustom('PlayStoreClick', { page: document.body ? document.body.getAttribute('data-page') : '' });
      return;
    }
    var link = event.target.closest('a[href^="tel:"], a[href^="https://wa.me/"], a[href^="mailto:"]');
    if (link) track('Contact', { method: link.href.slice(0, 4) === 'tel:' ? 'phone' : link.href.indexOf('wa.me') > -1 ? 'whatsapp' : 'email' });
  });

  window.BlackGoldTracking = {
    // Attribution fields for POST /leads.
    attribution: function () {
      var out = {};
      ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'fbclid', 'gclid', 'referrer', 'landingPage'].forEach(function (key) {
        if (current[key]) out[key] = current[key];
      });
      var fbp = cookie('_fbp');
      var fbc = cookie('_fbc');
      if (fbp) out.fbp = clip(fbp, 200);
      if (fbc) out.fbc = clip(fbc, 600);
      return out;
    },
    track: track
  };
})();
