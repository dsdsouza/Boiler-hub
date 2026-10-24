"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { C, DISPLAY, MONO } from "../_theme";
import { api } from "./api";

const input =
  "min-h-11 w-full rounded-lg px-3 text-base outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2";
const inputStyle = { backgroundColor: C.field, color: C.text, border: `1px solid ${C.line}`, outlineColor: C.brassLight };
const primary = `min-h-11 rounded-lg px-4 text-xl tracking-[0.05em] disabled:opacity-50 ${DISPLAY}`;
const primaryStyle = { backgroundColor: C.brass, color: C.onFill, boxShadow: "inset 0 -3px 0 #8C6A35" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="plate flex flex-1 basis-[300px] flex-col gap-4 rounded-[14px] px-6 py-6"
      style={{ backgroundColor: C.surface, border: `1px solid ${C.rivet}` }}
    >
      <h2 className={`m-0 text-[28px] tracking-[0.03em] ${DISPLAY}`}>{title}</h2>
      {children}
    </section>
  );
}

export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"class" | "work">("work");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { team } = await api<{ team: { name: string; inviteCode: string } }>("/api/teams", "POST", { name, type });
      setName("");
      setMsg({ ok: true, text: `Created ${team.name}. Share invite code ${team.inviteCode}.` });
      startTransition(() => router.refresh());
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Create a team">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="team-name" className="text-[13px] font-medium" style={{ color: C.text2 }}>
            Name
          </label>
          <input
            id="team-name"
            className={input}
            style={inputStyle}
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
            placeholder="Product Squad, AP Bio P3…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="team-type" className="text-[13px] font-medium" style={{ color: C.text2 }}>
            Type
          </span>
          <div role="group" aria-labelledby="team-type" className="grid grid-cols-2 gap-2">
            {(["work", "class"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className="min-h-11 rounded-lg text-sm font-semibold"
                style={{
                  border: `1px solid ${type === t ? C.brass : C.line}`,
                  backgroundColor: type === t ? C.brass : C.surface,
                  color: type === t ? C.onFill : C.text2,
                }}
              >
                {t === "work" ? "Work team" : "Class"}
              </button>
            ))}
          </div>
          <p className="m-0 text-xs" style={{ color: C.muted }}>
            {type === "class" ? "You'll be the Teacher; people who join are Students." : "You'll be the Lead; people who join are Members."}
          </p>
        </div>
        <button type="submit" disabled={busy || !name.trim()} className={primary} style={primaryStyle}>
          {busy ? "Creating…" : "Create team"}
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className="m-0 text-sm" style={{ color: msg.ok ? "#7FB3D5" : "#F25C45" }}>
            {msg.text}
          </p>
        )}
      </form>
    </Panel>
  );
}

export function JoinTeamForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api<{ teamId: string }>("/api/teams/join", "POST", { code });
      setCode("");
      setMsg({ ok: true, text: "Joined. Your boiler is hidden on this team until you choose otherwise below." });
      startTransition(() => router.refresh());
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Join by code">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-code" className="text-[13px] font-medium" style={{ color: C.text2 }}>
            Invite code
          </label>
          <input
            id="invite-code"
            className={`${input} ${MONO} text-lg uppercase tracking-[0.2em]`}
            style={inputStyle}
            value={code}
            maxLength={6}
            required
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="K7Q2MX"
          />
          <p className="m-0 text-xs" style={{ color: C.muted }}>
            You join hidden. Nobody sees your boiler until you change it.
          </p>
        </div>
        <button type="submit" disabled={busy || code.length !== 6} className={primary} style={primaryStyle}>
          {busy ? "Joining…" : "Join team"}
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className="m-0 text-sm" style={{ color: msg.ok ? "#7FB3D5" : "#F25C45" }}>
            {msg.text}
          </p>
        )}
      </form>
    </Panel>
  );
}
