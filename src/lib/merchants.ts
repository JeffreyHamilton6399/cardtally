/**
 * Known gift card issuers.
 *
 * This list is a fallback, not the source of truth. Almost every gift card
 * prints its own balance-check URL and phone number on the back, and that
 * printed value is authoritative in a way a hardcoded list can never be: it
 * comes from the issuer, it matches the exact program the card belongs to, and
 * it does not rot when a retailer moves a page. `parseCard` reads it off the
 * card first and only falls back to this table when the scan misses it.
 *
 * What this table is genuinely good for is recognition - turning the word
 * "STARBUCKS" sitting in a blob of OCR text into a brand, and into a sane
 * guess at how long the number should be and whether a PIN comes with it.
 */

export type Merchant = {
  id: string
  /** Display name. */
  name: string
  /**
   * Lowercase needles matched against OCR text. Keep these distinctive:
   * "target" is fine, "gift" would match every card ever printed.
   */
  keywords: string[]
  /** The issuer's own balance page. Opened in a new tab, never fetched. */
  balanceUrl: string
  /** Digits in the card number, when the program uses a fixed length. */
  digits?: number[]
  /** Whether a PIN or security code is needed alongside the number. */
  pin: "required" | "optional" | "none"
  /** Shown under the hand-off button when there is something worth knowing. */
  note?: string
}

