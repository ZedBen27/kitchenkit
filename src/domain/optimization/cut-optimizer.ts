export type Material = 'Résine' | 'Aluco';
export type OptimizationObjective = 'min-sheets' | 'min-waste';

export interface SheetSize { width: number; height: number; }
export interface CutPart { id: string; material: Material; width: number; height: number; quantity: number; label: string; allowRotation?: boolean; }
export interface PlacedPart { id: string; label: string; x: number; y: number; width: number; height: number; rotated: boolean; }
export interface SheetPlan { material: Material; sheetIndex: number; width: number; height: number; placements: PlacedPart[]; usedArea: number; wasteArea: number; utilization: number; unusableWasteArea: number; }
export interface OptimizationResult { material: Material; objective: OptimizationObjective; sheets: SheetPlan[]; totalWasteArea: number; totalUnusableWasteArea: number; totalUtilization: number; }

export interface OptimizationInput {
  material: Material;
  sheet: SheetSize;
  parts: CutPart[];
  kerf?: number;
  objective?: OptimizationObjective;
}

export interface CalculatedPartLike {
  material: string;
  partType: string;
  length: number;
  width?: number;
  quantity: number;
}

export function partsFromCalculations(parts: CalculatedPartLike[], material: Material): CutPart[] {
  return parts
    .filter((p) => p.material === material && p.width !== undefined && p.length > 0 && p.width > 0)
    .map((p, index) => ({
      id: `${material.toLowerCase()}-${index + 1}`,
      material,
      width: p.length,
      height: p.width as number,
      quantity: p.quantity,
      label: p.partType,
      allowRotation: true,
    }));
}

// Multi-start guillotine heuristic. The objective is deliberately evaluated
// using two different notions:
// - min-sheets: first minimize physical sheets, then total unused area.
// - min-waste: first minimize unusable offcuts (free rectangles that cannot
//   accept even the smallest remaining part), then total unused area and sheets.
// This makes the two modes meaningfully different instead of comparing only
// total unused sheet area, which is mathematically tied to sheet count when all
// sheets have the same dimensions and all requested parts are fixed.
export function optimizeCuts(material: Material, sheet: SheetSize, input: CutPart[], kerf = 0, objective: OptimizationObjective = 'min-sheets'): OptimizationResult {
  if (sheet.width <= 0 || sheet.height <= 0) throw new Error('Sheet dimensions must be greater than zero.');
  if (kerf < 0) throw new Error('Kerf cannot be negative.');

  const expanded = input.flatMap((p) => Array.from({ length: p.quantity }, (_, i) => ({ ...p, id: `${p.id}-${i + 1}` })));
  if (expanded.some((p) => p.width <= 0 || p.height <= 0)) throw new Error('Cut part dimensions must be greater than zero.');

  const sorters = [
    (a: CutPart, b: CutPart) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height,
    (a: CutPart, b: CutPart) => b.width * b.height - a.width * a.height || Math.max(b.width, b.height) - Math.max(a.width, a.height),
    (a: CutPart, b: CutPart) => b.height - a.height || b.width - a.width,
    (a: CutPart, b: CutPart) => b.width - a.width || b.height - a.height,
  ];

  const candidates = sorters.map((sorter) => runGuillotine(material, sheet, [...expanded].sort(sorter), kerf, objective, expanded));
  return candidates.reduce((best, current) => isBetter(current, best, objective) ? current : best);
}

