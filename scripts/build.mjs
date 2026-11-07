// Source: src/ + public/. Output: dist/. No packages are required.
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const output = join(root, 'dist');
export const RELEASE_MANIFEST = 'release-manifest.json';

// Only portable, relative artifact names. Never follow a symlink outside the inputs/output.
export function isReleasePath(path) {
  return typeof path === 'string' && path.length <= 512
    && /^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/.test(path)
    && path.split('/').every(part => part !== '.' && part !== '..');
}

export function listReleaseFiles(directory) {
  const files = [];
  function visit(relative) {
    const stat = lstatSync(join(directory, relative));
    if (stat.isSymbolicLink()) throw new Error('Release inputs/output must not contain symlinks');
    if (stat.isDirectory()) {
      for (const name of readdirSync(join(directory, relative)).sort()) {
        const child = relative ? relative + '/' + name : name;
        if (!isReleasePath(child)) throw new Error('Unsupported release file name');
        visit(child);
      }
    } else if (stat.isFile()) files.push(relative);
    else throw new Error('Release inputs/output must contain only regular files and directories');
  }
  visit('');
  return files.sort();
}

// Chunked hashing also covers the APK without buffering it in memory.
export function hashFile(file) {
  if (!lstatSync(file).isFile()) throw new Error('Expected a regular release file');
  const fd = openSync(file, 'r');
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(1024 * 1024);
  let size = 0;
  try {
    let length;
    while ((length = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, length));
      size += length;
    }
  } finally { closeSync(fd); }
  return { size, sha256: hash.digest('hex') };
}

export function fingerprintBuildInputs(projectRoot = root) {
  const files = ['package.json', 'scripts/build.mjs'];
  for (const directory of ['src', 'public']) {
    files.push(...listReleaseFiles(join(projectRoot, directory)).map(file => directory + '/' + file));
  }
  const hash = createHash('sha256').update('black-gold-build-inputs-v1\n');
  for (const file of files.sort()) {
    const { size, sha256 } = hashFile(join(projectRoot, file));
    hash.update(JSON.stringify([file, size, sha256]) + '\n');
  }
  // Publish only the aggregate, not source filenames, local paths or file contents.
  return hash.digest('hex');
}

export function readSourceCommit(projectRoot = root) {
  // A source archive must not inherit an unrelated parent repository's HEAD.
  if (!existsSync(join(projectRoot, '.git'))) return 'unknown';
  const options = { cwd: projectRoot, encoding: 'utf8', timeout: 2000, maxBuffer: 4096, stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], options).trim();
    if (realpathSync(top) !== realpathSync(projectRoot)) return 'unknown';
    const commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], options).trim();
    return /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit) ? commit : 'unknown';
  } catch { return 'unknown'; }
}

const styles = [
  'base.css', 'header.css', 'home.css', 'components.css', 'collection.css',
  'seller-app.css', 'faq.css', 'footer-forms.css', 'industry.css', 'motion.css', 'responsive.css', 'theme.css'
];

