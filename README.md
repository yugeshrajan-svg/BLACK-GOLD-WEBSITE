# Black Gold website — client review edition (v4.1)

Open `dist/index.html` in a modern browser to review the website, or upload everything inside `dist` to a static host. The site has no dependencies.

## Pages

| Page | File | Visual and interactions |
| --- | --- | --- |
| Home | `index.html` | An app-focused hero links to the seller-app section. A moving-truck journey illustrates registration, rates, pickup and payment with four selectable steps; collection details follow |
| About | `about.html` | A stepped refinery pipeline, plus a second animated journey linking measurement, rates, payment and a digital receipt to the four selectable promises |
| What we collect | `collect.html` | A changing sample jar with oil selection controls. Choosing a sample keeps it selected and carries that oil into the enquiry |
| Seller app | `seller-app.html` | The hero shows the app being found and installed: “Black Gold Seller” is typed into a search, the app appears, an install progress bar fills and a green screen says it is ready to open. Below, the phone preview cycles through rates, pickup and receipt screens beside the feature cards, with buttons to try each screen |
| FAQs | `faq.html` | An animated answers chat and a search field that filters the questions and answers |

Every page shares the header, a still closing call to action, the footer and the pickup enquiry form. The live visuals run only while they are on screen, stop with the Pause motion button, and show a still, complete version with reduced motion. Cards below each visual light up in step with it (About).

## Editing the pages

The five HTML files in `dist/` are generated. Edit the sources, then rebuild:

- `src/layout.html`: everything the pages share (head, header, closing section, footer, dialogs).
- `src/pages/*.html`: each page's own content. The comment at the top gives the page's title and description.
- `src/partials/*.html`: shared app preview, feature cards and download options, plus the Seller app hero's install preview (`seller-install-preview.html`).
- `src/app-downloads.json`: add the official `googlePlay` URL and the HTTPS `apk` URL (or a local `assets/filename.apk` path), then rebuild. Empty values show “coming soon” without a fake download link.
- Run `node build.mjs` (Node.js, no packages needed) to write the pages into `dist/`.

`style.css`, `app.js` and `oil-surface.js` in `dist/` are edited directly. The website uses English throughout.

## What changed in v4.1

- **Finding and installing the app, on the Seller app page.** The hero now loops through four steps: “Black Gold Seller” is typed into a store search, the app appears with an Install button, a progress bar fills, and a green screen confirms it is ready to open. Numbered steps below the phone (Search, Find the app, Install, Open) follow along. The headline and actions stay beside the animation, which is labelled “Illustrative install preview” and shows no ratings or download counts.
- **App screens move to “In the app”.** The rates / pickup / receipt phone preview now sits beside the three feature cards, as on the homepage, with its own Pause motion control.
- **Motion settings.** Pause motion and hidden tabs freeze the sequence; it also stops offscreen. Reduced motion, a saved pause and pages without scripting show the finished, ready-to-open screen.
- **How it works page removed.** The site now has five pages. The header menu and footer no longer list it. The homepage section “From your phone to your pickup” covers the process, and the What we collect hero now links there (“How pickup works”). The page's “Who we serve” cards (car and bike service centres, factories) were removed with it.

## What changed in v4.0

- **Animated app-to-pickup journey.** “From your phone to your pickup” has four illustrated steps and a moving truck. It progresses automatically until the visitor scrolls, points at a card, focuses a step or selects one; the truck then follows that input. The progress rail stays visible while the cards scroll past. Payment and receipt use a green theme. Pause motion, hidden tabs, offscreen handling and reduced motion are supported.
- **English throughout.** Removed the language switch, translation script, automatic language detection, translation attributes and language-specific fonts and styles. Existing language preferences and old `?lang=ta` links leave the site in English.
- **Smooth scrolling.** Section links and Back to top use the browser's native smooth scrolling, with space below the fixed header. Keyboard focus follows the destination. Reduced motion uses instant scrolling.

## What changed in v3.9

- **A dedicated app section below the hero.** The opening hero promotes the app and links to its own complete section. The phone preview, three app benefits and download choices sit together in that section; its pause control works with the rest of the site. The Seller app page also includes a visible Google Play / APK download section.
- **The seller app is the main product on the homepage.** The headline, animated phone preview, benefits and getting-started steps lead visitors toward the app. The flowing-oil background and collection information remain part of the page.
- **App actions throughout the website.** Seller app is a direct navigation item. The header and closing section now prioritise “Get the seller app”, with the enquiry available as a secondary action. The app opens a download panel with Google Play and direct APK choices.
- **Download links can be added later.** Both download choices are prepared and clearly marked as coming soon until their official addresses are entered in `src/app-downloads.json`. Shared preview and download partials keep the homepage, seller-app page and dialog consistent. English and Tamil copy are included.

