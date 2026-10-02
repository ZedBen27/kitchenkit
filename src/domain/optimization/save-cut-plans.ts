import type { OptimizationResult } from './cut-optimizer';

export interface CutPlanInsert {
  project_id: string;
  material: 'Résine' | 'Aluco';
  sheet_index: number;
  sheet_width: number;
  sheet_height: number;
  kerf: number;
  used_area: number;
  waste_area: number;
  utilization: number;
  placements: unknown[];
}

export function toCutPlanInserts(projectId: string, result: OptimizationResult, kerf: number): CutPlanInsert[] {
  return result.sheets.map((sheet) => ({
    project_id: projectId,
    material: result.material,
    sheet_index: sheet.sheetIndex,
    sheet_width: sheet.width,
    sheet_height: sheet.height,
    kerf,
    used_area: sheet.usedArea,
    waste_area: sheet.wasteArea,
    utilization: sheet.utilization,
    placements: sheet.placements,
  }));
}