function runGuillotine(
  material: Material,
  sheet: SheetSize,
  parts: CutPart[],
  kerf: number,
  objective: OptimizationObjective,
  allParts: CutPart[],
): OptimizationResult {
  type FreeRect = { x: number; y: number; width: number; height: number };
  const plans: SheetPlan[] = [];
  const freeRects: FreeRect[][] = [];
  const sheetArea = sheet.width * sheet.height;

  for (const part of parts) {
    let best: { sheet: number; rect: number; rotated: boolean; score: number } | null = null;

    for (let s = 0; s < freeRects.length; s++) {
      for (let r = 0; r < freeRects[s].length; r++) {
        const fr = freeRects[s][r];
        const orientations = part.allowRotation === false
          ? [[part.width, part.height, false] as const]
          : [[part.width, part.height, false] as const, [part.height, part.width, true] as const];
        for (const [w, h, rotated] of orientations) {
          if (w + kerf > fr.width || h + kerf > fr.height) continue;
          const shortFit = Math.min(fr.width - w, fr.height - h);
          const leftover = fr.width * fr.height - w * h;
          const score = objective === 'min-waste'
            ? leftover * 1_000_000 + shortFit
            : shortFit * 1_000_000 + leftover;
          if (!best || score < best.score) best = { sheet: s, rect: r, rotated, score };
        }
      }
    }

    if (!best) {
      const wFits = part.width + kerf <= sheet.width && part.height + kerf <= sheet.height;
      const rFits = part.allowRotation !== false && part.height + kerf <= sheet.width && part.width + kerf <= sheet.height;
      if (!wFits && !rFits) throw new Error(`Part ${part.label} (${part.width}×${part.height}) does not fit on sheet ${sheet.width}×${sheet.height}`);
      const rotated = !wFits && rFits;
      plans.push({ material, sheetIndex: plans.length + 1, width: sheet.width, height: sheet.height, placements: [], usedArea: 0, wasteArea: sheetArea, utilization: 0, unusableWasteArea: 0 });
      freeRects.push([{ x: 0, y: 0, width: sheet.width, height: sheet.height }]);
      best = { sheet: freeRects.length - 1, rect: 0, rotated, score: Infinity };
    }

    const fr = freeRects[best.sheet][best.rect];
    const w = best.rotated ? part.height : part.width;
    const h = best.rotated ? part.width : part.height;
    plans[best.sheet].placements.push({ id: part.id, label: part.label, x: fr.x, y: fr.y, width: w, height: h, rotated: best.rotated });
    plans[best.sheet].usedArea += w * h;

    const remaining: FreeRect[] = [];
    const rightWidth = fr.width - w - kerf;
    const bottomHeight = fr.height - h - kerf;
    if (rightWidth > 0) remaining.push({ x: fr.x + w + kerf, y: fr.y, width: rightWidth, height: h });
    if (bottomHeight > 0) remaining.push({ x: fr.x, y: fr.y + h + kerf, width: fr.width, height: bottomHeight });
    freeRects[best.sheet].splice(best.rect, 1, ...remaining);
  }

  const smallestPart = allParts.reduce((smallest, part) => {
    if (!smallest) return part;
    return part.width * part.height < smallest.width * smallest.height ? part : smallest;
  }, allParts[0]);

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    plan.wasteArea = sheetArea - plan.usedArea;
    plan.utilization = plan.usedArea / sheetArea;
    plan.unusableWasteArea = freeRects[i].reduce((sum, fr) => {
      if (!smallestPart) return sum;
      const fitsNormal = smallestPart.width + kerf <= fr.width && smallestPart.height + kerf <= fr.height;
      const fitsRotated = smallestPart.allowRotation !== false && smallestPart.height + kerf <= fr.width && smallestPart.width + kerf <= fr.height;
      return fitsNormal || fitsRotated ? sum : sum + fr.width * fr.height;
    }, 0);
  }

  const totalArea = plans.length * sheetArea;
  const used = plans.reduce((sum, plan) => sum + plan.usedArea, 0);
  const totalUnusableWasteArea = plans.reduce((sum, plan) => sum + plan.unusableWasteArea, 0);
  return {
    material,
    objective,
    sheets: plans,
    totalWasteArea: totalArea - used,
    totalUnusableWasteArea,
    totalUtilization: totalArea ? used / totalArea : 0,
  };
}

function isBetter(a: OptimizationResult, b: OptimizationResult, objective: OptimizationObjective): boolean {
  const eps = 1e-9;
  if (objective === 'min-waste') {
    if (a.totalUnusableWasteArea < b.totalUnusableWasteArea - eps) return true;
    if (Math.abs(a.totalUnusableWasteArea - b.totalUnusableWasteArea) > eps) return false;
    if (a.totalWasteArea < b.totalWasteArea - eps) return true;
    if (Math.abs(a.totalWasteArea - b.totalWasteArea) > eps) return false;
    if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length;
    return a.totalUtilization > b.totalUtilization;
  }

  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length;
  if (a.totalWasteArea < b.totalWasteArea - eps) return true;
  if (Math.abs(a.totalWasteArea - b.totalWasteArea) > eps) return false;
  if (a.totalUnusableWasteArea < b.totalUnusableWasteArea - eps) return true;
  if (Math.abs(a.totalUnusableWasteArea - b.totalUnusableWasteArea) > eps) return false;
  return a.totalUtilization > b.totalUtilization;
}
