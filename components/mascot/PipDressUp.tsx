"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PipWardrobe } from "./PipWardrobe";

export function PipDressUp({ score }: { score: number }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div className="border-t border-line pt-3">
      <Button ref={button} variant="ghost" className="w-full" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((value) => !value)}>
        Dress up
      </Button>
      {open && <section id={panelId} aria-label="Pip wardrobe" className="mt-3" onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}>
        <PipWardrobe score={score} onDone={close} autoFocus />
      </section>}
    </div>
  );
}
