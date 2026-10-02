import { optimizeCuts, partsFromCalculations } from './cut-optimizer';

describe('cut optimizer', () => {
  const sheet = { width: 2.44, height: 1.22 };

  it('expands quantities from multiple boxes into one material workload', () => {
    const parts = partsFromCalculations([
      { material: 'Résine', partType: 'back', length: 0.847, width: 0.747, quantity: 2 },
      { material: 'Résine', partType: 'side', length: 0.547, width: 0.747, quantity: 4 },
      { material: 'Aluco', partType: 'door', length: 0.429, width: 0.796, quantity: 2 },
    ], 'Résine');

    expect(parts.reduce((sum, p) => sum + p.quantity, 0)).toBe(6);
    const result = optimizeCuts('Résine', sheet, parts, 0.003);
    expect(result.sheets.length).toBeGreaterThan(0);
    expect(result.sheets.flatMap((s) => s.placements)).toHaveLength(6);
  });

  it('supports rotation and reports utilization', () => {
    const result = optimizeCuts('Aluco', sheet, [
      { id: 'door', material: 'Aluco', width: 0.796, height: 0.429, quantity: 4, label: 'door' },
    ], 0.003);

    expect(result.totalUtilization).toBeGreaterThan(0);
    expect(result.totalUtilization).toBeLessThanOrEqual(1);
    expect(result.sheets.flatMap((s) => s.placements).every((p) => p.width > 0 && p.height > 0)).toBe(true);
  });

  it('rejects a part that cannot fit even after rotation', () => {
    expect(() => optimizeCuts('Résine', { width: 1, height: 1 }, [
      { id: 'oversize', material: 'Résine', width: 1.1, height: 0.9, quantity: 1, label: 'oversize' },
    ])).toThrow(/does not fit/);
  });
});
