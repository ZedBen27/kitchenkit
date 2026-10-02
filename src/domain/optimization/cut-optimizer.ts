export type Material = 'Résine' | 'Aluco';

export interface SheetSize { width: number; height: number; }
export interface CutPart { id: string; material: Material; width: number; height: number; quantity: number; label: string; allowRotation?: boolean; }
export interface PlacedPart { id: string; label: string; x: number; y: number; width: number; height: number; rotated: boolean; }
export interface SheetPlan { material: Material; sheetIndex: number; width: number; height: number; placements: PlacedPart[]; usedArea: number; wasteArea: number; utilization: number; }
export interface OptimizationResult { material: Material; sheets: SheetPlan[]; totalWasteArea: number; totalUtilization: number; }

// Deterministic guillotine-style first-fit heuristic. Parts are sorted by longest side,
// then area, and each part is placed in the currently best free rectangle. This is a
// replaceable adapter: the domain API remains stable if an exact solver is introduced.
export function optimizeCuts(material: Material, sheet: SheetSize, input: CutPart[], kerf = 0): OptimizationResult {
  const parts = input.flatMap((p) => Array.from({ length: p.quantity }, (_, i) => ({ ...p, id: `${p.id}-${i + 1}` })))
    .sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || (b.width * b.height) - (a.width * a.height));

  const plans: SheetPlan[] = [];
  type FreeRect = { x: number; y: number; width: number; height: number };
  const freeRects: FreeRect[][] = [];

  const area = (p: { width: number; height: number }) => p.width * p.height;

  for (const part of parts) {
    let best: { sheet: number; rect: number; rotated: boolean; score: number } | null = null;
    for (let s = 0; s < freeRects.length; s++) {
      for (let r = 0; r < freeRects[s].length; r++) {
        const fr = freeRects[s][r];
        const orientations = part.allowRotation === false ? [[part.width, part.height, false] as const] : [[part.width, part.height, false] as const, [part.height, part.width, true] as const];
        for (const [w, h, rotated] of orientations) {
          const fits = w + kerf <= fr.width && h + kerf <= fr.height;
          if (!fits) continue;
          const score = (fr.width * fr.height) - (w * h);
          if (!best || score < best.score) best = { sheet: s, rect: r, rotated, score };
        }
      }
    }

    if (!best) {
      plans.push({ material, sheetIndex: plans.length + 1, width: sheet.width, height: sheet.height, placements: [], usedArea: 0, wasteArea: area(sheet), utilization: 0 });
      freeRects.push([{ x: 0, y: 0, width: sheet.width, height: sheet.height }]);
      best = { sheet: freeRects.length - 1, rect: 0, rotated: false, score: Infinity };
      const fr = freeRects[best.sheet][0];
      if (part.width > fr.width || part.height > fr.height) {
        if (part.allowRotation !== false && part.height <= fr.width && part.width <= fr.height) best.rotated = true;
        else throw new Error(`Part ${part.label} (${part.width}×${part.height}) does not fit on sheet ${sheet.width}×${sheet.height}`);
      }
    }

    const fr = freeRects[best.sheet][best.rect];
    const w = best.rotated ? part.height : part.width;
    const h = best.rotated ? part.width : part.height;
    const placed: PlacedPart = { id: part.id, label: part.label, x: fr.x, y: fr.y, width: w, height: h, rotated: best.rotated };
    plans[best.sheet].placements.push(placed);
    plans[best.sheet].usedArea += w * h;

    // Guillotine split: right and bottom rectangles. Kerf is treated as material lost around cuts.
    const remaining: FreeRect[] = [];
    if (fr.width - w - kerf > 0) remaining.push({ x: fr.x + w + kerf, y: fr.y, width: fr.width - w - kerf, height: h });
    if (fr.height - h - kerf > 0) remaining.push({ x: fr.x, y: fr.y + h + kerf, width: fr.width, height: fr.height - h - kerf });
    freeRects[best.sheet].splice(best.rect, 1, ...remaining);
  }

  for (const p of plans) {
    p.wasteArea = p.width * p.height - p.usedArea;
    p.utilization = p.usedArea / (p.width * p.height);
  }
  const totalArea = plans.reduce((n, p) => n + p.width * p.height, 0);
  const used = plans.reduce((n, p) => n + p.usedArea, 0);
  return { material, sheets: plans, totalWasteArea: totalArea - used, totalUtilization: totalArea ? used / totalArea : 0 };
}
