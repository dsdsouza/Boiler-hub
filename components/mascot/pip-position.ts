export type Point = { x: number; y: number };
export type PipFrame = { width: number; height: number; pipWidth: number; pipHeight: number; bottom: number };
export const PIP_POSITION_KEY = "bp-pip-position-v1";
const EDGE = 12;

export function pipBounds(frame: PipFrame) {
  return { minX: EDGE, minY: EDGE, maxX: Math.max(EDGE, frame.width - frame.pipWidth - EDGE), maxY: Math.max(EDGE, frame.height - frame.pipHeight - frame.bottom) };
}
export function clampPip(point: Point, frame: PipFrame): Point {
  const b = pipBounds(frame);
  return { x: Math.max(b.minX, Math.min(point.x, b.maxX)), y: Math.max(b.minY, Math.min(point.y, b.maxY)) };
}
export function pipRatio(point: Point, frame: PipFrame): Point {
  const b = pipBounds(frame), p = clampPip(point, frame);
  return { x: (p.x - b.minX) / Math.max(1, b.maxX - b.minX), y: (p.y - b.minY) / Math.max(1, b.maxY - b.minY) };
}
export function fromPipRatio(point: Point, frame: PipFrame): Point {
  const b = pipBounds(frame);
  return clampPip({ x: b.minX + point.x * (b.maxX - b.minX), y: b.minY + point.y * (b.maxY - b.minY) }, frame);
}
export function readPipRatio(value: string | null): Point | null {
  try {
    const p = JSON.parse(value ?? "null");
    return p && typeof p.x === "number" && typeof p.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? { x: p.x, y: p.y } : null;
  } catch { return null; }
}
/** Anchor the compact chat directly above Pip, with fallbacks at the screen edges. */
export function pipPanel(point: Point, frame: PipFrame) {
  const width = Math.min(288, frame.width - EDGE * 2);
  const height = Math.min(360, frame.height - frame.bottom - EDGE * 2);
  const left = Math.max(EDGE, Math.min(point.x + frame.pipWidth / 2 - width / 2, frame.width - width - EDGE));
  const above = Math.max(0, point.y - EDGE * 2);
  const belowTop = point.y + frame.pipHeight + EDGE;
  const below = Math.max(0, frame.height - frame.bottom - belowTop - EDGE);
  // A bottom anchor follows the rendered height instead of reserving a tall,
  // mostly empty rectangle between a short conversation and the character.
  if (above >= Math.min(160, height)) return { left, bottom: frame.height - point.y + EDGE, width, maxHeight: Math.min(height, above) };
  if (below >= Math.min(160, height)) return { left, top: belowTop, width, maxHeight: Math.min(height, below) };
  const sideTop = Math.max(EDGE, Math.min(point.y + frame.pipHeight / 2 - height / 2, frame.height - frame.bottom - height - EDGE));
  if (point.x >= width + EDGE * 2) return { left: point.x - width - EDGE, top: sideTop, width, maxHeight: height };
  if (frame.width - point.x - frame.pipWidth >= width + EDGE * 2) return { left: point.x + frame.pipWidth + EDGE, top: sideTop, width, maxHeight: height };
  return above >= below
    ? { left, bottom: frame.height - point.y + EDGE, width, maxHeight: above }
    : { left, top: belowTop, width, maxHeight: below };
}