## What changed in v3.8

- **Clearer journey artwork.** All four illustrations have permanent English/Tamil labels, stronger colours and directional arrows. The measuring jug has litre markings, the price tag shows rupees per litre, the wallet includes a payment coin, and the digital receipt appears on a phone. The animated drop follows a route around the labels.
- **Animated promise journey.** “Clear at every step” on the About page now pairs the four promises with a measuring tank, rate tag, wallet and digital receipt. An oil droplet follows the connected path while the matching promise and explanation change. Each promise can be selected manually. The section includes a pause control, a stacked mobile layout and English/Tamil copy; offscreen, hidden-tab and reduced-motion settings are respected.

## What changed in v3.7

- **Flowing oil background.** The homepage now uses the existing oil surface renderer for a continuous golden stream and moving ripples across the whole hero. The camera, text and buttons stay steady. Only the homepage loads the renderer.
- **Motion controls and fallback.** Pause motion freezes the surface; offscreen and hidden-tab rendering stops. Reduced motion, unavailable WebGL or a lost graphics context shows `oil-poster.webp` instead. The renderer scales its resolution to device performance.

## What changed in v3.6

- **Animated oil poster.** A gentle, continuous pan and zoom animates `oil-poster.webp` behind the steady headline and actions. Pause motion freezes it; it also pauses offscreen or in a hidden tab. Reduced motion keeps the poster still.

## What changed in v3.5

- **WebP homepage background.** `assets/oil-poster.webp` fills the entire home hero, with responsive cropping and the readability overlay. The video element and its playback code have been removed.

## What changed in v3.4

- **Full-background home video.** The original `oil-motion.mp4` now covers the entire home hero behind the headline and actions, with a dark overlay to keep the copy readable. The light coloured sections and dividers continue below it.
- **Controlled playback.** The muted, inline video starts automatically when motion is allowed, loops, and responds to Pause motion. Playback pauses offscreen or in a hidden tab; reduced motion shows the poster. The poster also remains available if playback is blocked or fails.
- **Native video rendering.** The home page uses the local MP4 instead of the framed WebGL canvas. The unused oil-surface script is no longer loaded by the pages.

## What changed in v3.3

- **Light homepage backgrounds.** A pale cream-to-mint hero frames the live oil visual. Mint, powder blue, peach and lilac section backgrounds replace the mostly white page; closing sections use a light colour wash too.
- **Visible section dividers on every page.** Two-pixel accent lines and small section markers separate the content, with matching boundaries at the hero and closing section.
- **Important information stands out.** Buying and collecting oil, the Chennai service area, price per litre, measurement, payment and receipts use selected amber, mint and blue highlights. Form confirmation notes and step labels also have clearer colour emphasis.
- **A different About animation.** The circular loop is replaced by a rectangular refinery scene. Oil flows through pipes between filling tanks; selecting a stage updates the active tank, progress bar, caption and explanatory card. Pause and reduced-motion preferences still apply.

## What changed in v3.2

- **Colour across all six pages.** Teal, terracotta, blue, violet and cyan accents distinguish the pages. Oil choices and process cards use soft colour washes, while the primary actions keep the gold identity.
- **Illustrations you can explore.** Choose an oil, explore a cycle stage or pickup step, and switch between app preview screens. Selected oil choices carry into the enquiry form. App screens remain labelled as illustrative, with masked rates.
- **Useful FAQ search.** Search the questions and answers in the current language, see the matching count, and clear an empty search to restore all questions.
- **Responsive motion.** Short entrances, pointer-responsive card colour and slow hero glows support the existing illustrations. Pause motion and reduced motion are respected; background and offscreen visuals pause. Manual oil selection stays put.

Run `node .qa/verify-interactions.mjs` for browser-independent interaction smoke checks. These cover the generated HTML and real scripts with a small DOM adapter; browser layout still needs visual review.

## What changed in v3.1

