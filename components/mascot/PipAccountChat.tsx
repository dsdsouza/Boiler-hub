"use client";

import { useState } from "react";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";
import { useStudyAccountability } from "@/components/boiler/useStudyAccountability";
import type { StudyProposal } from "@/lib/pip/planning";
import { PipChat } from "./PipChat";
import { usePipConversation } from "./PipConversation";

/** Load owner state only while the floating chat is open; use the shared page cache. */
export function PipAccountChat({ userId }: { userId: string }) {
  const boiler = useMyBoiler("api", userId);
  const study = useStudyAccountability(boiler);
  const { dismissProposal } = usePipConversation();
  const [error, setError] = useState("");
  const accept = (proposal: StudyProposal) => {
    const task = boiler.data?.items.find((item) => item.id === proposal.taskId && item.kind === "task" && !item.doneAt);
    const now = Date.now();
    if (!task) { setError("That task is no longer open. Ask Pip for an updated plan."); return; }
    if (!study.blocker.connected || !study.blocker.remindersSupported || !study.blocker.remindersEnabled) { setError("Pair the Pip extension and enable laptop reminders in Connect → Focus with Pip first."); return; }
    if (proposal.startAt < now - 60000 || proposal.endAt <= now + 60000) { setError("That study time has passed. Ask Pip for a new window."); return; }
    study.send({ id: crypto.randomUUID(), taskId: task.id, title: task.title.slice(0, 200), goal: proposal.goal, startAt: Math.max(now, proposal.startAt), endAt: proposal.endAt, demo: false, scope: "account" });
    setError(""); dismissProposal();
  };
  return <>
    <PipChat studyContext={study.context} remindersReady={Boolean(study.blocker.connected && study.blocker.remindersSupported && study.blocker.remindersEnabled)} replacing={Boolean(study.session && !study.session.outcome)} onAcceptProposal={accept} />
    {error && <p role="alert" className="m-0 mt-2 text-sm text-hot-ink">{error}</p>}
  </>;
}
