"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParsedCard } from "@/lib/card-parse";

/**
 * The shape of the response from /api/balance. Mirrors the BalanceResult type
 * defined in src/app/api/balance/route.ts. Duplicated here rather than imported
 * because the API route is server-only and the type would drag the route's
 * server-only imports into the client bundle.
 */
type BalanceResult = {
  status: "found" | "error" | "needs-redeem" | "unknown" | "blocked" | "no-card" | "no-url";
  balance?: string;
  message?: string;
  pageUrl: string;
  merchantName: string;
  rawExcerpt?: string;
  fetchedAt: number;
};

type Props = {
  /** The card details to look up. The component re-checks whenever this object changes. */
  card: ParsedCard;
  /** The currently-edited values, used when the user taps "Re-check". */
  editable: { merchantId: string | null; number: string; pin: string; url: string };
  /** Fires when the user wants to leave for the issuer's own page. */
  onOpenExternal: () => void;
};

/**
 * The balance, right here.
 *
 * This is the difference between CardTally-as-was and the version the user
 * asked for: instead of opening a new tab and asking the user to paste their
 * digits in, the page asks the server (which can do cross-origin fetches the
 * browser cannot) and shows the answer inline. When the server cannot get an
 * answer - the issuer blocked it, the merchant is a code-redeem flow, the
 * network is down - the component says so plainly and the "Open the page"
 * fallback remains available underneath.
 */
export function InlineBalance({ card, editable, onOpenExternal }: Props) {
  const [result, setResult] = React.useState<BalanceResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // The very first check is keyed to the parsed card object (a stable identity
  // for one scan). The "Re-check" button below uses the currently-edited
  // values, so it can ask again after the user has fixed an OCR misread.
  const checkParsed = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: card.merchant?.id ?? null,
          cardNumber: card.number,
          pin: card.pin,
          url: card.url || card.merchant?.balanceUrl || "",
        }),
      });
      const data = (await res.json()) as BalanceResult;
      setResult(data);
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Could not reach the balance service.",
      );
    } finally {
      setLoading(false);
    }
  }, [card]);

  const checkEdited = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: editable.merchantId,
          cardNumber: editable.number,
          pin: editable.pin,
          url: editable.url,
        }),
      });
      const data = (await res.json()) as BalanceResult;
      setResult(data);
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Could not reach the balance service.",
      );
    } finally {
      setLoading(false);
    }
  }, [editable]);

  // Check automatically on the first parsed card, and again whenever the
  // underlying scan changes (the user scans a different card).
  React.useEffect(() => {
    void checkParsed();
  }, [checkParsed]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Checking the balance…</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Asking {card.merchant?.name ?? "the issuer"} through CardTally&apos;s server.
            This usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-card p-5 text-center">
        <AlertTriangle className="size-5 text-destructive" />
        <p className="text-sm">{error}</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void checkEdited()}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  if (!result) return null;

  // The happy path: a balance came back. This is what the user actually wants
  // to see, sized like it matters.
  if (result.status === "found" && result.balance) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-gradient-to-b from-emerald-500/10 to-card p-5 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          <Check className="size-3.5" />
          Balance confirmed
        </div>
        <div className="text-4xl font-bold tracking-tight tabular-nums">{result.balance}</div>
        <p className="text-[11px] text-muted-foreground">
          Reported by {result.merchantName}. Checked just now.
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void checkEdited()}>
            <RefreshCw className="size-3.5" />
            Re-check
          </Button>
          {result.pageUrl ? (
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={onOpenExternal}>
              <ExternalLink className="size-3.5" />
              See on {result.merchantName}&apos;s page
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // Redeem-style cards (Amazon, Steam, app stores). The correct answer for
  // these is "there is no balance", and we say so without making it look like
  // a failure.
  if (result.status === "needs-redeem") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-amber-500" />
          This is a redeem code
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.message ??
            `${result.merchantName} codes apply to your account balance rather than staying on the card. There is no balance to look up.`}
        </p>
        {result.pageUrl ? (
          <Button size="sm" className="gap-1.5" onClick={onOpenExternal}>
            <ArrowRight className="size-3.5" />
            Redeem at {result.merchantName}
          </Button>
        ) : null}
      </div>
    );
  }

  // The issuer blocked the automatic check. Common and unavoidable - be plain
  // about it and surface the fallback button prominently.
  if (result.status === "blocked") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldAlert className="size-4 text-amber-500" />
          Couldn&apos;t auto-check this one
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.message ??
            `${result.merchantName} blocked the automatic request. Open their page to see the balance.`}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5" onClick={onOpenExternal}>
            <ExternalLink className="size-3.5" />
            Open {result.merchantName}&apos;s page
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void checkEdited()}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // The page said the card itself is bad - invalid, expired, already redeemed.
  // That is a real answer (just a sad one), so show it with the same weight as
  // a balance.
  if (result.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="size-4" />
          {result.merchantName} could not verify the card
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.message ??
            "The issuer rejected the card number or PIN. Check the digits against the card and try again."}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void checkEdited()}>
            <RefreshCw className="size-3.5" />
            Re-check after editing
          </Button>
          {result.pageUrl ? (
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={onOpenExternal}>
              <ExternalLink className="size-3.5" />
              Open the page
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // No card number was scanned - we can't ask anyone anything.
  if (result.status === "no-card") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="size-4 text-muted-foreground" />
          No number to check yet
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.message ??
            "Type the card number into the fields below and CardTally will look it up."}
        </p>
      </div>
    );
  }

  if (result.status === "no-url") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="size-4 text-muted-foreground" />
          No balance page for this card
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.message ??
            "CardTally does not know which issuer to ask. Pick the issuer below and try again."}
        </p>
      </div>
    );
  }

  // status === "unknown" - we got a response but could not parse a balance or
  // a definite error out of it. The fallback is still the issuer's page.
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wallet className="size-4 text-muted-foreground" />
        Could not read a balance automatically
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {result.message ??
          `${result.merchantName} sent back a page CardTally could not parse. Open their page to see the balance.`}
      </p>
      {result.rawExcerpt ? (
        <p className="line-clamp-2 text-[10px] text-muted-foreground/70">
          Response excerpt: {result.rawExcerpt}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-2">
        {result.pageUrl ? (
          <Button size="sm" className="gap-1.5" onClick={onOpenExternal}>
            <ExternalLink className="size-3.5" />
            Open {result.merchantName}&apos;s page
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void checkEdited()}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      </div>
    </div>
  );
}
