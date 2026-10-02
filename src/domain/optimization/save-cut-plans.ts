import type { OptimizationResult } from './cut-optimizer';

export interface CutPlanInsert {
  project_id: string;
  material: 'Résine' | 'Aluco';
  source_dimensions: {
    sheet_index: number;
    width: number;
    height: number;
    kerf: number;
    used_area: number;
    utilization: number;
  };
  placements: unknown[];
  waste: number;
}

export function toCutPlanInserts(projectId: string, result: OptimizationResult, kerf: number): CutPlanInsert[] {
  return result.sheets.map((sheet) => ({
    project_id: projectId,
    material: result.material,
    source_dimensions: {
      sheet_index: sheet.sheetIndex,
      width: sheet.width,
      height: sheet.height,
      kerf,
      used_area: sheet.usedArea,
      utilization: sheet.utilization,
    },
    placements: sheet.placements,
    waste: sheet.wasteArea,
  }));
}
