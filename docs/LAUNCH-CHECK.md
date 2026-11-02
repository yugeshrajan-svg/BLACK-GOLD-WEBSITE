# Launch review — 2 November 2026

The owner plans to launch direct website APK downloads on 3 November 2026 while the team completes the Google Play submission. The owner has requested use of the currently supplied APK for this launch. The website has not been deployed; domain and hosting selection remain deferred.

Google Play approval is not a prerequisite for offering the APK on the website. The active download is prepared independently. Release signing remains a recommendation for the customer release and future update compatibility; it is not an automated build or download gate.

## Verified

- The clean build and all five generated pages pass `npm run check`.
- Local page links, section anchors, ARIA references, metadata, images, fonts and download references pass the integrity check.
- Interaction checks cover menus, motion controls, desktop / compact app journeys, FAQ search/chat, oil selection and enquiry validation. These checks simulate the DOM; they are not visual browser or device tests.
- The first, gold “Download APK” button is active. The Google Play button shows “Coming soon” without a link. The smaller iOS button includes an Apple symbol and is disabled.
- Static assets, including the APK, are copied unchanged into `dist/`.
- On 2 November 2026, the owner reported testing the supplied APK on an Android phone and confirmed that it works. This is an owner-reported device test; the device model and individual app flows were not specified.
- The website's scripts have no automatic form-submission request or external analytics call. The enquiry is prepared locally; visitors choose whether to send it through WhatsApp or their email app. The motion preference uses local storage.
- Fonts, images and website scripts are served locally with the site.
- The build accepts the final website URL in one place: `src/config/site.json`. Once configured, it generates canonical links, sharing URLs, absolute sharing-image URLs, homepage structured-data URLs and a sitemap. The domain is currently blank intentionally.

## Launch status and follow-ups

| Item | Current finding | Next step |
| --- | --- | --- |
| Google Play publication | Owner reports that the app has been submitted to Google Play and is under review. Approval and a public listing have not been verified. | Keep the website's Google Play button marked “Coming soon”. Once the listing is publicly available, add its official URL to `src/config/app-downloads.json` and rebuild to activate the button. |
| Website APK | Supplied APK is signed with `C=US, O=Android, CN=Android Debug`. Version name `1.0.0`, version code `1`, package `com.blackgold.seller`. The owner requests this file for the immediate website download and reports that it works on an Android phone. | Use the existing active download for the requested website launch. Replace it with the release-signed APK when supplied. |
| App compatibility | Current APK has `minSdkVersion=26` (Android 8.0), `targetSdkVersion=36`, and ARM64 native libraries only. | Check the replacement APK's requirements and update website compatibility text if they differ. |
| App network settings | The current manifest permits cleartext traffic. An HTTPS Black Gold API origin is present in the APK. | App developer should review the release network configuration. This static inspection does not establish actual runtime traffic or backend functionality. |
| Privacy and app policy text | No privacy page is present. The seller guide makes specific claims about account deletion and retention of completed sale records. | Supply approved privacy / data-handling text and confirm that the app actually follows the deletion and retention description before customer launch. |
| Real device and visual checks | Owner reports that the APK works on an Android phone. A complete website browser visual review has not been completed because browser automation could not reliably target the website. | Remaining website checks: review all five pages on desktop and a phone, including the enquiry dialog and WhatsApp/email drafts. After hosting, confirm the public APK download. |
| Domain and hosting | Deferred. The connected Sites project reports no saved version or live deployment, with custom access. | Choose hosting later; set the final HTTPS URL, rebuild, and verify HTTPS, public access and the hosted APK response on the selected host. Preserve current access until an audience change is requested. |

The supplied APK is 14,629,725 bytes. Its SHA-256 is `d07d9964b9ee46737987e7f464fc7fc33cb56a9a40a2b94ca43ef32270e2fb9b`. This identifies the inspected test file; recheck the replacement release independently.

The website's APK still matches the inspected test file. Submission to Google Play does not replace the APK stored in this repository; its direct-download file must be updated separately.

Replacement check: the owner subsequently supplied `Black-Gold-Seller (7).apk`. Its SHA-256 matches the test file and both website copies exactly, and its certificate subject is still `C=US, O=Android, CN=Android Debug`. The website already serves that exact file.

If the future Play Store app has a different signing certificate, Android may require users of this website APK to reinstall when switching versions. The team should plan the signing / migration approach; do not promise an automatic update from this APK to the Play version without checking certificate compatibility.

## Final build

Run `npm run check` for the current website APK build. The launch handoff is `Black-Gold-Website-upload.zip` in the project root; it contains the files from `dist/` at the archive root, including the APK at `assets/black-gold-seller.apk`. The archive is ready to upload to a static host; it is not a live deployment. After the domain is selected, set `src/config/site.json`, rebuild and recreate the archive to include the final search / sharing URLs. Keep source files, signing keys and local development configuration out of the deployment upload.

Android's [website-distribution guidance](https://developer.android.com/distribute/marketing-tools/alternative-distribution) describes direct APK downloads and installation permissions. Its [app-signing documentation](https://developer.android.com/studio/publish/app-signing) explains signing and update compatibility, and its [network-security documentation](https://developer.android.com/privacy-and-security/security-config) describes cleartext traffic settings.
