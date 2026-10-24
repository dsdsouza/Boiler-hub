"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Mascot } from "./Mascot";
import { setPipAccessory, usePipAccessory } from "./useAccessory";
import { MASCOT_NAME } from "./voice";
import { ACCESSORIES } from "./wardrobe";

// Pick one cosmetic for Pip. Previews use the user's own score so they look like their Pip.

export function PipWardrobe({ score, onDone, autoFocus }: { score: number; onDone?: () => void; autoFocus?: boolean }) {
  const current = usePipAccessory();
  const name = useId();
  const groupRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    if (autoFocus) groupRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, [autoFocus]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Mascot score={score} size={64} reaction="wave" accessory={current} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-fg">Dress up {MASCOT_NAME}</span>
          <span className="text-xs text-muted">Just for looks, one at a time. Saved in this browser.</span>
        </div>
      </div>
      <fieldset ref={groupRef} className="m-0 border-0 p-0">
        <legend className="sr-only">{MASCOT_NAME}’s accessory</legend>
        <div className="grid grid-cols-4 gap-2">
          {ACCESSORIES.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-line bg-bg px-1 pt-1.5 pb-1 text-center text-[11px] leading-tight font-medium text-body hover:border-rivet has-[:checked]:border-brass has-[:checked]:text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-ink"
            >
              <input type="radio" name={name} value={a.id} checked={current === a.id} onChange={() => setPipAccessory(a.id)} className="sr-only" />
              <Mascot score={score} size={56} accessory={a.id} />
              <span>{a.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {onDone && (
        <div>
          <Button onClick={onDone}>Done</Button>
        </div>
      )}
    </div>
  );
}
