// Browser-independent smoke checks against the generated HTML and real scripts.
// This small DOM adapter checks behaviour; it does not verify browser layout.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const downloadLinks = JSON.parse(readFileSync('src/app-downloads.json','utf8'));

const decode = s => s.replace(/&(?:amp|lt|gt|quot|#39|#\d+);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[x] ?? String.fromCodePoint(+x.slice(2,-1))));
const escape = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));

function simple(node, selector) {
  if (!node || node.tag.startsWith('#')) return false;
  const attrs = [...selector.matchAll(/\[([^\]]+)\]/g)];
  const rest = selector.replace(/\[[^\]]+\]/g, '');
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
  get value() { return this.attrs.value || ''; }
  set value(v) { this.attrs.value = String(v); }
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
  let seq = 0, now = 0; const frames = new Map(), timers = new Map(), memory = new Map(browserLanguage === 'ta' ? [['bg-lang','ta']] : []);
  const media = new Map();
  const windowEvents = {};
  const window = {
    document:doc, innerHeight:900, innerWidth:1440, scrollY:0,
    addEventListener(type,fn){(windowEvents[type] ||= []).push(fn);},
    matchMedia(query) { if (!media.has(query)) media.set(query,{matches:query.includes('reduced-motion') && reduced,listeners:[],addEventListener(type,fn){this.listeners.push(fn);}}); return media.get(query); }
  };
  const journey = doc.querySelector('.route--pickup');
  if (journey) journey.getBoundingClientRect = () => ({left:0, top:1800-window.scrollY, bottom:2400-window.scrollY, right:1000, width:1000, height:600});
  if (oilFactory) window.OilSurface = oilFactory;
  const sandbox = {window, document:doc, navigator:{language:browserLanguage, languages:[browserLanguage]}, location:{href:'https://example.test/'+file+(browserLanguage === 'ta' ? '?lang=ta' : '')}, history:{state:null,replaceState(){}},
    localStorage:{getItem:k=>memory.get(k) ?? null,setItem:(k,v)=>memory.set(k,v)},
    URL, Blob, Date, console,
    requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;}, cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++seq,fn);return seq;}, clearTimeout:id=>timers.delete(id),
    FormData:class extends Map { constructor(form) { super(); for (const n of form.querySelectorAll('input')) if (n.attrs.name && (n.type !== 'radio' || n.checked)) this.set(n.attrs.name,n.value); } }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync('dist/app.js','utf8'),context,{filename:'app.js'});
  const q = s => doc.querySelector(s), qa = s => doc.querySelectorAll(s);
  return {doc,q,qa,
    scroll(y) { window.scrollY = y; (windowEvents.scroll || []).forEach(fn=>fn()); },
    setReduced(value) { const pref = window.matchMedia('(prefers-reduced-motion: reduce)'); pref.matches = value; pref.listeners.forEach(fn=>fn(pref)); },
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
    home.click('.hero [data-app]');
    assert.equal(home.q('#app-dialog').open,true,'The homepage promotes the app download panel');
    assert.equal(home.q('#pickup-dialog').open,false,'Getting the app must not open the enquiry form');
    for (const [platform,url] of Object.entries(downloadLinks)) {
      const options = home.qa('[data-app-download="'+platform+'"]');
      assert.equal(options.length,2,'Show the download choice on the homepage and in the dialog');
      options.forEach(option => {
        if (url) assert.equal(option.getAttribute('href'),url);
        else { assert.equal(option.getAttribute('aria-disabled'),'true'); assert.equal(option.hasAttribute('href'),false); }
      });
    }
    home.click('#app-dialog [data-close]');
    home.click('#pickup-process [data-route-step="2"]'); home.flush();
    assert.equal(home.q('.home-steps .is-highlighted h3').textContent,'Request a pickup');
    assert.equal(home.q('#pickup-journey-caption .route-caption-title').textContent,'Request a pickup');
    home.advance(5000);
    assert.equal(home.q('#pickup-process [data-route-step="2"]').getAttribute('aria-pressed'),'true','Manual pickup stage should hold');
    home.click('[data-app-screen="1"]');
    assert.ok(home.q('.phone .screen.s2').classList.contains('is-active'));
    assert.equal(home.qa('[data-app-feature].is-current').length,1);
    assert.equal(home.q('[data-app-feature].is-current h3').textContent,'Pickups');
    home.click('[data-home-oil="hydraulic"]');
    assert.equal(home.q('#home-oil-panel').dataset.tone,'hydraulic');
    assert.equal(home.q('[data-home-oil="hydraulic"]').getAttribute('aria-selected'),'true');
    home.click('[data-home-enquire]');
    assert.equal(home.q('input[value="Used hydraulic oil"]').checked,true);
    assert.equal(home.q('#pickup-dialog').open,true);
    home.q('[data-home-oil="hydraulic"]').fire('keydown',{key:'End'});
    assert.equal(home.q('[data-home-oil="transfer"]').getAttribute('aria-selected'),'true');
    assert.equal(home.q('#home-oil-panel').dataset.tone,'transfer');
    assert.equal(home.q('[data-home-oil="transfer"]').getAttribute('aria-selected'),'true');

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
    assert.equal(about.qa('.promise-station.is-current').length,1);
    assert.equal(about.qa('.promise-station.is-done').length,3);
    assert.equal(about.q('.refinery').dataset.stage,'2','Promise selection must not change the refinery');
    about.advance(5000); assert.equal(about.q('.promise-journey').dataset.stage,'3','Manual promise selection should hold');
    assert.equal(about.q('.promise-caption-title').textContent,about.q('[data-promise-stage="3"] .promise-choice-label').textContent);
    assert.ok(about.q('.promise-caption-detail').textContent.length > 15);

    const collect = load('collect.html',reduced,browserLanguage);
    collect.click('[data-oil-preview="transfer"]'); collect.flush();
    collect.advance(15000);
    assert.equal(collect.q('.oil-stage').dataset.tone,'transfer');
    assert.equal(collect.q('.oil-card.is-selected').dataset.oil,'transfer');
    assert.equal(collect.q('[data-oil-description]').textContent,'From industrial operations');
    collect.click('.page-hero-copy [data-pickup]');
    assert.equal(collect.q('input[value="Used transfer oil"]').checked,true);

    const app = load('seller-app.html',reduced,browserLanguage);
    assert.ok(app.q('.page-hero .install-preview'),'The seller-app hero shows the search-and-install sequence');
    assert.equal(app.q('.page-hero .phone'),null,'The app screens leave the hero');
    assert.ok(app.q('#app-features .phone'),'The app screens sit beside the feature cards');
    assert.match(app.q('.install-graphic .concept-label').textContent,/illustrative/i,'The install animation is labelled as a preview');
    if (reduced) {
      app.advance(15000);
      assert.equal(app.q('.install-preview').dataset.stage,'3','Reduced motion shows the finished install');
      assert.equal(app.q('.install-query').textContent,'Black Gold Seller');
      assert.equal(app.q('.install-steps li[aria-current]').textContent,'Open');
    }
    app.click('[data-app-screen="2"]');
    assert.ok(app.q('.screen.s3').classList.contains('is-active'));
    app.advance(5000);
    assert.ok(app.q('.screen.s3').classList.contains('is-active'),'Manual preview should hold');

    const faq = load('faq.html',reduced,browserLanguage);
    faq.search('Chennai');
    assert.equal(faq.qa('#faq-answers details').filter(n=>!n.hidden).length,1);
    faq.search('no-such-answer-4729'); assert.equal(faq.q('.faq-no-results').hidden,false);
    faq.click('[data-clear-search]'); assert.equal(faq.qa('#faq-answers details').filter(n=>!n.hidden).length,6);
    assert.equal(faq.q('.faq-no-results').hidden,true);
  }
}

