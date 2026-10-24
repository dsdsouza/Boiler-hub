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
/** Put chat beside Pip where it fits, and keep the entire panel in the viewport. */
export function pipPanel(point: Point, frame: PipFrame) {
  const width = Math.min(380, frame.width - EDGE * 2);
  const height = Math.min(460, frame.height - frame.bottom - EDGE * 2);
  const left = Math.max(EDGE, Math.min(point.x + frame.pipWidth / 2 - width / 2, frame.width - width - EDGE));
  const above = Math.max(0, point.y - EDGE * 2);
  const belowTop = point.y + frame.pipHeight + EDGE;
  const below = Math.max(0, frame.height - frame.bottom - belowTop - EDGE);
  if (above >= height) return { left, top: point.y - height - EDGE, width, maxHeight: height };
  if (below >= height) return { left, top: belowTop, width, maxHeight: height };
  const sideTop = Math.max(EDGE, Math.min(point.y + frame.pipHeight / 2 - height / 2, frame.height - frame.bottom - height - EDGE));
  if (point.x >= width + EDGE * 2) return { left: point.x - width - EDGE, top: sideTop, width, maxHeight: height };
  if (frame.width - point.x - frame.pipWidth >= width + EDGE * 2) return { left: point.x + frame.pipWidth + EDGE, top: sideTop, width, maxHeight: height };
  // On a narrow screen, use the larger free side and let chat scroll instead
  // of covering the character or putting controls outside the viewport.
  return above >= below ? { left, top: EDGE, width, maxHeight: above } : { left, top: belowTop, width, maxHeight: below };
}
