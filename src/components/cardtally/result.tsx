"use client";

import * as React from "react";
import { AlertTriangle, Barcode, ExternalLink, RotateCcw, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { groupDigits, luhnValid, type ParsedCard } from "@/lib/card-parse";
import { merchantById, merchants } from "@/lib/merchants";
import { useToast } from "@/hooks/use-toast";
import { InlineBalance } from "@/components/cardtally/inline-balance";

const OTHER = "__other__";

type Props = {
  parsed: ParsedCard;
  onReset: () => void;
};

/**
 * What the scan found, and the balance - right on the page.
 *
 * The fields stay editable because OCR on foil is wrong often enough that a
 * read-only display would just be a dead end - a single misread digit and the
 * issuer's form rejects the card, with nothing the user can do about it here.
 * They are laid out quietly, under the balance, because for most scans they
 * are correct and nobody needs to look at them.
 */
export function Result({ parsed, onReset }: Props) {
  const { toast } = useToast();
  const [merchantId, setMerchantId] = React.useState(parsed.merchant?.id ?? OTHER);
  const [number, setNumber] = React.useState(parsed.number);
  const [pin, setPin] = React.useState(parsed.pin);
  const [url, setUrl] = React.useState(parsed.url);

  const digits = number.replace(/\D/g, "");
  const checksumFails = digits.length >= 13 && !luhnValid(digits);
  const merchant = merchantById(merchantId === OTHER ? null : merchantId);

  function pickMerchant(id: string) {
    setMerchantId(id);
    const next = merchantById(id === OTHER ? null : id);
    // Never stamp on a URL the card itself printed - it is more specific than
    // anything the registry knows.
    if (next && (!parsed.url || parsed.url === parsed.merchant?.balanceUrl)) {
      setUrl(next.balanceUrl);
    }
  }

  // The hand-off still exists, as a fallback. When the inline check could not
  // get a balance (anti-bot, redeem flow, network), the user can still open
  // the issuer's own page in a new tab and have the digits ready to paste.
  const openExternal = React.useCallback(() => {
    const target = url || merchant?.balanceUrl;
    if (!target) {
      toast({ title: "No balance page known", description: "Pick the issuer below." });
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
    if (!digits) return;
    const payload = pin ? `${digits}\t${pin}` : digits;
    navigator.clipboard?.writeText(payload).then(
      () =>
        toast({
          title: pin ? "Number and PIN copied" : "Number copied",
          description: "Paste into the issuer's form.",
        }),
      () =>
        toast({
          title: "Opened the page",
          description: "The clipboard was blocked, so you will have to type the number.",
        }),
    );
  }, [digits, pin, url, merchant?.balanceUrl, toast]);

  return (
    <div className="flex flex-col gap-4">
      <ReadStatus parsed={parsed} checksumFails={checksumFails} />

      {/* The balance, fetched and shown inline. This is the primary action
          now: the whole reason the user scanned the card is to see this
          number. */}
      <InlineBalance
        card={parsed}
        editable={{
          merchantId: merchantId === OTHER ? null : merchantId,
          number: digits,
          pin,
          url,
        }}
        onOpenExternal={openExternal}
      />

      {/* The manual hand-off, demoted. Only here because some issuers will
          block the automatic check, and the user needs a way out. */}
      {(url || parsed.phone) && (
        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-muted-foreground"
              onClick={openExternal}
            >
              <ExternalLink className="size-3.5" />
              Open {merchant?.name ?? "the issuer"}&apos;s page
            </Button>
          ) : null}
          {parsed.phone ? (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="gap-1.5 text-muted-foreground"
            >
              <a href={`tel:${parsed.phone.replace(/[^0-9+]/g, "")}`}>
                Or call {parsed.phone}
              </a>
            </Button>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <p className="text-[11px] font-medium text-muted-foreground">
          What was read off the card. Fix anything wrong, then re-check the balance.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Card number" className="sm:col-span-2">
            <Input
              className={cn("h-9 font-mono text-sm", checksumFails && "border-destructive")}
              value={groupDigits(digits)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Type it if the scan missed it"
              onChange={(e) => setNumber(e.target.value)}
            />
          </Field>

          <Field label="PIN">
            <Input
              className="h-9 font-mono text-sm"
              value={pin}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Under the scratch-off"
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>

          <Field label="Issuer">
            <Select value={merchantId} onValueChange={pickMerchant}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Pick one" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {merchants.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Balance page" className="sm:col-span-2">
            <Input
              className="h-9 text-sm"
              value={url}
              placeholder="https://"
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <Button variant="ghost" className="gap-1.5 text-muted-foreground" onClick={onReset}>
        <RotateCcw className="size-3.5" />
        Scan another card
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** One line saying how much the scan should be trusted, and why. */
function ReadStatus({ parsed, checksumFails }: { parsed: ParsedCard; checksumFails: boolean }) {
  if (checksumFails) {
    return (
      <Status tone="warn" icon={AlertTriangle}>
        The checksum on that number does not add up, so a digit is probably misread. Compare it
        with the card before you trust the balance.
      </Status>
    );
  }
  if (parsed.source === "barcode") {
    return (
      <Status tone="good" icon={Barcode}>
        Read from the barcode, so the number is exact. A PIN is never in the barcode — check that
        one yourself.
      </Status>
    );
  }
  if (parsed.source === "text" && parsed.confidence >= 0.6) {
    return (
      <Status tone="good" icon={ScanLine}>
        Read from the print, and the checksum agrees.
      </Status>
    );
  }
  if (parsed.source === "text") {
    return (
      <Status tone="warn" icon={ScanLine}>
        Read from the print, but not confidently. Check every digit.
      </Status>
    );
  }
  return (
    <Status tone="warn" icon={AlertTriangle}>
      No number found in that image. Try the back of the card, or type it in below.
    </Status>
  );
}

function Status({
  tone,
  icon: Icon,
  children,
}: {
  tone: "good" | "warn";
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs leading-snug",
        tone === "warn" ? "border-destructive/40 text-destructive" : "text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
