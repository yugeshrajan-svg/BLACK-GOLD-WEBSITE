// Browser-independent smoke checks against the generated HTML and real scripts.
// This small DOM adapter checks behaviour; it does not verify browser layout.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const downloadLinks = JSON.parse(readFileSync('src/config/app-downloads.json','utf8'));
const contactDetails = JSON.parse(readFileSync('src/config/contact.json','utf8'));
const areaList = JSON.parse(readFileSync('src/config/areas.json','utf8'));

const decode = s => s.replace(/&(?:amp|lt|gt|quot|#39|#\d+);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[x] ?? String.fromCodePoint(+x.slice(2,-1))));
const escape = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));

function simple(node, selector) {
  if (!node || node.tag.startsWith('#')) return false;
  const attrs = [...selector.matchAll(/\[([^\]]+)\]/g)];
  const rest = selector.replace(/\[[^\]]+\]/g, '');
  if (/:checked\b/.test(rest) && !node.checked) return false;
  const tag = rest.match(/^[\w-]+/)?.[0];
  if (tag && tag.toLowerCase() !== node.tag) return false;
  if ([...rest.matchAll(/#([\w-]+)/g)].some(m => node.id !== m[1])) return false;
  if ([...rest.matchAll(/\.([\w-]+)/g)].some(m => !node.classList.contains(m[1]))) return false;
  return attrs.every(([, body]) => {
    const m = /^([^\s=^]+)(?:\s*(\^?=)\s*["']?([^"']*)["']?)?$/.exec(body);
    if (!m) throw new Error('Unsupported selector: ' + selector);
    if (!m[2]) return node.hasAttribute(m[1]);
    return m[2] === '=' ? node.getAttribute(m[1]) === m[3] : (node.getAttribute(m[1]) || '').startsWith(m[3]);
  });
}

function matches(node, selector) {
  return selector.split(',').some(part => {
    const tokens = part.trim().match(/(?:\[[^\]]*\]|[^\s\[\]])+/g) || [];
    function check(element, index) {
      if (!simple(element, tokens[index])) return false;
      if (!index) return true;
      if (tokens[index-1] === '>') return check(element.parentNode, index-2);
      for (let p = element.parentNode; p; p = p.parentNode) if (check(p, index-1)) return true;
      return false;
    }
    return !!tokens.length && check(node, tokens.length-1);
  });
}

class Element {
  constructor(tag, attrs = {}, doc) {
    this.tag = tag; this.attrs = attrs; this.ownerDocument = doc; this.children = []; this.listeners = {};
    this.style = {setProperty(k,v) { this[k] = v; }, getPropertyValue(k) { return this[k] || ''; }};
    const self = this;
    this.classList = {
      contains: c => (self.attrs.class || '').split(/\s+/).includes(c),
      add: (...cs) => { self.attrs.class = [...new Set([...(self.attrs.class || '').split(/\s+/).filter(Boolean), ...cs])].join(' '); },
      remove: (...cs) => { self.attrs.class = (self.attrs.class || '').split(/\s+/).filter(c => !cs.includes(c)).join(' '); },
      toggle(c, force) { const on = force ?? !this.contains(c); on ? this.add(c) : this.remove(c); return on; }
    };
    this.dataset = new Proxy({}, {
      get: (_, k) => self.getAttribute('data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase())),
      set: (_, k, v) => { self.setAttribute('data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase()), v); return true; }
    });
  }
  getAttribute(k) { return this.attrs[k] ?? null; }
  setAttribute(k,v) { this.attrs[k] = String(v); }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  toggleAttribute(k,on = !this.hasAttribute(k)) { on ? this.setAttribute(k,'') : this.removeAttribute(k); }
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
  querySelectorAll(selector) {
    const found = [];
    const walk = n => { for (const child of n.children) if (typeof child !== 'string') { if (matches(child,selector)) found.push(child); walk(child); } };
    walk(this); return found;
  }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  closest(s) { for (let n = this; n; n = n.parentNode) if (matches(n,s)) return n; return null; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
  set textContent(v) { this.children = [String(v)]; }
  get innerHTML() { return this.children.map(c => typeof c === 'string' ? escape(c) : c.outerHTML).join(''); }
  set innerHTML(v) { this.children = []; parse(String(v),this,this.ownerDocument); }
  get outerHTML() { return '<' + this.tag + Object.entries(this.attrs).map(([k,v]) => ' '+k+'="'+escape(v)+'"').join('')+'>'+this.innerHTML+(voids.has(this.tag) ? '' : '</'+this.tag+'>'); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  fire(type, extras = {}) {
    const event = {type, target:this, button:0, defaultPrevented:false, preventDefault(){this.defaultPrevented=true;}, stopPropagation(){this.stopped=true;}, ...extras};
    for (let n = this; n; n = n.parentNode) { for (const fn of n.listeners[type] || []) fn(event); if (event.stopped || extras.bubbles === false) break; }
    return event;
  }
  focus() { this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return {left:0, top:0, bottom:1000, right:300, width:300, height:80}; }
  get offsetHeight() { return 80; }
  get id() { return this.attrs.id || ''; }
  get lang() { return this.attrs.lang || ''; }
  set lang(v) { this.attrs.lang = v; }
  // A <select> reads and sets its value through its options, as in a browser.
  get value() {
    if (this.tag === 'option') return this.attrs.value ?? this.textContent;
    if (this.tag === 'select') { const options = this.querySelectorAll('option'); return (options.find(o => o.hasAttribute('selected')) || options[0])?.value ?? ''; }
    return this.attrs.value || '';
  }
  set value(v) {
    if (this.tag === 'select') { for (const o of this.querySelectorAll('option')) o.toggleAttribute('selected', o.value === String(v)); return; }
    this.attrs.value = String(v);
  }
  get type() { return this.attrs.type || 'text'; }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { this.toggleAttribute('hidden',v); }
  get open() { return this.hasAttribute('open'); }
  set open(v) { this.toggleAttribute('open',v); }
  get checked() { return this.hasAttribute('checked'); }
  set checked(v) {
    if (v && this.type === 'radio') this.ownerDocument.querySelectorAll('input').filter(n => n.attrs.name === this.attrs.name).forEach(n => n.removeAttribute('checked'));
    this.toggleAttribute('checked',v);
  }
  showModal() { this.open = true; }
  close() { this.open = false; this.fire('close',{bubbles:false}); }
}

function parse(html, root, doc) {
  const stack = [root];
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  for (const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const tag = token.slice(2,-1).trim().toLowerCase();
      for (let i = stack.length-1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
    } else if (token.startsWith('<')) {
      const tag = token.match(/^<([\w:-]+)/)?.[1].toLowerCase();
      if (!tag) continue;
      const attrs = {};
      const tail = token.slice(tag.length+1).replace(/\/?\s*>$/, '');
      for (const m of tail.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1]] = decode(m[2] ?? m[3] ?? m[4] ?? '');
      const node = new Element(tag,attrs,doc); stack.at(-1).appendChild(node);
      if (!voids.has(tag) && !token.endsWith('/>')) stack.push(node);
    } else stack.at(-1).children.push(decode(token));
  }
}

function load(file, reduced = false, browserLanguage = 'en', oilFactory) {
  const doc = new Element('#document'); doc.ownerDocument = doc;
  parse(readFileSync('dist/' + file,'utf8'),doc,doc);
  doc.documentElement = doc.querySelector('html'); doc.body = doc.querySelector('body');
  doc.documentElement.classList.add('js');
  assert.equal(doc.documentElement.lang,'en','Every page stays in English');
  assert.equal(doc.querySelector('.lang-toggle'),null,'The language switch has been removed');
  doc.title = doc.querySelector('title').textContent; doc.hidden = false; doc.documentElement.scrollHeight = 3000;
  doc.getElementById = id => doc.querySelector('#'+id);
  doc.createElement = tag => new Element(tag,{},doc);
  let seq = 0, now = 0; const frames = new Map(), timers = new Map(), memory = new Map(browserLanguage === 'ta' ? [['bg-lang','ta']] : []);
  const media = new Map();
  const windowEvents = {};
  const window = {
    document:doc, innerHeight:900, innerWidth:1440, scrollY:0,
    addEventListener(type,fn){(windowEvents[type] ||= []).push(fn);},
    matchMedia(query) { if (!media.has(query)) media.set(query,{matches:matchesViewport(query),listeners:[],addEventListener(type,fn){this.listeners.push(fn);}}); return media.get(query); }
  };
  function matchesViewport(query) {
    if (query.includes('reduced-motion')) return reduced;
    const ranges = [...query.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)];
    return ranges.length > 0 && ranges.every(([,bound,axis,value]) => bound === 'min'
      ? window[axis === 'width' ? 'innerWidth' : 'innerHeight'] >= +value
      : window[axis === 'width' ? 'innerWidth' : 'innerHeight'] <= +value);
  }
  const journey = doc.querySelector('.route--pickup');
  if (journey) journey.getBoundingClientRect = () => ({left:0, top:1800-window.scrollY, bottom:2400-window.scrollY, right:1000, width:1000, height:600});
  const sellerJourney = doc.querySelector('.seller-journey');
  if (sellerJourney) {
    sellerJourney.getBoundingClientRect = () => ({left:0, top:1800-window.scrollY, bottom:5200-window.scrollY, right:1200, width:1200, height:3400});
    sellerJourney.querySelector('.sj-panel').getBoundingClientRect = () => ({left:0, top:100, bottom:680, right:560, width:560, height:580});
    sellerJourney.querySelectorAll('.seller-journey-step').forEach((step,i) => {
      step.getBoundingClientRect = () => ({left:650, top:1800+i*420-window.scrollY, bottom:2160+i*420-window.scrollY, right:1200, width:550, height:360});
    });
  }
  if (oilFactory) window.OilSurface = oilFactory;
  const sandbox = {window, document:doc, navigator:{language:browserLanguage, languages:[browserLanguage]}, location:{href:'https://example.test/'+file+(browserLanguage === 'ta' ? '?lang=ta' : '')}, history:{state:null,replaceState(){}},
    localStorage:{getItem:k=>memory.get(k) ?? null,setItem:(k,v)=>memory.set(k,v)},
    URL, Blob, Date, console,
    requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;}, cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++seq,fn);return seq;}, clearTimeout:id=>timers.delete(id),
    FormData:class extends Map { constructor(form) { super(); for (const n of form.querySelectorAll('input, select')) if (n.attrs.name && (n.type !== 'radio' || n.checked)) this.set(n.attrs.name,n.value); } }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync('dist/app.js','utf8'),context,{filename:'app.js'});
  const q = s => doc.querySelector(s), qa = s => doc.querySelectorAll(s);
  return {doc,q,qa,
    scroll(y) { window.scrollY = y; (windowEvents.scroll || []).forEach(fn=>fn()); },
    setReduced(value) { reduced = value; const pref = window.matchMedia('(prefers-reduced-motion: reduce)'); pref.matches = value; pref.listeners.forEach(fn=>fn(pref)); },
    resize(width,height) {
      window.innerWidth = width; window.innerHeight = height;
      for (const [query,pref] of media) {
        const next = matchesViewport(query);
        if (next !== pref.matches) { pref.matches = next; pref.listeners.forEach(fn=>fn(pref)); }
      }
      (windowEvents.resize || []).forEach(fn=>fn());
    },
    flush() { while(timers.size) { const jobs=[...timers.values()]; timers.clear(); jobs.forEach(fn=>fn()); } },
    advance(ms) { for (let elapsed=0; elapsed<ms; elapsed+=100) { now+=100; const jobs=[...frames.values()]; frames.clear(); jobs.forEach(fn=>fn(now)); } },
    click:s=>{ const node=q(s); assert.ok(node,'Missing '+s); node.fire('click'); },
    search(text) { q('#faq-search').value=text; q('#faq-search').fire('input'); }
  };
}

for (const reduced of [false,true]) {
  for (const browserLanguage of ['en','ta']) {
    const home = load('index.html',reduced,browserLanguage);
    home.click('.hero .text-link');
    assert.equal(home.doc.activeElement,home.q('#seller-app'),'Section links retain keyboard focus at their destination');
    home.click('.header [data-app]');
    assert.equal(home.q('#app-dialog').open,true,'The header opens the app download panel');
    assert.equal(home.q('#pickup-dialog').open,false,'Getting the app must not open the enquiry form');
    home.q('#app-dialog').close();
    home.click('.hero-bottom .hero-enquiry');
    assert.equal(home.q('#pickup-dialog').open,true,'The hero corner button opens the pickup enquiry');
    home.q('#pickup-dialog').close();
    for (const [platform,url] of Object.entries(downloadLinks)) {
      const options = home.qa('[data-app-download="'+platform+'"]');
      assert.equal(options.length,url || platform === 'googlePlay' ? 3 : 0,'Show downloads and the Google Play coming-soon option in each download area');
      if (url) {
        assert.ok(home.q('.hero [data-app-download="'+platform+'"]'),'The hero offers each available download directly');
        options.forEach(option => assert.equal(option.getAttribute('href'),url));
      } else if (platform === 'googlePlay') {
        options.forEach(option => {
          assert.equal(option.getAttribute('aria-disabled'),'true');
          assert.equal(option.hasAttribute('href'),false);
          assert.match(option.textContent,/Coming soon/);
        });
      }
    }
    home.click('#app-dialog [data-close]');
    home.click('#pickup-process [data-route-step="2"]'); home.flush();
    assert.equal(home.q('.home-steps .is-highlighted h3').textContent,'Request a pickup');
    assert.equal(home.q('#pickup-journey-caption .route-caption-title').textContent,'Request a pickup');
    home.advance(5000);
    assert.equal(home.q('#pickup-process [data-route-step="2"]').getAttribute('aria-pressed'),'true','Manual pickup stage should hold');
    assert.equal(home.q('.phone'),null,'The full app demo belongs on the seller-app page');
    assert.equal(home.qa('#seller-app [data-install-preview]').length,1,'Meet your seller app uses the shared Play Store animation');
    assert.equal(home.q('.app-teaser-art'),null,'The old home phone illustration has been replaced');
    assert.equal(home.q('.chennai-scene'),null,'The old Chennai install animation has been replaced');
    assert.equal(home.qa('[data-app-feature]').length,0,'The homepage has a compact app introduction');
    assert.equal(home.qa('.home-oil-photo').length,3,'Keep the three homepage oil photos (engine, hydraulic, transformer)');
    assert.equal(home.qa('.faq-list').length,0,'Full answers belong on the FAQ page');
    assert.equal(home.q('#promise-title').textContent,'Our promise.');
    assert.equal(home.qa('#our-promises [data-promise-stage]').length,4,'The home page presents all four promises');
    const homeSections = home.q('#main').children.filter(node => node.tag === 'section').map(node => node.id);
    assert.equal(homeSections.indexOf('our-promises'),homeSections.indexOf('seller-app') + 1,'Our promise follows Meet your seller app directly');
    assert.ok(home.q('#get-app [data-app-download="googlePlay"] .store-icon-play'),'Show Google Play with its icon, including before launch');
    assert.equal(Boolean(home.q('#get-app [data-app-download="apk"]')),Boolean(downloadLinks.apk),'Show the configured direct APK download');
    assert.ok(home.q('#get-app .store-link--ios .store-icon-apple'),'The compact iOS button includes the Apple symbol');
    assert.ok(home.q('#get-app .store-link--ios').hasAttribute('disabled'),'The iOS coming-soon button is inactive');
    home.click('[data-home-oil="hydraulic"]');
    assert.equal(home.q('#home-oil-panel').dataset.tone,'hydraulic');
    assert.equal(home.q('[data-home-oil="hydraulic"]').getAttribute('aria-selected'),'true');
    home.click('[data-home-enquire]');
    assert.equal(home.q('input[value="Used hydraulic oil"]').checked,true);
    assert.equal(home.q('#pickup-dialog').open,true);
    home.q('[data-home-oil="hydraulic"]').fire('keydown',{key:'End'});
    assert.equal(home.q('[data-home-oil="transformer"]').getAttribute('aria-selected'),'true');
    assert.equal(home.q('#home-oil-panel').dataset.tone,'transformer');
    assert.equal(home.q('[data-home-oil="transformer"]').getAttribute('aria-selected'),'true');

    const about = load('about.html',reduced,browserLanguage);
    about.click('[data-refinery-stage="2"]'); about.flush();
    assert.equal(about.q('[data-refinery-stage="2"]').getAttribute('aria-pressed'),'true');
    assert.equal(about.q('.stage-card.is-current h3').textContent,about.q('[data-refinery-stage="2"]').textContent);
    assert.ok(about.q('[data-refinery-description]').textContent.length > 10);
    assert.equal(about.q('.refinery').dataset.stage,'2');
    assert.equal(about.qa('.refinery-stage.is-current').length,1);
    assert.equal(about.qa('.refinery-stage.is-done').length,2);
    assert.equal(about.q('.loop'),null);
    about.click('[data-promise-stage="3"]');
    assert.equal(about.q('.promise-journey').dataset.stage,'3');
    assert.equal(about.q('[data-promise-stage="3"]').getAttribute('aria-pressed'),'true');
    assert.equal(about.qa('[data-promise-scene].is-active').length,1);
    assert.equal(about.qa('.promise-milestone.is-done').length,3);
    assert.equal(about.q('.refinery').dataset.stage,'2','Promise selection must not change the refinery');
    about.advance(5000); assert.equal(about.q('.promise-journey').dataset.stage,'3','Manual promise selection should hold');
    assert.equal(about.q('.promise-caption-title').textContent,about.q('[data-promise-stage="3"] .promise-choice-label').textContent);
    assert.ok(about.q('.promise-caption-detail').textContent.length > 15);

    const collect = load('collect.html',reduced,browserLanguage);
    assert.ok(collect.q('#serve-title'),'Business eligibility belongs on What We Collect');
    assert.equal(collect.qa('.oil-stage .oil-photo').length,3,'One photo for each oil in the sample');
    collect.click('[data-oil-preview="transformer"]'); collect.flush();
    collect.advance(15000);
    assert.equal(collect.q('.oil-stage').dataset.tone,'transformer');
    assert.equal(collect.q('.oil-card.is-selected').dataset.oil,'transformer');
    assert.equal(collect.q('[data-oil-description]').textContent,'From industrial operations');
    collect.click('.page-hero-copy [data-pickup]');
    assert.equal(collect.q('input[value="Used transformer oil"]').checked,true);

    const app = load('seller-app.html',reduced,browserLanguage);
    assert.equal(app.qa('#app-workflow .seller-journey-step').length,8,'The Seller App journey keeps all eight readable steps');
    assert.equal(app.qa('#app-setup .seller-checklist li').length,4,'Setup explains the business, proof, location and payment requirements');
    assert.equal(app.qa('.seller-help-list details').length,4,'Account help covers language, listings, passwords and deletion');
    app.click('[data-journey-go="4"]');
    assert.equal(app.q('.seller-journey').dataset.step,'4');
    assert.equal(app.qa('[data-journey-scene].is-active').length,1,'Only the selected scene should be visible');
    assert.equal(app.q('[data-journey-scene="4"]').classList.contains('is-active'),true);
    assert.match(app.q('[data-journey-description]').textContent,/live location/);
    app.q('[data-journey-go="4"]').fire('keydown',{key:'End'});
    assert.equal(app.q('.seller-journey').dataset.step,'7','Keyboard End selects payment');
    assert.equal(app.doc.activeElement,app.q('[data-journey-go="7"]'));
    assert.equal(app.q('.sj-truck').style.transform,'translateX(426.00px)');
    assert.equal(app.qa('.seller-journey-step[aria-current="step"]').length,1);
    assert.match(app.q('[data-journey-announcement]').textContent,/Step 8 of 8/);
    app.advance(10000);
    assert.equal(app.q('.seller-journey').dataset.step,'7','The journey must not autoplay away from a selected step');
    app.q('[data-journey-go="7"]').fire('keydown',{key:'Home'});
    assert.equal(app.q('.seller-journey').dataset.step,'0');
    app.click('[data-app-screen="1"]');
    assert.ok(app.q('.phone .screen.s2').classList.contains('is-active'));
    assert.equal(app.qa('[data-app-feature].is-current').length,1);
    assert.equal(app.q('[data-app-feature].is-current h3').textContent,'Track your pickup');
    assert.equal(app.q('.phone-nav .on').textContent,'Orders','Tracking is part of Orders in the supplied app');
    assert.match(app.q('.phone-code p').textContent,/measured and loaded/);
    assert.equal(app.qa('.app-install-guide li').length,3);
    app.click('[data-app-screen="2"]');
    assert.ok(app.q('.screen.s3').classList.contains('is-active'));
    app.advance(5000);
    assert.ok(app.q('.screen.s3').classList.contains('is-active'),'Manual preview should hold');

    const faq = load('faq.html',reduced,browserLanguage);
    faq.search('Chennai');
    assert.equal(faq.qa('#faq-answers details').filter(n=>!n.hidden).length,1);
    faq.search('no-such-answer-4729'); assert.equal(faq.q('.faq-no-results').hidden,false);
    faq.click('[data-clear-search]'); assert.equal(faq.qa('#faq-answers details').filter(n=>!n.hidden).length,12);
    assert.equal(faq.q('.faq-no-results').hidden,true);
    faq.search('Does this website book');
    assert.equal(faq.qa('#faq-answers details').filter(n=>!n.hidden).length,1);
    assert.equal(faq.q('#faq-booking').hidden,false,'Keep the booking explanation when moving it from Home');
    faq.search('pickup code');
    assert.equal(faq.qa('#faq-answers details').filter(n=>!n.hidden).length,1);
    assert.equal(faq.q('#faq-pickup-code').hidden,false);
    faq.search('UPI');
    assert.equal(faq.q('#faq-payment').hidden,false);
    assert.equal(new URL(faq.q('#faq-support a').getAttribute('href')).pathname,contactDetails.email,'Support questions go to the configured email');
  }
}

// FAQ hero chat: everyday questions find the published answer; unknown ones offer an enquiry.
for (const reduced of [false,true]) {
  const chat = load('faq.html',reduced);
  const bots = () => chat.qa('[data-chat-log] .faq-msg--bot');
  const lastBot = () => bots().at(-1);
  const answerTitle = () => lastBot().querySelector('.faq-msg-title')?.textContent;
  const askChat = text => { chat.q('#faq-chat-input').value = text; chat.q('[data-chat-form]').fire('submit'); chat.flush(); };
  assert.equal(chat.q('[data-faq-chat]').hidden,false,'The chat box appears once scripts run');
  assert.equal(chat.qa('[data-chat-suggest] button').length,3,'Three suggested questions to start');
  for (const [question,title] of [
    ['how much do you pay per litre?','How is the price set?'],
    ['smallest amount of oil you collect','Is there a minimum quantity?'],
    ['can I get paid by UPI','How do I receive my payment?'],
    ['Do you collect in Chennai?','Where do you collect?'],
    ['OTP for the driver','When should I share my pickup code?'],
    ['who can register','Who can register?'],
    ['I want to cancel my listing','Can I change or cancel a submitted listing?'],
    ['do you take hydraulic oil','What oils can I sell?'],
    ['the driver measured less than I had','What if the measured quantity is different?'],
    ['can I book a pickup on this website','Does this website book my pickup?'],
    ['what is your email address','How do I contact Black Gold support?'],
    ['I need help from customer care','How do I contact Black Gold support?']
  ]) {
    const before = bots().length;
    askChat(question);
    assert.equal(chat.qa('[data-chat-log] .faq-msg--user').at(-1).textContent,question,'The visitor sees their own question');
    assert.equal(bots().length,before+1,'Each question gets one reply');
    assert.equal(answerTitle(),title,'"'+question+'" should find '+title);
    assert.equal(chat.q('#faq-chat-input').value,'','The field clears after sending');
  }
  const minimumAnswer = chat.qa('[data-chat-log] .faq-msg--bot').find(b => b.querySelector('.faq-msg-title')?.textContent === 'Is there a minimum quantity?');
  assert.match(minimumAnswer.textContent,/50 litres/,'Replies repeat the published answer');
  assert.ok(chat.qa('[data-chat-suggest] button').every(b => !['How is the price set?','Is there a minimum quantity?'].includes(b.textContent)),'Suggestions skip questions already answered');
  const replies = bots().length;
  askChat('   '); assert.equal(bots().length,replies,'An empty message sends nothing');
  askChat('hello'); assert.match(lastBot().textContent,/Ask me about/);
  askChat('what is the weather tomorrow');
  assert.equal(answerTitle(),undefined,'No guessing when nothing matches');
  chat.click('[data-chat-enquiry]'); assert.equal(chat.q('#pickup-dialog').open,true,'Unknown questions lead to the enquiry');
  chat.q('#pickup-dialog').close();
  const chip = chat.q('[data-chat-suggest] button');
  const chipText = chip.textContent;
  chip.fire('click'); chat.flush();
  assert.equal(answerTitle(),chipText,'Tapping a suggestion asks it');
  chat.search('Chennai');
  askChat('minimum quantity');
  chat.qa('[data-chat-open]').at(-1).fire('click');
  assert.equal(chat.q('#faq-minimum').open,true,'The answer link opens the full answer');
  assert.equal(chat.q('#faq-minimum').hidden,false,'and clears a search that was hiding it');
  assert.equal(chat.q('#faq-search').value,'');
}

assert.equal(existsSync('dist/how-it-works.html'),false,'The How it works page has been removed');
for (const file of ['index.html','about.html','collect.html','seller-app.html','faq.html']) {
  assert.equal(load(file).q('a[href^="how-it-works"]'),null,file+' must not link to the removed How it works page');
}
assert.ok(load('seller-app.html').q('#app-workflow'),'Process links lead to the Seller App journey');
assert.equal(load('collect.html').q('.page-hero-copy .text-link').getAttribute('href'),'seller-app.html#app-workflow');

const pickupJourney = load('index.html');
pickupJourney.advance(4200);
assert.ok(pickupJourney.q('.route--pickup').classList.contains('is-travelling'));
const truckPosition = parseFloat(pickupJourney.q('.pickup-truck').style.left);
assert.ok(truckPosition > 12.5 && truckPosition < 37.5,'The truck travels toward the next stop');
pickupJourney.advance(1100); pickupJourney.flush();
assert.equal(pickupJourney.q('.home-steps .is-highlighted h3').textContent,'Check your rate');
pickupJourney.click('#pickup-process [data-motion]');
const parkedPosition = pickupJourney.q('.pickup-truck').style.left;
pickupJourney.advance(10000);
assert.equal(pickupJourney.q('.pickup-truck').style.left,parkedPosition);
assert.equal(pickupJourney.q('.home-steps .is-highlighted h3').textContent,'Check your rate');
pickupJourney.click('#pickup-process [data-motion]');
pickupJourney.advance(5000);
assert.equal(pickupJourney.q('.home-steps .is-highlighted h3').textContent,'Request a pickup');
pickupJourney.doc.hidden = true; pickupJourney.doc.fire('visibilitychange');
pickupJourney.advance(10000);
assert.equal(pickupJourney.q('.home-steps .is-highlighted h3').textContent,'Request a pickup');
pickupJourney.doc.hidden = false; pickupJourney.doc.fire('visibilitychange');
pickupJourney.advance(5000);
assert.equal(pickupJourney.q('.home-steps .is-highlighted h3').textContent,'Get paid. Keep the receipt.');
const scrollPickup = load('index.html');
scrollPickup.scroll(1305); scrollPickup.advance(1000); scrollPickup.flush();
assert.equal(scrollPickup.q('.route--pickup').dataset.step,'0');
scrollPickup.scroll(1505); scrollPickup.advance(1000); scrollPickup.flush();
assert.equal(scrollPickup.q('.home-steps .is-highlighted h3').textContent,'Check your rate');
assert.ok(Math.abs(parseFloat(scrollPickup.q('.pickup-truck').style.left)-37.5) < .1);
scrollPickup.scroll(1705); scrollPickup.advance(1000); scrollPickup.flush();
assert.equal(scrollPickup.q('.route--pickup').dataset.step,'2');
scrollPickup.scroll(1905); scrollPickup.advance(1000); scrollPickup.flush();
assert.equal(scrollPickup.q('.route--pickup').dataset.step,'3');
assert.equal(scrollPickup.q('.pickup-truck').style.left,'87.500%');
scrollPickup.scroll(1505); scrollPickup.advance(1000);
assert.equal(scrollPickup.q('.route--pickup').dataset.step,'1','Scrolling upward takes the truck back');
scrollPickup.q('.home-steps li').fire('pointerenter',{pointerType:'mouse'});
scrollPickup.advance(1000); assert.equal(scrollPickup.q('.route--pickup').dataset.step,'0');
scrollPickup.qa('.home-steps li')[2].fire('focusin');
scrollPickup.advance(1000); assert.equal(scrollPickup.q('.route--pickup').dataset.step,'2');
scrollPickup.click('#pickup-process [data-motion]');
const scrollParked = scrollPickup.q('.pickup-truck').style.left;
scrollPickup.scroll(1910); scrollPickup.advance(1000);
assert.equal(scrollPickup.q('.pickup-truck').style.left,scrollParked,'Pause freezes scroll-driven motion');
scrollPickup.click('#pickup-process [data-motion]');
scrollPickup.scroll(1915); scrollPickup.advance(1000);
assert.equal(scrollPickup.q('.route--pickup').dataset.step,'3');
scrollPickup.doc.hidden = true; scrollPickup.doc.fire('visibilitychange');
scrollPickup.scroll(1505); scrollPickup.advance(1000);
assert.equal(scrollPickup.q('.route--pickup').dataset.step,'3');

const stillPickup = load('index.html',true);
stillPickup.advance(25000);
assert.ok(stillPickup.q('.route--pickup').classList.contains('is-static'));
assert.equal(stillPickup.q('.home-steps .is-highlighted h3').textContent,'Install and register');
stillPickup.click('#pickup-process [data-route-step="3"]'); stillPickup.flush();
assert.equal(stillPickup.q('.home-steps .is-highlighted h3').textContent,'Get paid. Keep the receipt.');

const flowState = {created:0, playing:false, rendered:false};
const flowing = load('index.html',false,'en',(canvas,options) => {
  flowState.created++;
  assert.equal(options.mode,'pour');
  assert.equal(options.parallax,0);
  assert.equal(options.startTime,6,'Start on the frame oil-poster.webp shows');
  assert.equal(options.quality,undefined,'Draw at the full screen resolution');
  return {
    renderOnce() { flowState.rendered = true; canvas.classList.add('is-ready'); },
    play() { flowState.playing = true; },
    pause() { flowState.playing = false; }
  };
});
assert.equal(flowState.created,1); assert.equal(flowState.rendered,true); assert.equal(flowState.playing,true);
flowing.click('[data-motion]'); assert.equal(flowState.playing,false);
flowing.click('[data-motion]'); assert.equal(flowState.playing,true);
flowing.doc.hidden = true; flowing.doc.fire('visibilitychange'); assert.equal(flowState.playing,false);
flowing.doc.hidden = false; flowing.doc.fire('visibilitychange'); assert.equal(flowState.playing,true);
flowing.setReduced(true); assert.equal(flowState.playing,false);
flowing.setReduced(false); assert.equal(flowState.playing,true);
assert.equal(flowState.created,1,'Reuse the surface when resuming motion');
let stillCreated = 0;
const still = load('index.html',true,'en',() => { stillCreated++; return null; });
assert.equal(stillCreated,0,'Reduced motion must keep the poster without creating a surface');
still.click('[data-home-oil="transformer"]'); assert.equal(still.q('#home-oil-panel').dataset.tone,'transformer');
for (const factory of [() => null, () => { throw new Error('No WebGL'); }]) {
  const fallback = load('index.html',false,'en',factory);
  assert.equal(fallback.q('#oil-flow').classList.contains('is-ready'),false);
  fallback.click('[data-home-enquire]'); assert.equal(fallback.q('#pickup-dialog').open,true);
}

// The oil surface itself, with a stand-in WebGL context: it draws at the screen's own resolution
// (up to 2 device pixels per CSS pixel and a 4K frame), and lowers it only while frames run slow.
function oilRig(width, height, dpr) {
  const rig = {frames:new Map(), seq:0, now:0, events:{}};
  const gl = new Proxy({}, {get:(_,k) => /^get(Shader|Program)Parameter$/.test(k) ? () => true : /^[A-Z_]+$/.test(k) ? 0 : () => ({})});
  rig.canvas = {clientWidth:width, clientHeight:height, width:300, height:150, getContext:() => gl, addEventListener() {},
    classList:{contains:() => false, add() {}, remove() {}}, getBoundingClientRect:() => ({top:0, height})};
  const sandbox = {window:{devicePixelRatio:dpr, addEventListener:(type,fn) => (rig.events[type] ||= []).push(fn)}, document:{hidden:false, addEventListener() {}}, console,
    requestAnimationFrame:fn => { rig.frames.set(++rig.seq,fn); return rig.seq; }, cancelAnimationFrame:id => rig.frames.delete(id)};
  vm.runInContext(readFileSync('dist/oil-surface.js','utf8'),vm.createContext(sandbox),{filename:'oil-surface.js'});
  rig.oil = sandbox.window.OilSurface(rig.canvas,{mode:'pour', interactive:false, parallax:0});
  // Runs `count` frames; `ms` is the time between them, or a repeating pattern of times.
  rig.run = (count,ms) => { for (let i = 0; i < count; i++) { rig.now += [].concat(ms)[i % [].concat(ms).length]; const jobs = [...rig.frames.values()]; rig.frames.clear(); jobs.forEach(fn => fn(rig.now)); } };
  return rig;
}
for (const [width,height,dpr,expected] of [[1366,827,1,'1366x827'],[1920,1080,2,'3840x2160'],[2560,1440,2,'3840x2160'],[390,810,3,'780x1620']]) {
  const rig = oilRig(width,height,dpr); rig.oil.renderOnce();
  assert.equal(rig.canvas.width+'x'+rig.canvas.height,expected,`Oil canvas at ${width}x${height} on a ${dpr}x screen`);
}
const smoothOil = oilRig(1920,1080,1); smoothOil.oil.play(); smoothOil.run(180,16.7);
assert.equal(smoothOil.canvas.width,1920,'A device holding 60 fps keeps the full resolution');
const slowOil = oilRig(1920,1080,1); slowOil.oil.play(); slowOil.run(40,50);
assert.ok(slowOil.canvas.width < 1920 && slowOil.canvas.width >= 1920 * .35,'A slow device draws fewer pixels to stay smooth');
const loadingOil = oilRig(1920,1080,1); loadingOil.oil.play(); loadingOil.run(20,100); loadingOil.run(120,16.7);
assert.equal(loadingOil.canvas.width,1920,'Slow frames while the page loads do not lower the resolution');
const scrollingOil = oilRig(1920,1080,1); scrollingOil.oil.play();
for (let i = 0; i < 80; i++) { scrollingOil.events.scroll.forEach(fn => fn()); scrollingOil.run(1,50); }
scrollingOil.run(60,16.7);
assert.equal(scrollingOil.canvas.width,1920,'Slow frames while the page scrolls do not lower the resolution');
const stutterOil = oilRig(1280,800,2); stutterOil.oil.play(); stutterOil.run(60,[13.3,13.3,26.7]);
assert.ok(stutterOil.canvas.width < 2560,'Every third frame missed lowers the resolution, though the 18 ms average is under the 24 ms limit');
const fastOil = oilRig(1280,800,2); fastOil.oil.play(); fastOil.run(150,[8.3,8.3,16.7]);
assert.equal(fastOil.canvas.width,2560,'80 fps on a 120 Hz screen keeps the full resolution');

const autoplay = load('seller-app.html');
autoplay.advance(4700); assert.ok(autoplay.q('.screen.s2').classList.contains('is-active'));
autoplay.click('[data-motion]'); autoplay.advance(10000); assert.ok(autoplay.q('.screen.s2').classList.contains('is-active'));
autoplay.click('[data-motion]'); autoplay.advance(4700); assert.ok(autoplay.q('.screen.s3').classList.contains('is-active'));
autoplay.doc.hidden = true; autoplay.doc.fire('visibilitychange'); autoplay.advance(10000);
assert.ok(autoplay.q('.screen.s3').classList.contains('is-active'));

const refinery = load('about.html');
refinery.advance(4500); assert.equal(refinery.q('.refinery').dataset.stage,'1');
refinery.click('[data-motion]'); refinery.advance(10000); assert.equal(refinery.q('.refinery').dataset.stage,'1');
refinery.click('[data-motion]'); refinery.advance(4500); assert.equal(refinery.q('.refinery').dataset.stage,'2');
const stillRefinery = load('about.html',true);
stillRefinery.advance(15000); assert.equal(stillRefinery.q('.refinery').dataset.stage,'0');
assert.equal(stillRefinery.q('.promise-journey').dataset.stage,'0');

for (const file of ['about.html','index.html']) {
  const promises = load(file);
  const art = () => promises.q('[data-promise-scene].is-active');
  assert.equal(promises.qa('[data-promise-scene]').length,4);
  assert.equal(promises.qa('[data-promise-scene].is-active').length,1);
  promises.advance(2000);
  assert.equal(promises.q('.promise-journey').dataset.stage,'0');
  assert.equal(art().dataset.promiseScene,'0');
  assert.ok(Number(art().style.getPropertyValue('--promise-action')) > 0,'The measuring scene should fill gradually');
  assert.ok(Number(art().style.getPropertyValue('--promise-action')) < 1);
  promises.advance(3800);
  assert.equal(promises.q('.promise-journey').dataset.stage,'1');
  assert.equal(art().dataset.promiseScene,'1');
  assert.equal(promises.qa('.promise-milestone.is-done').length,1);
  promises.click('.promise-heading [data-motion]');
  const frozenArtwork = art().style.getPropertyValue('--promise-action');
  const frozenProgress = promises.q('.promise-journey').style.getPropertyValue('--promise-phase');
  promises.advance(10000);
  assert.equal(promises.q('.promise-journey').dataset.stage,'1');
  assert.equal(art().style.getPropertyValue('--promise-action'),frozenArtwork,'Pause freezes the artwork');
  assert.equal(promises.q('.promise-journey').style.getPropertyValue('--promise-phase'),frozenProgress,'Pause also freezes the timeline');
  assert.ok(promises.qa('[data-motion]').every(button => button.hasAttribute('data-paused')));
  promises.click('.promise-heading [data-motion]');
  promises.advance(4300);
  assert.equal(promises.q('.promise-journey').dataset.stage,'1');
  assert.ok(Number(promises.q('.promise-journey').style.getPropertyValue('--promise-phase')) > .7,'The timeline resumes from its paused position');
  promises.advance(1400);
  assert.equal(promises.q('.promise-journey').dataset.stage,'2');
  assert.equal(art().dataset.promiseScene,'2');
  promises.doc.hidden = true;
  promises.doc.fire('visibilitychange');
  const hiddenArtwork = art().style.getPropertyValue('--promise-time');
  promises.advance(10000);
  assert.equal(promises.q('.promise-journey').dataset.stage,'2');
  assert.equal(art().style.getPropertyValue('--promise-time'),hiddenArtwork,'A hidden tab stops the artwork clock');
  promises.doc.hidden = false;
  promises.doc.fire('visibilitychange');
  promises.advance(5700);
  assert.equal(promises.q('.promise-journey').dataset.stage,'3');
  assert.equal(art().dataset.promiseScene,'3');
  promises.advance(5700);
  assert.equal(promises.q('.promise-journey').dataset.stage,'0');
  assert.equal(promises.qa('[data-promise-scene].is-active').length,1,'Only one scene is selected after a complete loop');
  assert.equal(promises.q('[data-promise-announcement]').textContent,'','Automatic scenes do not repeatedly announce changes');
  promises.q('[data-promise-stage="0"]').fire('keydown',{key:'End'});
  assert.equal(promises.q('.promise-journey').dataset.stage,'3','Keyboard End selects the receipt promise');
  assert.equal(promises.doc.activeElement,promises.q('[data-promise-stage="3"]'));
  assert.equal(promises.q('[data-promise-count]').textContent,'04');
  assert.equal(promises.qa('.promise-milestone.is-done').length,3);
  assert.match(promises.q('[data-promise-announcement]').textContent,/Promise 4 of 4/);
  promises.advance(5000);
  assert.equal(promises.q('.promise-journey').dataset.stage,'3','A manual promise choice holds while its explanation is read');
  promises.q('[data-promise-stage="3"]').fire('keydown',{key:'Home'});
  promises.setReduced(true);
  promises.advance(12000);
  assert.equal(promises.q('.promise-journey').dataset.stage,'0','Reduced motion keeps the selected promise still');
  assert.equal(art().style.getPropertyValue('--promise-action'),'1','Reduced motion shows a complete illustration');
  assert.equal(art().style.getPropertyValue('--promise-pour'),'0');
  promises.click('[data-promise-stage="2"]');
  assert.equal(promises.q('.promise-journey').dataset.stage,'2','Reduced-motion visitors can still choose a promise');
  assert.equal(art().dataset.promiseScene,'2');
  assert.equal(art().style.getPropertyValue('--promise-complete'),'1');
  assert.equal(promises.q('[data-promise-count]').textContent,'03');
  assert.equal(promises.q('.promise-caption-detail').textContent,promises.q('[data-promise-stage="2"] .promise-choice-detail').textContent);

  const hover = load(file);
  const focusBeforeHover = hover.doc.activeElement;
  const paymentOption = hover.q('[data-promise-stage="2"]');
  paymentOption.fire('pointerenter',{pointerType:'mouse'});
  assert.equal(hover.q('.promise-journey').dataset.stage,'2','Mouse hover previews its promise without a click');
  assert.equal(paymentOption.getAttribute('aria-pressed'),'true');
  assert.equal(hover.q('[data-promise-scene].is-active').dataset.promiseScene,'2');
  assert.equal(hover.q('.promise-caption-detail').textContent,hover.q('[data-promise-stage="2"] .promise-choice-detail').textContent);
  assert.equal(hover.doc.activeElement,focusBeforeHover,'Hover does not move keyboard focus');
  assert.equal(hover.q('[data-promise-announcement]').textContent,'','Mouse previews stay quiet for screen readers');
  hover.advance(2000);
  const hoverTime = hover.q('[data-promise-scene].is-active').style.getPropertyValue('--promise-time');
  paymentOption.fire('pointerenter',{pointerType:'mouse'});
  assert.equal(hover.q('[data-promise-scene].is-active').style.getPropertyValue('--promise-time'),hoverTime,'Hovering the current option does not restart its artwork');
  hover.advance(12000);
  assert.equal(hover.q('.promise-journey').dataset.stage,'2','Autoplay keeps the hovered promise selected');
  paymentOption.fire('pointerleave',{pointerType:'mouse'});
  hover.advance(1700);
  assert.equal(hover.q('.promise-journey').dataset.stage,'2','Leaving a card gives a short reading delay');
  hover.advance(600);
  assert.equal(hover.q('.promise-journey').dataset.stage,'3','Autoplay resumes after the mouse leaves');
  hover.q('[data-promise-stage="1"]').fire('pointerenter',{pointerType:'touch'});
  assert.equal(hover.q('.promise-journey').dataset.stage,'3','Touch entry does not activate a mouse preview');
  hover.click('[data-promise-stage="1"]');
  assert.equal(hover.q('.promise-journey').dataset.stage,'1','Touch visitors can select with a tap');
  hover.setReduced(true);
  hover.q('[data-promise-stage="0"]').fire('pointerenter',{pointerType:'mouse'});
  assert.equal(hover.q('.promise-journey').dataset.stage,'0');
  assert.equal(hover.q('[data-promise-scene].is-active').style.getPropertyValue('--promise-action'),'1','Reduced-motion hover shows a complete, still illustration');
}

// Picking from the area list: set the choice and announce the change, as a browser does.
const chooseArea = (page, value) => {
  page.q('select[name="area"]').value = value;
  page.q('select[name="area"]').fire('change');
};
const form = load('index.html');
assert.deepEqual(form.qa('select[name="area"] option').map(n => n.value),['',...areaList,'Other'],'The list prompts first, then every area in src/config/areas.json, then Other area');
assert.equal(form.q('select[name="area"]').value,'','No area is chosen until the visitor picks one');
assert.equal(form.qa('.choice-grid .enquiry-jar').length,3,'Each oil choice shows its sample jar');
assert.equal(form.q('.area-other').hidden,true,'The typed area box waits for Other area');
form.click('[data-home-enquire]'); form.q('#pickup-form').fire('submit');
assert.equal(form.qa('.field.invalid').length,4);
assert.equal(form.q('select[name="area"]').getAttribute('aria-invalid'),'true','An area must be chosen');
assert.equal(form.q('input[name="phone"]').getAttribute('aria-invalid'),'true','The customer phone number is required');
form.q('input[name="business"]').value = 'Test workshop';
form.q('input[name="phone"]').value = '12345';
chooseArea(form,'Other');
assert.equal(form.q('.area-other').hidden,false,'Other area opens a box to type the area');
assert.equal(form.q('.area-field').classList.contains('invalid'),false,'Choosing an area clears its error');
form.q('input[name="quantity"]').value = '49';
form.q('#pickup-form').fire('submit');
assert.equal(form.q('input[name="areaOther"]').getAttribute('aria-invalid'),'true','Other area needs the area typed in');
assert.equal(form.q('input[name="phone"]').getAttribute('aria-invalid'),'true','A phone number needs ten digits');
assert.equal(form.q('input[name="quantity"]').getAttribute('aria-invalid'),'true','The minimum pickup is 50 litres');
assert.equal(form.q('#enquiry-result').hidden,true);
form.q('input[name="phone"]').value = '+91 98765-43210';
form.q('input[name="areaOther"]').value = 'Kolathur';
form.q('input[name="quantity"]').value = '50';
form.q('#pickup-form').fire('submit');
assert.equal(form.q('#enquiry-result').hidden,false);
assert.match(form.q('#enquiry-text').textContent,/Test workshop/);
assert.match(form.q('#enquiry-text').textContent,/Area: Kolathur/,'A typed area reaches the enquiry');
assert.match(form.q('#enquiry-text').textContent,/Phone: \+91 98765 43210/,'The enquiry carries the customer phone number');
assert.match(form.q('#enquiry-text').textContent,/no pickup has been booked/i);
assert.match(form.q('#enquiry-text').textContent,/Minimum collection: 50 litres/);
const enquiryShare = new URL(form.q('#whatsapp-enquiry').href);
assert.equal(enquiryShare.origin,'https://wa.me');
assert.equal(enquiryShare.pathname,'/' + contactDetails.phone.slice(1),'Pickup enquiries address the configured Black Gold contact');
assert.equal(enquiryShare.searchParams.get('text'),form.q('#enquiry-text').textContent,'The full enquiry stays intact in the WhatsApp draft');
const enquiryEmail = new URL(form.q('#email-enquiry').href);
assert.equal(enquiryEmail.protocol,'mailto:');
assert.equal(enquiryEmail.pathname,contactDetails.email,'The email draft addresses the configured enquiry email');
assert.equal(enquiryEmail.searchParams.get('subject'),'Black Gold pickup enquiry');
assert.equal(enquiryEmail.searchParams.get('body').replace(/\r\n/g,'\n'),form.q('#enquiry-text').textContent,'The full summary stays intact in the email draft');
form.click('#edit-enquiry');
chooseArea(form,'Ambattur');
assert.equal(form.q('.area-other').hidden,true,'A listed area closes the Other box');
form.q('input[name="quantity"]').value = '75';
form.q('#pickup-form').fire('submit');
const revisedShare = new URL(form.q('#whatsapp-enquiry').href);
assert.equal(revisedShare.pathname,'/' + contactDetails.phone.slice(1),'Editing the enquiry preserves its recipient');
assert.match(revisedShare.searchParams.get('text'),/75 Litres/);
assert.match(revisedShare.searchParams.get('text'),/Area: Ambattur/,'A tapped area reaches the enquiry');
const revisedEmail = new URL(form.q('#email-enquiry').href);
assert.equal(revisedEmail.pathname,contactDetails.email,'Editing the enquiry preserves the email recipient');
assert.equal(revisedEmail.searchParams.get('body').replace(/\r\n/g,'\n'),form.q('#enquiry-text').textContent,'The email draft updates after editing the enquiry');

const barrels = load('index.html');
barrels.q('input[name="business"]').value = 'Barrel workshop';
barrels.q('input[name="phone"]').value = '044 2345 6789';
chooseArea(barrels,'Guindy');
barrels.q('input[name="unit"][value="Litres"]').checked = false;
barrels.q('input[name="unit"][value="Barrels"]').checked = true;
barrels.q('input[name="unit"][value="Barrels"]').fire('change');
assert.equal(barrels.q('input[name="quantity"]').getAttribute('min'),'1','A barrel count must not use a litre minimum');
barrels.q('input[name="quantity"]').value = '1';
barrels.q('#pickup-form').fire('submit');
assert.equal(barrels.q('#enquiry-result').hidden,false);
assert.match(barrels.q('#enquiry-text').textContent,/1 Barrels/);
barrels.click('#edit-enquiry');
barrels.q('input[name="unit"][value="Barrels"]').checked = false;
barrels.q('input[name="unit"][value="Litres"]').checked = true;
barrels.q('input[name="unit"][value="Litres"]').fire('change');
barrels.q('#pickup-form').fire('submit');
assert.equal(barrels.q('input[name="quantity"]').getAttribute('min'),'50');
assert.equal(barrels.q('#enquiry-result').hidden,true,'Switching back to litres restores the collection minimum');

// Crossing into desktop navigation must release the mobile menu's scroll and focus locks.
const navigation = load('index.html');
navigation.resize(1024,900);
navigation.click('.menu');
assert.equal(navigation.q('.menu').getAttribute('aria-expanded'),'true');
assert.equal(navigation.q('#main').inert,true);
assert.equal(navigation.q('.footer').inert,true);
navigation.resize(1025,900);
assert.equal(navigation.q('.menu').getAttribute('aria-expanded'),'false','The compact desktop navigation closes an open tablet menu');
assert.equal(navigation.doc.documentElement.classList.contains('menu-locked'),false);
assert.equal(navigation.q('#main').inert,false,'Desktop content becomes interactive after resizing');
assert.equal(navigation.q('.footer').inert,false);
navigation.resize(760,844);
navigation.click('.menu');
navigation.doc.fire('keydown',{key:'Escape'});
assert.equal(navigation.q('.menu').getAttribute('aria-expanded'),'false');
assert.equal(navigation.doc.activeElement,navigation.q('.menu'),'Escape returns focus to Menu');

const sellerScroll = load('seller-app.html');
sellerScroll.scroll(3200); sellerScroll.advance(300);
assert.equal(sellerScroll.q('.seller-journey').dataset.step,'4','Scrolling selects the step in view');
assert.equal(sellerScroll.q('[data-journey-announcement]').textContent,'','Scrolling does not repeatedly announce scene changes');
sellerScroll.scroll(1500); sellerScroll.advance(300);
assert.equal(sellerScroll.q('.seller-journey').dataset.step,'0','Reverse scrolling returns to the earlier scene');
sellerScroll.click('.sj-panel [data-motion]');
sellerScroll.scroll(4100); sellerScroll.advance(300);
assert.equal(sellerScroll.q('.seller-journey').dataset.step,'0','Pause motion freezes automatic journey changes');
sellerScroll.click('[data-journey-go="6"]');
assert.equal(sellerScroll.q('.seller-journey').dataset.step,'6','Manual selection still works while paused');
sellerScroll.click('.sj-panel [data-motion]');
sellerScroll.q('#app-step-3').fire('focusin');
assert.equal(sellerScroll.q('.seller-journey').dataset.step,'2','Focusing a story card updates its illustration');
sellerScroll.doc.hidden = true;
sellerScroll.doc.fire('visibilitychange');
sellerScroll.scroll(4600); sellerScroll.advance(300);
assert.equal(sellerScroll.q('.seller-journey').dataset.step,'2','Hidden tabs do not change the journey');
const sellerStill = load('seller-app.html',true);
sellerStill.scroll(3200); sellerStill.advance(300);
assert.equal(sellerStill.q('.seller-journey').dataset.step,'0','Reduced motion keeps the scroll illustration still');
sellerStill.click('[data-journey-go="7"]');
assert.equal(sellerStill.q('.seller-journey').dataset.step,'7','Reduced-motion visitors can explore every scene manually');

const compactSeller = load('seller-app.html');
compactSeller.resize(900,800);
compactSeller.q('.sj-panel').getBoundingClientRect = () => ({left:0, top:80, bottom:420, right:800, width:800, height:340});
compactSeller.scroll(2960); compactSeller.advance(300);
assert.equal(compactSeller.q('.seller-journey').dataset.step,'4','A stacked sticky panel selects the story visible beneath it');
assert.equal(compactSeller.q('.seller-journey').style.getPropertyValue('--sj-panel-height'),'340px','Anchor spacing follows the measured panel height');
compactSeller.resize(900,740);
compactSeller.scroll(2961); compactSeller.advance(300);
assert.equal(compactSeller.q('.seller-journey').dataset.step,'3','Short screens use the normal viewport when the panel stops sticking');

for (const [file,motionControl] of [
  ['seller-app.html','.seller-app-hero [data-motion]'],
  ['index.html','#seller-app [data-motion]']
]) {
  const installDemo = load(file);
  assert.equal(installDemo.q('[data-install-preview]').dataset.phase,'0');
  installDemo.advance(1600);
  assert.ok(installDemo.q('[data-install-query]').textContent.length > 0 && installDemo.q('[data-install-query]').textContent.length < 'Black Gold Seller'.length,'The search query types in progressively');
  installDemo.advance(2700);
  assert.equal(installDemo.q('[data-install-preview]').dataset.phase,'1','Search reveals the app result');
  assert.equal(installDemo.q('[data-install-query]').textContent,'Black Gold Seller');
  assert.equal(installDemo.q('[data-install-suggestion]').textContent,'Black Gold Seller');
  assert.equal(installDemo.q('[data-install-preview]').dataset.searchReady,'true');
  assert.equal(installDemo.q('[data-install-action]').textContent,'Install');
  assert.equal(installDemo.qa('[data-install-key].is-pressed').length,0,'The keyboard releases when the listing opens');
  installDemo.advance(3200);
  assert.equal(installDemo.q('[data-install-preview]').dataset.phase,'2');
  assert.ok(parseInt(installDemo.q('[data-install-percent]').textContent) > 0 && parseInt(installDemo.q('[data-install-percent]').textContent) < 100,'The download percentage progresses');
  assert.ok(+installDemo.q('[data-install-ring]').style.strokeDashoffset > 0 && +installDemo.q('[data-install-ring]').style.strokeDashoffset < 226.2,'The icon download ring fills with the percentage');
  assert.equal(installDemo.q('[data-install-secondary]').textContent,'Cancel');
  assert.equal(installDemo.q('[data-install-subtitle]').textContent,'Downloading…');
  installDemo.click(motionControl);
  const heldInstall = installDemo.q('[data-install-percent]').textContent;
  const heldRing = installDemo.q('[data-install-ring]').style.strokeDashoffset;
  installDemo.advance(6000);
  assert.equal(installDemo.q('[data-install-percent]').textContent,heldInstall,'Pause freezes installation progress');
  assert.equal(installDemo.q('[data-install-ring]').style.strokeDashoffset,heldRing,'Pause also freezes the icon ring');
  installDemo.click(motionControl);
  installDemo.doc.hidden = true;
  installDemo.doc.fire('visibilitychange');
  installDemo.advance(6000);
  assert.equal(installDemo.q('[data-install-percent]').textContent,heldInstall,'The installation loop stops in hidden tabs');
  installDemo.doc.hidden = false;
  installDemo.doc.fire('visibilitychange');
  installDemo.advance(5000);
  assert.equal(installDemo.q('[data-install-preview]').dataset.phase,'3');
  assert.equal(installDemo.q('[data-install-percent]').textContent,'100%');
  assert.equal(installDemo.q('[data-install-action]').textContent,'Open');
  assert.equal(installDemo.q('[data-install-secondary]').textContent,'Uninstall');
  assert.equal(installDemo.q('[data-install-preview]').dataset.launched,'false','Open stays visible before the simulated launch');
  installDemo.advance(2300);
  assert.equal(installDemo.q('[data-install-preview]').dataset.launched,'true','The Open tap reveals the Black Gold splash screen');
  installDemo.advance(1900);
  assert.equal(installDemo.q('[data-install-preview]').dataset.phase,'0','The installation preview loops back to search');
  assert.equal(installDemo.q('[data-install-preview]').dataset.launched,'false','The launched app resets before the next search');
  assert.equal(installDemo.qa('.seller-install-backdrop button, .seller-install-backdrop a, .seller-install-backdrop input').length,0,'The decorative install animation cannot trigger real downloads or searches');
  installDemo.setReduced(true);
  installDemo.advance(20000);
  assert.equal(installDemo.q('[data-install-preview]').dataset.phase,'3','Reduced motion shows a still, complete app preview');
  assert.equal(installDemo.q('[data-install-query]').textContent,'Black Gold Seller');
  assert.equal(installDemo.q('[data-install-preview]').dataset.launched,'false','Reduced motion keeps the completed store screen still');
  if (file === 'seller-app.html') assert.equal(installDemo.q('.seller-feature-layout .phone') !== null,true,'The working-app preview now belongs in the feature section');

  const finishingInstall = load(file);
  finishingInstall.advance(11200);
  assert.equal(finishingInstall.q('[data-install-preview]').dataset.phase,'2');
  assert.equal(finishingInstall.q('[data-install-preview]').dataset.installing,'true','Downloading finishes before the installation step');
  assert.equal(finishingInstall.q('[data-install-subtitle]').textContent,'Installing…');
  assert.equal(finishingInstall.q('[data-install-percent]').textContent,'100%');
  assert.equal(finishingInstall.q('[data-install-ring]').style.strokeDashoffset,'0.00');
}

console.log('PASS: Menu resize and keyboard recovery; compact and desktop Seller App journey; search/install hero loop, typing, progress, pause, hidden tabs and reduced motion; English pages, removed-page links, app preview, FAQ search and chat, quantity minimums, home truck, downloads, promises and enquiry validation.');
