# Response security rollout

The live server configuration is not in this checkout. These changes are **not deployed** by building the website, and .openai/hosting.json is preserved. Do not replace the production Caddyfile with a guessed template.

## Local proof

The existing loopback preview server sends nosniff, DENY framing, explicit Referrer-Policy and a report-only CSP on every response. To test enforcement locally:


```sh
npm run build
node scripts/serve.mjs --port 4300 --csp-enforce
```

The policy hashes the exact inline scripts/JSON-LD in the generated HTML; it allows self-hosted scripts/fonts/images, the site's inline animation styles, and no AJAX connections or native form posts. Draft creation must remain local and WhatsApp/email navigation must remain a deliberate visitor action. Hashes must be regenerated after rebuilding content.

## Candidate Caddy fragment

After `npm run check`, run `node scripts/security-headers.mjs --caddy --https`. This writes a fragment to stdout only; it does not change any server. Start with the emitted report-only CSP. HSTS starts at one day, without includeSubDomains or preload. The existing HTTPS redirects must remain intact.

The operator must first inspect and back up the current Caddy configuration; preserve reverse proxies, routing, compression, TLS, API CORS and authentication. Merge the marketing policy only into the handler serving these static pages. Validate Caddy syntax/config using the server's installed Caddy version before reload, then verify public headers and browser console/network behaviour.

Do **not** apply this static-site CSP globally to the seller app/API: connect-src 'none', form-action 'none' and frame-ancestors 'none' may break unrelated app or embedded flows. For the proxied /privacy and /delete-account routes, inspect their implementation and independently test a suitable CSP; base headers can be merged only after confirming framing requirements. Strip X-Powered-By at the proxy boundary if appropriate.

CSP Report-Only currently has no remote reporting endpoint (no extra visitor data is sent). Use staging browser violation events/console logs to evaluate it. After the approved staging checks pass, generate with --enforce, validate again and roll out in a controlled release. Raise HSTS duration only after confirming the host/subdomain plan and rollback implications. Never enable preload blindly.

## Verification

Check both HTTPS hostnames and representative static/404/legal responses for the intended headers. Test every page, motion controls, menu, enquiry validation, copied/downloaded draft and explicit WhatsApp/email handoff. A local header test is not proof that the production proxy sends the headers.
