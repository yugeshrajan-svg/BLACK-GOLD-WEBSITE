# Black Gold website audit

**Audit:** 7 November 2026, approximately 22:58–23:04 IST (UTC+05:30).  
**Targets:** https://www.myblackgold.app/ and https://myblackgold.app/.  
**Reviewed commit:** 0da994193732afcf3a5b79972daf2a0148a008a5 (clean checkout at start; committed 7 November, 22:29 IST).  
**Method:** read-only customer browsing, ordinary GET/HEAD requests, source inspection, and the existing local build/in-memory tests. No production form submission, messages, calls, login, account creation, active vulnerability scans or exploit probes. No application changes or deployment performed.

## 1. Summary and first three fixes

The website explains its core offer well: used/waste engine, hydraulic and transformer oil; registered businesses in Chennai; 50-litre minimum; on-site measurement; UPI/cash payment at pickup; and receipts. Garage and factory operators have a clear enquiry route. Five marketing pages, the sitemap, privacy policy and account-deletion information were reachable. The enquiry dialog explicitly says it prepares a summary rather than booking a pickup.

**Main seller obstacles:** Google Play is not available through this website; the primary download is a 46.18 MB APK requiring Android sideloading. iOS is “Coming soon,” with an enquiry/contact fallback rather than an iOS app. Mobile keyboard users encounter an incorrect menu focus order. Fleet eligibility is not explicit.

**Tackle first:**
1. **Provide and verify the intended public Google Play listing**, or clearly position the APK as an interim option. Put an explicit “No Android phone? Enquire here” alternative beside download choices.
2. **Deploy a reviewed, identifiable release including the existing menu-order fix**, then retest the live site. Current local tests do not certify the deployed version.
3. **Add staged, tested security headers** to both the static site and proxied legal routes, especially HSTS, CSP/frame protection and nosniff.

No Critical security finding was confirmed. This limited passive audit is **not** a security clearance for the seller app/API. No staging environment was supplied or approved; no staging vulnerability was reproduced.

## 2. Coverage and evidence

Evidence files are in [evidence/](evidence/). “Pass” applies only to the stated check, not the complete feature or application.

### Browser environments

- Managed Chrome: initial Pixel 7 emulation, **412×839 CSS px**. Its viewer subsequently resized to 607×705, so controlled measurements below were rerun independently.
- Isolated headless desktop Chrome engine **157**, macOS host, **1440×900**.
- Same Chromium engine with Pixel 7 / Android 14 profile, **412×839**. The emulated user-agent advertises Chrome 153; this was **not a real Android device**.
- Same Chromium engine with iPhone 13 profile, **390×664**. Safari-looking user-agent notwithstanding, this was **not Safari/WebKit or a real iPhone**.
- Each controlled profile used a fresh browser context; journeys were sequential. Raw measurements: [browser-results.json](evidence/browser-results.json).

