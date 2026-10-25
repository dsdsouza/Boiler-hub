import { redirect } from "next/navigation";

// /settings has no page of its own; Connect (sources) is the only settings screen.
export default function SettingsPage() {
  redirect("/settings/sources");
}
