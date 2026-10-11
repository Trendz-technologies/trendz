"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { clsx } from "clsx";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { Button, Select } from "@/components/ui";

/** "3*CODE" scans CODE three times; anything else is one unit. */
export function parseScan(raw: string): { code: string; quantity: number } | null {
  const text = raw.trim();
  if (!text) return null;
  const m = /^(\d{1,3})\s*\*\s*(.+)$/.exec(text);
  if (m) return { code: m[2]!, quantity: Math.max(1, Math.min(999, Number(m[1]))) };
  return { code: text, quantity: 1 };
}

const isEditable = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

export interface ScannerInputHandle {
  focus: () => void;
}

/**
 * Keyboard-wedge (USB / Bluetooth) scanner input. Scanners "type" the code and
 * press Enter, so the field keeps focus whenever nothing else is being edited,
 * and stray keystrokes while focus is on the page are routed into it.
 */
export const ScannerInput = forwardRef<ScannerInputHandle, { onScan: (code: string, quantity: number) => void; busy?: boolean; paused?: boolean }>(function ScannerInput(
  { onScan, busy, paused },
  ref,
) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

  // Re-focus after blur unless the cashier moved to another field or a dialog is open.
  const refocus = useCallback(() => {
    window.setTimeout(() => {
      if (paused) return;
      if (document.querySelector("[role=dialog]")) return;
      if (isEditable(document.activeElement) && document.activeElement !== input.current) return;
      input.current?.focus({ preventScroll: true });
    }, 120);
  }, [paused]);

  useEffect(() => {
    if (!paused) input.current?.focus({ preventScroll: true });
  }, [paused]);

  // Route printable keys typed "into the page" (e.g. after clicking a button) to the scanner field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (isEditable(document.activeElement) || document.querySelector("[role=dialog]")) return;
      input.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [paused]);

  const submit = () => {
    const parsed = parseScan(value);
    setValue("");
    if (parsed) onScan(parsed.code, parsed.quantity);
  };

  return (
    <div className="relative">
      <ScanLine size={18} className={clsx("pointer-events-none absolute left-4 top-1/2 -translate-y-1/2", busy ? "animate-pulse text-ink" : "text-ink/40")} />
      <input
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        onBlur={refocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        aria-label="Scan a barcode or QR code, or type a SKU and press Enter"
        placeholder="Scan barcode / QR or type SKU + Enter   (3*SKU for quantity 3)"
        className="h-14 w-full rounded-2xl border-2 border-ink/80 bg-white pl-12 pr-4 font-mono text-base tracking-wide outline-none transition placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-ink/40 focus:border-ink focus:ring-4 focus:ring-accent/25"
      />
    </div>
  );
});

/**
 * Camera scanning through @zxing/browser (QR, EAN-13, UPC, Code 128 …).
 * Continuous mode keeps the camera running and ignores the same code for a
 * short cool-down so one physical scan is not counted twice.
 */
export function CameraScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [continuous, setContinuous] = useState(true);
  const continuousRef = useRef(continuous);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
    continuousRef.current = continuous;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access needs a secure (HTTPS) connection and a browser with camera support.");
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 400 });
        const ctl = await reader.decodeFromConstraints(
          { video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } } },
          video.current ?? undefined,
          (result) => {
            if (!result) return;
            const code = result.getText();
            const now = Date.now();
            if (code === last.current.code && now - last.current.at < 1800) return;
            last.current = { code, at: now };
            setFlash(true);
            window.setTimeout(() => setFlash(false), 180);
            onScanRef.current(code);
            if (!continuousRef.current) {
              controls.current?.stop();
              onCloseRef.current();
            }
          },
        );
        if (cancelled) {
          ctl.stop();
          return;
        }
        controls.current = ctl;
        setError(null);
        const { BrowserCodeReader } = await import("@zxing/browser");
        const list = await BrowserCodeReader.listVideoInputDevices().catch(() => []);
        if (!cancelled) setDevices(list);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access for this site in the browser settings."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "The camera could not be started. It may be in use by another app.",
        );
      }
    })();
    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [deviceId]);

  return (
    <div className="space-y-3">
      <div className={clsx("relative overflow-hidden rounded-2xl bg-night transition", flash && "ring-4 ring-success")}>
        <video ref={video} className="aspect-video w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-danger/70 shadow-[0_0_12px_rgba(220,38,38,0.8)]" />
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-night/85 p-6 text-center text-sm text-pearl">
            <CameraOff size={22} />
            {error}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {devices.length > 1 && (
          <Select aria-label="Camera" value={deviceId ?? ""} onChange={(e) => setDeviceId(e.target.value || undefined)} className="max-w-56">
            <option value="">Default camera</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </Select>
        )}
        <div role="radiogroup" aria-label="Scan mode" className="flex rounded-full bg-offwhite p-1 text-xs font-semibold">
          {[
            { v: true, label: "Continuous" },
            { v: false, label: "Single scan" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={continuous === o.v}
              onClick={() => setContinuous(o.v)}
              className={clsx("rounded-full px-3 py-1.5 transition", continuous === o.v ? "bg-ink text-white" : "text-ink/60")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" icon={<Camera size={14} />} className="ml-auto" onClick={onClose}>
          Close camera
        </Button>
      </div>
      <p className="text-xs text-ink/50">
        {continuous ? "Keep scanning items one after another. The same code is ignored for about two seconds to avoid double counting." : "The camera closes after one successful scan."}
      </p>
    </div>
  );
}
