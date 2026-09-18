import { matchMerchant, type Merchant } from "@/lib/merchants"

/**
 * Pulling a gift card out of a photograph.
 *
 * Two things arrive from the scanner: whatever the barcode reader decoded, and
 * whatever the OCR pass made of the text. They are not equal. A decoded barcode
 * is exact - it either decoded or it did not - so when one is present it wins
 * outright and the OCR text is only mined for the things a barcode never
 * carries: the PIN, the brand, the URL on the back.
 *
 * The OCR path is where the care goes. Gift card numbers are printed in tight
 * sans faces on foil and gloss, and Tesseract reads foil badly, so the digits
 * come back salted with the classic confusions: O for 0, I and l for 1, S for
 * 5, B for 8. Correcting those blindly across the whole string would turn
 * "SUBWAY" into "5UBWAY" and lose the brand, so coercion is confined to runs
 * that already look like numbers.
 */

export type ParsedCard = {
  /** Digits only. Empty when nothing plausible was found. */
  number: string
  /** Digits only. Empty when the card has no PIN or the scratch-off is intact. */
  pin: string
  /** Read off the card, when the card printed one. */
  url: string
  /** Read off the card, when the card printed one. */
  phone: string
  /** MM/YY, when printed. */
  expires: string
  merchant: Merchant | null
  /** Where the number came from. Barcodes are exact; OCR is a guess. */
  source: "barcode" | "text" | "none"
  /** Whether the number satisfies the Luhn checksum. */
  luhn: boolean
  /** 0-1. Drives whether the review step opens pre-trusted or flagged. */
  confidence: number
}

/** Characters OCR routinely substitutes for digits, and what they should be. */
const DIGIT_LOOKALIKES: Record<string, string> = {
  O: "0", o: "0", Q: "0", D: "0",
  I: "1", l: "1", i: "1", "|": "1", "!": "1",
  Z: "2", z: "2",
  E: "3",
  A: "4",
  S: "5", s: "5",
  G: "6", b: "6",
  T: "7", "?": "7",
  B: "8",
  g: "9", q: "9",
}

const LOOKALIKE_CLASS = "0-9OoQDIliZzEASsGbT?Bgq|!"

function coerceDigits(run: string): string {
  let out = ""
  for (const ch of run) {
    if (ch >= "0" && ch <= "9") out += ch
    else if (DIGIT_LOOKALIKES[ch]) out += DIGIT_LOOKALIKES[ch]
  }
  return out
}

/** The Luhn checksum every network card and many retailer cards satisfy. */
export function luhnValid(digits: string): boolean {
  if (digits.length < 12) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/**
 * Every run in the text that could be a card number, best first.
 *
 * A run qualifies on shape alone - length and a high enough proportion of real
 * digits - and is then scored. Luhn is the strongest signal available without
 * contacting anyone, a nearby "card number" label is the next strongest, and a
 * length the detected brand actually issues breaks the remaining ties.
 */
function numberCandidates(text: string, merchant: Merchant | null): Array<{ digits: string; score: number }> {
  const runRe = new RegExp(`[${LOOKALIKE_CLASS}][${LOOKALIKE_CLASS}\\s-]{10,30}[${LOOKALIKE_CLASS}]`, "g")
  const out: Array<{ digits: string; score: number }> = []
  const seen = new Set<string>()

  for (const line of text.split(/\r?\n/)) {
    const labelled = /card\s*(number|no|#)|account\s*(number|no)|^\s*number/i.test(line)

    for (const match of line.matchAll(runRe)) {
      const raw = match[0]
      const realDigits = (raw.match(/[0-9]/g) ?? []).length
      const letters = (raw.match(/[A-Za-z]/g) ?? []).length

      // On an unlabelled line, a run has to already look like a number to be
      // considered at all, or every long word containing an O and an I becomes
      // a candidate. A line that says "Card Number" has earned the benefit of
      // the doubt: whatever follows is the number, however badly it was read.
      if (!labelled && (realDigits < 8 || letters > realDigits)) continue

      const digits = coerceDigits(raw)
      if (digits.length < 13 || digits.length > 19) continue
      if (seen.has(digits)) continue
      seen.add(digits)

      // Every digit identical is a printing artefact or a row of placeholder
      // boxes, never a card. Drop it outright rather than ranking it last.
      if (/^(\d)\1+$/.test(digits)) continue

      let score = 0.3
      if (luhnValid(digits)) score += 0.4
      if (labelled) score += 0.2
      // A heavily-corrected run is worth surfacing for the user to fix, but
      // should not present itself as confident.
      score -= Math.max(0, (digits.length - realDigits) / digits.length) * 0.25
      if (merchant?.digits?.includes(digits.length)) score += 0.15
      else if (merchant?.digits && !merchant.digits.includes(digits.length)) score -= 0.15
      if (digits.length === 16) score += 0.05

      out.push({ digits, score: Math.min(Math.max(score, 0.05), 1) })
    }
  }

  return out.sort((a, b) => b.score - a.score)
}

/**
 * The PIN, which is only ever found by its label.
 *
 * A bare 4-digit run in gift card text is far more often a year, a store
 * number or the tail of the card number than it is the PIN, so an unlabelled
 * run is never promoted. If the scratch-off has not been scraped off there is
 * genuinely no PIN on the card yet, and returning nothing is the correct answer.
 */
function findPin(text: string, cardNumber: string): string {
  const labelRe = new RegExp(
    `(?:pin|p\\.i\\.n|security\\s*code|access\\s*code|redemption\\s*code|scratch|cvv|cvc|cid)` +
      `[^${LOOKALIKE_CLASS}\\n]{0,12}([${LOOKALIKE_CLASS}][${LOOKALIKE_CLASS}\\s-]{1,12})`,
    "gi",
  )

  for (const match of text.matchAll(labelRe)) {
    const digits = coerceDigits(match[1])
    if (digits.length < 3 || digits.length > 8) continue
    // A "PIN" that is just the card number again is a mis-read label.
    if (cardNumber && cardNumber.includes(digits) && digits.length > 5) continue
    return digits
  }

  return ""
}

function findUrl(text: string): string {
  // Ordered widest-first so "www.foo.com/balance" beats "foo.com".
  const re = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]{1,40}\.(?:com|net|org|us|co)(?:\/[^\s,]{0,60})?)\b/gi
  const hits: string[] = []

  for (const match of text.matchAll(re)) {
    const url = match[1].replace(/[.,;:]+$/, "")
    // Email addresses and bare sentence-ending words are not balance pages.
    if (url.includes("@")) continue
    hits.push(url)
  }

  if (!hits.length) return ""
  // A URL with a path is almost always the balance page; prefer it.
  const withPath = hits.find((h) => h.includes("/"))
  const best = withPath ?? hits[0]
  return best.startsWith("http") ? best : `https://${best}`
}