| Check | Environment / browser or commit | Result | Evidence / limitation |
|---|---|---|---|
| HTTPS www canonicalization | Live, curl/browser | Pass | www HTTPS → 301 → apex HTTPS 200; redirects.txt |
| HTTP upgrade, both hosts | Live, curl | Pass | Apex HTTP → 308 HTTPS; www HTTP → 308 HTTPS www → 301 apex |
| Navigation/footer/sitemap discovery | Live, mobile Chrome + GET | Pass | /, about.html, collect.html, faq.html, seller-app.html all 200; sitemap.xml.headers |
| Garage journey: oil, minimum, area, payment | Live, mobile Chrome | Pass | Home/collection/seller pages and FAQ content; locality requires confirmation |
| Factory journey | Live, mobile Chrome | Pass | Hydraulic/transformer oils and industrial businesses explicitly described |
| Fleet eligibility | Live, public content | Fail | F5: fleets not explicitly included/excluded |
| Intended public Google Play destination | Live + commit | Fail | F1: disabled link, no href; config googlePlay empty |
| Direct APK destination | Live, ordinary HEAD | Pass | 200, Android package MIME, 46,177,162 bytes; apk.headers; installation/signature not verified |
| iPhone/desktop continuation | Live, emulated iPhone + desktop | Pass | Enquiry and footer contacts exist; no iOS app or web seller login claimed |
| Printed QR destination | Not supplied | Blocked | Need exact printed artwork |
| WhatsApp/email/telephone destinations | Live DOM + local smoke tests | Pass | wa.me/917010860788; support@myblackgold.app; tel:+917010860788; not opened/sent/dialed |
| Enquiry dialog and labels | Live, mobile Chrome | Pass | Oil radios, business, phone, area, quantity, units; dialog opens and Escape closes; no submission |
| Valid/missing/invalid inputs and draft encoding | Local in-memory tests, reviewed commit | Pass | tests.log; four missing fields, 12345 phone, 49 L, valid 50 L, Other area, barrels, edited drafts |
| Actual browser submissions, duplicate delivery, backend errors | Approved staging absent | Blocked | No production submission; local tests do not prove delivery or deduplication |
| Privacy and deletion information | Live ordinary GET | Pass | /privacy and /delete-account return 200; no account deletion attempted |
| Homepage visual layout/media | Live, three controlled profiles | Pass | android.png, iphone-chromium.png, desktop.png; no horizontal overflow or completed broken images before/after sampled scrolling |
| Mobile menu keyboard order | Live, Pixel/iPhone profiles | Fail | F2; menuNextFocus is BODY instead of first navigation link |
| Skip link / focus styling | Live, Pixel profile | Pass | Skip to content receives a 2px visible outline; Enter focuses main; accessibility-results.json |
| Reduced motion | Live, Pixel profile | Pass | Initial and dynamic reduced-motion settings pause motion; labels become Play motion |
| Contrast spot-check | Live computed styles | Pass | Body text #d9d3c4 on #07080a: 13.42:1; not an all-elements/gradient contrast certification |
| Slow-mobile load observation | Live, Pixel profile, one throttled run | Pass | FCP 1.784 s; DOM ready 2.437 s; load 4.665 s; download link visible when checked at 4.681 s |
| Real Android Chrome / iPhone Safari | Hardware/browser unavailable in audit | Blocked | Emulation cannot establish real-device install or Safari compatibility |
| Browser errors / failed requests | Live sampled homepage profiles | Pass | No page errors or request failures recorded; browser-results.json |
| Mixed content / third-party analytics | Live sampled resource logs + assets | Pass | Observed homepage resources HTTPS, same-origin; no analytics requests observed |
| HSTS/CSP/frame protection/nosniff | Live normal responses | Fail | F3; captured .headers files |
| Cookie security flags | Live fresh public sessions | N/A | No cookies observed in sampled contexts; no Set-Cookie in inspected responses; app sessions untested |
| Build, static integrity, interaction smoke checks | Local reviewed commit | Pass | npm test; 5 pages, 195 local references; tests.log |
| Dedicated lint | Local package.json | N/A | No lint script configured; both JS files pass node --check |
| Deployment matches reviewed source | Live bytes vs rebuilt checkout | Fail | F4; all 8 sampled HTML/JS/CSS artifacts differ; asset-hashes.json |
| WSTG active tests / authorization / sessions | Approved staging absent | Blocked | Detailed remaining access/checks below |

**Reduced-motion evidence note:** browser-results.json samples the class immediately after changing emulation and records paused=false before the media-change handler runs. The dedicated accessibility check waits for the state transition and confirms initial and dynamic reduced-motion behaviour; accessibility-results.json is the settled result, not a reduced-motion failure.

**Performance interpretation:** 1.6 Mbps download, 750 kbps upload, 150 ms latency, cold browser cache, no CPU throttling. Recorded initial-load CLS was **0.000154**. Visibility at 4.681 s is an upper-bound observation, not the exact first usable time, INP, or completed download. Unthrottled cold-profile load times varied from 1.44 to 12.10 s; these single samples are not a benchmark. No sustained-load test was run.

