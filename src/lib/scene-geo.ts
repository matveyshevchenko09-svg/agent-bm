// Общая геометрия сцены прототипа БАЗИС — используется и окном, и логикой агента.

export const VB_W = 428;
export const VB_H = 400;

// Сетка 3×3 внутри шкафа для расстановки по голосовым командам
export const GRID = { x: 196, y: 86, w: 236, h: 258 };
export const PART_W = 62;
export const PART_H = 44;

/** Препятствия помещения (с фото замеров). В реальной системе распознаются с фото. */
export const OBSTACLES = [
  { id: 'battery', label: 'Батарея Ø76', x: 124, y: 318, w: 76, h: 52 },
];

export interface Rect { x: number; y: number; w: number; h: number }

export function posRect(pos: string | undefined, idx: number): Rect {
  if (!pos) return { x: GRID.x + 80 + (idx % 3) * 8, y: GRID.y + 100 + (idx % 3) * 8, w: PART_W, h: PART_H };
  const colW = GRID.w / 3, rowH = GRID.h / 3;
  const v = pos[0] ?? 'c', h = pos[1] ?? 'c';
  const col = h === 'l' ? 0 : h === 'r' ? 2 : 1;
  const row = v === 't' ? 0 : v === 'b' ? 2 : 1;
  const pad = 6 + (idx % 2) * 4;
  return { x: GRID.x + col * colW + pad, y: GRID.y + row * rowH + pad, w: colW - pad * 2, h: rowH - pad * 2 };
}

export function partRect(p: { pos?: string; x?: number; y?: number }, idx: number): Rect {
  if (p.x != null && p.y != null) return { x: p.x, y: p.y, w: PART_W, h: PART_H };
  return posRect(p.pos, idx);
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** С каким препятствием пересекается элемент (null — не пересекается) */
export function collidesWith(p: { pos?: string; x?: number; y?: number }, idx: number) {
  const r = partRect(p, idx);
  return OBSTACLES.find((o) => intersects(r, o)) ?? null;
}

/** Свободное место правее препятствия (куда убрать элемент) */
export function freeSpotRightOf(o: Rect, yHint: number): { x: number; y: number } {
  return {
    x: Math.min(o.x + o.w + 12, VB_W - PART_W - 8),
    y: Math.round(Math.max(30, Math.min(VB_H - PART_H - 8, yHint))),
  };
}
