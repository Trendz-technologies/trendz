"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { clsx } from "clsx";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui";
import { HEX_COLOR, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type Rgb } from "@/lib/theme";

type Hsv = [hue: number, saturation: number, value: number];

const toHex = ([h, s, v]: Hsv) => rgbToHex(hsvToRgb(h, s, v));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Where a pointer is inside an element, as fractions 0–1. */
function fraction(e: { clientX: number; clientY: number }, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
}

const ARROWS: Record<string, [dx: number, dy: number] | undefined> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

const THUMB = "pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pearl shadow-[0_0_0_1.5px_rgb(0_0_0/0.45),0_2px_6px_rgb(0_0_0/0.4)]";
const TRACK = "relative touch-none select-none outline-none focus-visible:ring-4 focus-visible:ring-accent/35";

/**
 * Saturation / brightness area with a vertical hue slider. Works with a mouse,
 * touch and the arrow keys (Shift for bigger steps).
 */
export function ColorPicker({ value, onChange, disabled }: { value: string; onChange: (hex: string) => void; disabled?: boolean }) {
  // Hue, saturation and brightness are kept here so the hue survives a trip through grey or black.
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(value)));
  // Follow outside changes (swatches, a typed HEX, discard) without an effect.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (toHex(hsv) !== value) {
      const [h, s, v] = rgbToHsv(hexToRgb(value));
      setHsv(v === 0 ? [hsv[0], hsv[1], 0] : s === 0 ? [hsv[0], 0, v] : [h, s, v]);
    }
  }
  const [h, s, v] = hsv;

  const update = (next: Hsv) => {
    setHsv(next);
    onChange(toHex(next));
  };

  const dragArea = (e: PointerEvent<HTMLDivElement>) => {
    const { x, y } = fraction(e, e.currentTarget);
    update([h, x, 1 - y]);
  };
  const dragHue = (e: PointerEvent<HTMLDivElement>) => update([fraction(e, e.currentTarget).y * 360, s, v]);
  /** Pointer handlers for a draggable track: follow the pointer from press until release. */
  const drag = (move: (e: PointerEvent<HTMLDivElement>) => void) =>
    disabled
      ? {}
      : {
          onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          },
          onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
          },
        };

  const keyArea = (e: KeyboardEvent) => {
    const d = ARROWS[e.key];
    if (!d || disabled) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.1 : 0.01;
    update([h, clamp01(s + d[0] * step), clamp01(v + d[1] * step)]);
  };
  const keyHue = (e: KeyboardEvent) => {
    const d = ARROWS[e.key];
    if (!d || disabled) return;
    e.preventDefault();
    // Down / right move towards 360°, matching the slider's direction.
    update([Math.min(360, Math.max(0, h + (d[0] - d[1]) * (e.shiftKey ? 15 : 2))), s, v]);
  };

  return (
    <div className={clsx("flex gap-3", disabled && "opacity-60")}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s * 100)}
        aria-valuetext={`Saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`}
        onKeyDown={keyArea}
        {...drag(dragArea)}
        className={clsx(TRACK, "h-44 flex-1 rounded-xl border border-black/10", !disabled && "cursor-crosshair")}
        style={{ backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${toHex([h, 1, 1])})` }}
      >
        <span className={THUMB} style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: value }} />
      </div>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label="Hue"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(h)}
        aria-valuetext={`${Math.round(h)}°`}
        onKeyDown={keyHue}
        {...drag(dragHue)}
        className={clsx(TRACK, "h-44 w-4 shrink-0 rounded-full border border-black/10", !disabled && "cursor-pointer")}
        style={{ backgroundImage: "linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      >
        <span className={THUMB} style={{ left: "50%", top: `${(h / 360) * 100}%`, background: toHex([h, 1, 1]) }} />
      </div>
    </div>
  );
}

/** "#RRGGBB" from typed text; 3-digit shorthand (#f0a) only when `shorthand` is allowed. */
function parseHex(text: string, shorthand = false): string | null {
  const t = `#${text.trim().replace(/^#/, "")}`.toLowerCase();
  if (HEX_COLOR.test(t)) return t;
  if (shorthand && /^#[0-9a-f]{3}$/.test(t)) return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  return null;
}

/** HEX text box: applies a colour as soon as six digits are typed, and tidies up on blur. */
export function HexInput({ id, value, onChange, disabled }: { id: string; value: string; onChange: (hex: string) => void; disabled?: boolean }) {
  const [text, setText] = useState(value.toUpperCase());
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (parseHex(text) !== value) setText(value.toUpperCase());
  }
  return (
    <input
      id={id}
      className="input font-mono uppercase tracking-wider"
      value={text}
      disabled={disabled}
      maxLength={7}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="characters"
      onChange={(e) => {
        setText(e.target.value);
        const hex = parseHex(e.target.value);
        if (hex) onChange(hex);
      }}
      onBlur={() => {
        const hex = parseHex(text, true);
        if (hex && hex !== value) onChange(hex);
        setText((hex ?? value).toUpperCase());
      }}
    />
  );
}

/** Red, green and blue as numbers 0–255. */
export function RgbInputs({ value, onChange, disabled }: { value: string; onChange: (hex: string) => void; disabled?: boolean }) {
  const rgb = hexToRgb(value);
  return (
    <div className="grid grid-cols-3 gap-3">
      {(["R", "G", "B"] as const).map((channel, i) => (
        <div key={channel}>
          <label htmlFor={`rgb-${channel}`} className="label">
            {channel}
          </label>
          <input
            id={`rgb-${channel}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={255}
            disabled={disabled}
            className="input font-mono"
            value={rgb[i]}
            onChange={(e) => {
              const next = [...rgb] as Rgb;
              next[i] = Math.min(255, Math.max(0, Math.round(Number(e.target.value) || 0)));
              onChange(rgbToHex(next));
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions); the value stays selectable in the box.
    }
  };
  return (
    <Button variant="outline" icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={() => void copy()} aria-label={`Copy ${value}`}>
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}
