/**
 * Copy the OCR engine into public/ so it is served from this origin.
 *
 * Out of the box tesseract.js pulls its worker, its wasm core and its language
 * model from a CDN at the moment of the first scan. For most apps that is a
 * detail. For this one it is the whole point: a tool that promises your card
 * number never leaves the device should not be reaching out to a third party
 * the instant you hold a card up to the camera, and the request itself - its
 * timing, its origin - is a leak even though the image is not in it.
 *
 * So the three pieces are vendored at install time and served locally. The
 * model is fetched once here, at build time, from the project's own tessdata
 * host. After that the scanner works with the network off.
 *
 * Run automatically by `postinstall`, or by hand with `bun run vendor:ocr`.
 */

import { createWriteStream } from "node:fs";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public", "tesseract");
const modules = join(root, "node_modules");

/** tessdata_fast: a quarter the size of the full model, and as accurate on print. */
const LANG_URL = "https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyInto(from, to, label) {
  if (!(await exists(from))) {
    console.warn(`[vendor-tesseract] skipped ${label}: ${from} is not there`);
    return false;
  }
  await mkdir(dirname(to), { recursive: true });
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  console.log(`[vendor-tesseract] ${label}`);
  return true;
}

async function fetchLanguage() {
  const target = join(publicDir, "lang", "eng.traineddata.gz");
  if (await exists(target)) {
    console.log("[vendor-tesseract] language model already vendored");
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  console.log("[vendor-tesseract] fetching the English model, once");

  const response = await fetch(LANG_URL);
  if (!response.ok || !response.body) {
    throw new Error(`could not fetch the language model: ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  console.log("[vendor-tesseract] language model vendored");
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  await copyInto(
    join(modules, "tesseract.js", "dist", "worker.min.js"),
    join(publicDir, "worker.min.js"),
    "worker",
  );
  await copyInto(join(modules, "tesseract.js-core"), join(publicDir, "core"), "wasm core");
  await fetchLanguage();
}

main().catch((error) => {
  // A missing OCR engine is worth shouting about but not worth failing an
  // install over - the rest of the app, and `next build`, are unaffected.
  console.error("[vendor-tesseract] failed:", error.message);
  console.error("[vendor-tesseract] scanning will not work until this succeeds.");
});
