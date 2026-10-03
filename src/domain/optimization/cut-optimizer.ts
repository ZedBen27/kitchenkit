import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type Material = 'Résine' | 'Aluco';
export type OptimizationObjective = 'min-sheets' | 'min-waste';

export interface SheetSize { width: number; height: number; }
export interface CutPart { id: string; material: Material; width: number; height: number; quantity: number; label: string; allowRotation?: boolean; }
export interface PlacedPart { id: string; label: string; x: number; y: number; width: number; height: number; rotated: boolean; }
export interface SheetPlan { material: Material; sheetIndex: number; width: number; height: number; placements: PlacedPart[]; usedArea: number; wasteArea: number; utilization: number; }
export interface OptimizationResult { material: Material; objective: OptimizationObjective; sheets: SheetPlan[]; totalWasteArea: number; totalUtilization: number; }

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

async function resolveWorkshopCutSettings(material: Material, fallbackSheet: SheetSize, fallbackKerf: number) {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { sheet: fallbackSheet, kerf: fallbackKerf };

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) return { sheet: fallbackSheet, kerf: fallbackKerf };

    const { data: settings } = await supabase
      .from('workshop_settings')
      .select('resin_width,resin_height,aluco_width,aluco_height,kerf')
      .eq('organization_id', membership.organization_id)
      .maybeSingle();
    if (!settings) return { sheet: fallbackSheet, kerf: fallbackKerf };

    return {
      sheet: material === 'Résine'
        ? { width: Number(settings.resin_width), height: Number(settings.resin_height) }
        : { width: Number(settings.aluco_width), height: Number(settings.aluco_height) },
      kerf: Number(settings.kerf),
    };
  } catch {
    return { sheet: fallbackSheet, kerf: fallbackKerf };
  }
}

/**
 * Optimization is deliberately executed by the server API. This keeps the
 * WebAssembly binary out of the browser render path and avoids client-side
 * WASM initialization/runtime failures in Next.js/Vercel.
 */
export async function optimizeCuts(
  material: Material,
  sheet: SheetSize,
  input: CutPart[],
  kerf = 0,
  objective: OptimizationObjective = 'min-sheets',
): Promise<OptimizationResult> {
  const workshop = await resolveWorkshopCutSettings(material, sheet, kerf);
  sheet = workshop.sheet;
  kerf = workshop.kerf;

  if (sheet.width <= 0 || sheet.height <= 0) throw new Error('Sheet dimensions must be greater than zero.');
  if (kerf < 0) throw new Error('Kerf cannot be negative.');
  if (!input.length) return { material, objective, sheets: [], totalWasteArea: 0, totalUtilization: 0 };

  const response = await fetch('/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ material, sheet, parts: input, kerf, objective }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'تعذر تشغيل محرك تحسين التقطيع.');
  return payload as OptimizationResult;
}
