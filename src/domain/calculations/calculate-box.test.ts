import { calculateBox, ProjectSettings, BoxInput } from './calculate-box';

const settings: ProjectSettings = {
  a: 0.053,
  b: 0.017,
  b2: 0.034,
  c: 0.004,
  t: 0.02,
  r: 0.02,
  handlesEnabled: true,
};

const box = (overrides: Partial<BoxInput> = {}): BoxInput => ({
  structure: 'ET',
  boxType: 'Potager',
  shelvesCount: 0,
  doorsCount: 0,
  length: 0.9,
  height: 0.8,
  depth: 0.6,
  ...overrides,
});

const findPart = (result: ReturnType<typeof calculateBox>, material: string, type: string) =>
  result.parts.find((p) => p.material === material && p.partType === type);

const findAccessory = (result: ReturnType<typeof calculateBox>, type: string) =>
  result.accessories.find((a) => a.accessoryType === type);

describe('calculateBox', () => {
  it.each([
    ['ET', '2 Départ Long', '2 Départ Court', '2 Départ Long'],
    ['SET', '2 Départ Court', '2 Départ Long', '2 Départ Long'],
    ['Eco', '2 Départ Court', '2 Départ Court', '2 Départ Court'],
  ] as const)('applies confirmed %s profile rules', (structure, lProfile, hProfile, pProfile) => {
    const result = calculateBox(box({ structure }), settings);
    expect(findPart(result, 'Profile', lProfile)).toMatchObject({ length: 0.9, quantity: 2 });
    expect(findPart(result, 'Profile', hProfile)).toMatchObject({ length: 0.8, quantity: 2 });
    expect(findPart(result, 'Profile', pProfile)).toMatchObject({ length: 0.6, quantity: 4 });
  });

  it.each([
    [0.9, 0.8, 0.6],
    [1.2, 0.7, 0.5],
    [0.7, 1.2, 0.5],
  ] as const)('keeps L/H/P by position for example dimensions %s × %s × %s', (length, height, depth) => {
    const result = calculateBox(box({ length, height, depth }), settings);
    expect(findPart(result, 'Profile', '1Départ')).toMatchObject({ length, quantity: 2 });
    expect(findPart(result, 'Profile', '1Départ')).not.toMatchObject({ length: height });
    expect(result.parts.some(p => p.material === 'Profile' && p.length === depth && p.quantity === 4)).toBe(true);
  });

  it('calculates Potager resin faces and feet', () => {
    const result = calculateBox(box({ boxType: 'Potager' }), settings);
    expect(findPart(result, 'Résine', 'back')).toMatchObject({ length: 0.847, width: 0.747 });
    expect(findPart(result, 'Résine', 'bottom')).toMatchObject({ length: 0.847, width: 0.547 });
    expect(findPart(result, 'Résine', 'right')).toMatchObject({ length: 0.547, width: 0.747 });
    expect(findPart(result, 'Résine', 'top')).toBeUndefined();
    expect(findAccessory(result, 'Pied')).toMatchObject({ quantity: 4 });
  });

  it('calculates Element resin including top and no feet', () => {
    const result = calculateBox(box({ boxType: 'Element' }), settings);
    expect(result.parts.filter((p) => p.material === 'Résine')).toHaveLength(5);
    expect(findPart(result, 'Résine', 'top')).toMatchObject({ length: 0.847, width: 0.547 });
    expect(findAccessory(result, 'Pied')).toBeUndefined();
  });

  it('adds shelf resin and four shelf corners per shelf', () => {
    const result = calculateBox(box({ shelvesCount: 3 }), settings);
    expect(result.parts.filter((p) => p.partType === 'shelf')).toHaveLength(3);
    expect(result.parts.filter((p) => p.partType === 'shelf').every((p) => p.length === 0.827 && p.width === 0.527)).toBe(true);
    expect(result.accessories.filter((a) => a.accessoryType === 'Coin 2 Départ').reduce((n, a) => n + a.quantity, 0)).toBe(12);
  });

  it('calculates one door and optional handle', () => {
    const result = calculateBox(box({ doorsCount: 1 }), settings);
    expect(findPart(result, 'Ouvrant', 'Ouvrant H')).toMatchObject({ length: 0.8, quantity: 2 });
    expect(findPart(result, 'Ouvrant', 'Ouvrant L')).toMatchObject({ length: 0.883, quantity: 2 });
    expect(findPart(result, 'Aluco', 'door')).toMatchObject({ length: 0.879, width: 0.796, quantity: 1 });
    expect(findAccessory(result, 'Coin Équerre')).toMatchObject({ quantity: 4 });
    expect(findAccessory(result, 'Charnière')).toMatchObject({ quantity: 2 });
    expect(findAccessory(result, 'Poignée')).toMatchObject({ quantity: 1 });
  });

  it('calculates two doors using B2 and doubles door accessories', () => {
    const result = calculateBox(box({ doorsCount: 2 }), settings);
    expect(findPart(result, 'Ouvrant', 'Ouvrant H')).toMatchObject({ length: 0.8, quantity: 4 });
    expect(findPart(result, 'Ouvrant', 'Ouvrant L')).toMatchObject({ length: 0.433, quantity: 4 });
    expect(findPart(result, 'Aluco', 'door')).toMatchObject({ length: 0.429, width: 0.796, quantity: 2 });
    expect(findAccessory(result, 'Coin Équerre')).toMatchObject({ quantity: 8 });
    expect(findAccessory(result, 'Charnière')).toMatchObject({ quantity: 4 });
    expect(findAccessory(result, 'Poignée')).toMatchObject({ quantity: 2 });
  });

  it('adds eight Coin 3 Départ to every box', () => {
    const result = calculateBox(box(), settings);
    expect(findAccessory(result, 'Coin 3 Départ')).toMatchObject({ quantity: 8 });
  });
});
