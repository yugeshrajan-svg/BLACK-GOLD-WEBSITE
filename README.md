# Black Gold website

A five-page website for Black Gold's used-oil collection service and Android seller app. Built with HTML, CSS and JavaScript. Requires Node.js 20 or newer; no package installation is needed.

## Run the website

Open a terminal in this folder and run:

```sh
npm run dev
```

Open **http://127.0.0.1:3000**. The server rebuilds when you save changes in `src/` or `public/`; refresh the browser to see them. Stop with **Ctrl+C**.

If port 3000 is already in use:

```sh
npm run dev -- --port 3001
```

## Project structure

```text
BLACK-GOLD-WEBSITE/
├── src/                     ← Edit the website here
│   ├── pages/               ← Home, About, Collect, Seller App, FAQs
│   ├── partials/            ← Shared page sections and app previews
│   ├── config/              ← Contact details, service areas, download links
│   ├── styles/              ← CSS grouped by purpose
│   ├── scripts/             ← Website behaviour and oil animation
│   └── layout.html          ← Shared head, menu, footer and dialogs
├── public/                  ← Files copied into the built website
│   ├── assets/              ← Images, icons and the seller app (APK)
│   ├── fonts/               ← Self-hosted fonts and their licence
│   └── og-image.jpg         ← Social sharing image
├── scripts/                 ← Build and local-server tools
├── tests/                   ← Site integrity and interaction checks
├── docs/UPDATING.md          ← Step-by-step update guide
├── dist/                    ← Generated website; upload this folder's contents
├── .openai/hosting.json      ← Existing Sites hosting configuration
└── package.json             ← Run, build and check commands
```

**Edit `src/` and `public/`. `dist/` is recreated by the build, so edits made there will be overwritten.** The built website keeps the existing page and download URLs.

## Common updates

| What you want to change | File or folder to edit |
| --- | --- |
| Home page | `src/pages/index.html` |
| About page | `src/pages/about.html` |
| Oils and eligible businesses | `src/pages/collect.html` |
| Seller app guide | `src/pages/seller-app.html` |
| FAQ answers | `src/pages/faq.html` |
| Menu, footer, enquiry and app dialogs | `src/layout.html` |
| Phone, email, office address | `src/config/contact.json` |
| Pickup area choices | `src/config/areas.json` |
| Google Play and APK links | `src/config/app-downloads.json` |
| Final website URL and generated search/share URLs | `src/config/site.json` |
| Colours, spacing, page styles | `src/styles/` |
| Interactions and animation logic | `src/scripts/` |

Read [the update guide](docs/UPDATING.md) for examples and a map of the shared sections and stylesheets.

The [launch review](docs/LAUNCH-CHECK.md) records the remaining release items. The final HTTPS URL, `https://myblackgold.app`, is set in `src/config/site.json`; the build supplies canonical URLs, absolute sharing images and a sitemap from it.

## Build, check and upload

```sh
npm run check
```

This builds a fresh `dist/` and checks all five pages, local links, section anchors, metadata, downloads and shared interactions. It also confirms that static files are copied without alteration. Interaction checks simulate desktop, compact layouts and reduced motion; they do not replace visual testing on a real phone.

After a successful check, commit and push, including `dist/`. The live site at myblackgold.app is served from this repo's `dist/` on the Black Gold server: after a push, run `cd /opt/blackgold-website && git pull` there. `npm run build` generates the website without running checks; `npm start` builds and serves it without watching for changes.

## Current download and enquiry behaviour

The gold “Tap to download” button gives Android phones the seller app directly: the Google-signed universal APK from Play Console, so Google Play can update it later (see [the update guide](docs/UPDATING.md#direct-apk-download) before replacing it). The Google Play button displays “Coming soon” until its official URL is configured; the app is in closed testing until production approval. A smaller iOS button with an Apple symbol also displays “Coming soon”. Both coming-soon options are inactive. The Play Store animation and app screens are labelled illustrations.

The footer links to the privacy policy and account deletion pages, which the Black Gold server serves at `https://myblackgold.app/privacy` and `/delete-account`.

The enquiry form prepares a summary for WhatsApp or email. Visitors choose whether to send it; the website does not automatically send details or book a pickup.
