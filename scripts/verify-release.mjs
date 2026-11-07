// Offline by default. Network access requires an explicit, allowlisted --url.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { hashFile, isReleasePath, listReleaseFiles, output, RELEASE_MANIFEST } from './build.mjs';

export const ALLOWED_ORIGINS = Object.freeze(['https://myblackgold.app', 'https://www.myblackgold.app']);
export const LIMITS = Object.freeze({
  manifestBytes: 1024 * 1024,
  artifacts: 256,
  fileBytes: 8 * 1024 * 1024,
  apkBytes: 64 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  totalBytesWithApk: 128 * 1024 * 1024,
  requestMs: 15_000,
  totalMs: 120_000
});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hasKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export function validateManifest(manifest) {
  if (!hasKeys(manifest, ['schemaVersion', 'source', 'artifacts']) || manifest.schemaVersion !== 1
    || !hasKeys(manifest.source, ['commit', 'inputSha256'])
    || typeof manifest.source.commit !== 'string'
    || !(manifest.source.commit === 'unknown' || /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(manifest.source.commit))
    || !isHash(manifest.source.inputSha256)) throw new Error('Invalid release manifest schema/source');
  if (!Array.isArray(manifest.artifacts) || !manifest.artifacts.length || manifest.artifacts.length > LIMITS.artifacts) {
    throw new Error('Invalid release artifact count (maximum ' + LIMITS.artifacts + ')');
  }
  let previous = '';
  for (const artifact of manifest.artifacts) {
    if (!hasKeys(artifact, ['path', 'size', 'sha256']) || !isReleasePath(artifact.path)
      || artifact.path === RELEASE_MANIFEST || artifact.path <= previous
      || !Number.isSafeInteger(artifact.size) || artifact.size < 0 || !isHash(artifact.sha256)) {
      throw new Error('Invalid, duplicate or unsorted release artifact record');
    }
    previous = artifact.path;
  }
  return manifest;
}

export function verifyLocalRelease(directory = output) {
  if (!lstatSync(directory).isDirectory()) throw new Error('Release directory must be a real directory, not a symlink');
  const manifestPath = join(directory, RELEASE_MANIFEST);
  const stat = lstatSync(manifestPath);
  if (!stat.isFile() || stat.size > LIMITS.manifestBytes) throw new Error('Manifest must be a regular file of at most 1 MiB');
  const bytes = readFileSync(manifestPath);
  const manifest = validateManifest(JSON.parse(bytes.toString('utf8')));
  const actual = listReleaseFiles(directory).filter(path => path !== RELEASE_MANIFEST);
  const expected = manifest.artifacts.map(artifact => artifact.path);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Release file set mismatch (missing or unexpected files)');
  for (const artifact of manifest.artifacts) {
    const actual = hashFile(join(directory, artifact.path));
    if (actual.size !== artifact.size || actual.sha256 !== artifact.sha256) throw new Error('Artifact integrity mismatch: ' + artifact.path);
  }
  return { manifest, manifestSize: bytes.length, manifestSha256: sha256(bytes), checked: expected.length };
}

export function parseRemoteBase(value) {
  if (typeof value !== 'string' || !/^https:\/\//.test(value) || /[\\\s%?#@]/.test(value)) {
    throw new Error('Remote URL must be plain HTTPS, without credentials, escapes, query or fragment');
  }
  let base;
  try { base = new URL(value); } catch { throw new Error('Invalid remote URL'); }
  if (!ALLOWED_ORIGINS.includes(base.origin) || base.username || base.password) {
    throw new Error('Remote origin is not allowlisted; allowed: ' + ALLOWED_ORIGINS.join(', '));
  }
  // Check the raw path too: URL parsing otherwise silently normalizes /../ and /./.
  const rawPath = value.slice(value.indexOf('://') + 3).replace(/^[^/]+/, '');
  const path = rawPath.replace(/^\//, '').replace(/\/$/, '');
  if ((path && !isReleasePath(path)) || rawPath.includes('//')) throw new Error('Invalid remote base path');
  base.pathname = base.pathname.replace(/\/$/, '') + '/';
  return base;
}

async function remoteDigest(url, maxBytes, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  let reader;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Remote request timed out'));
      controller.abort();
    }, timeoutMs);
  });
  const download = async () => {
    const response = await fetchImpl(url.href, {
      method: 'GET', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'accept-encoding': 'identity', 'cache-control': 'no-cache' }, signal: controller.signal
    });
    if (response.status !== 200 || response.redirected || (response.url && response.url !== url.href)) {
      throw new Error('Expected a direct HTTP 200 response (redirects are not allowed)');
    }
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
      throw new Error('Remote Content-Length exceeds its allowed byte budget');
    }
    if (!response.body) throw new Error('Remote response has no readable body');
    reader = response.body.getReader();
    const hash = createHash('sha256');
    let size = 0;
    while (true) {
      if (controller.signal.aborted) throw new Error('Remote request timed out');
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Remote body exceeds its allowed byte budget');
      hash.update(value);
    }
    return { size, sha256: hash.digest('hex') };
  };
  try { return await Promise.race([download(), timeout]); }
  finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
  }
}

