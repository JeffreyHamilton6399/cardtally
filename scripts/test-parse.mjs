/**
 * Tests for the card parser.
 *
 * The parser is the one part of CardTally that is hard to eyeball. Everything
 * else either renders or does not, but scoring a handful of digit-runs scraped
 * off a foil card is the kind of code that keeps working on the example you
 * tried and quietly breaks on the next one. So it gets tested against text
 * shaped like what Tesseract actually returns: right characters mostly, digits
 * salted with O/I/S/B, and the useful lines buried in marketing copy.
 *
 *     npm test
 *
 * No test runner. Node strips the types itself, and the loader hook below
 * teaches it the `@/` alias that tsconfig defines and Node does not know about.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcUrl = pathToFileURL(join(root, "src") + "/").href;

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      if (specifier.startsWith("@/")) {
        return next(${JSON.stringify(srcUrl)} + specifier.slice(2) + ".ts", context);
      }
      return next(specifier, context);
    }
  `)}`,
);

// Imported dynamically: the alias hook has to be registered first, and static
// imports are hoisted above everything here.
const { parseCard, luhnValid, groupDigits } = await import("../src/lib/card-parse.ts");
const { matchMerchant, merchants } = await import("../src/lib/merchants.ts");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${name}`);
    console.log(`       ${String(error.message).split("\n")[0]}`);
  }
}

function group(name) {
  console.log(`\n${name}`);
}

/** A number that satisfies Luhn, for the cases that should validate. */
const GOOD = "4111111111111111";
assert.ok(luhnValid(GOOD), "fixture must be Luhn-valid");

group("Luhn");
test("accepts a valid number", () => assert.ok(luhnValid(GOOD)));
test("rejects a transposed digit", () => assert.ok(!luhnValid("4111111111111121")));
test("rejects short input", () => assert.ok(!luhnValid("411111")));
test("rejects non-digits", () => assert.ok(!luhnValid("4111x11111111111")));

group("Brand matching");
test("finds a retailer", () => assert.equal(matchMerchant("STARBUCKS CARD")?.id, "starbucks"));
test("is case insensitive", () => assert.equal(matchMerchant("starbucks")?.id, "starbucks"));
test("retailer beats the network logo printed beside it", () => {
  assert.equal(matchMerchant("VISA  SUBWAY GIFT CARD")?.id, "subway");
});
test("bare network card still matches", () => {
  assert.equal(matchMerchant("VISA GIFT CARD $50")?.id, "visa");
});
test("longer needle wins", () => assert.equal(matchMerchant("BATH & BODY WORKS")?.id, "bathbody"));
test("unknown brand yields null", () => assert.equal(matchMerchant("SOME CORNER SHOP"), null));
test("every registry entry has a usable balance URL", () => {
  for (const m of merchants) {
    assert.ok(m.balanceUrl.startsWith("https://"), `${m.id} has no https balance URL`);
    assert.ok(m.keywords.length > 0, `${m.id} has no keywords`);
  }
});

group("Barcode path");
test("a decoded barcode is taken verbatim and trusted", () => {
  const card = parseCard("STARBUCKS CARD", ["6013320012345678"]);
  assert.equal(card.number, "6013320012345678");
  assert.equal(card.source, "barcode");
  assert.ok(card.confidence >= 0.9);
});
test("barcode wins over a number in the text", () => {
  assert.equal(parseCard(`Card Number ${GOOD}`, ["6013320012345678"]).number, "6013320012345678");
});
test("a barcode carrying a URL is ignored, not mangled", () => {
  const card = parseCard("Card Number 6013 3200 1234 5678", ["https://example.com/gc"]);
  assert.equal(card.number, "6013320012345678");
  assert.equal(card.source, "text");
});

