#!/usr/bin/env tsx

/**
 * One-off (2026-06-14): splice the iOS-specific certificate-install slides into
 * the iOS Deploy App guides, from "Download the certificate" onward.
 *
 * Source content + screenshots: helpcontent/iosguide/ (iosloginguide.MD + iosN.PNG).
 * iOS installs the mTLS cert via a downloaded configuration profile in Settings,
 * which differs from Android — so the generic (Android-derived) cert slides are
 * replaced with 9 iOS slides in BOTH:
 *   - User Guide  → "Joining a Deploy App"   (keep slides 1-4, replace 5-8)
 *   - Admin Guide → "First Login"            (keep slides 1-3, replace 4-7)
 *
 * Format: the existing legacy ```markdown fenced slideset (slides split on
 * `---`, `[picN]` refs resolved from a "## Pictures:" list). We rebuild the
 * fence (kept slides verbatim + 9 new slides) and the Pictures list, uploading
 * the 9 iOS screenshots as Outline attachments. The "  =WxH" size hint is
 * omitted on purpose — the sync image-processor measures real dimensions.
 *
 * Usage:
 *   pnpm tsx scripts/oneoff/2026-06-14-ios-login-cert-slides.ts            # dry run
 *   pnpm tsx scripts/oneoff/2026-06-14-ios-login-cert-slides.ts --apply    # execute
 *   Then: pnpm sync
 */
import "dotenv/config";

import { createOutlineClient } from "../lib/outline-api";

const APPLY = process.argv.includes("--apply");
const IMG_DIR = "helpcontent/iosguide";
const OUTLINE_ORIGIN = "https://pvarki.getoutline.com";

const JOINING_ID = "cdde88ea-2777-42c6-b918-b9726de6926a"; // iOS User Guide
const FIRST_LOGIN_ID = "45d8e9f7-f154-4c6b-9eaa-cb37c5cb749d"; // iOS Admin Guide

const client = createOutlineClient();

// Existing attachment ids for the kept (pre-"Download the certificate") slides.
const A = (id: string) => `${OUTLINE_ORIGIN}/api/attachments.redirect?id=${id}`;

// --- kept slides (verbatim from the current pages) -------------------------
const JOINING_KEPT = [
  `# Gaining Access
[layout: image-left]
You can join a instance via obtaining a invite link:
- by scanning a QR Code (Opens the next page straight away)
- by receiving an invite link (Opens the next page straight away)
- by receiving a link + Manual Code (Opens page on the left).
[pic1]`,
  `# Callsign
[layout: image-left]
The invite lets you give yourself a callsign & join the waiting room.
- The callsign should be something your organization can identify you with.
- This callsign will be yours across all services.
[pic2]`,
  `# Waiting Room
[layout: image-left]
Your Deploy App server's admin have to accept you in personally after an invite.
- Show your QR code to an admin or share the link with them.
- Once an admin has approved you, you will be able to continue.
[pic3]`,
  `# Instructions
[layout: image-left]
- Deploy App has built-in instructions to instruct users and highlight key features.
- This guide will go through certificate installation.
[pic4]`,
];
const JOINING_KEPT_PICS = [
  A("efdd56d5-1ba7-46a7-b4a0-929b60df5d2f"),
  A("664b481c-0d48-47d3-a340-f8fa67cfefe6"),
  A("71e50cc0-0c34-4805-91df-5791f8fcf384"),
  A("bb46bead-62ec-4460-9379-e06a846f829e"),
];

const FIRST_LOGIN_KEPT = [
  `# Initial Access
[layout: image-left]
For the first time, you access your Deploy App with a first-admin code.
- Your service operator should provide you with a link to your instance and a first admin code.
- Login with the code provided.
Remember! First-admin codes are one-use only, so when using one, do complete the login flow. Else you have used the code and gained no access with it.
[pic1]`,
  `# Callsign
[layout: image-left]
As with standard user login, give yourself a callsign.
- This should be something your organization can identify you with.
- It will be used across all services.
[pic2]`,
  `# Instructions
- Deploy App has built in instructions to instruct users and highlight key features.
- This guide will go through certificate installation.
[pic3]`,
];
const FIRST_LOGIN_KEPT_PICS = [
  A("efdd56d5-1ba7-46a7-b4a0-929b60df5d2f"),
  A("664b481c-0d48-47d3-a340-f8fa67cfefe6"),
  A("bb46bead-62ec-4460-9379-e06a846f829e"),
];

