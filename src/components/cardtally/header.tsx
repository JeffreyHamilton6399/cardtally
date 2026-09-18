"use client";

import * as React from "react";
import Image from "next/image";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackButton } from "@/components/feedback-button";
import { SiteSettingsMenu } from "@/components/site-settings-menu";

const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";

export function Header() {
  return (
    <header className="h-12 shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Image
            src="/card-logo.svg"
            alt="CardTally logo"
            width={24}
            height={24}
            priority
            className="size-6 shrink-0"
          />
          <span className="text-sm font-semibold tracking-tight">CardTally</span>
        </div>

        <div className="flex items-center gap-1.5">
          <FeedbackButton />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
              <Heart className="size-3.5" />
              <span className="hidden sm:inline">Donate</span>
            </a>
          </Button>
          <SiteSettingsMenu />
        </div>
      </div>
    </header>
  );
}
