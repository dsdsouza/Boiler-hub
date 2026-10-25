import type { EngineRoomView } from "../../lib/data/teams";

export const teamUiRoom: EngineRoomView = {
  team: { id: "00000000-0000-4000-a000-000000000030", name: "Heys", type: "work" },
  myRole: "lead", myUserId: "ari", myVisibility: "hidden", memberCount: 4, hiddenCount: 0, inviteCode: "ABC123",
  boilers: [
    { userId: "ari", name: "Ari", score: 95, zone: "redline", status: "running_hot", isLead: true, synced: true },
    { userId: "bea", name: "Bea", score: 80, zone: "hot", status: "heads_down", isLead: false, synced: true },
    { userId: "cam", name: "Cam", score: 30, zone: "cool", status: "open", isLead: false, synced: true },
    { userId: "new", name: "New member", score: 0, zone: "cool", status: "away", isLead: false, synced: false },
  ].map(boiler => ({ ...boiler, counts: { meetings: 3, meetingHours: 3, tasksDue: 19, overdue: 4 }, updatedAt: new Date().toISOString() })) as EngineRoomView["boilers"],
};