export const merchants: Merchant[] = [
  {
    id: "visa",
    name: "Visa gift card",
    keywords: ["visa"],
    balanceUrl: "https://www.vanillagift.com/check-balance",
    digits: [16],
    pin: "required",
    note: "Visa gift cards are issued by a lot of different banks. Use the site printed on the back of yours. Vanilla is only the most common one.",
  },
  {
    id: "mastercard",
    name: "Mastercard gift card",
    keywords: ["mastercard", "master card"],
    balanceUrl: "https://www.mastercard.us/en-us/personal/find-a-card/gift-cards.html",
    digits: [16],
    pin: "required",
    note: "Mastercard gift cards are issued by a lot of different banks. The back of the card names yours.",
  },
  {
    id: "amex",
    name: "American Express gift card",
    keywords: ["american express", "amex"],
    balanceUrl: "https://www.americanexpress.com/gift-cards/check-balance",
    digits: [15],
    pin: "required",
  },
  {
    id: "vanilla",
    name: "Vanilla",
    keywords: ["vanilla"],
    balanceUrl: "https://www.vanillagift.com/check-balance",
    digits: [16],
    pin: "required",
  },
  {
    id: "amazon",
    name: "Amazon",
    keywords: ["amazon"],
    balanceUrl: "https://www.amazon.com/gp/css/gc/balance",
    pin: "none",
    note: "Amazon claim codes apply to your account balance rather than staying on the card.",
  },
  {
    id: "starbucks",
    name: "Starbucks",
    keywords: ["starbucks"],
    balanceUrl: "https://www.starbucks.com/card",
    digits: [16],
    pin: "required",
  },
  {
    id: "target",
    name: "Target",
    keywords: ["target"],
    balanceUrl: "https://www.target.com/guest/gift-card-balance",
    pin: "required",
  },
  {
    id: "walmart",
    name: "Walmart",
    keywords: ["walmart"],
    balanceUrl: "https://www.walmart.com/giftcardbalance",
    pin: "required",
  },
  {
    id: "apple",
    name: "Apple",
    keywords: ["apple", "itunes", "app store"],
    balanceUrl: "https://secure.store.apple.com/shop/giftcard/balance",
    pin: "none",
  },
  {
    id: "google-play",
    name: "Google Play",
    keywords: ["google play"],
    balanceUrl: "https://play.google.com/redeem",
    pin: "none",
    note: "Google Play codes redeem into your account balance. There is no balance page for the card itself.",
  },
  {
    id: "bestbuy",
    name: "Best Buy",
    keywords: ["best buy", "bestbuy"],
    balanceUrl: "https://www.bestbuy.com/gift-card-balance",
    pin: "required",
  },
  {
    id: "homedepot",
    name: "The Home Depot",
    keywords: ["home depot", "homedepot"],
    balanceUrl: "https://www.homedepot.com/mycheckout/giftcard",
    pin: "required",
  },
  {
    id: "lowes",
    name: "Lowe's",
    keywords: ["lowe's", "lowes"],
    balanceUrl: "https://www.lowes.com/l/gift-cards.html",
    pin: "required",
  },
  {
    id: "sephora",
    name: "Sephora",
    keywords: ["sephora"],
    balanceUrl: "https://www.sephora.com/gift-cards-balance",
    pin: "required",
  },
  {
    id: "ulta",
    name: "Ulta Beauty",
    keywords: ["ulta"],
    balanceUrl: "https://www.ulta.com/guest/gift-card-balance",
    pin: "required",
  },
  {
    id: "nordstrom",
    name: "Nordstrom",
    keywords: ["nordstrom"],
    balanceUrl: "https://www.nordstrom.com/c/gift-card-balance",
    pin: "required",
  },
  {
    id: "macys",
    name: "Macy's",
    keywords: ["macy's", "macys"],
    balanceUrl: "https://www.macys.com/account/giftcardbalance",
    pin: "required",
  },
  {
    id: "kohls",
    name: "Kohl's",
    keywords: ["kohl's", "kohls"],
    balanceUrl: "https://www.kohls.com/feature/giftcardbalance.jsp",
    pin: "required",
  },
  {
    id: "gap",
    name: "Gap",
    keywords: ["old navy", "banana republic", "gap"],
    balanceUrl: "https://www.gap.com/browse/giftCardBalance.do",
    pin: "required",
  },
  {
    id: "nike",
    name: "Nike",
    keywords: ["nike"],
    balanceUrl: "https://www.nike.com/orders/gift-card-lookup",
    pin: "required",
  },
  {
    id: "lululemon",
    name: "lululemon",
    keywords: ["lululemon"],
    balanceUrl: "https://shop.lululemon.com/story/gift-card-balance",
    pin: "required",
  },
  {
    id: "rei",
    name: "REI",
    keywords: ["rei co-op", "rei"],
    balanceUrl: "https://www.rei.com/gift-cards",
    pin: "required",
  },
  {
    id: "gamestop",
    name: "GameStop",
    keywords: ["gamestop"],
    balanceUrl: "https://www.gamestop.com/gift-card-balance",
    pin: "required",
  },
  {
    id: "steam",
    name: "Steam",
    keywords: ["steam", "valve"],
    balanceUrl: "https://store.steampowered.com/account/redeemwalletcode",
    pin: "none",
    note: "Steam codes redeem into your wallet. There is no balance page for the card itself.",
  },
  {
    id: "playstation",
    name: "PlayStation",
    keywords: ["playstation", "psn"],
    balanceUrl: "https://www.playstation.com/redeem",
    pin: "none",
  },
  {
    id: "xbox",
    name: "Xbox",
    keywords: ["xbox"],
    balanceUrl: "https://redeem.microsoft.com",
    pin: "none",
  },
  {
    id: "nintendo",
    name: "Nintendo",
    keywords: ["nintendo", "eshop"],
    balanceUrl: "https://ec.nintendo.com/redeem",
    pin: "none",
  },
  {
    id: "netflix",
    name: "Netflix",
    keywords: ["netflix"],
    balanceUrl: "https://www.netflix.com/redeem",
    pin: "none",
  },
  {
    id: "spotify",
    name: "Spotify",
    keywords: ["spotify"],
    balanceUrl: "https://www.spotify.com/redeem",
    pin: "none",
  },
  {
    id: "uber",
    name: "Uber",
    keywords: ["uber eats", "uber"],
    balanceUrl: "https://www.uber.com/gift-cards",
    pin: "none",
  },
  {
    id: "doordash",
    name: "DoorDash",
    keywords: ["doordash"],
    balanceUrl: "https://www.doordash.com/gift-cards",
    pin: "none",
  },
  {
    id: "airbnb",
    name: "Airbnb",
    keywords: ["airbnb"],
    balanceUrl: "https://www.airbnb.com/gift/redeem",
    pin: "required",
  },
  {
    id: "chipotle",
    name: "Chipotle",
    keywords: ["chipotle"],
    balanceUrl: "https://www.chipotle.com/gift-cards",
    pin: "required",
  },
  {
    id: "dunkin",
    name: "Dunkin'",
    keywords: ["dunkin"],
    balanceUrl: "https://www.dunkindonuts.com/dd-card",
    pin: "required",
  },
  {
    id: "subway",
    name: "Subway",
    keywords: ["subway"],
    balanceUrl: "https://www.subway.com/en-US/GiftCards",
    pin: "required",
  },
  {
    id: "mcdonalds",
    name: "McDonald's",
    keywords: ["mcdonald", "arch card"],
    balanceUrl: "https://www.mcdonalds.com/us/en-us/arch-card.html",
    pin: "none",
  },
  {
    id: "panera",
    name: "Panera",
    keywords: ["panera"],
    balanceUrl: "https://www.panerabread.com/en-us/gift-cards.html",
    pin: "required",
  },
  {
    id: "chickfila",
    name: "Chick-fil-A",
    keywords: ["chick-fil-a", "chick fil a"],
    balanceUrl: "https://www.chick-fil-a.com/gift-cards",
    pin: "none",
  },
  {
    id: "olivegarden",
    name: "Olive Garden",
    keywords: ["olive garden"],
    balanceUrl: "https://www.olivegarden.com/gift-cards",
    pin: "required",
  },
  {
    id: "amc",
    name: "AMC Theatres",
    keywords: ["amc theatres", "amc"],
    balanceUrl: "https://www.amctheatres.com/gift-cards",
    pin: "required",
  },
  {
    id: "barnesnoble",
    name: "Barnes & Noble",
    keywords: ["barnes", "noble"],
    balanceUrl: "https://www.barnesandnoble.com/h/gift-cards",
    pin: "required",
  },
  {
    id: "ebay",
    name: "eBay",
    keywords: ["ebay"],
    balanceUrl: "https://www.ebay.com/giftcard",
    pin: "required",
  },
  {
    id: "costco",
    name: "Costco",
    keywords: ["costco"],
    balanceUrl: "https://www.costco.com/shop-card-balance.html",
    pin: "none",
  },
  {
    id: "ikea",
    name: "IKEA",
    keywords: ["ikea"],
    balanceUrl: "https://www.ikea.com/us/en/customer-service/gift-card/",
    pin: "required",
  },
  {
    id: "petco",
    name: "Petco",
    keywords: ["petco"],
    balanceUrl: "https://www.petco.com/shop/en/petcostore/gift-cards",
    pin: "required",
  },
  {
    id: "petsmart",
    name: "PetSmart",
    keywords: ["petsmart"],
    balanceUrl: "https://www.petsmart.com/gift-cards/",
    pin: "required",
  },
  {
    id: "dicks",
    name: "Dick's Sporting Goods",
    keywords: ["dick's sporting", "dicks sporting"],
    balanceUrl: "https://www.dickssportinggoods.com/gift-cards",
    pin: "required",
  },
  {
    id: "tjmaxx",
    name: "T.J.Maxx",
    keywords: ["tjmaxx", "t.j.maxx", "marshalls", "homegoods"],
    balanceUrl: "https://tjx.cashstar.com/balance-check/",
    pin: "required",
  },
  {
    id: "bathbody",
    name: "Bath & Body Works",
    keywords: ["bath & body", "bath and body"],
    balanceUrl: "https://www.bathandbodyworks.com/gift-cards",
    pin: "required",
  },
  {
    id: "wayfair",
    name: "Wayfair",
    keywords: ["wayfair"],
    balanceUrl: "https://www.wayfair.com/gift_card/check_balance",
    pin: "required",
  },
]

const byId = new Map(merchants.map((m) => [m.id, m]))

export function merchantById(id: string | null | undefined): Merchant | null {
  if (!id) return null
  return byId.get(id) ?? null
}

/**
 * Find the issuer whose keyword appears in the scanned text.
 *
 * Longer needles win, so "bath & body" beats a stray "bath". The two card
 * networks lose every tie: their logo is printed on thousands of cards they
 * did not issue, so a card reading both "VISA" and "STARBUCKS" is a Starbucks
 * card with a network logo in the corner, not the other way round.
 */
export function matchMerchant(text: string): Merchant | null {
  const haystack = text.toLowerCase()
  let best: { merchant: Merchant; weight: number } | null = null

  for (const merchant of merchants) {
    for (const keyword of merchant.keywords) {
      if (!haystack.includes(keyword)) continue
      const isNetwork = merchant.id === "visa" || merchant.id === "mastercard"
      const weight = keyword.length - (isNetwork ? 100 : 0)
      if (!best || weight > best.weight) best = { merchant, weight }
    }
  }

  return best?.merchant ?? null
}