## 3. Findings

### F1 — Public Google Play acquisition path unavailable
**Severity: High (conversion/release readiness, not a demonstrated security exploit).**  
**Classification:** Confirmed live and corroborated by source.  
**Affected:** / and /seller-app.html; src/config/app-downloads.json:2–3; src/partials/app-download-options.html:4–19; scripts/build.mjs:59–98.

**Reproduce:** Open the homepage in a fresh mobile browser. Inspect “Coming soon Google Play” and the primary Android download. Open Seller app → download instructions. Inspect the APK URL with an ordinary HEAD request.

**Expected:** The requested seller-app journey reaches the intended public Play listing, or clearly explains an interim installation route and non-Android alternative.  
**Actual/evidence:** Google Play is disabled with no destination. The working link is /assets/black-gold-seller.apk, HTTP 200, application/vnd.android.package-archive, 46,177,162 bytes. Seller instructions explain allowing browser installs. The Play animation is explicitly labelled illustrative/listing not live. No wrong listing, region restriction or tester-only screen was observed—there is no Play URL to test.

**Impact:** Users who require Play distribution or cannot sideload cannot finish the advertised app-first journey. iPhone and desktop users must use enquiry/contact; the same Android download remains prominent.

**Proposed fix:** Supply the approved public listing, verify package/developer identity and target-region access, then populate googlePlay. Until then, label the APK as a direct Android install; publish trusted version/update guidance and an explicit nearby enquiry alternative. Do not treat absence of a Play listing as evidence that the APK is malicious.

**Retest:** Follow every rendered store button on a signed-out Android device in the target region; verify the exact intended public listing, installation and update path. Verify iPhone/desktop fallback without initiating unwanted downloads. APK signing/install testing remains outside this audit.

### F2 — Mobile menu opening skips links in forward keyboard order
**Severity: Medium.**  
**Classification:** Confirmed live; corrective markup already exists in reviewed source.  
**Affected:** Live / (shared header), captured live-index.html.txt:39–51 and live-app.js.txt:46–75. Local comparison: src/layout.html:40–49.

**Reproduce:** At 412×839 or 390×664, focus Menu; press Enter; press Tab. Inspect the focused element. Repeat with Shift+Tab or Escape for recovery.

**Expected:** Forward Tab enters the open navigation, beginning with Home, in a predictable visible sequence.  
**Actual/evidence:** The live Menu button occurs after navigation in DOM order. With main/footer inert, the next Tab leaves the page's controls (activeElement becomes BODY); another Tab returns to Skip to content. Both isolated mobile profiles reproduced this. Escape closes the menu. This is a disruptive focus-order defect, not a claim that links are permanently inaccessible.

**Impact:** Keyboard/switch users must backtrack or cycle through browser/page controls to reach navigation.

**Proposed fix:** Review and deploy the existing source change placing Menu before the links. Verify open-menu focus management and visible focus; add a real-browser regression alongside the mock DOM test.

**Retest:** Menu → Enter → Tab must focus Home; all navigation links and the app CTA must be reachable sequentially. Test Escape, Shift+Tab, resize across 1025 px, and touch navigation.

### F3 — Missing response security hardening
**Severity: Low (defence in depth).**  
**Classification:** Confirmed live response configuration; no exploit attempted.  
**Affected:** Inspected marketing HTML responses, /privacy and /delete-account.

**Reproduce:** Make a normal GET or HEAD to the affected URLs and inspect headers. Saved evidence includes index.html.headers, privacy.headers, delete-account.headers and redirects.txt.

**Expected:** A deliberately tested HTTPS and browser-policy baseline for both static and proxied content.  
**Actual:** No Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options or explicit Referrer-Policy in the inspected responses. HTTP already redirects correctly. Legal routes also disclose X-Powered-By: Express.

