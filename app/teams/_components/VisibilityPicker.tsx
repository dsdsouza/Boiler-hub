"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Visibility } from "@/lib/types";
import { C, VISIBILITY_META } from "../_theme";
import { api } from "./api";

const LEVELS: Visibility[] = ["hidden", "lead", "everyone"];

export function VisibilityPicker({ teamId, value, leadLabel }: { teamId: string; value: Visibility; leadLabel: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function pick(next: Visibility) {
    if (next === current) return;
    const prev = current;
    setCurrent(next);
    setError(null);
    try {
      await api(`/api/teams/${teamId}/membership`, "PATCH", { visibility: next });
      startTransition(() => router.refresh());
    } catch (e) {
      setCurrent(prev);
      setError((e as Error).message);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2" aria-busy={pending}>
      <legend className="mb-1.5 text-[13px] font-medium" style={{ color: C.text2 }}>
        Who sees my boiler here
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LEVELS.map((v) => {
          const on = v === current;
          const meta = VISIBILITY_META[v];
          const label = v === "lead" ? `${leadLabel} only` : meta.label;
          const explain = v === "lead" ? `Only this team's ${leadLabel.toLowerCase()}s see your boiler.` : meta.explain;
          return (
            <label
              key={v}
              className="flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
              style={{
                border: `1px solid ${on ? C.brass : C.line}`,
                backgroundColor: on ? "#2E2517" : C.surface,
                outlineColor: C.brassLight,
              }}
            >
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: on ? C.text : C.text2 }}>
                <input
                  type="radio"
                  name={`vis-${teamId}`}
                  value={v}
                  checked={on}
                  onChange={() => pick(v)}
                  className="accent-[#D1A85A]"
                />
                {label}
              </span>
              <span className="text-xs leading-snug" style={{ color: C.muted }}>
                {explain}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm" style={{ color: "#F25C45" }}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
