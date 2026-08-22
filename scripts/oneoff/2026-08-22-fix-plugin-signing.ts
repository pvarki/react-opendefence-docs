// Fix: Play Store ATAK-CIV only loads plugins signed via TAK.gov's Third
// Party Pipeline — a self-signed release APK loads only on developer builds.
import "dotenv/config";
import { createOutlineClient } from "../lib/outline-api";

const DOC_ID = "6ba7d761-ea9b-4627-90ec-3ffe6b326bcc"; // Packaging & distribution (overview)

const OLD = `* **Civilian / open-source plugins (this guide's scope).** You distribute your own signed APK — GitHub releases, your own site, etc. — just like any Android app, within the terms of the ATAK-CIV license and the licenses of anything you bundle. Users side-load it onto a device running ATAK-CIV.`;

const NEW = `* **Play Store users — sign through TAK.gov (this guide's scope).** The ATAK-CIV build on **Google Play only loads plugins signed by the TAK Product Center**. Your own release key is not enough: submit your built plugin through TAK.gov's **Third Party Pipeline** to get it signed (and optionally listed on TAK.gov), then distribute the signed APK — GitHub releases, your own site, etc. — within the terms of the ATAK-CIV license and the licenses of anything you bundle. An APK signed only with your own key installs fine, but Play Store ATAK-CIV refuses to load it.
* **Developer builds — your own key is enough.** The ATAK-CIV developer build from the SDK accepts plugins signed with any key, including this guide's debug/release keys. That covers development, testing, and closed groups that side-load the developer build — it is not a path to Play Store users.`;

async function main() {
  const client = createOutlineClient();
  const text = await client.getDocumentText(DOC_ID);
  if (!text.includes(OLD))
    throw new Error("Expected bullet not found — doc changed, aborting.");
  await client.updateDocument(DOC_ID, text.replace(OLD, NEW));
  console.log("Updated", DOC_ID);
}

main();
