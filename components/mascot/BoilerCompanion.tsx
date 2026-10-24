"use client";

import { useEffect, useRef, useState } from "react";
import type { MyBoilerData } from "@/components/boiler/boilerState";
import type { VentEvent } from "@/components/boiler/useMyBoiler";
import { Card } from "@/components/ui/Card";
import { readStorage, writeStorage } from "@/components/ui/storage";
import { ZONE_LABEL } from "@/components/ui/zones";
import { companionMessage, type CompanionTarget } from "./companionMessage";
import { Mascot } from "./Mascot";
import { PipWardrobe } from "./PipWardrobe";
import { usePipAccessory } from "./useAccessory";
import { MASCOT_NAME, PIP_HIDDEN_KEY } from "./voice";

// What Pip says inside MyBoilerView; actions jump to its
// existing headings. No avatar here: the big Pip hero on the page is the one speaking.

const VENT_MESSAGE_MS = 8000;

/** Focus the rendered section after following Pip’s suggestion. */
const TARGET_SELECTOR: Record<CompanionTarget, string> = { forecast: "#fc", breakdown: '[data-boiler-section="breakdown"] h2' };

function jumpTo(target: CompanionTarget) {
  const el = Array.from(document.querySelectorAll<HTMLElement>(TARGET_SELECTOR[target])).find((heading) => heading.getClientRects().length > 0);
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.focus({ preventScroll: true });
}

export function BoilerCompanion({ data, vent }: { data: MyBoilerData | null; vent: VentEvent }) {
  const [hidden, setHidden] = useState(false);
  const [recentVent, setRecentVent] = useState<number | null>(null);
  const [dressing, setDressing] = useState(false);
  const wardrobeButton = useRef<HTMLButtonElement>(null);
  const accessory = usePipAccessory();

  useEffect(() => setHidden(readStorage(PIP_HIDDEN_KEY) === "1"), []);

  useEffect(() => {
    if (!vent.key) return;
    setRecentVent(vent.amount);
    const t = setTimeout(() => setRecentVent(null), VENT_MESSAGE_MS);
    return () => clearTimeout(t);
  }, [vent.key, vent.amount]);

  if (!data) return null;
  const { result } = data;
  const message = companionMessage({
    score: result.score,
    zone: result.zone,
    forecast: result.forecast,
    contributions: result.contributions,
    itemCount: data.items.length,
    calendar: data.calendar,
    vented: recentVent,
  });
  if (!message) return null;

  const setHide = (h: boolean) => {
    setHidden(h);
    writeStorage(PIP_HIDDEN_KEY, h ? "1" : "0");
  };

  const closeWardrobe = () => {
    setDressing(false);
    wardrobeButton.current?.focus();
  };

  if (hidden) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setHide(false)}
          className="bp-button inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-transparent px-3 text-sm font-medium text-body hover:border-rivet hover:text-fg"
        >
          <Mascot score={result.score} size={24} accessory={accessory} />
          Show {MASCOT_NAME}
        </button>
      </div>
    );
  }

  return (
    <Card as="aside" aria-label={`${MASCOT_NAME}, your pressure companion`} className="flex items-start gap-3 py-3 pr-2 pl-4 sm:pl-5">
      <div className="grid min-w-0 flex-1 gap-x-6 gap-y-1.5 py-0.5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="font-mono text-[11px] tracking-[0.14em] text-brass-ink uppercase">
          {MASCOT_NAME} <span className="text-muted">· {ZONE_LABEL[result.zone]} {result.score}</span>
        </div>
        <div>
          <p className="m-0 text-base leading-snug font-semibold text-fg">{message.headline}</p>
          <p className="m-0 mt-0.5 text-sm leading-normal text-body">{message.body}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-start-2 sm:row-start-1 sm:row-span-2 sm:items-center">
          {message.action && (
            <button
              type="button"
              onClick={() => jumpTo(message.action!.target)}
              className="bp-button inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-rivet bg-surface-2 px-[18px] text-sm font-semibold text-fg hover:border-brass"
            >
              {message.action.label}
            </button>
          )}
          <button
            type="button"
            ref={wardrobeButton}
            onClick={() => setDressing((d) => !d)}
            aria-expanded={dressing}
            className="bp-button inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-transparent px-3 text-sm font-medium text-body hover:border-rivet hover:text-fg"
          >
            Dress up
          </button>
        </div>
        {dressing && (
          <div
            className="col-span-full mt-1 max-w-[360px] border-t border-line pt-3"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeWardrobe();
              }
            }}
          >
            <PipWardrobe score={result.score} onDone={closeWardrobe} autoFocus />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setHide(true)}
        aria-label={`Hide ${MASCOT_NAME}`}
        title={`Hide ${MASCOT_NAME}`}
        className="inline-flex min-h-11 min-w-11 flex-none cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted hover:text-fg"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </Card>
  );
}
