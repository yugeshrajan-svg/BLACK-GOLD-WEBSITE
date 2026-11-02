# Updating the Black Gold website

## Your usual workflow

1. Open the project folder in VS Code.
2. Run `npm run dev` in the terminal and open http://127.0.0.1:3000.
3. Edit a file in `src/` or `public/` and save it. The terminal reports that the site was rebuilt.
4. Refresh the browser. Check both a desktop view and your phone.
5. Run `npm run check` before uploading the contents of `dist/` to your host.

You do not need Python, `npm install`, or a frontend framework. Restart `npm run dev` after changing a build script.

## Change page text

Open the matching HTML file in `src/pages/`. These files contain the page content. `src/layout.html` supplies the shared menu, footer, dialogs and metadata.

Each page starts with a comment like this:

```html
<!--
page: about
title: About Black Gold
description: A short description for search engines and link previews.
closingEyebrow: Get started
closingTitle: Your next collection starts here.
closingDescription: Prepare an enquiry or get the seller app.
-->
```

Keep all six fields. `page` identifies the current menu item; `title` and `description` are used in the document head. The three `closing` values control the final call to action.

Preserve existing `id`, `data-*` and `aria-*` attributes when changing text. Menus, links, animations and accessibility depend on them.

## Change something shared across pages

| Shared section | Source file |
| --- | --- |
| Menu, footer, enquiry form, download dialog | `src/layout.html` |
| APK / Google Play buttons | `src/partials/app-download-options.html` |
| Home app introduction | `src/partials/home-app-intro.html` |
| Four collection promises on Home and About | `src/partials/our-promise.html` |
| Home pickup journey | `src/partials/pickup-journey.html` |
| Seller App's eight-step journey | `src/partials/seller-app-journey.html` |
| Illustrated store animation | `src/partials/seller-install-preview.html` |
| App screen preview and feature descriptions | `src/partials/app-preview.html`, `src/partials/app-features.html` |

Pages include shared sections with `{{> section-name}}`. Values such as `{{contactEmail}}` come from configuration during the build.

## Change phone, email or office address

Edit `src/config/contact.json`. Use a country code for `phone`, for example `+91` followed by the number. `display` is the version visitors see. Keep the email as a plain address without `mailto:`.

The build updates phone, WhatsApp, email and office details throughout the site. You do not need to edit each page.

## Change the pickup areas

Edit the list in `src/config/areas.json`. Keep the names in the desired order. The enquiry form automatically adds “Other area” so visitors can type a location outside the list.

Use valid JSON: double quotes, commas between entries, and no comma after the last entry.

## App download links

The download buttons are configured in `src/config/app-downloads.json`:

```json
{
  "googlePlay": "",
  "apk": ""
}
```

When the seller app is public on Google Play, set `googlePlay` to `https://play.google.com/store/apps/details?id=com.blackgold.seller`. Its “Coming soon” button then becomes an active store link, and the install steps on the Seller app page switch to Google Play wording automatically. The smaller iOS “Coming soon” button, including its Apple symbol, is in `src/partials/app-download-options.html`.

### Direct APK download

The website offered a direct APK until 2 November 2026; it was removed because that file was a debug-signed test build. Android only updates an installed app with a build signed by the same key, so phones with that APK could not install or update the Google Play version without uninstalling it first, and testers who installed it did not count towards Google Play's closed-testing requirement.

To offer a direct download again, use only the **Google-signed universal APK** of a released version: Play Console → **Test and release → App bundle explorer** → choose the version → **Downloads** → **Signed, universal APK**. It carries the same signature as the Play Store app, so Google Play can update it later. Then:

1. Copy it to **`public/assets/black-gold-seller.apk`**.
2. Set `"apk": "assets/black-gold-seller.apk"` in `src/config/app-downloads.json` (an HTTPS URL also works).
3. Run `npm run check`, then commit and push. The APK button and APK install steps return automatically; an empty `apk` value hides them again.

Never publish a debug build or an APK signed with the upload key.

## Change images or branding

Replace files in `public/assets/`. Keeping a filename preserves all references to it. If you use a new name, update every HTML/CSS reference; `npm run check` reports missing local files.

The main files are `black-gold-logo.webp`, `black-gold-app-icon.webp`, `about-refinery.webp`, `oil-poster.webp`, and the favicon / touch icons. `public/og-image.jpg` is the social sharing image. The refinery image and app screens are labelled illustrations; update their captions if real approved images replace them.

## Change the design

The build combines these stylesheets in this order into `dist/style.css`:

| Stylesheet in `src/styles/` | Controls |
| --- | --- |
| `base.css` | Fonts, colour variables, base text, buttons and links |
| `header.css` | Logo, navigation and menu controls |
| `home.css` | Home hero, app introduction and download buttons |
| `components.css` | Page heroes, cards, oil choices and shared promises |
| `collection.css` | About refinery, collection jar and home pickup journey |
| `seller-app.css` | Seller App screens, guide, setup and install animation |
| `faq.css` | FAQ list, search and question chat |
| `footer-forms.css` | Closing section, footer, dialogs and enquiry form |
| `motion.css` | Shared keyframes and pause rules |
| `responsive.css` | Shared tablet / phone layout adjustments |

Page-specific responsive rules can also appear next to their components. Start with the relevant stylesheet. Shared colours and spacing are CSS variables at the top of `base.css`.

Website behaviour lives in `src/scripts/app.js`. The home oil effect lives in `src/scripts/oil-surface.js`. These files are copied to `dist/` during the build.

## Check and upload

Once the public domain is chosen, set `url` in `src/config/site.json` to the final HTTPS website address. Leave it empty during local preparation. A build with a configured URL creates canonical links, page sharing URLs, absolute social-preview images, the homepage structured-data URL, and `sitemap.xml`. `robots.txt` is generated on every build and includes the sitemap address when configured. Domain selection and hosting remain separate from the local build.

`npm run check` rebuilds the site and runs:

- `tests/verify-site.mjs`: page structure, local links and files, section anchors, ARIA references, metadata, download availability and exact static-file copying.
- `tests/verify-interactions.mjs`: menus, motion controls, app demonstrations, collection choices, FAQ search/chat and enquiry validation under simulated desktop / compact / reduced-motion conditions.

Also look at all five pages in your browser and on a phone after visible design changes. The automated checks do not assess visual layout or whether the Android app installs on a particular device.

Upload the contents of **`dist/`** after the checks pass. Builds recreate that folder from `src/` and `public/` and remove stale generated files. The existing Sites hosting identity remains in `.openai/hosting.json`; keep that configuration when updating the same hosted Site.