assert.equal(existsSync('dist/how-it-works.html'),false,'The How it works page has been removed');
for (const file of ['index.html','about.html','collect.html','seller-app.html','faq.html']) {
  assert.equal(load(file).q('a[href^="how-it-works"]'),null,file+' must not link to the removed How it works page');
}
assert.equal(load('collect.html').q('.page-hero-copy .text-link').getAttribute('href'),'index.html#pickup-process');
assert.ok(load('index.html').q('#pickup-process'),'The homepage keeps the pickup process section');

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
still.click('[data-home-oil="transfer"]'); assert.equal(still.q('#home-oil-panel').dataset.tone,'transfer');
for (const factory of [() => null, () => { throw new Error('No WebGL'); }]) {
  const fallback = load('index.html',false,'en',factory);
  assert.equal(fallback.q('#oil-flow').classList.contains('is-ready'),false);
  fallback.click('[data-home-enquire]'); assert.equal(fallback.q('#pickup-dialog').open,true);
}

const autoplay = load('seller-app.html');
autoplay.advance(4700); assert.ok(autoplay.q('.screen.s2').classList.contains('is-active'));
autoplay.click('[data-motion]'); autoplay.advance(10000); assert.ok(autoplay.q('.screen.s2').classList.contains('is-active'));
autoplay.click('[data-motion]'); autoplay.advance(4700); assert.ok(autoplay.q('.screen.s3').classList.contains('is-active'));
autoplay.doc.hidden = true; autoplay.doc.fire('visibilitychange'); autoplay.advance(10000);
assert.ok(autoplay.q('.screen.s3').classList.contains('is-active'));

