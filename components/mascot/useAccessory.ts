"use client";

import { useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "@/components/ui/storage";
import { PIP_ACCESSORY_KEY, parseAccessory, type AccessoryId } from "./wardrobe";

// The user's chosen accessory, saved in this browser. Every Pip on the page
// (dock, strip, onboarding) updates together, and other tabs follow via "storage".

const CHANGED = "bp-pip-accessory";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function usePipAccessory(): AccessoryId {
  return useSyncExternalStore(
    subscribe,
    () => parseAccessory(readStorage(PIP_ACCESSORY_KEY)),
    () => "none",
  );
}

export function setPipAccessory(id: AccessoryId) {
  writeStorage(PIP_ACCESSORY_KEY, id);
  window.dispatchEvent(new Event(CHANGED));
}