- **Answers on the home page.** Accepted oils, eligible businesses, four pickup steps, measurement and receipt details, and practical FAQs are visible without opening another page.
- **Calmer motion.** The signature home oil pour remains. The opening logo curtain, scrolling promise strip, pointer-following buttons, delayed text entrances, floating mock-ups and closing oil animation have been removed. Scrolling uses the browser's normal behavior, with no external library.
- **Selective gold.** Flat gold primary actions and the hero/closing headline accents sit alongside neutral headings, bullets, icons and form controls. Button shine and gold hover fills have been removed.
- **Accurate action labels.** Pickup buttons say “Prepare pickup enquiry”; the form explains that it creates a summary to share and does not book a pickup. App controls say “App availability” while verified download links are pending. New and revised text is included in English and Tamil.

## What changed in v3

- **One page per topic.** The long single page is now six pages (table above). The header menu is Home · About · Services ▾ · How it works · FAQs; Services opens a small panel with What we collect and Seller app (on hover, click or keyboard; Escape closes it). The current page is underlined, or highlighted in the panel. Below 1180 px wide the menu moves behind the menu button and lists all six pages; in Tamil, whose labels are longer, the header's pickup button steps aside between 1180 and 1240 px. The footer links all six pages.
- **One background.** On every page, everything between the black hero and the black closing section uses the same warm white (#f7f4ee); the beige bands are gone. A hairline across the content width marks where one section ends and the next begins.
- **Less decoration.** No ring pattern behind the page visuals, no small print under the home hero (only the pause button remains), no numbers on the home cards, no numerals inside the oil loop, plain bullet dots, and no giant wordmark in the footer.
- **Short bullet points.** Paragraphs are replaced by two or three short points everywhere, in English and Tamil.
- **Each page feels alive.** Every page opens with its own animated visual (table above).
- **New fonts.** Fraunces (headings, with its italic for the gold accent words) and Inter (text), chosen from the four pairings in `font-options.html`. Both are hosted with the site.

## What changed in v2.1

- **Professional light theme.** Warm white pages with near-black text and dark-gold accents, chosen in `theme-options.html`. Heroes, the closing section and the footer stay black and gold. The header turns into a frosted light bar over light sections.
- **Consistent spacing.** The same section padding (72–128 px, 64 px on phones) and the same gaps throughout; content width 1280 px.
- **Tamil version.** A தமிழ் / EN button switches every page, including the menu, form, validation messages and the enquiry summary. The choice is remembered across pages, phones set to Tamil open in Tamil, and adding `?lang=ta` to any page address opens it in Tamil.
- **Link previews.** `og-image.jpg` (1200 × 630, 95 KB) is used when a page is shared on WhatsApp and social media.
- **Faster first view.** The logo intro lasts about 0.75 s, once per visit, and is skipped on data-saver and 2G connections.
- **Lighter pages.** Self-hosted fonts; the poster image is WebP (49 KB) with a JPEG fallback; Tamil fonts download only when Tamil is shown.
- **Search.** LocalBusiness structured data (schema.org `RecyclingCenter`) on the home page.

## v2

The real-time golden-pour hero (`oil-surface.js`), smooth scrolling (Lenis 1.1.20 from jsDelivr, skipped offline or with reduced motion), the animated sample jar and phone preview, and the pickup enquiry whose summary can be downloaded, copied or shared on WhatsApp (nothing is sent automatically).

The v1 files are kept in `_original-v1/`. `background-options.html`, `theme-options.html` and `font-options.html` are the pages used to choose the hero, colours and fonts. None of these is part of the upload.

## Before public launch

- Add the verified telephone / WhatsApp details and seller app store links.
- Connect the enquiry form to the approved business endpoint. It currently creates a summary to download, copy or share; it does not submit or book a pickup.
- Confirm minimum volume, charges, service areas, payment terms and legal company information.
- Confirm the refining description (stage III on the About page), authorisations and all operational claims.
- Replace the labelled illustrative app preview with real screenshots if available. Rates in the preview are deliberately masked (₹ ••.••).
- Add a privacy policy appropriate to the final enquiry integration.
- Test on real phones (especially lower-end Android) to confirm the animations run smoothly.
- Once the domain is live, change `og:image` in `src/layout.html` to the full address (`https://…/og-image.jpg`) and rebuild; WhatsApp and Facebook need an absolute URL. Use the same address for `"image"` in the structured data in `src/pages/index.html`, and add `"url"`.
- Add `"telephone"`, the street address, postcode and opening hours to the structured data once they are confirmed.

All fonts, styles and scripts are hosted with the site. The enquiry summary stays in the browser unless the visitor chooses to copy, download or share it.
