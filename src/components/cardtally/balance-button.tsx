"use client";

import * as React from "react";
import { ExternalLink, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { merchantById } from "@/lib/merchants";

type Props = {
  url: string;
  phone?: string;
  merchantId?: string | null;
  number?: string;
  pin?: string;
  size?: "sm" | "default";
  label?: string;
};

/**
 * The hand-off.
 *
 * This is the one thing CardTally cannot do for you, and the design is honest
 * about it rather than pretending otherwise. A gift card balance lives on the
 * issuer's own system; there is no public API that returns it, browsers cannot
 * reach those endpoints across origins anyway, and the services that claim to
 * check any card are either scraping retailers or collecting card numbers on a
 * server. Both are worse than opening the page yourself.
 *
 * So the button does the tedious part - putting the digits on your clipboard
 * and opening the issuer's own page - and leaves the actual lookup where it
 * belongs. The number goes to the merchant, typed by you, on their site.
 *
 * `window.open` runs first and synchronously, before the clipboard write is
 * awaited, because a popup blocker will veto any window opened out of a promise
 * callback.
 */
export function BalanceButton({
  url,
  phone,
  merchantId,
  number,
  pin,
  size = "sm",
  label = "Check balance",
}: Props) {
  const { toast } = useToast();
  const merchant = merchantById(merchantId);

  const go = React.useCallback(() => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");

    if (!number) {
      toast({
        title: "Opened the balance page",
        description: "This card's number is not stored here, so have the card handy.",
      });
      return;
    }

    const payload = pin ? `${number}\t${pin}` : number;
    navigator.clipboard?.writeText(payload).then(
      () =>
        toast({
          title: pin ? "Number and PIN copied" : "Number copied",
          description: pin
            ? "Paste into the number field, then tab across and paste again for the PIN."
            : "Paste it into the balance form.",
        }),
      () =>
        toast({
          title: "Opened the balance page",
          description: "The clipboard was blocked, so you will need to type the number.",
        }),
    );
  }, [url, number, pin, toast]);

  if (!url && !phone) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {url ? (
          <Button size={size} variant="outline" className="gap-1.5" onClick={go}>
            <ExternalLink className="size-3.5" />
            {label}
          </Button>
        ) : null}
        {phone ? (
          <Button size={size} variant="ghost" asChild className="gap-1.5 text-muted-foreground">
            <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>
              <Phone className="size-3.5" />
              {phone}
            </a>
          </Button>
        ) : null}
      </div>
      {merchant?.note ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{merchant.note}</p>
      ) : null}
    </div>
  );
}
