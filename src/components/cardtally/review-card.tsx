"use client";

import * as React from "react";
import { AlertTriangle, Barcode, Check, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { parseMoney } from "@/lib/format";
import { merchantById, merchants } from "@/lib/merchants";
import type { CardDraft } from "@/lib/wallet";
import { BalanceButton } from "@/components/cardtally/balance-button";

const OTHER = "__other__";

type Props = {
  parsed: ParsedCard;
  onSave: (draft: CardDraft) => void;
  onDiscard: () => void;
};

/**
 * Confirm what the scan thought it saw.
 *
 * Every field is editable and nothing saves itself. OCR on a foil card is
 * good enough to save real typing and not good enough to trust silently, so
 * the honest interface is one that shows its work: where each value came from,
 * how sure it is, and a clear flag when the checksum says a digit is wrong.
 */
export function ReviewCard({ parsed, onSave, onDiscard }: Props) {
  const [merchantId, setMerchantId] = React.useState(parsed.merchant?.id ?? OTHER);
  const [label, setLabel] = React.useState(parsed.merchant?.name ?? "");
  const [number, setNumber] = React.useState(parsed.number);
  const [pin, setPin] = React.useState(parsed.pin);
  const [expires, setExpires] = React.useState(parsed.expires);
  const [url, setUrl] = React.useState(parsed.url);
  const [balance, setBalance] = React.useState("");
  const [keepSecrets, setKeepSecrets] = React.useState(false);

  const digits = number.replace(/\D/g, "");
  const checksumFails = digits.length >= 13 && !luhnValid(digits);

  // Switching brand should follow through to the things the brand decides,
  // but never stamp on a URL the card itself printed.
  function pickMerchant(id: string) {
    setMerchantId(id);
    const merchant = merchantById(id === OTHER ? null : id);
    if (merchant) {
      if (!label || merchants.some((m) => m.name === label)) setLabel(merchant.name);
      if (!parsed.url || parsed.url === parsed.merchant?.balanceUrl) setUrl(merchant.balanceUrl);
    }
  }

  function save() {
    onSave({
      merchantId: merchantId === OTHER ? null : merchantId,
      label: label.trim() || "Gift card",
      last4: digits.slice(-4),
      number: digits,
      pin: pin.replace(/\D/g, ""),
      keepSecrets,
      balanceCents: parseMoney(balance),
      currency: "USD",
      checkedAt: parseMoney(balance) === null ? null : new Date().toISOString(),
      expires: expires.trim(),
      url: url.trim(),
      phone: parsed.phone,
      note: "",
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <ReadStatus parsed={parsed} checksumFails={checksumFails} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand">
          <Select value={merchantId} onValueChange={pickMerchant}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              {merchants.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
              <SelectItem value={OTHER}>Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Name it">
          <Input
            className="h-8 text-sm"
            value={label}
            placeholder="Gift card"
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>

        <Field label="Card number" className="sm:col-span-2">
          <Input
            className={cn("h-8 font-mono text-sm", checksumFails && "border-destructive")}
            value={groupDigits(digits)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Type it if the scan missed it"
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>

        <Field label="PIN">
          <Input
            className="h-8 font-mono text-sm"
            value={pin}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Under the scratch-off"
            onChange={(e) => setPin(e.target.value)}
          />
        </Field>

        <Field label="Expires">
          <Input
            className="h-8 font-mono text-sm"
            value={expires}
            placeholder="MM/YY"
            onChange={(e) => setExpires(e.target.value)}
          />
        </Field>

        <Field label="Balance page" className="sm:col-span-2">
          <Input
            className="h-8 text-sm"
            value={url}
            placeholder="https://"
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>

        <Field label="Balance, once you have checked">
          <Input
            className="h-8 font-mono text-sm"
            value={balance}
            inputMode="decimal"
            placeholder="$0.00"
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>
      </div>

      {url ? (
        <div className="rounded-md border border-dashed p-2.5">
          <p className="mb-2 text-xs text-muted-foreground">
            CardTally cannot read the balance itself — only the issuer knows it. This opens their
            page with your digits on the clipboard.
          </p>
          <BalanceButton
            url={url}
            phone={parsed.phone}
            merchantId={merchantId === OTHER ? null : merchantId}
            number={digits}
            pin={pin}
          />
        </div>
      ) : null}

      <label className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
        <Checkbox
          checked={keepSecrets}
          onCheckedChange={(v) => setKeepSecrets(v === true)}
          className="mt-0.5"
        />
        <span className="text-xs leading-snug">
          <span className="font-medium">Remember the number and PIN on this device.</span>{" "}
          <span className="text-muted-foreground">
            Convenient, and a real risk: together they spend the card, and this browser stores them
            unencrypted. Left off, only the last four digits are kept.
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <Button size="sm" className="gap-1.5" onClick={save}>
          <Check className="size-3.5" />
          Add to wallet
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
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
        The checksum on that number does not add up, so a digit is probably misread. Compare it with
        the card.
      </Status>
    );
  }
  if (parsed.source === "barcode") {
    return (
      <Status tone="good" icon={Barcode}>
        Read from the barcode, so the number is exact. The PIN is not in the barcode — check it
        yourself.
      </Status>
    );
  }
  if (parsed.source === "text" && parsed.confidence >= 0.6) {
    return (
      <Status tone="good" icon={ScanLine}>
        Read from the print and the checksum agrees. Worth a glance anyway.
      </Status>
    );
  }
  if (parsed.source === "text") {
    return (
      <Status tone="warn" icon={ScanLine}>
        Read from the print, but not confidently. Check every digit before you rely on it.
      </Status>
    );
  }
  return (
    <Status tone="warn" icon={AlertTriangle}>
      No number found in that image. Try the other side of the card, or type it in below.
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