const installLoop = load('seller-app.html');
const installer = installLoop.q('.install-preview');
const typedQuery = () => installLoop.q('.install-query').textContent;
const installStep = () => installLoop.q('.install-steps li[aria-current]').textContent;
const installPercent = () => installLoop.q('.install-percent').textContent;
assert.equal(installer.dataset.stage,'0'); assert.equal(typedQuery(),''); assert.ok(installer.classList.contains('is-empty'));
installLoop.advance(1300);
assert.ok(typedQuery().length > 0 && typedQuery().length < 17 && 'Black Gold Seller'.startsWith(typedQuery()),'The search is typed letter by letter');
assert.equal(installer.dataset.stage,'0'); assert.equal(installStep(),'Search');
installLoop.advance(1300);
assert.equal(installer.dataset.stage,'1'); assert.equal(typedQuery(),'Black Gold Seller'); assert.equal(installStep(),'Find the app');
installLoop.advance(3000);
assert.equal(installer.dataset.stage,'2'); assert.equal(installStep(),'Install');
const midInstall = parseInt(installPercent(),10);
assert.ok(midInstall > 0 && midInstall < 100,'Installation shows its progress');
installLoop.click('[data-motion]'); installLoop.advance(10000);
assert.equal(installer.dataset.stage,'2'); assert.equal(installPercent(),midInstall + '%','Pause freezes the installation');
installLoop.click('[data-motion]'); installLoop.advance(2000);
assert.equal(installer.dataset.stage,'3'); assert.equal(installPercent(),'100%'); assert.equal(installStep(),'Open');
assert.equal(installLoop.qa('.install-steps li.is-done').length,3);
installLoop.doc.hidden = true; installLoop.doc.fire('visibilitychange'); installLoop.advance(10000);
assert.equal(installer.dataset.stage,'3'); assert.equal(installer.classList.contains('is-fading'),false,'A hidden tab stops the sequence');
installLoop.doc.hidden = false; installLoop.doc.fire('visibilitychange'); installLoop.advance(3100);
assert.ok(installer.classList.contains('is-fading'));
installLoop.advance(800);
assert.equal(installer.dataset.stage,'0'); assert.ok(installer.classList.contains('is-fading'),'The finished screen clears out of sight before the loop restarts');
installLoop.advance(400);
assert.equal(installer.dataset.stage,'0','The sequence loops back to an empty search'); assert.equal(typedQuery(),'');
assert.equal(installer.classList.contains('is-fading'),false); assert.equal(installLoop.qa('.install-steps li.is-done').length,0);
installLoop.setReduced(true);
assert.equal(installer.dataset.stage,'3'); assert.equal(typedQuery(),'Black Gold Seller');

const refinery = load('about.html');
refinery.advance(4500); assert.equal(refinery.q('.refinery').dataset.stage,'1');
refinery.click('[data-motion]'); refinery.advance(10000); assert.equal(refinery.q('.refinery').dataset.stage,'1');
refinery.click('[data-motion]'); refinery.advance(4500); assert.equal(refinery.q('.refinery').dataset.stage,'2');
const stillRefinery = load('about.html',true);
stillRefinery.advance(15000); assert.equal(stillRefinery.q('.refinery').dataset.stage,'0');
assert.equal(stillRefinery.q('.promise-journey').dataset.stage,'0');

const promises = load('about.html');
promises.advance(3900);
assert.equal(promises.q('.promise-journey').dataset.stage,'0');
assert.notEqual(promises.q('.promise-drop').getAttribute('transform'),'translate(160.00 110.00)','Oil should travel between checkpoints');
promises.advance(500); assert.equal(promises.q('.promise-journey').dataset.stage,'1');
promises.click('.promise-heading [data-motion]');
const frozenDrop = promises.q('.promise-drop').getAttribute('transform');
promises.advance(10000); assert.equal(promises.q('.promise-journey').dataset.stage,'1');
assert.equal(promises.q('.promise-drop').getAttribute('transform'),frozenDrop);
assert.ok(promises.qa('[data-motion]').every(button => button.hasAttribute('data-paused')));
promises.click('.promise-heading [data-motion]');
promises.advance(3500);
const routedDrop = promises.q('.promise-drop').getAttribute('transform').match(/translate\(([\d.]+) ([\d.]+)\)/);
assert.equal(Number(routedDrop[1]),575,'The drop must follow the connector beside the stage labels');
assert.ok(Number(routedDrop[2]) > 110 && Number(routedDrop[2]) < 350);
promises.advance(800); assert.equal(promises.q('.promise-journey').dataset.stage,'2');
promises.doc.hidden = true; promises.doc.fire('visibilitychange');
promises.advance(10000); assert.equal(promises.q('.promise-journey').dataset.stage,'2');
promises.doc.hidden = false; promises.doc.fire('visibilitychange');
promises.advance(4300); assert.equal(promises.q('.promise-journey').dataset.stage,'3');
promises.advance(4300); assert.equal(promises.q('.promise-journey').dataset.stage,'0');

const form = load('index.html');
form.click('[data-home-enquire]'); form.q('#pickup-form').fire('submit');
assert.equal(form.qa('.field.invalid').length,3);
form.q('input[name="business"]').value = 'Test workshop';
form.q('input[name="area"]').value = 'Ambattur';
form.q('input[name="quantity"]').value = '50';
form.q('#pickup-form').fire('submit');
assert.equal(form.q('#enquiry-result').hidden,false);
assert.match(form.q('#enquiry-text').textContent,/Test workshop/);
assert.match(form.q('#enquiry-text').textContent,/no pickup has been booked/i);

console.log('PASS: all five pages stay in English; How it works removed with no links left; pickup scroll/hover/focus tracking, truck travel and selection, anchor focus, app install sequence, app preview and downloads, promise journey, oil presets, FAQ search, pause, hidden tabs, reduced motion and enquiry validation.');
