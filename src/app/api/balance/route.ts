import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { merchantById } from "@/lib/merchants";

/**
 * Inline balance checking.
 *
 * The original CardTally handed the user off to the issuer's own page because
 * the browser cannot read a balance from a different origin. The server can.
 * This route does the cross-origin request the browser could not, with the
 * headers a real browser would send, and asks the LLM to read whatever the
 * issuer sends back: a balance, an error, a captcha wall, or a redeem-a-code
 * page that does not have a balance at all.
 *
 * It does not impersonate a real user well enough to beat Akamai or PerimeterX
 * (those fingerprint TLS, JA3, mouse movement and far more than a `fetch`
 * carries), so when it is blocked it says so plainly. The "Open the page"
 * button is still there as the fallback for those cases.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type BalanceRequest = {
  merchantId: string | null;
  cardNumber: string;
  pin: string;
  url: string;
};

export type BalanceResult = {
  /** What we managed to learn. Drives the inline UI. */
  status: "found" | "error" | "needs-redeem" | "unknown" | "blocked" | "no-card" | "no-url";
  /** A formatted balance string, when status === "found". */
  balance?: string;
  /** A short, human-readable explanation of whatever the status means. */
  message?: string;
  /** The issuer's own URL we tried (or that the user should fall back to). */
  pageUrl: string;
  merchantName: string;
  /** Optional short excerpt of what came back, for transparency. */
  rawExcerpt?: string;
  fetchedAt: number;
};

/**
 * Merchants whose "card" is actually a one-shot redeem code with no balance to
 * look up. Showing a spinner and then "no balance" for these would feel like a
 * failure when it is in fact the correct answer, so they are short-circuited
 * up front with a friendly explanation.
 */
const REDEEM_MERCHANTS = new Set([
  "amazon",
  "google-play",
  "steam",
  "playstation",
  "xbox",
  "nintendo",
  "netflix",
  "spotify",
  "uber",
  "doordash",
  "apple",
  "costco",
]);

/** Headers a recent Chrome would send on a top-level document request. */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Sec-Ch-Ua":
    '"Chromium";v="126", "Not.A/Brand";v="24", "Google Chrome";v="126"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
};

/** Pull the visible text out of an HTML response so the LLM does not read CSS. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Looks-like-a-bot-page heuristics, run on the GET before we bother parsing. */
function looksBlocked(html: string, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes("access denied") ||
    head.includes("are you a robot") ||
    head.includes("captcha") ||
    head.includes("blocked") ||
    head.includes("denied") ||
    head.includes("akamai") ||
    head.includes("perimeterx") ||
    head.includes("px-captcha") ||
    head.includes("cloudflare") ||
    head.includes("incapsula") ||
    head.includes("attention required")
  );
}

/**
 * Ask the LLM to read the issuer's response and pull out a balance, an error
 * message, or a "this is a redeem page" verdict. The LLM is far better at this
 * than regex - balance pages are unstructured HTML, error strings vary, and
 * blocked pages have their own distinctive phrasing the LLM recognises.
 *
 * Returns a structured verdict; on any failure to parse, falls back to
 * `unknown` with the raw text as the message so the user still sees
 * something.
 */
async function llmReadBalance(opts: {
  text: string;
  merchantName: string;
  cardNumber: string;
  url: string;
}): Promise<{
  status: BalanceResult["status"];
  balance?: string;
  message?: string;
}> {
  const text = opts.text.slice(0, 6000);
  if (!text) return { status: "unknown" };

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "You read the response from a gift-card balance-check page and pull out the balance, an error, or a status. You respond with one JSON object and nothing else.",
        },
        {
          role: "user",
          content: `The page is from ${opts.merchantName}, after submitting a card number starting with ${opts.cardNumber.slice(0, 4)} and ending with ${opts.cardNumber.slice(-4)}.

URL: ${opts.url}

Page content (text only, truncated to 6000 chars):
${text}

Read it and reply with one JSON object of this exact shape:
{"status": "found" | "error" | "needs-redeem" | "blocked" | "unknown", "balance": string | null, "message": string | null}

Rules:
- status "found" if a balance is clearly shown (a dollar amount, e.g. "$25.00" or "Balance: $100.00"). Put the balance string in "balance".
- status "error" if the page says the card number or PIN is invalid, expired, or already redeemed. Put the issuer's wording in "message".
- status "blocked" if the page is a captcha, "access denied", robot check, or bot-detection wall.
- status "needs-redeem" if the page is a code-redeem flow with no concept of a card balance (app stores, streaming services, gaming wallets).
- status "unknown" if none of the above apply.
- "balance" must be null unless status is "found".
- "message" is a short human-readable line; null if there is nothing useful to say.

Reply with JSON only, no markdown fences.`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return { status: "unknown", message: raw.slice(0, 180) || undefined };
    }
    const parsed = JSON.parse(match[0]) as {
      status?: string;
      balance?: string | null;
      message?: string | null;
    };
    return {
      status: (parsed.status as BalanceResult["status"]) ?? "unknown",
      balance: parsed.balance && parsed.balance !== "null" ? parsed.balance : undefined,
      message: parsed.message && parsed.message !== "null" ? parsed.message : undefined,
    };
  } catch (err) {
    console.error("LLM balance parse failed:", err);
    return { status: "unknown" };
  }
}

