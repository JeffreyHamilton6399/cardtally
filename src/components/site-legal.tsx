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

      <h3>What is stored, and where</h3>
      <p>
        Cards you add are kept in this browser&apos;s <strong>localStorage</strong>,
        on this device. They are not synced, backed up, or visible to anyone
        else. Clearing site data deletes them, and so does clearing your browser
        history in most browsers.
      </p>
      <p>
        By default a saved card keeps only its last four digits. The full number
        and PIN are stored only for cards where you tick the box that says so.
        Be deliberate about that: <strong>localStorage is not encrypted</strong>,
        and a gift card number with its PIN can be spent by anyone holding both.
        On a shared or work machine, leave it off.
      </p>

      <h3>Checking a balance means leaving this page</h3>
      <p>
        CardTally cannot read your balance. Only the company that issued the card
        knows it, and they publish it on their own site. When you check a
        balance, a new tab opens on <strong>the issuer&apos;s own page</strong> and
        your card details go onto your clipboard so you can paste them there.
      </p>
      <p>
        From that point you are on their website, under their privacy policy, not
        this one. CardTally does not send them anything, cannot see what you type
        there, and never learns the result — that is why you type the balance
        back in yourself.
      </p>

      <h3>No tracking</h3>
      <p>
        There are no analytics, no advertising trackers, no cookies and no
        fingerprinting. The only outside request the page makes is to Google
        Fonts for its typefaces.
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
        CardTally is a free, browser-based tool for reading gift cards and
        keeping track of them. It is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;, with no warranty of any kind.
      </p>

      <h3>It reads cards. It does not value them.</h3>
      <p>
        <strong>
          A balance shown here is one you typed in, not one CardTally looked up.
        </strong>{" "}
        It is a note to yourself, and it goes out of date the moment the card is
        spent. Before relying on a balance — at a till, or when selling or giving
        a card away — check it with the issuer.
      </p>
      <p>
        Scanning is a best effort. Text recognition on foil, gloss and small
        print gets digits wrong, which is why every scan is shown to you for
        checking rather than saved automatically. Confirm the number against the
        card before you use it.
      </p>

      <h3>Your cards are your responsibility</h3>
      <p>
        Cards are stored in your browser and nowhere else. That means no one can
        take them from a server, and also that nothing can recover them: if you
        clear site data, lose the device, or use a private window, they are gone.
        Keep the card itself, or your own copy of anything that matters.
      </p>
      <p>
        If you choose to store full numbers and PINs, you are choosing to keep
        spendable value in unencrypted browser storage on that device. That is
        yours to weigh.
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
        number, an out-of-date balance, an expired card, or cards lost from
        browser storage.
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
