import { NextResponse } from 'next/server';
import { solve2d } from '@0xdoublesharp/bin-packing-wasm/two-d';
import type { Material, OptimizationObjective, OptimizationResult, CutPart, SheetSize } from '@/domain/optimization/cut-optimizer';

export const runtime = 'nodejs';

const MM_PER_M = 1000;
const toMm = (value: number) => Math.max(1, Math.round(value * MM_PER_M));
const fromMm = (value: number) => value / MM_PER_M;

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      material: Material;
      sheet: SheetSize;
      parts: CutPart[];
      kerf?: number;
      objective?: OptimizationObjective;
    };

    const { material, sheet, parts } = body;
    const kerf = body.kerf ?? 0;
    const objective = body.objective ?? 'min-sheets';

    if (!['Résine', 'Aluco'].includes(material)) throw new Error('مادة غير صالحة.');
    if (!sheet || sheet.width <= 0 || sheet.height <= 0) throw new Error('أبعاد اللوح غير صالحة.');
    if (kerf < 0) throw new Error('Kerf cannot be negative.');
    if (!Array.isArray(parts) || !parts.length) {
      return NextResponse.json({ material, objective, sheets: [], totalWasteArea: 0, totalUtilization: 0 } satisfies OptimizationResult);
    }

    const solution = solve2d(
      {
        sheets: [{
          name: `${material}-sheet`,
          width: toMm(sheet.width),
          height: toMm(sheet.height),
          cost: 1,
          kerf: Math.max(0, toMm(kerf)),
        }],
        demands: parts.map((part) => ({
          name: `${part.id}::${part.label}`,
          width: toMm(part.width),
          height: toMm(part.height),
          quantity: Math.max(1, Math.round(part.quantity)),
          can_rotate: part.allowRotation !== false,
        })),
      },
      {
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

    const sheets = solution.layouts.map((layout, layoutIndex) => {
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

    const result: OptimizationResult = {
      material,
      objective,
      sheets,
      totalWasteArea: solution.total_waste_area / (MM_PER_M * MM_PER_M),
      totalUtilization: totalSheetArea > 0 ? usedArea / totalSheetArea : 0,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر تشغيل محرك تحسين التقطيع.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
