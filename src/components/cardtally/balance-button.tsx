"use client";

import * as React from "react";
import { ArrowRight, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { merchantById } from "@/lib/merchants";

type Props = {
  url: string;
  phone?: string;
  merchantId?: string | null;
  number?: string;
  pin?: string;
  merchantName?: string;
};

/**
 * The hand-off, and the whole point of the app.
 *
 * CardTally cannot fetch a balance, and neither can any other web page. It was
 * worth checking rather than assuming, so it was checked: every major issuer's
 * balance page refuses a cross-origin fetch, sets `x-frame-options` and
 * `frame-ancestors 'self'` so it cannot be embedded, and screens visitors with
 * device fingerprinting. The one route left is a server pretending to be a
 * browser convincingly enough to get past fraud detection, which is the same
 * technique used to drain stolen cards.
 *
 * So the number comes from the issuer, and this button removes every step
 * between you and it: their page opens, and the digits are already on your
 * clipboard so there is nothing to type or read back off the card.
 *
 * `window.open` runs first and synchronously. A popup blocker vetoes any window
 * opened from inside a promise callback, so the clipboard write has to come
 * after, not before.
 */
export function BalanceButton({ url, phone, merchantId, number, pin, merchantName }: Props) {
  const { toast } = useToast();
  const merchant = merchantById(merchantId);
  const who = merchantName || merchant?.name || "the issuer";

  const go = React.useCallback(() => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");

    if (!number) {
      toast({
        title: "Opened the balance page",
        description: "No number was read, so keep the card to hand.",
      });
      return;
    }

    const payload = pin ? `${number}\t${pin}` : number;
    navigator.clipboard?.writeText(payload).then(
      () =>
        toast({
          title: pin ? "Number and PIN copied" : "Number copied",
          description: pin
            ? "Paste into the number field, then tab across and paste again."
            : "Paste it into their balance form.",
        }),
      () =>
        toast({
          title: "Opened the balance page",
          description: "The clipboard was blocked, so you will have to type the number.",
        }),
    );
  }, [url, number, pin, toast]);

  if (!url && !phone) return null;

  return (
    <div className="flex flex-col gap-2">
      {url ? (
        <Button size="lg" className="h-12 w-full justify-between gap-2 text-base" onClick={go}>
          <span className="truncate">Get the balance from {who}</span>
          <ArrowRight className="size-4 shrink-0" />
        </Button>
      ) : null}

      <p className="text-center text-[11px] leading-snug text-muted-foreground">
        Opens {who}&apos;s own page with your digits copied. Only they know the balance — no
        website can look it up for you.
      </p>

      {phone ? (
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
          <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>
            <Phone className="size-3.5" />
            Or call {phone}
          </a>
        </Button>
      ) : null}

      {merchant?.note ? (
        <p className="text-center text-[11px] leading-snug text-muted-foreground">{merchant.note}</p>
      ) : null}
    </div>
  );
}
