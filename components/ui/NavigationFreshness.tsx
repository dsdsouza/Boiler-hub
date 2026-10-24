"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Bound the age of prefetched private pages without blocking tab transitions. */
export function NavigationFreshness() {
  const pathname = usePathname();
  const router = useRouter();
  const mountedAt = useRef(Date.now());
  const checkedAt = useRef(new Map<string, number>());
  useEffect(() => {
    const privatePage = /^\/(boiler|teams|settings)(\/|$)/.test(pathname);
    const refresh = (force = false) => {
      const lastCheck = checkedAt.current.get(pathname) ?? mountedAt.current;
      if (privatePage && (force || Date.now() - lastCheck >= 30_000)) {
        checkedAt.current.set(pathname, Date.now());
        router.refresh();
      }
    };
    const focus = () => refresh();
    // Team forms already refresh their route after a successful write.
    const changed = (event: Event) => { if ((event as CustomEvent).detail?.origin !== "teams") refresh(true); };
    refresh();
    window.addEventListener("focus", focus);
    window.addEventListener("boiler:data-changed", changed);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("boiler:data-changed", changed);
    };
  }, [pathname, router]);
  return null;
}
