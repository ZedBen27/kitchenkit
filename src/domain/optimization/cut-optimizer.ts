import { solve2d, type TwoDSolution } from '@0xdoublesharp/bin-packing-wasm/two-d';

export type Material = 'Résine' | 'Aluco';
export type OptimizationObjective = 'min-sheets' | 'min-waste';

export interface SheetSize { width: number; height: number; }
export interface CutPart { id: string; material: Material; width: number; height: number; quantity: number; label: string; allowRotation?: boolean; }
export interface PlacedPart { id: string; label: string; x: number; y: number; width: number; height: number; rotated: boolean; }
export interface SheetPlan { material: Material; sheetIndex: number; width: number; height: number; placements: PlacedPart[]; usedArea: number; wasteArea: number; utilization: number; }
export interface OptimizationResult { material: Material; objective: OptimizationObjective; sheets: SheetPlan[]; totalWasteArea: number; totalUtilization: number; }

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

// The previous in-house heuristic has been replaced by the Rust/WASM 2D
// rectangular packing engine. Dimensions are converted to millimetres because
// the external solver uses integer geometry; the application continues to use
// metres everywhere else.
const MM_PER_M = 1000;

function toMm(value: number): number {
  return Math.max(1, Math.round(value * MM_PER_M));
}

function fromMm(value: number): number {
  return value / MM_PER_M;
}

function solveWithExternalEngine(material: Material, sheet: SheetSize, parts: CutPart[], kerf: number): OptimizationResult {
  const sheetWidth = toMm(sheet.width);
  const sheetHeight = toMm(sheet.height);
  const sheetKerf = Math.max(0, toMm(kerf));

  const demands = parts.map((part) => ({
    name: `${part.id}::${part.label}`,
    width: toMm(part.width),
    height: toMm(part.height),
    quantity: Math.max(1, Math.round(part.quantity)),
    can_rotate: part.allowRotation !== false,
  }));

  const solution: TwoDSolution = solve2d(
    {
      sheets: [{
        name: `${material}-sheet`,
        width: sheetWidth,
        height: sheetHeight,
        cost: 1,
        kerf: sheetKerf,
      }],
      demands,
    },
    {
      // Auto compares the strong 2D strategies. Keeping the guillotine
      // constraint means the resulting layout remains suitable for panel-saw
      // style cutting instead of producing a layout that is only theoretical.
      algorithm: 'auto',
      guillotine_required: true,
      beam_width: 24,
      multistart_runs: 32,
      seed: 42,
    },
  );

  if (solution.unplaced.length) {
    const first = solution.unplaced[0];
    throw new Error(`تعذر وضع القطعة ${first.name} (${fromMm(first.width).toFixed(3)}×${fromMm(first.height).toFixed(3)} m) على اللوح.`);
  }

  const sheets: SheetPlan[] = solution.layouts.map((layout, layoutIndex) => {
    const placements = layout.placements.map((placement, placementIndex) => {
      const separator = placement.name.indexOf('::');
      const label = separator >= 0 ? placement.name.slice(separator + 2) : placement.name;
      const id = separator >= 0 ? placement.name.slice(0, separator) : `external-${layoutIndex + 1}-${placementIndex + 1}`;
      return {
        id: `${id}-${layoutIndex + 1}-${placementIndex + 1}`,
        label,
        x: fromMm(placement.x),
        y: fromMm(placement.y),
        width: fromMm(placement.width),
        height: fromMm(placement.height),
        rotated: placement.rotated,
      };
    });

    return {
      material,
      sheetIndex: layoutIndex + 1,
      width: fromMm(layout.width),
      height: fromMm(layout.height),
      placements,
      usedArea: fromMm(layout.used_area),
      wasteArea: fromMm(layout.waste_area),
      utilization: layout.used_area / (layout.width * layout.height),
    };
  });

  const totalSheetArea = sheets.reduce((sum, current) => sum + current.width * current.height, 0);
  const usedArea = sheets.reduce((sum, current) => sum + current.usedArea, 0);

  return {
    material,
    objective: 'min-sheets',
    sheets,
    totalWasteArea: fromMm(0) + solution.total_waste_area / (MM_PER_M * MM_PER_M),
    totalUtilization: totalSheetArea > 0 ? usedArea / totalSheetArea : 0,
  };
}

export function optimizeCuts(material: Material, sheet: SheetSize, input: CutPart[], kerf = 0, objective: OptimizationObjective = 'min-sheets'): OptimizationResult {
  if (sheet.width <= 0 || sheet.height <= 0) throw new Error('Sheet dimensions must be greater than zero.');
  if (kerf < 0) throw new Error('Kerf cannot be negative.');
  if (!input.length) return { material, objective, sheets: [], totalWasteArea: 0, totalUtilization: 0 };

  // The external solver's ranking is already lexicographic on unplaced parts,
  // sheet count, waste and cost. This is exactly the current KitchenKit goal:
  // consume as few physical sheets as possible, then minimize waste.
  const result = solveWithExternalEngine(material, sheet, input, kerf);
  return { ...result, objective };
}
