// Source: src/ + public/. Output: dist/. No packages are required.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const output = join(root, 'dist');
const styles = [
  'base.css', 'header.css', 'home.css', 'components.css', 'collection.css',
  'seller-app.css', 'faq.css', 'footer-forms.css', 'motion.css', 'responsive.css'
];

export function buildSite() {
  const layout = readFileSync(join(root, 'src/layout.html'), 'utf8');
  const downloads = JSON.parse(readFileSync(join(root, 'src/config/app-downloads.json'), 'utf8'));
  const site = JSON.parse(readFileSync(join(root, 'src/config/site.json'), 'utf8'));
  const contact = JSON.parse(readFileSync(join(root, 'src/config/contact.json'), 'utf8'));
  const areas = JSON.parse(readFileSync(join(root, 'src/config/areas.json'), 'utf8'));
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  let siteUrl = '';
  if (typeof site.url !== 'string') throw new Error('src/config/site.json: url must be a string');
  if (site.url.trim()) {
    let parsed;
    try { parsed = new URL(site.url.trim()); }
    catch { throw new Error('src/config/site.json: enter the full HTTPS website URL'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('src/config/site.json: use an HTTPS website URL without credentials, a query or a fragment');
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') + '/';
    siteUrl = parsed.href;
  }
  const shareImage = siteUrl ? new URL('og-image.jpg', siteUrl).href : 'og-image.jpg';
  const jsonString = value => JSON.stringify(value).replace(/</g, '\\u003c');
  if (!Array.isArray(areas) || !areas.length || !areas.every((a) => typeof a === 'string' && a.trim() && a.trim() !== 'Other')) {
    throw new Error('src/config/areas.json must list area names (the form adds "Other area" itself)');
  }
  // One option per area in the enquiry form's area list; "Other area" follows in the layout.
  const areaTokens = {
    areaOptions: areas.map((a) => `<option value="${escape(a.trim())}">${escape(a.trim())}</option>`).join('')
  };
  if (!/^\+[1-9]\d{7,14}$/.test(contact.phone)) throw new Error('Contact phone must include its country code, with digits only after +');
  if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(contact.email)) throw new Error('Contact email must be a plain email address');
  const contactTokens = {
    contactPhone: contact.phone,
    contactDisplay: escape(contact.display),
    contactEmail: escape(contact.email),
    contactMailto: 'mailto:' + escape(contact.email),
    contactOfficeAddress: escape(contact.office.streetAddress + ', ' + contact.office.cityLine),
    contactOfficeStreetJson: JSON.stringify(contact.office.streetAddress).replace(/</g, '\\u003c'),
    contactTel: 'tel:' + contact.phone,
    contactWhatsApp: 'https://wa.me/' + contact.phone.slice(1)
  };
  // Partials may include other partials (the home intro shares the download options and Play Store preview).
  const expand = (html, depth = 0) => {
    if (depth > 5) throw new Error('Partials are nested too deeply (does one include itself?)');
    return html.replace(/\{\{> ([a-z-]+)\}\}/g, (_, name) => expand(readFileSync(join(root, 'src/partials', name + '.html'), 'utf8').trim(), depth + 1));
  };

  function downloadAttrs(key) {
    const url = (downloads[key] || '').trim();
    if (!url) return 'aria-disabled="true" tabindex="-1"';
    const valid = key === 'googlePlay'
      ? /^https:\/\/play\.google\.com\/store\/apps\/details\?/.test(url)
      : /^https:\/\//.test(url) || /^assets\/[a-zA-Z0-9._/-]+\.apk$/.test(url);
    if (!valid) throw new Error('Invalid ' + key + ' app download URL');
    if (key === 'apk' && url.startsWith('assets/')) {
      const publicRoot = join(root, 'public');
      const apkFile = resolve(publicRoot, url);
      if (!apkFile.startsWith(publicRoot + sep) || !existsSync(apkFile)) {
        throw new Error('APK file missing from public/: ' + url);
      }
    }
    return 'href="' + escape(url) + '" ' + (key === 'googlePlay' ? 'target="_blank" rel="noopener"' : 'download="Black-Gold-Seller.apk"');
  }

  const available = { googlePlay: Boolean(downloads.googlePlay?.trim()), apk: Boolean(downloads.apk?.trim()) };
  const downloadTokens = {
    googlePlayAttrs: downloadAttrs('googlePlay'),
    googlePlayLabel: available.googlePlay ? 'Get it on' : 'Coming soon',
    googlePlayArrow: available.googlePlay ? '↗' : '',
    apkAttrs: downloadAttrs('apk'),
    downloadStatus: !available.googlePlay && !available.apk
      ? '<p class="download-status">For app availability, contact Black Gold.</p>' : '',
    downloadDescription: available.apk && !available.googlePlay
      ? 'Download the seller app APK for a 64-bit Android phone.'
      : available.googlePlay
        ? 'Download the seller app for Android using an option below.'
        : 'Contact Black Gold for help getting the Android seller app.',
    downloadFirstStep: available.apk && !available.googlePlay
      ? 'Tap Download APK to save the app to your Android phone.'
      : available.googlePlay
        ? 'Choose an available download option below.'
        : 'Contact Black Gold for the latest download information.'
  };

  // Prepare and validate everything before replacing generated output.
  const pages = new Map();
  for (const file of readdirSync(join(root, 'src/pages')).filter((f) => f.endsWith('.html'))) {
    const source = readFileSync(join(root, 'src/pages', file), 'utf8');
    // Each page starts with a comment of "key: value" lines (page, title, description).
    const header = /^<!--([\s\S]*?)-->\s*/.exec(source);
    if (!header) throw new Error(`${file}: missing the page header comment`);
    const meta = {};
    for (const line of header[1].split('\n')) {
      const m = /^\s*(\w+):\s*(.+?)\s*$/.exec(line);
      if (m) meta[m[1]] = m[2];
    }
    for (const key of ['page', 'title', 'description', 'closingEyebrow', 'closingTitle', 'closingDescription']) {
      if (!meta[key]) throw new Error(`${file}: missing "${key}" in the page header`);
    }
    const content = expand(source.slice(header[0].length).trim());
    const canonical = siteUrl ? new URL(file === 'index.html' ? '' : file, siteUrl).href : '';
    const siteTokens = {
      pageUrlMetadata: canonical ? `<link rel="canonical" href="${escape(canonical)}">\n<meta property="og:url" content="${escape(canonical)}">` : '',
      shareImage: escape(shareImage),
      shareImageJson: jsonString(shareImage),
      siteUrlProperty: siteUrl ? '"url": ' + jsonString(siteUrl) + ',' : ''
    };
    let html = expand(layout).replace('{{content}}', () => content);
    html = html.replace(/\{\{#if (googlePlay|apk)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => available[key] ? content : '');
    html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = downloadTokens[key] ?? contactTokens[key] ?? areaTokens[key] ?? siteTokens[key] ?? (meta[key] == null ? undefined : escape(meta[key]));
      if (value == null) throw new Error(`${file}: unknown template value "${key}"`);
      return value;
    });
    if (/\{\{[\s\S]*?\}\}/.test(html)) throw new Error(`${file}: unresolved template markup`);
    // Mark this page's links in the menu and footer.
    html = html.split(`data-page="${meta.page}"`).join(`data-page="${meta.page}" aria-current="page"`);
    // The <body> tag carries data-page too; it is not a link, so take the marker off again.
    html = html.replace(`<body data-page="${meta.page}" aria-current="page">`, `<body data-page="${meta.page}">`);
    html = html.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    pages.set(file, `<!-- Generated from src/pages/${file}. Edit src/ or public/, then run npm run build. -->\n` + html);
  }

  const stylesheet = styles.map(file => `/* Source: src/styles/${file} */\n` + readFileSync(join(root, 'src/styles', file), 'utf8')).join('\n');
  const scripts = readdirSync(join(root, 'src/scripts')).filter(file => file.endsWith('.js'))
    .map(file => [file, readFileSync(join(root, 'src/scripts', file), 'utf8')]);
  // Only this checkout's fixed dist/ directory may be replaced.
  if (resolve(output) !== resolve(root, 'dist') || dirname(output) !== root) throw new Error('Invalid build output path');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  cpSync(join(root, 'public'), output, { recursive: true });
  writeFileSync(join(output, 'style.css'), '/* Generated by npm run build. Edit src/styles/. */\n' + stylesheet);
  for (const [file, content] of scripts) writeFileSync(join(output, file), content);
  for (const [file, html] of pages) writeFileSync(join(output, file), html);
  writeFileSync(join(output, 'robots.txt'), 'User-agent: *\nAllow: /\n' + (siteUrl ? '\nSitemap: ' + new URL('sitemap.xml', siteUrl).href + '\n' : ''));
  if (siteUrl) {
    const locations = [...pages.keys()].map(file => new URL(file === 'index.html' ? '' : file, siteUrl).href);
    writeFileSync(join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + locations.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n') + '\n</urlset>\n');
  }
  console.log(`Built ${pages.size} pages, ${styles.length} stylesheets, scripts and public assets into dist/.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildSite();
