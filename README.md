# CardTally

Point a camera at a gift card. CardTally reads the number, the PIN and the
balance page off it, and takes you straight to the issuer with the digits
already on your clipboard.

One card, one question, one screen. Nothing is uploaded and nothing is saved.

## Why it hands you off instead of just telling you

The obvious version of this app fetches the balance and prints it. That version
cannot be built, by anyone, and it is worth showing the working rather than
asserting it. Checked against the live issuers:

| Route | What actually happens |
| :--- | :--- |
| Fetch the balance page from the browser | `TypeError: Failed to fetch` — CORS blocked at every major issuer |
| Embed their page in an iframe | `x-frame-options: SAMEORIGIN`, `frame-ancestors 'self'` |
| Fetch it from a server instead | Works, until fraud detection. Target's own CSP loads `online-metrix.net` — ThreatMetrix device fingerprinting on the balance-check page |

There is no public gift card balance API. The only route that would return a
number is a server impersonating a browser convincingly enough to get past bot
detection, which is the technique used to drain stolen cards, and is not
something this repo is going to contain.

So the work splits:

| Step | Who does it |
| :--- | :--- |
| Read the card | CardTally, in your browser |
| Work out which issuer, and which page | CardTally |
| Put the digits where you can paste them | CardTally |
| Tell you the number | The issuer, on their own site |

Every tedious step is automated. The one step that requires the issuer stays
with the issuer.

## What it does

- Scan with the camera, a dropped photo, a file, or an image pasted from the clipboard
- Barcode and QR decoding first, since a decoded barcode is exact
- Text recognition for the number, PIN, expiry, balance URL and phone number
- Recognises about fifty issuers by name, for cards that print no URL
- Luhn checksum on every number, so a misread digit is flagged before you leave
- One button to the issuer's page, with number and PIN copied
- Light, dark and system themes

## Nothing is saved

A scanned card lives in the page's memory until you scan another or close the
tab. There is no wallet, no history, no database, no account.

That is deliberate. A gift card number with its PIN is a bearer instrument:
anyone holding both can spend it, and unlike a credit card there is no issuer to
call and no chargeback to file. Browser storage is not encrypted, so the safest
place for those digits is nowhere. The only thing kept between visits is the
theme preference.

## Reading a card

Two passes run over each image. They want opposite things, so they get
different inputs.

**Barcodes** are read from the untouched frame. They are exact - a symbol either
decodes or it does not - so a decoded barcode wins outright over anything the
text pass thinks it saw. `BarcodeDetector` is used where the browser has one;
Safari and Firefox fall back to ZXing, imported only when needed.

**Text** is read from a preprocessed copy, because a gift card is close to the
worst case for OCR: small tight digits on foil, gloss and holograms, at an angle
under a ceiling light. Three steps help - collapse to luminance so a coloured
foil ground stops competing with the ink, stretch the histogram so a washed-out
photo regains its black and white, then unsharp-mask the edges the camera's
noise reduction smeared.

It is deliberately **not** binarised. A hard threshold looks cleaner and reads
worse: it eats thin strokes on embossed numbers, and the 8s and 9s come back
as 0s.

The histogram clip is half a percent, not the usual five. A card is mostly
background and the ink can be under three percent of the pixels, so a five
percent clip puts both marks inside the background peak, collapses the span, and
drives the whole image to black.

## Reading the text

OCR on foil returns digits salted with the classic confusions - `O` for `0`,
`I` and `l` for `1`, `S` for `5`, `B` for `8`. Correcting those across the whole
string would turn `SUBWAY` into `5UBWAY` and lose the brand, so coercion is
confined to runs that already look like numbers.

Candidates are then scored. Luhn is the strongest signal available without
contacting anyone; a nearby `Card Number` label is next; a length the detected
brand actually issues breaks the rest. A line explicitly labelled `Card Number`
gets the benefit of the doubt even when badly read - whatever follows is the
number.

A PIN is only ever taken from a label. An unlabelled four-digit run on a gift
card is far more often a year or a store number, and if the scratch-off is
intact there is genuinely no PIN to find yet.

The balance URL printed on the back beats the built-in list every time. It comes
from the issuer, matches the exact programme the card belongs to, and does not
rot when a retailer moves a page.

Every field stays editable on the result screen. OCR on foil is wrong often
enough that a read-only display would be a dead end - one bad digit and the
issuer's form rejects the card with nothing you could do about it.

## The OCR engine is vendored

`tesseract.js` fetches its worker, wasm core and language model from a CDN on
first use. For most apps that is a detail; here it is the point. A tool that
promises your card number never leaves the device should not call a third party
the instant you hold a card to the camera - the request itself is a leak even
though the image is not in it.

`scripts/vendor-tesseract.mjs` copies all three into `public/` at install time,
so they are served from this origin and a scan works with the network off. It
runs from `postinstall`, or by hand:

```bash
npm run vendor:ocr
```

The model is `tessdata_fast`, about 2MB - a quarter the size of the full one and
as accurate on print. `public/tesseract` is gitignored and rebuilt on install.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # the card parser, 33 cases, no runner needed
npm run lint
npm run build
```

The camera needs a secure context, so it works on `localhost` and over https,
and nowhere else.

## Built with

- [Next.js 16](https://nextjs.org) (App Router), TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- [tesseract.js](https://tesseract.projectnaptha.com) for text, [ZXing](https://github.com/zxing-js/library) for barcodes where the browser has none

## Privacy

No backend, no API routes, no database, no accounts, no analytics, no trackers,
no stored cards.

**No third-party requests either.** The typefaces are self-hosted by
`next/font`, and the OCR engine is vendored into `public/`, so a deployed
CardTally makes every request to its own origin and none to anyone else. The
network panel on a live scan shows this: sixteen requests, all same-origin.

Retailer names and marks belong to their owners and are used only to identify
which card is which.