// --- the 9 new iOS slides (shared) -----------------------------------------
// Each entry: slide markdown (without the [picN] line) + its screenshot file.
const NEW_SLIDES: Array<{ body: string; img: string }> = [
  {
    img: "ios3.PNG",
    body: `# Download the certificate
[layout: image-left]
Download your client certificate (mTLS) that is to be installed in your device.
- This will act as your way to access the services.
- You do not need passwords with Deploy App, as the cert will be your ID.`,
  },
  {
    img: "ios5.PNG",
    body: `# Go to Settings
[layout: image-left]
With iOS, you have to go to Settings to install the certificate.
- Look for Settings.
- Eg. swipe a bit upwards to bring up Search, then type Settings and tap the settings icon.`,
  },
  {
    img: "ios6.PNG",
    body: `# Tap 'Profile Downloaded'
[layout: image-left]
Because you just downloaded a cert, Settings notifies you of it.
- Press the 'Profile Downloaded' notification to install the cert.`,
  },
  {
    img: "ios7.PNG",
    body: `# Tap Install
[layout: image-left]
Hit **Install** from the top right of this popup.`,
  },
  {
    img: "ios8.PNG",
    body: `# Type your Passcode
[layout: image-left]
In order to proceed, iOS asks for your device passcode.
- Type your passcode to continue.`,
  },
  {
    img: "ios9.PNG",
    body: `# Acknowledge the Warning
[layout: image-left]
iOS notifies you that this certificate is not signed by any Authority your phone already knows to trust.
- Acknowledge the warning (the signatory of this cert is your Deploy App server, eg. 'golden-monkey.example.com'.)`,
  },
  {
    img: "ios11.PNG",
    body: `# Type the Cert's Pass, always the callsign
[layout: image-left]
You have to type the Cert's Password. This is always **exactly same as your callsign.**
- The cert password bears no security meaning here.
- The password is only required due some password being mandatory for the cert filetype we use for compatibility reasons.`,
  },
  {
    img: "ios12.PNG",
    body: `# Success - Get Back to the Browser
[layout: image-left]
iOS notifies you that the client cert is now installed to your device.
- Now you can go back to your browser.
- Your client cert persists in your device, so you cannot lose access to the server unless you are deleted (which invalidates your cert's access.)`,
  },
  {
    img: "ios13.PNG",
    body: `# Hit Continue with Cert
[layout: image-left]
Hitting the purple Continue with Cert button now will let you in to application.
- Caution: If you pressed that button before the cert is installed, you will get the mTLS failure error.
- To clear that error, close the browser by swiping up and swiping the browser away. Then navigate back to the server and hit Continue with Cert.`,
  },
];

/** Build the full document body: kept slides + new slides + Pictures list. */
function buildBody(
  prefix: string,
  keptSlides: string[],
  keptPics: string[],
  newUrls: string[],
): string {
  const slides: string[] = [...keptSlides];
  const pics: Array<{ key: string; url: string }> = keptPics.map((url, i) => ({
    key: `pic${i + 1}`,
    url,
  }));

  NEW_SLIDES.forEach((slide, i) => {
    const key = `pic${keptPics.length + i + 1}`;
    slides.push(`${slide.body}\n[${key}]`);
    pics.push({ key, url: newUrls[i] });
  });

  const fence = "```markdown\n" + slides.join("\n\n---\n\n") + "\n```\n";
  const pictures =
    "## Pictures:\n\n" +
    pics.map((p) => `${p.key}\n\n![](${p.url})`).join("\n\n");

  return `${prefix}${fence}\n\n${pictures}\n`;
}

async function main() {
  console.log(APPLY ? "APPLYING\n" : "DRY RUN (pass --apply to execute)\n");

  // 1) Upload the 9 iOS screenshots (once) and map file -> attachment URL.
  const urlByFile: Record<string, string> = {};
  const files = [...new Set(NEW_SLIDES.map((s) => s.img))];
  for (const file of files) {
    if (APPLY) {
      const { url } = await client.uploadAttachment(`${IMG_DIR}/${file}`);
      urlByFile[file] = url;
      console.log(`↑ ${file} → ${url}`);
      await new Promise((r) => setTimeout(r, 150));
    } else {
      urlByFile[file] = `«UPLOAD:${file}»`;
    }
  }
  const newUrls = NEW_SLIDES.map((s) => urlByFile[s.img]);

  // 2) Rebuild each page: keep its translations-header prefix, swap the fence.
  const targets = [
    {
      id: JOINING_ID,
      name: "Joining a Deploy App",
      kept: JOINING_KEPT,
      keptPics: JOINING_KEPT_PICS,
    },
    {
      id: FIRST_LOGIN_ID,
      name: "First Login",
      kept: FIRST_LOGIN_KEPT,
      keptPics: FIRST_LOGIN_KEPT_PICS,
    },
  ];

  for (const t of targets) {
    const current = await client.getDocumentText(t.id);
    const fenceIdx = current.indexOf("```markdown");
    if (fenceIdx < 0) throw new Error(`No \`\`\`markdown fence in "${t.name}"`);
    const prefix = current.slice(0, fenceIdx);
    const body = buildBody(prefix, t.kept, t.keptPics, newUrls);

    console.log(`\n===== ${t.name} (${t.id}) =====`);
    console.log(
      `kept ${t.kept.length} slides + ${NEW_SLIDES.length} new iOS slides`,
    );
    if (!APPLY) {
      console.log("---- new body ----\n" + body);
    } else {
      await client.updateDocument(t.id, body, { publish: true });
      console.log("✓ updated in Outline");
    }
  }

  console.log(
    APPLY
      ? "\n✓ Done. Run `pnpm sync` to pull the updated iOS pages into the app."
      : "\n(dry run — no uploads or writes)",
  );
}

main().catch((err: unknown) => {
  console.error(
    "ios-login-cert-slides failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
