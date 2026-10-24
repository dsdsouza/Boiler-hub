import type { AccessoryId } from "./wardrobe";

// Drawn in Mascot's viewBox. On the small Pip, hats sit centered on the brass rim with the
// chimney poking up through the top, so steam still rises; nothing covers the face, gauge eye or water.
// PipHero perches them on the boiler's free shoulder instead (stack "none").

const BRASS = "#D1A85A";
const BRASS_DARK = "#8C6A35";
const COPPER = "#C8643B";
const INK = "#15120E";
const HAT = "#2A231B";
/** Lifts dark hats off the dark app background. */
const EDGE = "#7A6750";

/** "copper": the hat sits over Pip's chimney (Mascot.tsx). "none": no chimney through it (PipHero). */
export type Stack = "copper" | "none";

/** The top of Pip's chimney, redrawn over a hat so it reads as coming through it. */
function ChimneyTop({ from, stack }: { from: number; stack: Stack }) {
  if (stack === "none") return null;
  return (
    <>
      <rect x="54" y="13" width="12" height={from - 13} fill={COPPER} />
      <rect x="50" y="9" width="20" height="6" rx="2" fill={BRASS} />
    </>
  );
}

export function Accessory({ id, detail, stack = "copper" }: { id: AccessoryId; detail: boolean; stack?: Stack }) {
  switch (id) {
    case "top-hat":
      return (
        <g>
          <rect x="35" y="28.5" width="50" height="6" rx="3" fill={HAT} stroke={EDGE} strokeWidth="1.4" />
          <rect x="41" y="12" width="38" height="18.5" rx="2" fill={HAT} stroke={EDGE} strokeWidth="1.4" />
          <rect x="41.7" y="23" width="36.6" height="5" fill={COPPER} />
          {detail && <rect x="44" y="14.5" width="4" height="7.5" rx="2" fill="#fff" opacity="0.14" />}
          <ChimneyTop from={13} stack={stack} />
        </g>
      );
    case "engineer-cap":
      return (
        <g>
          <path d="M36 32 C36 12 84 12 84 32 Z" fill="#3E5F7E" stroke="#2C4660" strokeWidth="1.2" />
          {detail && <path d="M44 19.5 V31 M52 15.5 V31 M68 15.5 V31 M76 19.5 V31" stroke="#C9D8E6" strokeWidth="1.6" opacity="0.6" />}
          <path d="M38 30.5 Q24 30 19 35 H42 Z" fill="#2C4660" />
          <rect x="35" y="29" width="50" height="4.5" rx="2.25" fill="#2C4660" />
          <ChimneyTop from={16} stack={stack} />
        </g>
      );
    case "grad-cap":
      return (
        <g>
          <rect x="42" y="21" width="36" height="12" rx="2.5" fill={HAT} stroke={EDGE} strokeWidth="1.4" />
          <polygon points="24,20 60,9 96,20 60,31" fill={HAT} stroke={EDGE} strokeWidth="1.4" strokeLinejoin="round" />
          <ChimneyTop from={14} stack={stack} />
          {stack === "none" && <circle cx="60" cy="20" r="2.6" fill={BRASS} />}
          <path d="M66 18 Q84 19 88 22 V34" fill="none" stroke={BRASS} strokeWidth={detail ? 1.6 : 2.4} strokeLinecap="round" />
          <rect x="85.5" y="33" width="5" height={detail ? 8 : 6} rx="1.5" fill={BRASS} />
        </g>
      );
    case "hard-hat":
      return (
        <g>
          <path d="M37 32 C37 11 83 11 83 32 Z" fill="#F0B429" />
          <rect x="31" y="28.5" width="58" height="5.5" rx="2.75" fill="#C98F14" />
          {detail && <path d="M42 28 C42 18 48 14 54 13 M78 28 C78 18 72 14 66 13" fill="none" stroke="#C98F14" strokeWidth="2" strokeLinecap="round" />}
          <ChimneyTop from={14} stack={stack} />
        </g>
      );
    case "goggles":
      return (
        <g>
          <rect x="18" y="34" width="84" height="5" rx="2.5" fill="#5A4632" />
          <rect x="45" y="35" width="30" height="3" fill={BRASS_DARK} />
          <circle cx="37" cy="36.5" r="8.5" fill="#7FB3D5" fillOpacity="0.55" stroke={BRASS_DARK} strokeWidth={detail ? 3 : 3.8} />
          <circle cx="83" cy="36.5" r="8.5" fill="#7FB3D5" fillOpacity="0.55" stroke={BRASS_DARK} strokeWidth={detail ? 3 : 3.8} />
          {detail && <path d="M33 33.2 l3 -1.5 M79 33.2 l3 -1.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />}
        </g>
      );
    case "bow-tie":
      return (
        <g>
          <path d="M60 49 L45 41.5 V56.5 Z M60 49 L75 41.5 V56.5 Z" fill={COPPER} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          {detail && <path d="M50 45.5 l4 3.5 l-4 3.5 M70 45.5 l-4 3.5 l4 3.5" fill="none" stroke="#9E4A2A" strokeWidth="1.2" strokeLinecap="round" />}
          <rect x="56.5" y="45.5" width="7" height="7" rx="2" fill={BRASS} stroke={INK} strokeWidth="1.4" />
        </g>
      );
    case "none":
      return null;
  }
}
