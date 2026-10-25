import type { Metadata } from "next";
import { getViewer } from "@/components/ui/Account";
import { OnboardingClient } from "./OnboardingClient";

export const metadata: Metadata = {
  title: "Make it your Boiler · Boilerplate",
};
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const viewer = await getViewer();
  return (
    <OnboardingClient signedIn={!!viewer} accountName={viewer?.name ?? ""} />
  );
}
