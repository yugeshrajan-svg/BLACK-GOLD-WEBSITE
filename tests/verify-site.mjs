// Checks the actual generated site, including links across every page and asset.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';

const root = resolve('dist');
const pages = readdirSync(root).filter(file => file.endsWith('.html'));
const expected = readdirSync('src/pages').filter(file => file.endsWith('.html'));
assert.deepEqual(pages.sort(), expected.sort(), 'Only current source pages should be published');
const ids = new Map();
const html = new Map();

for (const page of pages) {
  const content = readFileSync(join(root, page), 'utf8');
  html.set(page, content);
  assert.ok(content.indexOf('class="menu"') < content.indexOf('<nav id="navigation"'), `${page}: Menu must precede links in keyboard order`);
  assert.match(content, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.ok(content.includes('data-download-enquiry'), `${page}: missing non-Android enquiry fallback`);
  assert.ok(!content.includes('{{'), `${page}: unresolved template`);
  assert.equal([...content.matchAll(/<h1\b/g)].length, 1, `${page}: needs one main heading`);
  assert.match(content, /<title>[^<]+<\/title>/, `${page}: needs a title`);
  assert.match(content, /<meta name="description" content="[^"]+"/, `${page}: needs a description`);
  const pageIds = [...content.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(pageIds).size, pageIds.length, `${page}: duplicate IDs`);
  ids.set(page, new Set(pageIds));
  assert.ok(!/Client review edition|App links pending/.test(content), `${page}: obsolete copy`);
  for (const image of content.matchAll(/<img\b([^>]+)>/g)) {
    assert.match(image[1], /\balt="[^"]*"/, `${page}: image missing alt text`);
  }
  for (const script of content.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    JSON.parse(script[1]);
  }
}

// Search results: each page needs its own title and description, short enough not to be cut off.
const metaText = (page, pattern) => html.get(page).match(pattern)[1].replaceAll('&amp;', '&');
const titles = pages.map(page => metaText(page, /<title>([^<]+)<\/title>/));
const descriptions = pages.map(page => metaText(page, /<meta name="description" content="([^"]+)"/));
assert.equal(new Set(titles).size, pages.length, 'Every page needs a different title');
assert.equal(new Set(descriptions).size, pages.length, 'Every page needs a different description');
pages.forEach((page, i) => {
  assert.ok(titles[i].length <= 72, `${page}: title is ${titles[i].length} characters; keep it to 72 or fewer`);
  assert.ok(descriptions[i].length >= 70 && descriptions[i].length <= 160, `${page}: description is ${descriptions[i].length} characters; keep it between 70 and 160`);
});
assert.match(titles[pages.indexOf('index.html')], /Used .*Oil Buyers in Chennai/, 'The home page title names what we buy and where');
const structured = page => [...html.get(page).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
const business = structured('index.html').find(item => item['@type'] === 'RecyclingCenter');
assert.ok(business?.['@id'] && business.address?.streetAddress && business.telephone, 'The home page describes the business, its address and phone');
assert.ok(business.areaServed.some(area => area.name === 'Chennai'), 'The business serves Chennai');
const industryService = structured('industry.html').find(item => item['@type'] === 'Service');
assert.equal(industryService?.provider['@id'], business['@id'], 'The industrial service points to the same business');

let localReferences = 0;
function checkReference(from, value) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return;
  const [urlPath, fragment] = value.split('#');
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const target = pathname ? resolve(dirname(join(root, from)), pathname) : join(root, from);
  assert.ok(target === root || target.startsWith(root + sep), `${from}: reference escapes dist: ${value}`);
  assert.ok(existsSync(target) && statSync(target).isFile(), `${from}: missing local target: ${value}`);
  if (fragment && extname(target) === '.html') {
    assert.ok(ids.get(target.slice(root.length + 1))?.has(decodeURIComponent(fragment)), `${from}: broken anchor: ${value}`);
  }
  localReferences++;
}

const downloads = JSON.parse(readFileSync('src/config/app-downloads.json', 'utf8'));
const site = JSON.parse(readFileSync('src/config/site.json', 'utf8'));
const siteBase = site.url.trim() ? new URL(site.url.trim().replace(/\/+$/, '') + '/').href : '';
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
assert.match(robots, /User-agent: \*/);
if (siteBase) {
  assert.ok(robots.includes('Sitemap: ' + new URL('sitemap.xml', siteBase).href));
  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, pages.length, 'The sitemap must cover every page');
  for (const page of pages) {
    const canonical = escapeAttribute(new URL(page === 'index.html' ? '' : page, siteBase).href);
    assert.ok(html.get(page).includes('<link rel="canonical" href="' + canonical + '">'), `${page}: wrong canonical URL`);
    assert.ok(html.get(page).includes('<meta property="og:url" content="' + canonical + '">'), `${page}: wrong sharing URL`);
    assert.ok(html.get(page).includes('<meta property="og:image" content="' + escapeAttribute(new URL('og-image.jpg', siteBase).href) + '">'), `${page}: wrong absolute sharing image`);
    assert.ok(sitemap.includes('<loc>' + canonical + '</loc>'), `${page}: missing sitemap URL`);
  }
} else assert.equal(existsSync(join(root, 'sitemap.xml')), false, 'Do not generate a sitemap with a guessed domain');
for (const [page, content] of html) {
  for (const reference of content.matchAll(/\b(?:href|src)="([^"]*)"/g)) checkReference(page, reference[1]);
  for (const reference of content.matchAll(/<meta property="og:image" content="([^"]+)"/g)) checkReference(page, reference[1]);
  for (const reference of content.matchAll(/\baria-(?:labelledby|describedby|controls)="([^"]+)"/g)) {
    for (const id of reference[1].split(/\s+/)) assert.ok(ids.get(page).has(id), `${page}: missing ARIA target ${id}`);
  }
  for (const [platform, url] of Object.entries(downloads)) {
    const links = [...content.matchAll(new RegExp('<a\\b[^>]*data-app-download="' + platform + '"[^>]*>', 'g'))];
    if (url.trim()) {
      assert.ok(links.length > 0, `${page}: missing enabled ${platform} download`);
      for (const [link] of links) assert.ok(link.includes('href="' + url.replaceAll('&', '&amp;') + '"'), `${page}: wrong download URL`);
    } else if (platform === 'googlePlay') {
      assert.ok(links.length > 0, `${page}: Google Play coming-soon option should remain visible`);
      for (const [link] of links) {
        assert.ok(link.includes('aria-disabled="true"'), `${page}: unavailable Google Play must be disabled`);
        assert.ok(!/\bhref=/.test(link), `${page}: unavailable Google Play must not link to a placeholder`);
      }
    } else assert.equal(links.length, 0, `${page}: unavailable download should be hidden`);
  }
}
const stylesheet = readFileSync(join(root, 'style.css'), 'utf8');
for (const reference of stylesheet.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) checkReference('style.css', reference[1]);

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function verifyPublic(directory = '') {
  for (const entry of readdirSync(join('public', directory), { withFileTypes: true })) {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) verifyPublic(relative);
    else assert.equal(hash(readFileSync(join('public', relative))), hash(readFileSync(join(root, relative))), `Static file changed during build: ${relative}`);
  }
}
verifyPublic();
if (downloads.apk.startsWith('assets/')) {
  assert.ok(readFileSync(join(root, downloads.apk)).subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])), 'APK must remain a binary ZIP/APK file');
}
console.log(`PASS: ${pages.length} pages; ${localReferences} local references; page anchors, ARIA targets, metadata, downloads and copied assets.`);
