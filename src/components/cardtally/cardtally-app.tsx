"use client";

import * as React from "react";
import { Wallet } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/format";
import {
  addCard,
  recordBalance,
  removeCard,
  walletTotal,
  type CardDraft,
} from "@/lib/wallet";
import { mutateWallet, useWallet } from "@/lib/wallet-store";
import type { ParsedCard } from "@/lib/card-parse";
import { CardRow } from "@/components/cardtally/card-row";
import { Header } from "@/components/cardtally/header";
import { ReviewCard } from "@/components/cardtally/review-card";
import { Scanner } from "@/components/cardtally/scanner";

export function CardTallyApp() {
  const { toast } = useToast();
  const cards = useWallet();
  const [pending, setPending] = React.useState<ParsedCard | null>(null);

  const total = walletTotal(cards);

  function handleSave(draft: CardDraft) {
    mutateWallet((current) => addCard(current, draft));
    setPending(null);
    toast({ title: "Added to the wallet", description: draft.label });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-4 sm:py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="flex flex-col gap-3">
            <div>
              <h1 className="text-sm font-semibold">Scan a card</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The number, the PIN and the balance page come off the card itself. The reading
                happens in this tab — no photo and no card number leaves your device.
              </p>
            </div>

            {pending ? (
              <ReviewCard
                parsed={pending}
                onSave={handleSave}
                onDiscard={() => setPending(null)}
              />
            ) : (
              <Scanner
                onScanned={(card, result) => {
                  setPending(card);
                  if (!card.number) {
                    toast({
                      title: "No number found",
                      description: `Scanned in ${result.ms}ms. Try the back of the card, or type it in.`,
                    });
                  }
                }}
              />
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Your cards</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {total.known > 0
                    ? `${total.known} checked${total.unknown ? `, ${total.unknown} not yet` : ""}`
                    : "Kept in this browser only"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg tabular-nums">{formatMoney(total.cents)}</p>
                <p className="text-[11px] text-muted-foreground">known balance</p>
              </div>
            </div>

            {cards.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
                <Wallet className="size-5 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
                <p className="max-w-xs text-[11px] text-muted-foreground">
                  Scan a card and it lands here with its balance page one tap away.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {cards.map((card) => (
                  <CardRow
                    key={card.id}
                    card={card}
                    onBalance={(cents) =>
                      mutateWallet((current) => recordBalance(current, card.id, cents))
                    }
                    onRemove={() => mutateWallet((current) => removeCard(current, card.id))}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