**Impact:** Without HSTS, first HTTP contact lacks the browser's enforced HTTPS protection; no CSP adds containment if injection is later introduced; absent frame policy permits framing unless another mechanism intervenes; nosniff removes MIME ambiguity. These observations do not prove XSS, clickjacking exploitation, or a sensitive-data leak. Modern default referrer behaviour still applies.

**Proposed fix:** Add headers in the real hosting/proxy configuration after staging compatibility checks. Begin CSP in Report-Only, inventory self-hosted fonts/images/scripts plus inline script/JSON-LD/style needs, then enforce a tailored policy with frame-ancestors and other appropriate restrictions. Enable HSTS after confirming subdomain readiness; do not blindly preload/includeSubDomains. Set nosniff and an explicit referrer policy; remove unnecessary Express fingerprinting.

**Retest:** Repeat normal response checks on both hosts, all page classes and the APK; confirm no blocked scripts/fonts/dialogs. Validate framing restrictions and CSP in approved staging.

### F4 — Reviewed release and live assets do not match
**Severity: Medium (release assurance).**  
**Classification:** Confirmed comparison, not proof of an unauthorized deployment.  
**Affected:** Five HTML pages, app.js, oil-surface.js and style.css; commit listed above.

**Reproduce:** Run npm test to rebuild dist, fetch each public artifact normally, and compare SHA-256 values using asset-hashes.json.

**Expected:** The release under review is identifiable and its tests can be tied to the live artifact.  
**Actual/evidence:** All eight sampled artifacts differ. For example, live app.js SHA-256 starts 4fa217ceff916afc; rebuilt app.js starts 32e30f35c4c2bf4e. Full hashes are retained. The difference is substantive: the live header has the old menu ordering, and live animation logic differs from the checkout. An exact live Git commit cannot be determined from available evidence.

**Impact:** Passing local tests cannot demonstrate that production includes tested fixes. The current keyboard fix is an observed example.

**Proposed fix:** Publish from a reviewed immutable build; retain commit/build manifests, artifact hashes and deployment records. Review the intended release before deploying—this audit did not deploy anything.

**Retest:** Compare expected release hashes with public artifacts, record the live commit/build identifier, then rerun the targeted live smoke checks.

### F5 — Fleet-operator eligibility is not explicit
**Severity: Low.**  
**Classification:** Live content clarity gap, not a claim that fleets are ineligible.  
**Affected:** /collect.html and /faq.html; src/pages/faq.html:66–80.

**Reproduce:** Follow Home → What we collect and FAQs as a fleet depot operator with used engine oil. Read “Who can register?” and collection coverage.

**Expected:** A fleet operator can determine whether depot-generated oil is accepted and which business verification applies.  
**Actual:** Registered car/bike service centres and industrial units are named; fleet depots are not explicitly addressed. Chennai/locality confirmation and 50 L minimum are clear.

**Impact:** An otherwise suitable fleet lead may assume exclusion or require an extra support conversation.

**Proposed fix:** Have operations confirm the policy, then explicitly include or exclude fleet/depot servicing with any documentation, oil-quality and volume requirements. Do not invent eligibility.

**Retest:** A fleet user should find a definitive eligibility answer and appropriate next action on the collection page or linked FAQ.

## 4. White-box review and security boundaries

**Actual stack:** Static HTML/CSS/vanilla browser JavaScript; Node ES modules build five pages from src/pages, src/layout.html, partials and JSON configuration. Eleven CSS files are concatenated. public assets are copied into dist. package.json has no third-party dependencies/devDependencies or lockfile-based dependency tree to audit. This does not certify the APK's dependencies.

**Build/hosting:** scripts/build.mjs:101–159 generates the site, robots and sitemap; it validates inputs before replacing the fixed dist directory. scripts/serve.mjs is a loopback-only local GET/HEAD preview server, not evidence of production backend behaviour. .openai/hosting.json points static hosting at dist. Live responses identify Caddy; legal routes are proxied Express responses. The production Caddy/Express configuration and backend source are not in this checkout.

