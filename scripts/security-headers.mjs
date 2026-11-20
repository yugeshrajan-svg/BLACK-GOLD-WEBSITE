// Headers for the static marketing website only, not the seller API.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Where the built pages send data, read from their own <meta> tags (src/config/site.json):
// the enquiry endpoint, and Meta's Pixel hosts when a Pixel ID is set.
function marketingSources(pages) {
  const connect = new Set();
  let pixel = false;
  for (const html of pages) {
    const leads = /<meta name="bg-leads" content="([^"]+)">/.exec(html)?.[1];
    if (leads) connect.add(/^https:\/\//.test(leads) ? new URL(leads).origin : "'self'");
    if (/<meta name="bg-meta-pixel" content="\d+">/.test(html)) pixel = true;
  }
  return { connect: [...connect].sort(), pixel };
}

export function securityHeaders(directory, { reportOnly = true, https = false } = {}) {
  const hashes = new Set();
  const pages = [];
  for (const file of readdirSync(directory).filter(name => name.endsWith('.html'))) {
    const html = readFileSync(join(directory, file), 'utf8');
    pages.push(html);
    for (const [, attributes, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc\s*=/i.test(attributes) && script.trim()) {
        hashes.add("'sha256-" + createHash('sha256').update(script).digest('base64') + "'");
      }
    }
  }
  const { connect, pixel } = marketingSources(pages);
  // Meta Pixel: its script, its beacon image and its fetch/beacon calls.
  const meta = pixel ? { script: ['https://connect.facebook.net'], img: ['https://www.facebook.com'], connect: ['https://www.facebook.com', 'https://connect.facebook.net'] } : { script: [], img: [], connect: [] };
  const connectSources = [...connect, ...meta.connect];
  const policy = [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'",
    "frame-ancestors 'none'", "form-action 'none'",
    "script-src 'self' " + [...meta.script, ...[...hashes].sort()].join(' '),
    // SVG colour attributes and JS animation styles are part of the current site.
    "style-src 'self' 'unsafe-inline'", ["img-src 'self' data:", ...meta.img].join(' '),
    "font-src 'self'", 'connect-src ' + (connectSources.length ? connectSources.join(' ') : "'none'")
  ].join('; ');
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    [reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy']: policy
  };
  // Start short, without includeSubDomains/preload. Extend only after host review.
  if (https) headers['Strict-Transport-Security'] = 'max-age=86400';
  return headers;
}

export function caddyFragment(headers) {
  return [
    '# Merge into the existing static marketing handler after configuration review.',
    '# Do not apply this CSP to the app/API or overwrite the existing Caddyfile.',
    'header {',
    ...Object.entries(headers).map(([name, value]) => '  ' + name + ' ' + JSON.stringify(value)),
    '  -X-Powered-By',
    '}', ''
  ].join(String.fromCharCode(10));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {values} = parseArgs({ options: {
    directory: {type:'string',default:'dist'}, caddy:{type:'boolean'},
    enforce:{type:'boolean'}, https:{type:'boolean'}
  }});
  const headers = securityHeaders(resolve(values.directory), {reportOnly:!values.enforce,https:!!values.https});
  console.log(values.caddy ? caddyFragment(headers) : JSON.stringify(headers,null,2));
}
