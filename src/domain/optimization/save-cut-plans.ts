import type { OptimizationResult } from './cut-optimizer';

/** Database representation of material names. The database constraint uses
 * `Resine` (without the accent), while the UI/domain uses `Résine`.
 */
type DbMaterial = 'Resine' | 'Aluco';

export interface CutPlanInsert {
  project_id: string;
  material: DbMaterial;
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

function toDbMaterial(material: OptimizationResult['material']): DbMaterial {
  return material === 'Résine' ? 'Resine' : 'Aluco';
}

export function toCutPlanInserts(projectId: string, result: OptimizationResult, kerf: number): CutPlanInsert[] {
  return result.sheets.map((sheet) => ({
    project_id: projectId,
    material: toDbMaterial(result.material),
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
