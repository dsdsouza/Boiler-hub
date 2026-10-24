const VISIBILITY = [
  { label: "HIDDEN", color: "#B3A48C", text: "Nobody sees your boiler. The default when you join." },
  { label: "LEAD ONLY", color: "#D1A85A", text: "Only the team’s leads or teacher see it." },
  { label: "EVERYONE", color: "#7FB3D5", text: "Everyone on that team sees your gauge and status." },
];

export function VisibilityList() {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {VISIBILITY.map((v) => (
        <li key={v.label} className="flex items-center gap-4 rounded-[10px] border border-line bg-surface px-5 py-[18px] shadow-(--shadow)">
          <span className="min-w-24 rounded-md px-2.5 py-1.5 text-center font-mono text-sm font-bold text-soot" style={{ backgroundColor: v.color }}>
            {v.label}
          </span>
          <span className="text-body">{v.text}</span>
        </li>
      ))}
    </ul>
  );
}