group("OCR text path");
test("reads a spaced number off the card", () => {
  const card = parseCard("STARBUCKS\nCard Number 6013 3200 1234 5678\nPIN 1234");
  assert.equal(card.number, "6013320012345678");
  assert.equal(card.pin, "1234");
});
test("corrects letters OCR substituted for digits", () => {
  const card = parseCard("Card Number 4III IIII IIII IIII");
  assert.equal(card.number, "4111111111111111");
  assert.ok(card.luhn);
});
test("brand text is not eaten by digit coercion", () => {
  assert.equal(parseCard("SUBWAY\nCard Number 6013 3200 1234 5678").merchant?.id, "subway");
});
test("a Luhn-valid candidate outranks a stray long run", () => {
  assert.equal(parseCard(`Promo 1234567890123456789\nCard Number ${GOOD}`).number, GOOD);
});
test("flags a number whose checksum fails", () => {
  const card = parseCard("Card Number 4111 1111 1111 1121");
  assert.equal(card.luhn, false);
  assert.ok(card.confidence < 0.7);
});
test("a run of identical digits is never a card", () => {
  assert.notEqual(parseCard("0000 0000 0000 0000").number, "0000000000000000");
});
test("nothing found is reported honestly", () => {
  const card = parseCard("THANK YOU FOR YOUR PURCHASE");
  assert.equal(card.number, "");
  assert.equal(card.source, "none");
  assert.equal(card.confidence, 0);
});

group("PIN");
test("needs a label", () => {
  // 2024 is a year, not a PIN, and must not be promoted to one.
  assert.equal(parseCard("Issued 2024\nCard Number 6013 3200 1234 5678").pin, "");
});
test("reads several label spellings", () => {
  assert.equal(parseCard("SECURITY CODE 4821").pin, "4821");
  assert.equal(parseCard("Access Code: 92117").pin, "92117");
  assert.equal(parseCard("Scratch to reveal PIN 3310").pin, "3310");
});
test("does not mistake the card number for the PIN", () => {
  const card = parseCard("PIN 6013320012345678\nCard Number 6013 3200 1234 5678");
  assert.notEqual(card.pin, "6013320012345678");
});

group("The back of the card");
test("prefers the printed URL over the registry", () => {
  const card = parseCard("STARBUCKS\nCheck your balance at starbucks.com/card-balance");
  assert.ok(card.url.includes("starbucks.com/card-balance"));
});
test("falls back to the registry when no URL is printed", () => {
  const card = parseCard("STARBUCKS CARD\nCard Number 6013 3200 1234 5678");
  assert.equal(card.url, "https://www.starbucks.com/card");
});
test("adds a scheme to a bare domain", () => {
  assert.ok(parseCard("visit vanillagift.com").url.startsWith("https://"));
});
test("reads a toll-free number", () => {
  assert.equal(parseCard("Questions? Call 1-800-555-1234").phone, "1-800-555-1234");
});
test("ignores an ordinary local number", () => {
  assert.equal(parseCard("Call 212-555-1234").phone, "");
});
test("reads an expiry date", () => assert.equal(parseCard("VALID THRU 08/27").expires, "08/27"));

group("A whole card, as OCR would return it");
test("end to end on messy input", () => {
  const ocr = [
    "STARBUCKS",
    "",
    "This card is redeemable at participating stores.",
    "Card Number",
    "6O13 32OO I234 5678",
    "PIN: 8842",
    "Check balance at starbucks.com/card",
    "Questions? 1-800-782-7282",
  ].join("\n");

  const card = parseCard(ocr);
  assert.equal(card.merchant?.id, "starbucks");
  assert.equal(card.number, "6013320012345678");
  assert.equal(card.pin, "8842");
  assert.ok(card.url.includes("starbucks.com"));
  assert.equal(card.phone, "1-800-782-7282");
});

group("Formatting");
test("groups 16 digits in fours", () => {
  assert.equal(groupDigits("6013320012345678"), "6013 3200 1234 5678");
});
test("groups 15 digits the Amex way", () => {
  assert.equal(groupDigits("378282246310005"), "3782 822463 10005");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
