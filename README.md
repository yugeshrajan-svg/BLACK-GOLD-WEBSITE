# Black Gold website — client review edition (v4.6)

Open `dist/index.html` in a modern browser to review the website, or upload everything inside `dist` to a static host. The site has no dependencies.

## Run locally

You need [Node.js](https://nodejs.org/) 18 or later. No `npm install` is required.

From the project folder, build and serve the site with one command, then open http://127.0.0.1:3000:

```sh
node build.mjs && python -m http.server 3000 --bind 127.0.0.1 --directory dist
```

If Python is not installed, use `node build.mjs && npx serve dist -l 3000` instead (it downloads the `serve` package the first time and prints the address to open). You can also open `dist/index.html` directly in a browser, but a local server is closer to how the site behaves once hosted.

To run the interaction smoke checks:

```sh
node .qa/verify-interactions.mjs
```

## Pages

| Page | File | Visual and interactions |
| --- | --- | --- |
| Home | `index.html` | App-focused hero, Play Store animation in the app introduction, Our promise animation, three selectable oil jars and a short journey with a truck that follows scrolling |
| About | `about.html` | Full-width oil-industry hero; a stepped refinery pipeline below it, plus a second animated journey linking measurement, rates, payment and a digital receipt to the four selectable promises |
| What we collect | `collect.html` | One interactive sample jar, oil category descriptions and the businesses eligible to sell; selected oil carries into the enquiry |
| Seller app | `seller-app.html` | Search-to-install hero animation; eight-scene scroll journey with a travelling truck and green receipt ending; working-app preview in Features, plus setup, account help and installation |
| FAQs | `faq.html` | “Ask Black Gold” chat box in the hero that answers typed questions from the FAQ list. Eleven searchable policy answers, including the 50-litre minimum, pickup-code timing, payment and listing changes |

Every page shares the header, closing layout, footer and pickup enquiry form. Closing messages are specific to each page. The live visuals run only while they are on screen, stop with the Pause motion button, and show a still, complete version with reduced motion. Cards below each visual light up in step with it (About).

## Editing the pages

The five HTML files in `dist/` are generated. Edit the sources, then rebuild:

- `src/layout.html`: everything the pages share (head, header, closing section, footer, dialogs).
- `src/pages/*.html`: each page's content. Its opening comment supplies the page, title, description, closingEyebrow, closingTitle and closingDescription metadata.
- `src/partials/*.html`: the home app introduction and pickup journey, shared promise animation, full seller-app demo and feature cards, and shared download options.
- `src/app-downloads.json`: add the official `googlePlay` URL and the HTTPS `apk` URL (or a local `assets/filename.apk` path), then rebuild. Empty values show “coming soon” without a fake download link.
- `src/contact.json`: the business telephone, its displayed format, enquiry email, and the office street address and city line. Rebuilding updates the footer address on every page, call, email and WhatsApp links, enquiry recipients and homepage structured data together.
- Run `node build.mjs` (Node.js, no packages needed) to write the pages into `dist/`.

`style.css`, `app.js` and `oil-surface.js` in `dist/` are edited directly. The website uses English throughout.

The About hero image, `dist/assets/about-refinery.webp`, is a generated illustration of an oil-refining setting, not a photograph of a specific Black Gold facility. It is labelled illustrative on the page and encoded as a 193 KB WebP. Replace this asset with an approved facility photograph when one is available.

## What changed in v4.6

- **Our promise follows the home app introduction.** A shared section now appears immediately after "Meet your seller app" on Home and also updates the promises on About. Four large illustrated scenes crossfade through oil filling a measuring container, a confirmed rate, payment at pickup and a saved digital receipt. A deep charcoal section and richer bronze, blue, emerald and purple scene backgrounds frame the illustrations. Bright progress markers and matching dark option cards keep the selected promise clear; golden oil, blue metal and a coral wallet add contrast within the artwork. A four-step timeline, drawn confirmation ticks, floating details and a current-step counter follow the sequence. One animation clock keeps the artwork and timeline together when paused. All four explanations remain visible beside the illustration. Hover over a promise to preview its animation and keep it selected while the pointer remains on the option; autoplay resumes after leaving. Click, arrow keys, Home and End also select promises. Automatic changes and mouse previews stay quiet for screen readers. Pause, hidden-tab and offscreen handling apply, and reduced-motion visitors can choose still stages manually. Edit both pages together through `src/partials/our-promise.html`.

- **Business contact added.** +91 70108 60788 appears in every footer with call and WhatsApp links, alongside the enquiry email support@myblackgold.app. Prepared pickup enquiries can open a WhatsApp draft addressed to this number or an email draft addressed to the enquiry email, with the full summary included; the visitor chooses whether to send it. The same number is included in the homepage structured data and can be changed in `src/contact.json`.

- **Play Store-style Seller App hero.** An Android phone replaces the generic search card. The scene types the app name with a matching keyboard, opens the Black Gold listing, animates a download ring around the app icon, shows the installation step, then changes Cancel/Open to Uninstall/Open. A simulated Open tap reveals the Black Gold splash screen before the loop restarts. Store-style navigation, app previews and the green install button make the flow recognisable. The scene is labelled illustrative, with the listing marked not live; it contains no invented ratings or download counts. Pause motion, offscreen and hidden-tab handling still apply, and reduced motion shows the completed store listing.

- **Compact spacing across every page.** Sections use 48-64 px vertical padding on desktop, 40 px on mobile and 36 px on small phones. Shared 20-32 px heading gaps, 20-40 px layout gaps and 18-24 px card padding reduce empty space while keeping text and controls readable. Home and About heroes grow with their content; the Seller App hero uses a normal two-column layout with a smaller, proportionally scaled store preview. Journey cards grow with their text, and FAQ rows, closing sections, dialogs and the footer use tighter spacing. Cards retain 16 px corners and buttons retain 12 px corners.

- **A simpler home hero.** A shorter description leads directly to the download buttons, followed by the collection essentials and an Explore link. The extra platform line and audience note have been removed, and the hero uses the height its content needs.

- **Compact laptop navigation and seller journey.** Page links stay visible from 1025 px, and resizing out of the mobile menu releases its scroll and focus locks. The eight journey cards use a compact number-and-role heading, less padding and content-based heights at every screen size. Phone step controls have two rows of four 44 px buttons; the smaller illustration repeats only the current heading, with full instructions in the cards. On viewports at most 740 px tall the panel scrolls normally.

- **Direct download choices in the home hero.** Google Play and Download APK buttons appear above the collection essentials, with a stacked layout on phones. They use the same `src/app-downloads.json` URLs as the app introduction and download dialog, and show the shared coming-soon message until those URLs are configured.

- **Shared Play Store animation on the home page.** "Meet your seller app" uses the same `seller-install-preview.html` partial as the Seller App hero, including search, listing, download, installation and the Black Gold launch. It replaces the earlier sample phone and Chennai pin animation. The benefits and download choices remain beside the phone on desktop and above it on smaller screens. Captions use darker colours against the light section background, and both pages share the same pause and reduced-motion behaviour.

- **Dark download buttons in “Meet your seller app”.** The homepage app introduction now shows the Google Play (with the Play icon) and APK download buttons directly, as dark store-style buttons, with “iOS app coming soon” in small text. They stay inactive, with a “coming soon” note, until the links are added to `src/app-downloads.json`. `build.mjs` now expands partials inside partials, which this section needs.

- **Refinery backdrop for “What can I sell?”.** The homepage oil-choice section shows `assets/about-refinery.webp` clearly behind the three oil cards. A lighter wash behind the heading and closing line, and a frosted selected-oil panel, keep the text easy to read. Replacing that image (for example with an approved facility photo) updates both this section and the About hero.

- **“Ask Black Gold” chat on the FAQs page.** Visitors type a question in their own words (“how much do you pay per litre?”, “OTP for the driver”) and get the matching published answer, with a link to it in the full list and suggested next questions. Questions it cannot match get an offer to prepare a pickup enquiry, never a guess. It runs entirely in the page with no server or AI service, and is labelled as answers from the FAQs, not a live chat. To help it understand a new answer, add everyday words to that answer's `data-keywords` in `src/pages/faq.html`.

- **How it works page removed.** The site now has five pages; the header menu and footer no longer list it. The collection-day checklist link on the Seller App page has gone with it. “The full process” on the homepage and “How selling works” on What we collect now open the eight-step Seller App journey.

## What changed in v4.5

- **Search-to-install hero.** A background app-discovery scene types “Black Gold Seller”, reveals the app, shows a simulated Install click and progress bar, then turns green for the ready-to-open state. It repeats while visible, follows Pause motion, stops in hidden tabs and shows a complete still preview for reduced motion. The illustrated controls do not trigger searches or downloads.
- **Focused app demonstrations.** The existing listing/tracking/receipt phone preview now sits beside the feature cards below the main journey. Real Google Play/APK links remain controlled by `src/app-downloads.json`; the hero animation is labelled illustrative.

## What changed in v4.4

- **A visual Seller App journey.** The first section after the hero walks through registration, verification, listing, confirmation, tracking, measurement, code authorisation and payment. Each step has a matching SVG scene and a truck that advances along the progress road. The payment stage uses green.
- **Scroll or choose a step.** Native page scrolling selects the illustration beside the story. Eight buttons, arrow/Home/End keys and focus on a story card also select a stage. Manual choices stay selected until the next scroll or selection; there is no automatic timer. All instructions remain readable without JavaScript.
- **Responsive and motion-aware.** The scene sits beside the story on desktop and above it on smaller screens. Short viewports use an ordinary flowing layout. Pause motion freezes scroll changes; reduced-motion users can select still scenes manually. Hidden and offscreen illustrations pause, and scroll changes do not flood screen-reader announcements.

## What changed in v4.3

- **One complete Seller App page.** Section links lead to features, setup, the eight-step workflow, account help and downloads. The guide covers registration and proof, listing and office confirmation, vehicle tracking, measurement, code authorisation and payment/receipts.
- **App reference details.** Explains Home / Orders / Alerts / Profile, automatic order/map updates, saved locations, UPI preferences, English/Tamil app settings, password help and account deletion from the supplied app showcase. Website copy stays English and sample screens remain clearly labelled.
- **A separate collection checklist.** The How It Works page now explains practical preparation at the shop and links to the full app walkthrough, rather than duplicating it. Download availability still comes from `src/app-downloads.json`.

## What changed in v4.2

- **App brand and colours.** Uses the supplied flask icon and logo, warm cream `#f6f4ef`, charcoal `#1e262d`, gold `#c9a227` and success green `#2e7d4f`. Website headings retain Fraunces; the app preview uses Inter.
- **App reference workflow.** The detailed guide covers registration, address proof, oil listing, office confirmation, vehicle tracking, measured/photo pickup, code authorisation after loading and payment. The preview uses Home, Orders, Alerts and Profile navigation. Prices remain masked and screens are labelled illustrative.
- **Product details in the right places.** Seller App explains tracking, pickup-code protection, UPI/cash, GST receipts, saved location, Android 8.0+ and English/Tamil app support. The website remains English. FAQs adds payment, code timing, quantity differences and office-assisted listing changes.
- **Collection minimum.** The enquiry form requires at least 50 litres in litre mode. Barrel mode accepts a barrel count and asks Black Gold to confirm the total volume; it does not assume a conversion. Download links remain configurable in `src/app-downloads.json`.

## What changed in v4.1

- **Each topic has a main page.** Home previews the service; About explains the oil cycle and promises; What We Collect owns oil categories and eligible businesses; How It Works explains the collection; Seller App owns the full demo, features and installation; FAQs holds the policy answers.
- **Shorter homepage.** Removed the copied full app presentation, promise strip and FAQ answers. Retained the new oil jars and scroll-driven truck, with oil selection before the brief pickup journey.
- **Consolidated supporting content.** Moved business cards to What We Collect, removed its repeated mini jars, moved the booking clarification into FAQs and removed the FAQ chat. Each page has a distinct closing message.

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

The v1 files (`_original-v1/`), the option pages used to choose the hero, colours and fonts (`background-options.html`, `theme-options.html`, `font-options.html`) and the unused JPEG poster have been removed from the folder; they remain in the Git history.

## Before public launch

- Add the official seller app store links.
- Connect the enquiry form to the approved business endpoint. It currently creates a summary to download, copy or share; it does not submit or book a pickup.
- Confirm minimum volume, charges, service areas, payment terms and legal company information.
- Confirm the refining description (stage III on the About page), authorisations and all operational claims.
- Replace the labelled illustrative app preview with real screenshots if available. Rates in the preview are deliberately masked (₹ ••.••).
- Add a privacy policy appropriate to the final enquiry integration.
- Test on real phones (especially lower-end Android) to confirm the animations run smoothly.
- Once the domain is live, change `og:image` in `src/layout.html` to the full address (`https://…/og-image.jpg`) and rebuild; WhatsApp and Facebook need an absolute URL. Use the same address for `"image"` in the structured data in `src/pages/index.html`, and add `"url"`.
- The confirmed office street address is included in the structured data. Add the full postcode and opening hours once they are confirmed.

All fonts, styles and scripts are hosted with the site. The enquiry summary stays in the browser unless the visitor chooses to copy, download or share it.
