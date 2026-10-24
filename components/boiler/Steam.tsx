"use client";

import { useEffect, useRef } from "react";
import type { Zone } from "@/lib/types";
import { TANK_PATH, VIEW, steamParams } from "./geometry";

// Canvas particle layer for steam and sight-glass bubbles. One rAF loop per
// boiler, paused when off screen. Coordinates are boiler viewBox units; the
// canvas extends PAD_TOP units above the SVG so plumes can rise past it.

export const PAD_TOP = 70;

interface Particle {
  kind: "puff" | "bubble" | "jet";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r0: number;
  r1: number;
  a0: number;
  /** Horizontal stretch for side-vent ellipses. */
  sx: number;
  /** Bubble: surface y where it pops; wobble phase. */
  top: number;
  phase: number;
}

interface SteamProps {
  score: number;
  zone: Zone;
  /** Liquid surface y, so bubbles pop at the waterline. */
  level: number;
  active: boolean;
  /** Increment to fire a vent burst (task completed). */
  vent: number;
  /** Increment to fire a whistle jet (crossed 90). */
  whistle: number;
  /** Called when the boiler scrolls in or out of view, so the rest of it can pause too. */
  onVisibility?: (visible: boolean) => void;
}

const MAX_PARTICLES = 160;

function makeSprite(color: string) {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.45, color + "8c");
  grad.addColorStop(1, color + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function toHex(color: string) {
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + [...c.slice(1)].map((ch) => ch + ch).join("");
  return "#ece6da";
}

export function Steam({ score, zone, level, active, vent, whistle, onVisibility }: SteamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibilityCb = useRef(onVisibility);
  visibilityCb.current = onVisibility;
  // Latest props, read by the loop without restarting it.
  const live = useRef({ score, zone, level });
  const events = useRef({ vent, whistle, calmUntil: 0, jetUntil: 0 });
  const burstQueue = useRef<("vent" | "whistle")[]>([]);

  useEffect(() => {
    live.current = { score, zone, level };
  }, [score, zone, level]);

  useEffect(() => {
    if (vent === events.current.vent) return;
    events.current.vent = vent;
    burstQueue.current.push("vent");
  }, [vent]);

  useEffect(() => {
    if (whistle === events.current.whistle) return;
    events.current.whistle = whistle;
    burstQueue.current.push("whistle");
  }, [whistle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!active) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const particles: Particle[] = [];
    const tank = new Path2D(TANK_PATH);
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let scale = 1;
    let dpr = 1;
    let steamColor = "";
    let sprite: HTMLCanvasElement | null = null;
    let frame = 0;
    const acc = { puff: 0, bubble: 0, valve: 0, side: 0, jet: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      scale = (rect.width * dpr) / VIEW.w;
    };
    const readColor = () => {
      const c = toHex(getComputedStyle(canvas).getPropertyValue("--steam") || "#ece6da");
      if (c !== steamColor) {
        steamColor = c;
        sprite = makeSprite(c);
      }
    };

    const spawn = (p: Partial<Particle> & Pick<Particle, "kind" | "x" | "y" | "life">) => {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      particles.push({ vx: 0, vy: 0, age: 0, r0: 4, r1: 12, a0: 0.5, sx: 1, top: 0, phase: Math.random() * 6.28, ...p });
    };

    const burst = (type: "vent" | "whistle") => {
      if (type === "vent") {
        events.current.calmUntil = performance.now() + 2600;
        for (let i = 0; i < 18; i++) {
          const fromValve = i < 10;
          spawn({
            kind: "puff",
            x: fromValve ? 121 + (Math.random() - 0.5) * 10 : 60 + Math.random() * 120,
            y: fromValve ? 46 : 70 + Math.random() * 40,
            vx: (Math.random() - 0.5) * 70,
            vy: -60 - Math.random() * 70,
            life: 1.2 + Math.random() * 0.5,
            r0: 8,
            r1: 34 + Math.random() * 16,
            a0: 0.95,
          });
        }
      } else {
        events.current.jetUntil = performance.now() + 1500;
      }
    };

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (frame++ % 90 === 0) readColor();
      while (burstQueue.current.length) burst(burstQueue.current.shift()!);

      const { score: s, zone: z, level: lv } = live.current;
      const p = steamParams(s, z);
      const calm = now < events.current.calmUntil ? 0.15 : 1;

      acc.puff += p.puffRate * dt;
      while (acc.puff >= 1) {
        acc.puff -= 1;
        spawn({
          kind: "puff",
          x: 78 + (Math.random() - 0.5) * 4,
          y: 32,
          vx: (Math.random() - 0.5) * 22,
          vy: -64 / p.puffLife,
          life: p.puffLife * (0.85 + Math.random() * 0.3),
          r0: 5,
          r1: p.puffRadius * (0.8 + Math.random() * 0.4),
          a0: p.puffAlpha,
        });
      }

      acc.bubble += p.bubbleRate * calm * dt;
      while (acc.bubble >= 1) {
        acc.bubble -= 1;
        const top = lv + 3;
        spawn({
          kind: "bubble",
          x: 56 + Math.random() * 128,
          y: 258,
          vy: -(258 - top) / p.bubbleLife,
          life: p.bubbleLife * 1.2,
          r0: 1.6 + Math.random() * p.bubbleMax,
          a0: 0.75,
          top,
        });
      }

      if (p.burst) {
        acc.valve += dt / 0.12;
        while (acc.valve >= 1) {
          acc.valve -= 1;
          spawn({ kind: "puff", x: 122, y: 42, vx: (Math.random() - 0.5) * 12, vy: -70, life: 0.6, r0: 3, r1: 13, a0: 0.85 });
        }
        acc.side += dt / 0.2;
        while (acc.side >= 1) {
          acc.side -= 1;
          spawn({
            kind: "puff",
            x: 204,
            y: Math.random() < 0.5 ? 150 : 164,
            vx: 60 + Math.random() * 20,
            vy: (Math.random() - 0.5) * 6,
            life: 0.55 + Math.random() * 0.15,
            r0: 3,
            r1: 10,
            a0: 0.85,
            sx: 2.2,
          });
        }
      }

      if (now < events.current.jetUntil) {
        acc.jet += dt / 0.04;
        while (acc.jet >= 1) {
          acc.jet -= 1;
          spawn({ kind: "jet", x: 121, y: 44, vx: (Math.random() - 0.5) * 18, vy: -180 - Math.random() * 60, life: 0.7, r0: 3, r1: 16, a0: 0.9 });
        }
      }

      // Draw. Transform maps viewBox units (with top padding) to device pixels.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -VIEW.x * scale, (PAD_TOP - VIEW.y) * scale);

      // Bubbles inside the tank, clipped.
      ctx.save();
      ctx.clip(tank);
      ctx.fillStyle = "#ffffff";
      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i]!;
        if (q.kind !== "bubble") continue;
        q.age += dt;
        q.y += q.vy * dt;
        if (q.y <= q.top || q.age >= q.life) {
          particles.splice(i, 1);
          continue;
        }
        const wobble = Math.sin(q.age * 9 + q.phase) * 1.4;
        ctx.globalAlpha = q.a0;
        ctx.beginPath();
        ctx.arc(q.x + wobble, q.y, q.r0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Steam above everything.
      if (sprite) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const q = particles[i]!;
          if (q.kind === "bubble") continue;
          q.age += dt;
          if (q.age >= q.life) {
            particles.splice(i, 1);
            continue;
          }
          const t = q.age / q.life;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          if (q.kind === "jet") q.vy *= 0.97;
          const r = q.r0 + (q.r1 - q.r0) * (1 - (1 - t) * (1 - t));
          ctx.globalAlpha = q.a0 * (1 - t);
          const w = r * 2 * q.sx;
          const h = r * 2;
          ctx.drawImage(sprite, q.x - w / 2, q.y - h / 2, w, h);
        }
      }
      ctx.globalAlpha = 1;
    };

    const start = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    readColor();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      visibilityCb.current?.(visible);
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 w-full"
      style={{ top: `${(-PAD_TOP / VIEW.h) * 100}%`, height: `${((VIEW.h + PAD_TOP) / VIEW.h) * 100}%` }}
    />
  );
}