**Button trace:** Download configuration → build.mjs downloadAttrs → shared app-download-options.html → rendered APK/disabled Play links. src/config/contact.json → build.mjs contactTokens → footer/dialog links in src/layout.html. No contact was initiated.

**Enquiry trace:** src/scripts/app.js:1172–1269 validates quantity range, required text/area and ten-digit phone normalization, then uses textContent for the summary and encodeURIComponent for WhatsApp/mailto drafts. It prevents default submission; no fetch/XHR/notification API is used in this path. The WhatsApp draft includes business, phone, area, oil and quantity; the email subject is “Black Gold pickup enquiry” with the same body. Footer contact links have no prefilled message. Source validation accepts ten digits rather than proving mobile-number ownership; the code intentionally also accepts landlines despite the “Mobile number” label. This is not a server security boundary.

**Data/storage/notifications:** The reviewed marketing script prepares a browser-local draft. Sending requires the visitor to open WhatsApp/mail and send there. Motion preference is stored locally; no reviewed path sends enquiries automatically. FAQ chat is a local FAQ matcher, not a live support chat. Browser-generated drafts containing contact details enter a third-party URL only when the visitor chooses that action; no real customer's data was used.

**Executed commands/results:**
- npm test → npm run check → npm run build; node tests/verify-site.mjs; node tests/verify-interactions.mjs: **exit 0**. Five pages, 195 local references; generated assets, metadata, anchors, ARIA references and mocked interactions passed.
- node --check src/scripts/app.js and node --check src/scripts/oil-surface.js: passed without syntax errors.
- Node v26.13.0; npm 11.20.0. No package installation or npm audit network submission was needed.
- Tests inspected before execution; they use Node built-ins, a DOM adapter, synthetic values and mocked browser facilities, not real notifications or production records. They are not real-browser end-to-end coverage.
- Ordinary curl GET/HEAD checks, SHA-256 comparisons and sequential read-only Playwright browsing are retained in evidence. Playwright used the already-installed host library; the helper's absolute import path is environment-specific.

**Passive security outcome:** No mixed-content resources, public-session cookies, analytics transmissions, live secrets, customer records or disruption were observed in sampled pages/assets. Limited private-key/provider-key pattern inspection found no matches; this is not exhaustive secret detection or APK analysis. /privacy and /delete-account returned Access-Control-Allow-Credentials: true with Vary: Origin, but no observed Allow-Origin value: that alone does **not** establish unsafe CORS. No crafted Origin or exploit request was sent.

## 5. Missing access and blocked completion checks

1. **Explicitly approved staging/local target** representing the actual seller backend, plus deployment identity. Keep notifications disabled/sandboxed and use synthetic data only.
2. **Backend/API source and hosting configuration**, plus approved test roles: two independent sellers, driver, office/admin where applicable. Needed to trace real server validation, permissions, storage, errors and notifications.
3. On that approved environment, apply the relevant OWASP WSTG checks: server-side boundary/type/length validation; minimal harmless injection tests; authentication/reset/session expiry/logout; cross-user record and file access; role escalation; duplicate/replayed requests and idempotency; CSRF for cookie-authenticated actions; credentialed CORS; unsafe redirects; synthetic upload handling and error responses. None were executed live.
4. **Exact intended Play package/listing and target-region availability**, plus approved test devices/accounts if install flow requires them. Publication/testing-track status cannot be inferred from the marketing placeholder.
5. **Printed QR artwork**, if QR validation is required.
6. **Real Android Chrome and iPhone Safari devices**, including installation/update checks and mobile assistive-technology testing. Complete all-page visual/focus/contrast coverage and repeat performance measurements on representative hardware; this report contains spot-checks only.

Public browsing and available source checks are complete within the stated limits. Staging and real-device checks remain blocked, not passed. The only repository additions are this audit report and its evidence; application source was not modified.
