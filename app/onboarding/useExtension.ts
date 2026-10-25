"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useExtension(extension: "calendar" | "focus") {
  const [state, setState] = useState<"checking" | "missing" | "installed">(
    "checking",
  );
  const [version, setVersion] = useState("");
  const request = useRef("");
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const check = useCallback(() => {
    request.current = crypto.randomUUID();
    setState("checking");
    if (timeout.current) clearTimeout(timeout.current);
    window.postMessage(
      { type: "bp-extension:ping", extension, nonce: request.current },
      location.origin,
    );
    timeout.current = setTimeout(() => setState("missing"), 1800);
  }, [extension]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        data?.type !== "bp-extension:pong" ||
        data.extension !== extension ||
        data.nonce !== request.current ||
        typeof data.version !== "string"
      )
        return;
      if (timeout.current) clearTimeout(timeout.current);
      setState("installed");
      setVersion(data.version.slice(0, 24));
    };
    window.addEventListener("message", receive);
    window.addEventListener("focus", check);
    check();
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("focus", check);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [check, extension]);
  return { state, version, check };
}
