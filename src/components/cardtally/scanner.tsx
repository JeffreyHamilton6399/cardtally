"use client";

import * as React from "react";
import { Camera, ImageIcon, Loader2, ScanLine, SwitchCamera, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseCard, type ParsedCard } from "@/lib/card-parse";
import { scanVideoFrame, scanFile, warmUpOcr, type ScanResult } from "@/lib/scan";

type Stage = "idle" | "camera" | "working" | "error";

type Props = {
  onScanned: (card: ParsedCard, result: ScanResult) => void;
};

/** A credit card is 85.60 x 53.98 mm. Every gift card copies it. */
const CARD_RATIO = 85.6 / 53.98;

/**
 * How often the camera is polled for a card, while it is running.
 *
 * The OCR pass takes roughly a second and a half on a warm worker, so polling
 * faster than this just stacks work. 900 ms is the floor that lets the previous
 * scan finish (and report back) before the next one starts, while still feeling
 * live: hold a card steady for two seconds and it is read.
 */
const POLL_MS = 900;

/**
 * The minimum OCR confidence that an auto-scan will accept on its own.
 *
 * Below this the result is shown to nobody - the loop just keeps watching.
 * The user can still tap Capture to take a frame they like the look of and
 * promote it to the editable review even when confidence is low.
 */
const AUTO_ACCEPT_CONFIDENCE = 0.55;

export function Scanner({ onScanned }: Props) {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState("");
  /** A live hint, shown over the camera, of what the auto-scan sees. */
  const [hint, setHint] = React.useState<string>("");
  const [facing, setFacing] = React.useState<"environment" | "user">("environment");
  const [dragging, setDragging] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // --- auto-scan bookkeeping -------------------------------------------------
  // The polling loop is owned by a single interval. While `inFlightRef` is
  // set, the next tick is a no-op - the worker is still busy on the last
  // frame. `cancelledRef` lets an in-flight scan be discarded when the camera
  // stops, so a slow worker never calls back into a torn-down component.
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = React.useRef(false);
  const cancelledRef = React.useRef(false);

  const stopCamera = React.useCallback(() => {
    cancelledRef.current = true;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    inFlightRef.current = false;
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

  const accept = React.useCallback(
    (result: ScanResult) => {
      const parsed = parseCard(result.text, result.barcodes);
      stopCamera();
      setStage("idle");
      setHint("");
      onScanned(parsed, result);
    },
    [onScanned, stopCamera],
  );

  const runOnce = React.useCallback(
    async (task: () => Promise<ScanResult>) => {
      setStage("working");
      setProgress(0);
      setError("");
      setHint("");
      try {
        const result = await task();
        if (cancelledRef.current) return;
        await accept(result);
      } catch (cause) {
        if (cancelledRef.current) return;
        console.error(cause);
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "That image could not be read. Try again with more light.",
        );
        setStage("error");
      }
    },
    [accept],
  );

  /**
   * Scan a single video frame and decide whether to accept it.
   *
   * The auto-scan does not surface every frame - that would flicker the result
   * view with low-confidence reads. Instead it keeps watching until something
   * looks like a real card: a barcode (which is exact) or an OCR pass with
   * enough confidence that the Luhn checksum probably agrees. The hint line
   * tells the user what the loop is doing so the camera does not look stuck.
   */
  const scanFrameAuto = React.useCallback(async () => {
    if (inFlightRef.current || cancelledRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    inFlightRef.current = true;
    try {
      setHint("Reading the frame…");
      const result = await scanVideoFrame(video, setProgress);
      if (cancelledRef.current) return;

      const parsed = parseCard(result.text, result.barcodes);

      // A decoded barcode is exact - if one is present, take the card now.
      if (parsed.source === "barcode") {
        setHint("Got the barcode — finishing up.");
        await accept(result);
        return;
      }

      // An OCR pass with a confident, Luhn-valid number is good enough to
      // promote automatically. Luhn alone is not (a misread can still pass),
      // so the confidence floor is the gate.
      if (parsed.source === "text" && parsed.confidence >= AUTO_ACCEPT_CONFIDENCE && parsed.luhn) {
        setHint("Got a clean read — finishing up.");
        await accept(result);
        return;
      }

      // Otherwise keep watching. Tell the user roughly what is missing so
      // they can adjust: glare, angle, distance.
      if (parsed.number) {
        setHint("Saw a number but the checksum disagreed. Hold the card flat and steady.");
      } else {
        setHint("Hold the card so the back fills the frame.");
      }
    } catch (cause) {
      if (cancelledRef.current) return;
      // A single bad frame is not an error worth surfacing - the loop will
      // try again on the next tick. Just reset the hint.
      console.debug("auto-scan frame failed:", cause);
      setHint("Frame was unreadable - hold steady.");
    } finally {
      inFlightRef.current = false;
    }
  }, [accept]);

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
        cancelledRef.current = false;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        setFacing(mode);
        setStage("camera");
        setHint("Point the camera at the back of the card.");
        // The <video> only exists once the camera stage has rendered.
        requestAnimationFrame(() => {
          const video = videoRef.current;
          if (!video) return;
          video.srcObject = stream;
          void video.play().catch(() => {});

          // Kick the polling loop. It runs for as long as the camera stage is
          // mounted; stopCamera tears it down.
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = setInterval(() => {
            void scanFrameAuto();
          }, POLL_MS);
          // Give the camera a moment to settle on the first frame, then take
          // an early stab at it instead of waiting a full tick.
          setTimeout(() => void scanFrameAuto(), 400);
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
    [facing, scanFrameAuto, stopCamera],
  );

  /** Force a scan on whatever the camera is showing right now. */
  const capture = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // Stop the loop so the user's manual capture is not racing an auto-scan.
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    void runOnce(() => scanVideoFrame(video, setProgress));
  }, [runOnce]);

  const handleFile = React.useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("That is not an image.");
        setStage("error");
        return;
      }
      void runOnce(() => scanFile(file, setProgress));
    },
    [runOnce],
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
            {/* The auto-scan badge. A small pulse so the user knows the loop
                is alive even while the worker is mid-scan. */}
            <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              Auto-scanning
            </div>
            {hint ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[11px] text-white/90">
                <ScanLine className="size-3 shrink-0 opacity-80" />
                <span className="truncate">{hint}</span>
              </div>
            ) : null}
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
              Capture now
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

      {stage === "camera" ? (
        <p className="text-center text-[11px] leading-snug text-muted-foreground">
          The scanner reads the camera continuously and accepts a card on its own as
          soon as the number is clear. Tap <span className="font-medium text-foreground">Capture now</span> to
          take a frame yourself.
        </p>
      ) : null}
    </div>
  );
}
