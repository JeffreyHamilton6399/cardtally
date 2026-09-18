"use client";

import * as React from "react";
import { Camera, ImageIcon, Loader2, SwitchCamera, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseCard, type ParsedCard } from "@/lib/card-parse";
import { scanFile, scanVideoFrame, warmUpOcr, type ScanResult } from "@/lib/scan";

type Stage = "idle" | "camera" | "working" | "error";

type Props = {
  onScanned: (card: ParsedCard, result: ScanResult) => void;
};

/** A credit card is 85.60 x 53.98 mm. Every gift card copies it. */
const CARD_RATIO = 85.6 / 53.98;

export function Scanner({ onScanned }: Props) {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState("");
  const [facing, setFacing] = React.useState<"environment" | "user">("environment");
  const [dragging, setDragging] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // The camera light staying on after someone navigates away is alarming in a
  // way no feature is worth, so the stream is torn down on unmount too.
  React.useEffect(() => stopCamera, [stopCamera]);

  // Start loading the OCR model while the user is still deciding what to do
  // with it. It is about two megabytes and the first scan feels twice as fast
  // when the download already happened.
  React.useEffect(() => {
    void warmUpOcr();
  }, []);

  const run = React.useCallback(
    async (task: () => Promise<ScanResult>) => {
      setStage("working");
      setProgress(0);
      setError("");
      try {
        const result = await task();
        const parsed = parseCard(result.text, result.barcodes);
        stopCamera();
        setStage("idle");
        onScanned(parsed, result);
      } catch (cause) {
        console.error(cause);
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "That image could not be read. Try again with more light.",
        );
        setStage("error");
      }
    },
    [onScanned, stopCamera],
  );

  const startCamera = React.useCallback(
    async (mode: "environment" | "user" = facing) => {
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser will not give a web page camera access.");
        setStage("error");
        return;
      }
      // getUserMedia is gated on a secure context. Saying so beats the browser's
      // own bare "NotAllowedError".
      if (!window.isSecureContext) {
        setError("The camera needs a secure connection. Open this page over https.");
        setStage("error");
        return;
      }

      try {
        stopCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        setFacing(mode);
        setStage("camera");
        // The <video> only exists once the camera stage has rendered.
        requestAnimationFrame(() => {
          const video = videoRef.current;
          if (!video) return;
          video.srcObject = stream;
          void video.play().catch(() => {});
        });
      } catch (cause) {
        const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
        setError(
          denied
            ? "Camera access was declined. You can still scan a photo of the card instead."
            : "No camera was available. You can scan a photo of the card instead.",
        );
        setStage("error");
      }
    },
    [facing, stopCamera],
  );

  const capture = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    void run(() => scanVideoFrame(video, setProgress));
  }, [run]);

  const handleFile = React.useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("That is not an image.");
        setStage("error");
        return;
      }
      void run(() => scanFile(file, setProgress));
    },
    [run],
  );

  // Photographing a card on a phone and pasting it on a laptop is a real path,
  // so the whole window listens for a pasted image.
  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? [])[0];
      if (file) handleFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative overflow-hidden rounded-lg border border-dashed transition-colors",
          dragging ? "border-foreground bg-accent" : "border-border",
        )}
        style={{ aspectRatio: String(CARD_RATIO) }}
      >
        {stage === "camera" ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="size-full object-cover"
            />
            {/* A frame to aim with. Cards read best filling the width. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <div className="h-full w-full rounded-md border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </>
        ) : stage === "working" ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm">Reading the card</p>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-foreground transition-[width] duration-200"
                style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Running in this tab. Nothing is being uploaded.
            </p>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Point the camera at the card, or drop a photo here.
            </p>
            <p className="text-[11px] text-muted-foreground">
              The back, where the number and the scratch-off are, reads best.
            </p>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {stage === "camera" ? (
          <>
            <Button size="sm" onClick={capture} className="gap-1.5">
              <Camera className="size-3.5" />
              Capture
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => startCamera(facing === "environment" ? "user" : "environment")}
            >
              <SwitchCamera className="size-3.5" />
              Flip
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => {
                stopCamera();
                setStage("idle");
              }}
            >
              <X className="size-3.5" />
              Stop
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={stage === "working"}
              onClick={() => startCamera()}
            >
              <Camera className="size-3.5" />
              Use camera
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={stage === "working"}
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="size-3.5" />
              Choose photo
            </Button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            // Let the same file be picked twice in a row.
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
