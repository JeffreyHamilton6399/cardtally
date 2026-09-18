"use client";

import * as React from "react";
import { FileText, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FEEDBACK_EMAIL } from "@/components/feedback-button";

export type LegalKind = "privacy" | "terms";

const LAST_UPDATED = "September 2026";

/**
 * Prose styling lives here rather than in globals.css so this dialog is
 * self-contained and drops into any of the tools unchanged.
 */
const PROSE =
  "space-y-4 px-6 py-5 [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:text-muted-foreground [&_li]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground";

function PrivacyBody() {
  return (
    <>
      <p>
        This page describes what CardTally does with what you give it, and what
        it cannot do even if it wanted to.
      </p>

      <h3>Your cards stay on your device</h3>
      <p>
        <strong>
          No photo, card number or PIN is ever uploaded, and there is no server
          here to upload it to.
        </strong>{" "}
        CardTally is a static page. It has no API routes, no database and no
        accounts.
      </p>
      <p>
        Reading a card happens entirely inside the tab. The text recognition is
        a WebAssembly build of Tesseract that runs on your own processor, and
        the engine, its model and the barcode reader are all served from this
        domain rather than fetched from anyone else, so a scan works with the
        network switched off.
      </p>

      <h3>The camera</h3>
      <p>
        The camera is used only while you are scanning, and only after your
        browser has asked you. Frames are read into memory, scanned and
        discarded. Nothing is recorded, and the stream is shut off when you stop
        scanning or leave the page.
      </p>

      <h3>Nothing is stored</h3>
      <p>
        <strong>CardTally does not save your cards.</strong> A scanned card
        lives in the page&apos;s memory until you scan another one or close the
        tab, and then it is gone. There is no wallet, no history, no database
        and no account.
      </p>
      <p>
        That is deliberate rather than a missing feature. A gift card number
        with its PIN is a bearer instrument - anyone holding both can spend it,
        and unlike a credit card there is no issuer to call and no chargeback to
        file. Browser storage is not encrypted, so the safest place for those
        digits is nowhere.
      </p>
      <p>
        The only thing kept between visits is your light or dark theme
        preference. An earlier version of CardTally could optionally remember
        cards; this one deletes anything that version left behind the first time
        you open it.
      </p>

      <h3>How a balance is checked</h3>
      <p>
        When you scan a card, CardTally&apos;s server asks the issuer for the
        balance on your behalf. The card number and PIN you scanned are sent to
        the issuer&apos;s own balance page, exactly as if you had typed them in
        yourself, and the balance that comes back is shown on this page. The
        number is held in memory only long enough to make the request and is
        not written anywhere.
      </p>
      <p>
        Not every issuer will let a server fetch their balance page: many run
        anti-bot screening that blocks the request. When that happens,
        CardTally tells you so plainly, and the button to open the issuer&apos;s
        page directly is still there so you can check the balance yourself the
        old way.
      </p>
      <p>
        From the moment you tap that button, you are on the issuer&apos;s
        website, under their privacy policy, not this one.
      </p>

      <h3>No tracking</h3>
      <p>
        There are no analytics, no advertising trackers, no cookies and no
        fingerprinting. There are no third-party requests at all: the typefaces
        and the text-recognition engine are both served from this domain, so
        opening CardTally and scanning a card contacts nobody but this site. You
        can confirm that yourself in your browser&apos;s network panel.
      </p>

      <h3>Children</h3>
      <p>
        CardTally is a general-purpose utility and does not knowingly collect
        anything from anyone, of any age, because it does not collect anything at
        all.
      </p>

      <h3>Questions</h3>
      <p>
        CardTally is open source, so you can check every claim on this page
        against the code. For anything else, email{" "}
        <a className="underline" href={`mailto:${FEEDBACK_EMAIL}`}>
          {FEEDBACK_EMAIL}
        </a>
        .
      </p>
    </>
  );
}

function TermsBody() {
  return (
    <>
      <p>
        By using CardTally, you agree to these terms. They&apos;re short on
        purpose.
      </p>

      <h3>What this is</h3>
      <p>
        CardTally is a free, browser-based tool for reading a gift card and
        getting you to the page that knows its balance. It is provided
        &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, with no warranty of
        any kind.
      </p>

      <h3>It reads cards and tries to value them.</h3>
      <p>
        <strong>CardTally asks the issuer for the balance on your behalf</strong>,
        on the same balance page you would visit yourself. It shows the balance
        here when the issuer allows it. When the issuer&apos;s anti-bot screening
        blocks the automatic request - which is common - CardTally says so and
        falls back to opening their page with your digits ready to paste.
      </p>
      <p>
        Scanning is a best effort. Text recognition on foil, gloss and small
        print gets digits wrong, which is why every scan is shown to you for
        checking rather than saved automatically. Confirm the number against the
        card before you use it.
      </p>

      <h3>Nothing is kept for you</h3>
      <p>
        CardTally does not remember your cards. Scan another one, or close the
        tab, and the last card is gone for good. Keep the card itself, or write
        the balance down somewhere of your own.
      </p>

      <h3>Fair use</h3>
      <ul>
        <li>Use CardTally only on cards you own or are entitled to use.</li>
        <li>
          Don&apos;t use it to read, store or test card numbers that are not
          yours.
        </li>
        <li>Don&apos;t use it for anything you don&apos;t have the right to do.</li>
      </ul>

      <h3>Other people&apos;s sites</h3>
      <p>
        Balance links point at retailers&apos; own pages. Those sites are not
        operated by CardTally, are not endorsed by it, and may move or change at
        any time. Retailer names and marks belong to their owners and are used
        only to identify which card is which.
      </p>

      <h3>Liability</h3>
      <p>
        To the fullest extent permitted by law, CardTally and its author are not
        liable for any loss arising from use of this tool, including a misread
        number, a balance that turns out to be wrong, or an expired card.
      </p>

      <h3>Cost</h3>
      <p>
        CardTally is free to use. There are no paid tiers, no accounts, and no
        ads.
      </p>

      <h3>Changes</h3>
      <p>
        These terms may change. The date at the top reflects the latest version,
        and continuing to use CardTally after a change constitutes acceptance of
        the updated terms.
      </p>
    </>
  );
}


/** The one legal dialog shared by every Jeffrey Hamilton tool. */
export function LegalDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: LegalKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isPrivacy = kind === "privacy";
  const Icon = isPrivacy ? ShieldCheck : FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className="size-5 text-zinc-500" />
            {isPrivacy ? "Privacy Policy" : "Terms of Service"}
          </DialogTitle>
          <DialogDescription>Last updated: {LAST_UPDATED}</DialogDescription>
        </DialogHeader>
        <div className={`max-h-[65vh] overflow-y-auto ${PROSE}`}>
          {isPrivacy ? <PrivacyBody /> : <TermsBody />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
