import type { CutPart, Material } from './cut-optimizer';

export interface PersistedPart {
  id: string;
  category: string;
  material: string;
  part_type: string;
  length: number;
  width: number;
  quantity: number;
  unit?: string | null;
  box_number?: number | null;
}

const normalizeMaterial = (material: string): Material | null => {
  const value = material.trim().toLowerCase();
  if (value === 'résine' || value === 'resine') return 'Résine';
  if (value === 'aluco') return 'Aluco';
  return null;
};

export function toOptimizerParts(rows: PersistedPart[]): CutPart[] {
  return rows.flatMap((row) => {
    const material = normalizeMaterial(row.material);
    if (!material || row.length <= 0 || row.width <= 0 || row.quantity <= 0) return [];
    return [{
      id: row.id,
      material,
      width: row.length,
      height: row.width,
      quantity: row.quantity,
      label: row.box_number ? `صندوق #${row.box_number} — ${row.part_type}` : row.part_type,
      allowRotation: true,
    }];
  });
}

export function mergeIdenticalParts(parts: CutPart[]): CutPart[] {
  const merged = new Map<string, CutPart>();
  for (const part of parts) {
    const key = `${part.material}|${part.label}|${part.width}|${part.height}`;
    const current = merged.get(key);
    if (current) current.quantity += part.quantity;
    else merged.set(key, { ...part });
  }
  return [...merged.values()];
}