export async function verifyRemoteRelease(directory, { url, includeApk = false, fetchImpl = globalThis.fetch, timeoutMs = LIMITS.requestMs } = {}) {
  const base = parseRemoteBase(url); // No URL, unknown origin or invalid URL: no request, ever.
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > LIMITS.requestMs) throw new Error('Invalid request timeout');
  const local = verifyLocalRelease(directory); // A trusted, intact local release is always the reference.
  const skipped = local.manifest.artifacts.filter(artifact => /\.apk$/i.test(artifact.path) && !includeApk);
  const selected = local.manifest.artifacts.filter(artifact => !skipped.includes(artifact));
  for (const artifact of selected) {
    const max = /\.apk$/i.test(artifact.path) ? LIMITS.apkBytes : LIMITS.fileBytes;
    if (artifact.size > max) throw new Error('Artifact exceeds remote download limit: ' + artifact.path);
  }
  const total = local.manifestSize + selected.reduce((sum, artifact) => sum + artifact.size, 0);
  if (total > (includeApk ? LIMITS.totalBytesWithApk : LIMITS.totalBytes)) throw new Error('Release exceeds total remote download budget');
  const deadline = Date.now() + LIMITS.totalMs;
  const planned = [{ path: RELEASE_MANIFEST, size: local.manifestSize, sha256: local.manifestSha256 }, ...selected];
  // Local records select requests, never untrusted remote manifest content. At most 257 sequential GETs.
  for (const artifact of planned) {
    const target = new URL(artifact.path, base);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) throw new Error('Artifact escaped the allowed origin/base');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Total remote verification timeout exceeded');
    const actual = await remoteDigest(target, artifact.size, Math.min(timeoutMs, remaining), fetchImpl);
    if (actual.size !== artifact.size || actual.sha256 !== artifact.sha256) throw new Error('Remote integrity mismatch: ' + artifact.path);
  }
  return { local, checked: selected.length, skipped: skipped.map(artifact => artifact.path) };
}

async function main() {
  const { values } = parseArgs({ options: {
    dir: { type: 'string', default: output }, url: { type: 'string' },
    'include-apk': { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' }
  }, allowPositionals: false, strict: true });
  if (values.help) {
    console.log('Usage: node scripts/verify-release.mjs [--dir dist] [--url https://myblackgold.app/] [--include-apk]');
    console.log('Offline by default. Remote: allowlisted HTTPS only; no credentials/redirects; APK bytes skipped unless explicitly included.');
    return;
  }
  if (values['include-apk'] && values.url === undefined) throw new Error('--include-apk requires --url (local checks already hash all artifacts)');
  const directory = resolve(values.dir);
  const remote = values.url !== undefined ? await verifyRemoteRelease(directory, { url: values.url, includeApk: values['include-apk'] }) : null;
  const local = remote ? remote.local : verifyLocalRelease(directory);
  console.log('Local integrity verified: ' + local.checked + ' artifacts. Source HEAD: ' + local.manifest.source.commit);
  console.log('Build input SHA-256: ' + local.manifest.source.inputSha256);
  if (remote) {
    console.log('Remote manifest and ' + remote.checked + ' requested artifacts match the local release.');
    if (remote.skipped.length) console.log('PARTIAL remote coverage: APK bytes NOT verified: ' + remote.skipped.join(', ') + '. Use --include-apk for a bounded download.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error('FAIL: ' + error.message); process.exitCode = 1; });
}
