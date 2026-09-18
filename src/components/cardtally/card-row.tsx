"use client";

import * as React from "react";
import { Check, Clock, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { groupDigits } from "@/lib/card-parse";
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import { isStale, type Card } from "@/lib/wallet";
import { BalanceButton } from "@/components/cardtally/balance-button";

type Props = {
  card: Card;
  onBalance: (cents: number | null) => void;
  onRemove: () => void;
};

export function CardRow({ card, onBalance, onRemove }: Props) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [revealed, setRevealed] = React.useState(false);
  const [confirmingRemove, setConfirmingRemove] = React.useState(false);

  const stale = isStale(card);

  function startEdit() {
    setDraft(card.balanceCents === null ? "" : (card.balanceCents / 100).toFixed(2));
    setEditing(true);
  }

  function commit() {
    onBalance(parseMoney(draft));
    setEditing(false);
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{card.label}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {revealed && card.number ? groupDigits(card.number) : `•••• ${card.last4 || "????"}`}
            {card.expires ? <span className="ml-2 opacity-70">exp {card.expires}</span> : null}
          </p>
        </div>

        <div className="text-right">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                className="h-7 w-24 text-right font-mono text-sm"
                value={draft}
                inputMode="decimal"
                placeholder="$0.00"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <Button size="icon" variant="ghost" className="size-7" onClick={commit}>
                <Check className="size-3.5" />
                <span className="sr-only">Save balance</span>
              </Button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="group flex flex-col items-end"
              title="Record what the balance page said"
            >
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  card.balanceCents === null && "text-muted-foreground",
                )}
              >
                {formatMoney(card.balanceCents, card.currency)}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground">
                <Pencil className="size-2.5" />
                {formatDate(card.checkedAt)}
              </span>
            </button>
          )}
        </div>
      </div>

      {stale ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          Checked {formatDate(card.checkedAt)}. Worth checking again before you count on it.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <BalanceButton
          url={card.url}
          phone={card.phone}
          merchantId={card.merchantId}
          number={card.number}
          pin={card.pin}
        />

        {card.keepSecrets && card.number ? (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {revealed ? "Hide" : "Show"}
          </Button>
        ) : null}

        {confirmingRemove ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Remove?</span>
            <Button size="sm" variant="destructive" className="h-7" onClick={onRemove}>
              Remove
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setConfirmingRemove(false)}
            >
              Keep
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmingRemove(true)}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Remove card</span>
          </Button>
        )}
      </div>

      {card.keepSecrets && revealed && card.pin ? (
        <p className="font-mono text-[11px] text-muted-foreground">PIN {card.pin}</p>
      ) : null}
    </li>
  );
}
