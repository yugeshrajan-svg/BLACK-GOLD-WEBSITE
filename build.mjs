// Builds the pages in dist/ from src/layout.html and src/pages/*.html.
// The header, footer, closing section and dialogs live once, in the layout.
// Run after editing anything in src/:  node build.mjs   (no dependencies)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(join(root, 'src/layout.html'), 'utf8');
const downloads = JSON.parse(readFileSync(join(root, 'src/app-downloads.json'), 'utf8'));
const contact = JSON.parse(readFileSync(join(root, 'src/contact.json'), 'utf8'));
const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
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
  return 'href="' + escape(url) + '" ' + (key === 'googlePlay' ? 'target="_blank" rel="noopener"' : 'download="Black-Gold-Seller.apk"');
}

const downloadTokens = {
  googlePlayAttrs: downloadAttrs('googlePlay'),
  apkAttrs: downloadAttrs('apk'),
  downloadStatus: !downloads.googlePlay && !downloads.apk
    ? '<p class="download-status">Download links are coming soon.</p>'
    : !downloads.googlePlay || !downloads.apk
      ? '<p class="download-status">Another download option will be added here soon.</p>'
      : ''
};

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
  let html = expand(layout).replace('{{content}}', () => content);
  html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => downloadTokens[key] ?? contactTokens[key] ?? escape(meta[key] || ''));
  // Mark this page's links in the menu and footer.
  html = html.split(`data-page="${meta.page}"`).join(`data-page="${meta.page}" aria-current="page"`);
  // The <body> tag carries data-page too; it is not a link, so take the marker off again.
  html = html.replace(`<body data-page="${meta.page}" aria-current="page">`, `<body data-page="${meta.page}">`);
  writeFileSync(join(root, 'dist', file), html);
  console.log('built dist/' + file);
}