function findPhone(text: string): string {
  const re = /\b(?:1[-.\s]?)?(?:\(?(8(?:00|33|44|55|66|77|88))\)?[-.\s]?)(\d{3})[-.\s]?(\d{4})\b/g
  const match = re.exec(text)
  if (!match) return ""
  return `1-${match[1]}-${match[2]}-${match[3]}`
}

function findExpiry(text: string): string {
  const match = /\b(0[1-9]|1[0-2])\s*[/\-]\s*(\d{2}|\d{4})\b/.exec(text)
  if (!match) return ""
  const year = match[2].length === 4 ? match[2].slice(2) : match[2]
  return `${match[1]}/${year}`
}

/**
 * Fold everything the scanner found into one card.
 *
 * `barcodes` are raw decoded strings. Some carry the card number plus a PIN
 * concatenated, some carry a URL with the number in a query parameter, and
 * plenty carry the number alone, so each is reduced to its digits and taken
 * only if the length lands in card territory.
 */
export function parseCard(text: string, barcodes: string[] = []): ParsedCard {
  const merchant = matchMerchant(text)
  const url = findUrl(text)
  const phone = findPhone(text)
  const expires = findExpiry(text)

  let number = ""
  let source: ParsedCard["source"] = "none"
  let confidence = 0

  for (const raw of barcodes) {
    const digits = raw.replace(/\D/g, "")
    if (digits.length >= 13 && digits.length <= 19) {
      number = digits
      source = "barcode"
      confidence = 0.95
      break
    }
    // Some cards encode number and PIN together in one long symbol.
    if (digits.length > 19 && digits.length <= 26) {
      number = digits.slice(0, 16)
      source = "barcode"
      confidence = 0.6
      break
    }
  }

  if (!number) {
    const candidates = numberCandidates(text, merchant)
    if (candidates.length) {
      number = candidates[0].digits
      source = "text"
      confidence = candidates[0].score
    }
  }

  const pin = findPin(text, number)

  return {
    number,
    pin,
    url: url || merchant?.balanceUrl || "",
    phone,
    expires,
    merchant,
    source,
    luhn: number ? luhnValid(number) : false,
    confidence: Number(confidence.toFixed(2)),
  }
}

/** 4111111111111111 -> 4111 1111 1111 1111 */
export function groupDigits(digits: string): string {
  if (digits.length === 15) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10)}`.trim()
  }
  return digits.replace(/(.{4})/g, "$1 ").trim()
}

/** Everything but the last four, for a wallet that does not keep the number. */
export function maskDigits(digits: string): string {
  if (digits.length <= 4) return digits
  return `•••• ${digits.slice(-4)}`
}
