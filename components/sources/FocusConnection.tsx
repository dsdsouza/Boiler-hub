"use client";

import { StudyAccountability } from "@/components/boiler/StudyAccountability";
import { useMyBoiler } from "@/components/boiler/useMyBoiler";
import { useStudyAccountability } from "@/components/boiler/useStudyAccountability";
import { usePipConversation } from "@/components/mascot/PipConversation";

/** Reuse the verified owner's workload and conversation on Connect. */
export function FocusConnection({ userId }: { userId: string }) {
  const boiler = useMyBoiler("api", userId);
  const study = useStudyAccountability(boiler);
  const { openChat } = usePipConversation();
  return <StudyAccountability boiler={boiler} study={study} onAsk={openChat} />;
}