export function buildSite() {
  if (existsSync(join(root, 'public', RELEASE_MANIFEST))) throw new Error(RELEASE_MANIFEST + ' is reserved for the build');
  const source = { commit: readSourceCommit(), inputSha256: fingerprintBuildInputs() };
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
  // Search engine ownership checks (Google Search Console, Bing Webmaster Tools) and the
  // business's own profiles elsewhere (Google Business Profile, IndiaMART...). All optional.
  const verification = { google: site.googleSiteVerification ?? '', bing: site.bingSiteVerification ?? '' };
  for (const [name, token] of Object.entries(verification)) {
    if (typeof token !== 'string' || (token.trim() && !/^[A-Za-z0-9_-]{8,128}$/.test(token.trim()))) {
      throw new Error(`src/config/site.json: ${name}SiteVerification must be the code from the verification meta tag, or empty`);
    }
  }
  const sameAs = site.sameAs ?? [];
  if (!Array.isArray(sameAs) || !sameAs.every(link => typeof link === 'string' && /^https:\/\/[^\s"<>]+$/.test(link))) {
    throw new Error('src/config/site.json: sameAs must list full https:// profile links');
  }
  const businessId = (siteUrl || '') + '#business';
  const seoTokens = {
    searchVerificationMeta: [
      verification.google.trim() && `<meta name="google-site-verification" content="${escape(verification.google.trim())}">`,
      verification.bing.trim() && `<meta name="msvalidate.01" content="${escape(verification.bing.trim())}">`
    ].filter(Boolean).join('\n'),
    businessIdJson: jsonString(businessId),
    logoJson: jsonString(siteUrl ? new URL('assets/black-gold-app-icon.webp', siteUrl).href : 'assets/black-gold-app-icon.webp'),
    sameAsProperty: sameAs.length ? '"sameAs": ' + jsonString(sameAs) + ',' : ''
  };
  if (!Array.isArray(areas) || !areas.length || !areas.every((a) => typeof a === 'string' && a.trim() && a.trim() !== 'Other')) {
    throw new Error('src/config/areas.json must list area names (the form adds "Other area" itself)');
  }
  // One option per area in the enquiry form's area list; "Other area" follows in the layout.
  const areaTokens = {
    areaOptions: areas.map((a) => `<option value="${escape(a.trim())}">${escape(a.trim())}</option>`).join(''),
    // The same areas, shown as a list on What we collect and named in the business details for search engines.
    areaListItems: areas.map((a) => `<li>${escape(a.trim())}</li>`).join(''),
    areaServedJson: jsonString([{ '@type': 'City', name: 'Chennai' }, ...areas.map((a) => ({ '@type': 'Place', name: a.trim() + ', Chennai' }))])
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
      ? 'Tap to download the seller app to your Android phone (Android 8.0 or newer).'
      : available.googlePlay
        ? 'Download the seller app for Android using an option below.'
        : 'Contact Black Gold for help getting the Android seller app.',
    downloadFirstStep: available.apk && !available.googlePlay
      ? 'Tap the download button to save the app to your Android phone.'
      : available.googlePlay
        ? 'Choose an available download option below.'
        : 'Contact Black Gold for the latest download information.',
    downloadInstallStep: available.apk && !available.googlePlay
      ? 'Open the downloaded file and tap Install. If Android asks, allow installs from your browser once, then tap Install again.'
      : available.googlePlay
        ? 'Tap Install on the Google Play page. Google Play keeps the app up to date.'
        : 'The app is coming to Google Play. Until then, contact Black Gold to join the early testing.'
  };

  // Prepare and validate everything before replacing generated output.
  const pages = new Map();
  for (const file of readdirSync(join(root, 'src/pages')).filter((f) => f.endsWith('.html')).sort()) {
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
    // {{#if key}} / {{#unless key}}: an app download that is configured, or an optional page header value.
    const isSet = key => key in available ? available[key] : Boolean(meta[key]);
    html = html.replace(/\{\{#(if|unless) (\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, test, key, content) => isSet(key) === (test === 'if') ? content : '');
    html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = downloadTokens[key] ?? contactTokens[key] ?? areaTokens[key] ?? siteTokens[key] ?? seoTokens[key] ?? (meta[key] == null ? undefined : escape(meta[key]));
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
  const scripts = readdirSync(join(root, 'src/scripts')).filter(file => file.endsWith('.js')).sort()
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
  // Fail without a manifest if inputs changed while being read/copied. Build from a stable checkout.
  if (fingerprintBuildInputs() !== source.inputSha256 || readSourceCommit() !== source.commit) {
    throw new Error('Build inputs changed during the build; rebuild from a stable checkout');
  }
  const artifacts = listReleaseFiles(output).map(path => ({ path, ...hashFile(join(output, path)) }));
  writeFileSync(join(output, RELEASE_MANIFEST), JSON.stringify({ schemaVersion: 1, source, artifacts }, null, 2) + '\n');
  console.log(`Built ${pages.size} pages, ${styles.length} stylesheets, scripts and public assets into dist/ with ${RELEASE_MANIFEST}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildSite();