/**
 * The actual fetch: GET the balance page (to load any cookies and find the
 * form), POST the card+PIN to whatever form the page contains, then ask the
 * LLM to read the response. A 15-second timeout caps the whole round trip so
 * a hung issuer does not keep the spinner spinning.
 */
async function fetchBalanceGeneric(opts: {
  url: string;
  cardNumber: string;
  pin: string;
  merchantName: string;
}): Promise<BalanceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const getRes = await fetch(opts.url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    const getHtml = await getRes.text();

    if (looksBlocked(getHtml, getRes.status)) {
      return {
        status: "blocked",
        message:
          "The issuer blocked the automatic check (anti-bot). Open their page to see the balance.",
        pageUrl: opts.url,
        merchantName: opts.merchantName,
        fetchedAt: Date.now(),
      };
    }

    // Find the first form on the page and submit our card details to it. Most
    // balance pages have exactly one form whose action is the balance-check
    // endpoint. We don't try to honour every hidden input (CSRF tokens expire
    // server-side anyway); we send the obvious fields under every name an
    // issuer is likely to expect, so one of them lands.
    const formMatch = getHtml.match(/<form[^>]*action=["']([^"']+)["']/i);
    let finalHtml = getHtml;
    let finalUrl = opts.url;

    if (formMatch) {
      const postUrl = new URL(formMatch[1], opts.url).href;
      const body = new URLSearchParams();
      // Send the card number and PIN under the field names common issuers use.
      body.set("cardNumber", opts.cardNumber);
      body.set("cardNum", opts.cardNumber);
      body.set("cardnumber", opts.cardNumber);
      body.set("accountNumber", opts.cardNumber);
      body.set("sc", opts.cardNumber);
      body.set("pin", opts.pin);
      body.set("cvv", opts.pin);
      body.set("cvv2", opts.pin);
      body.set("securityCode", opts.pin);

      try {
        const postRes = await fetch(postUrl, {
          method: "POST",
          headers: {
            ...BROWSER_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: new URL(opts.url).origin,
            Referer: opts.url,
          },
          body: body.toString(),
          signal: controller.signal,
          redirect: "follow",
        });
        finalHtml = await postRes.text();
        finalUrl = postRes.url || opts.url;

        if (looksBlocked(finalHtml, postRes.status)) {
          return {
            status: "blocked",
            message:
              "The issuer blocked the automatic check (anti-bot). Open their page to see the balance.",
            pageUrl: opts.url,
            merchantName: opts.merchantName,
            fetchedAt: Date.now(),
          };
        }
      } catch {
        // A failed POST is not fatal - we still have the GET response, which
        // sometimes already contains a balance (issuers that read the card
        // from a query string, for instance).
      }
    }

    const text = htmlToText(finalHtml);
    if (!text) {
      return {
        status: "unknown",
        message: "The issuer sent back an empty page. Open their page to see the balance.",
        pageUrl: opts.url,
        merchantName: opts.merchantName,
        fetchedAt: Date.now(),
      };
    }

    const verdict = await llmReadBalance({
      text,
      merchantName: opts.merchantName,
      cardNumber: opts.cardNumber,
      url: finalUrl,
    });

    return {
      status: verdict.status,
      balance: verdict.balance,
      message: verdict.message,
      pageUrl: opts.url,
      merchantName: opts.merchantName,
      rawExcerpt: text.slice(0, 220),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return {
      status: "unknown",
      message: `Couldn't reach the issuer: ${
        err instanceof Error ? err.message : "network error"
      }. Open their page to see the balance.`,
      pageUrl: opts.url,
      merchantName: opts.merchantName,
      fetchedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  let body: BalanceRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "no-card", message: "Bad request.", pageUrl: "", merchantName: "the issuer", fetchedAt: Date.now() } satisfies BalanceResult,
      { status: 400 },
    );
  }

  const { merchantId, cardNumber, pin, url } = body;
  const merchant = merchantById(merchantId);
  const merchantName = merchant?.name ?? "the issuer";
  const pageUrl = url || merchant?.balanceUrl || "";

  if (!cardNumber) {
    return NextResponse.json({
      status: "no-card",
      message: "No card number to check - type one in and try again.",
      pageUrl,
      merchantName,
      fetchedAt: Date.now(),
    } satisfies BalanceResult);
  }

  if (!pageUrl) {
    return NextResponse.json({
      status: "no-url",
      message: "CardTally does not know where to look this card up.",
      pageUrl,
      merchantName,
      fetchedAt: Date.now(),
    } satisfies BalanceResult);
  }

  if (merchantId && REDEEM_MERCHANTS.has(merchantId)) {
    return NextResponse.json({
      status: "needs-redeem",
      message: `${merchantName} codes are redeemed into your account. There is no balance on the card itself - the value moves the moment you redeem it.`,
      pageUrl,
      merchantName,
      fetchedAt: Date.now(),
    } satisfies BalanceResult);
  }

  const result = await fetchBalanceGeneric({
    url: pageUrl,
    cardNumber,
    pin,
    merchantName,
  });
  return NextResponse.json(result);
}
