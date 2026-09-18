/** Formatting helpers. Money is handled in cents everywhere but the display. */

export function formatMoney(cents: number | null, currency = "USD"): string {
  if (cents === null) return "—"
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    // An unrecognised currency code should not blank the whole row.
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

/**
 * Read a typed amount into cents.
 *
 * Accepts what people actually type into a balance field: "25", "$25",
 * "25.00", "1,250.75". Returns null for anything that is not a number, so the
 * caller can leave the balance unknown rather than record a zero it invented.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "")
  if (!cleaned) return null
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

export function formatDate(iso: string | null): string {
  if (!iso) return "never"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "never"

  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return date.toLocaleDateString()
}
