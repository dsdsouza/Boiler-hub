// Pip's wardrobe: one cosmetic at a time, all free, purely for looks.
// Kept free of React so the list and parsing are unit tested.

export const ACCESSORIES = [
  { id: "none", label: "None" },
  { id: "top-hat", label: "Top hat" },
  { id: "engineer-cap", label: "Engineer" },
  { id: "grad-cap", label: "Grad cap" },
  { id: "hard-hat", label: "Hard hat" },
  { id: "goggles", label: "Goggles" },
  { id: "bow-tie", label: "Bow tie" },
] as const;

export type AccessoryId = (typeof ACCESSORIES)[number]["id"];

export const PIP_ACCESSORY_KEY = "bp-pip-accessory";

/** Anything unknown (an old or edited value in storage) falls back to no accessory. */
export function parseAccessory(value: string | null | undefined): AccessoryId {
  return ACCESSORIES.some((a) => a.id === value) ? (value as AccessoryId) : "none";
}
