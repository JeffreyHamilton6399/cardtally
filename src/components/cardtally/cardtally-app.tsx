"use client";

import * as React from "react";

import { SiteFooter } from "@/components/site-footer";
import { useToast } from "@/hooks/use-toast";
import type { ParsedCard } from "@/lib/card-parse";
import { Header } from "@/components/cardtally/header";
import { Result } from "@/components/cardtally/result";
import { Scanner } from "@/components/cardtally/scanner";

/**
 * One card, one question: how much is on it.
 *
 * There is no wallet and nothing is saved. The card exists in this component's
 * state until you scan another or close the tab, which means there is no
 * storage to secure, nothing to leak, and no stale balance to mislead you
 * later.
 */
export function CardTallyApp() {
  const { toast } = useToast();
  const [card, setCard] = React.useState<ParsedCard | null>(null);

  // A short-lived earlier version kept a wallet, and anyone who ticked its
  // "remember this card" box has a full number and PIN sitting in localStorage
  // on their device. Nothing reads that key any more, so leaving it there would
  // be abandoning spendable value in storage for no reason. Clear it once.
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("cardtally.wallet.v1");
    } catch {
      // Blocked storage means there is nothing to clear anyway.
    }
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        {card ? (
          <Result parsed={card} onReset={() => setCard(null)} />
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-lg font-semibold tracking-tight">
                How much is on this card?
              </h1>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Scan it and CardTally reads the number, the PIN and the balance page off the
                card, then takes you straight to the issuer with the digits already copied.
                The reading happens in this tab — nothing is uploaded and nothing is saved.
              </p>
            </div>

            <Scanner
              onScanned={(scanned, result) => {
                setCard(scanned);
                if (!scanned.number) {
                  toast({
                    title: "No number found",
                    description: `Scanned in ${result.ms}ms. Try the back of the card, or type it in.`,
                  });
                }
              }}
            />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
