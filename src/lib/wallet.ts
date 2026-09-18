/**
 * The wallet: cards on this device, in this browser, and nowhere else.
 *
 * A gift card number with its PIN is a bearer instrument. Anyone holding both
 * can spend the card, and unlike a credit card there is no issuer to call and
 * no chargeback to file - the money is simply gone. That single fact decides
 * the shape of this module.
 *
 * So `keepSecrets` defaults to false and the full number and PIN are dropped on
 * save, leaving the last four digits, which are enough to tell two cards apart
 * and useless to anyone who finds them. Keeping the secrets is a per-card
 * choice, made deliberately, with the trade stated at the checkbox. Storage is
 * localStorage, which is unencrypted and readable by anything with access to
 * this browser profile - that is a real limit and the UI says so rather than
 * implying a safety it cannot provide.
 */

const STORAGE_KEY = "cardtally.wallet.v1"

export type Card = {
  id: string
  /** Registry id, or null for a card typed in by hand. */
  merchantId: string | null
  /** What to call it. Defaults to the merchant name, editable. */
  label: string
  /** Always kept. Enough to recognise the card, useless to a thief. */
  last4: string
  /** Full number. Empty unless `keepSecrets` is on. */
  number: string
  /** Empty unless `keepSecrets` is on. */
  pin: string
  /** Whether this card stores its number and PIN. */
  keepSecrets: boolean
  /** Cents, to avoid carrying a rounding error around. Null means unknown. */
  balanceCents: number | null
  currency: string
  /** ISO date of the last balance the user recorded. */
  checkedAt: string | null
  expires: string
  /** The balance page, printed on the card or taken from the registry. */
  url: string
  phone: string
  note: string
  addedAt: string
}

export type CardDraft = Omit<Card, "id" | "addedAt">

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false
  const c = value as Partial<Card>
  return typeof c.id === "string" && typeof c.label === "string" && typeof c.last4 === "string"
}

export function loadWallet(): Card[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Hand-edited or half-written storage should cost the user the bad rows,
    // not the whole wallet.
    return parsed.filter(isCard)
  } catch {
    return []
  }
}

export function saveWallet(cards: Card[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  } catch {
    // Private mode and a full quota both land here. The wallet stays correct
    // in memory for this session; it just will not survive a reload.
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Strip the secrets a card is not entitled to keep. */
function applySecretPolicy(draft: CardDraft): CardDraft {
  if (draft.keepSecrets) return draft
  return { ...draft, number: "", pin: "" }
}

export function addCard(cards: Card[], draft: CardDraft): Card[] {
  const card: Card = {
    ...applySecretPolicy(draft),
    id: newId(),
    addedAt: new Date().toISOString(),
  }
  return [card, ...cards]
}

export function updateCard(cards: Card[], id: string, patch: Partial<CardDraft>): Card[] {
  return cards.map((card) => {
    if (card.id !== id) return card
    const merged = { ...card, ...patch }
    // Turning secrets off has to actually erase them, not just hide them.
    if (!merged.keepSecrets) {
      merged.number = ""
      merged.pin = ""
    }
    return merged
  })
}

export function removeCard(cards: Card[], id: string): Card[] {
  return cards.filter((card) => card.id !== id)
}

/** Record a balance the user read off the merchant's page. */
export function recordBalance(cards: Card[], id: string, cents: number | null): Card[] {
  return cards.map((card) =>
    card.id === id ? { ...card, balanceCents: cents, checkedAt: new Date().toISOString() } : card,
  )
}

/** Cards with a known balance, summed. Unknown balances are left out. */
export function walletTotal(cards: Card[]): { cents: number; known: number; unknown: number } {
  let cents = 0
  let known = 0
  let unknown = 0
  for (const card of cards) {
    if (card.balanceCents === null) unknown++
    else {
      cents += card.balanceCents
      known++
    }
  }
  return { cents, known, unknown }
}

/**
 * Whether a recorded balance is old enough to distrust.
 *
 * A gift card balance only changes when it is spent, so a number is not wrong
 * merely because it is old. Ninety days is the point where it stops being worth
 * trusting from memory, and it matches roughly how often the cards people
 * actually forget about get used.
 */
export function isStale(card: Card, days = 90): boolean {
  if (!card.checkedAt) return false
  const age = Date.now() - new Date(card.checkedAt).getTime()
  return age > days * 24 * 60 * 60 * 1000
}
