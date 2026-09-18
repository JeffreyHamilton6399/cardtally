"use client";

import * as React from "react";

import { loadWallet, saveWallet, type Card } from "@/lib/wallet";

/**
 * The wallet as an external store.
 *
 * localStorage cannot be read during render: the server has no localStorage, so
 * a component that reads it while rendering produces different markup on the
 * two sides and hydration tears. The usual dodge is to read it in an effect and
 * drop the result into state, which works but costs a second render pass on
 * every mount and lies about what kind of data this is.
 *
 * `useSyncExternalStore` is the fitted tool. It is built for exactly this - a
 * value that lives outside React, with a separate server snapshot - and it pays
 * for itself immediately: subscribing to the `storage` event means two tabs
 * open on CardTally stay in step, and a card added in one appears in the other
 * rather than being quietly overwritten by whichever tab is closed last.
 */

const EMPTY: Card[] = [];

/** null until the first client subscription hydrates it from storage. */
let cards: Card[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  // Another tab wrote. Re-read rather than trusting the event payload, which
  // is absent on some browsers and stale on others.
  if (event.key !== null && !event.key.startsWith("cardtally.")) return;
  cards = loadWallet();
  emit();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): Card[] {
  // Must be referentially stable between calls or React loops forever, hence
  // caching into `cards` rather than calling loadWallet() each time.
  if (cards === null) cards = loadWallet();
  return cards;
}

function getServerSnapshot(): Card[] {
  return EMPTY;
}

/** Apply a change, persist it, and wake every subscriber. */
export function mutateWallet(update: (current: Card[]) => Card[]): void {
  const next = update(getSnapshot());
  cards = next;
  saveWallet(next);
  emit();
}

export function useWallet(): Card[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
