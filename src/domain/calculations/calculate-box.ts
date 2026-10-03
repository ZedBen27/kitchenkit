export type Structure = 'ET' | 'SET' | 'Eco';
export type BoxType = 'Potager' | 'Element';

export interface ProjectSettings {
  a: number;
  b: number;
  b2: number;
  c: number;
  t: number;
  r: number;
  handlesEnabled: boolean;
}

export interface BoxInput {
  structure: Structure;
  boxType: BoxType;
  shelvesCount: number;
  doorsCount: 0 | 1 | 2;
  length: number;
  height: number;
  depth: number;
}

export interface Part {
  category: 'profile' | 'panel';
  material: string;
  partType: string;
  length: number;
  width?: number;
  quantity: number;
  unit: 'piece';
}

export interface Accessory {
  accessoryType: string;
  quantity: number;
  unit: 'piece';
}

export interface BoxCalculation {
  parts: Part[];
  accessories: Accessory[];
}

const part = (material: string, partType: string, length: number, quantity: number, width?: number): Part => ({
  category: material === 'Résine' || material === 'Aluco' ? 'panel' : 'profile',
  material,
  partType,
  length,
  ...(width === undefined ? {} : { width }),
  quantity,
  unit: 'piece',
});

export function calculateBox(box: BoxInput, settings: ProjectSettings): BoxCalculation {
  const { length: L, height: H, depth: P, structure, boxType, shelvesCount, doorsCount } = box;
  const { a: A, b: B, b2: B2, c: C, t: T, r: R, handlesEnabled } = settings;
  const parts: Part[] = [];
  const accessories: Accessory[] = [];

  if (structure === 'ET') {
    parts.push(part('Profile', '1Départ', L, 2), part('Profile', '2 Départ Long', L, 2));
    parts.push(part('Profile', '1Départ', H, 2), part('Profile', '2 Départ Court', H, 2));
    parts.push(part('Profile', '2 Départ Long', P, 4));
  } else if (structure === 'SET') {
    parts.push(part('Profile', '1Départ', L, 2), part('Profile', '2 Départ Court', L, 2));
    parts.push(part('Profile', '1Départ', H, 2), part('Profile', '2 Départ Long', H, 2));
    parts.push(part('Profile', '2 Départ Long', P, 4));
  } else {
    parts.push(part('Profile', '1Départ', L, 2), part('Profile', '2 Départ Court', L, 2));
    parts.push(part('Profile', '1Départ', H, 2), part('Profile', '2 Départ Court', H, 2));
    parts.push(part('Profile', '2 Départ Court', P, 4));
  }

  const resinFaces = boxType === 'Potager'
    ? ['back', 'bottom', 'right', 'left']
    : ['back', 'top', 'bottom', 'right', 'left'];
  for (const face of resinFaces) {
    if (face === 'back') parts.push(part('Résine', 'back', L - A, 1, H - A));
    if (face === 'bottom' || face === 'top') parts.push(part('Résine', face, L - A, 1, P - A));
    if (face === 'right' || face === 'left') parts.push(part('Résine', face, P - A, 1, H - A));
  }

  for (let i = 0; i < shelvesCount; i++) {
    const shelfL = L - T;
    const shelfP = P - R;
    parts.push(part('Résine', 'shelf', shelfL - A, 1, shelfP - A));
    accessories.push({ accessoryType: 'Coin 2 Départ', quantity: 4, unit: 'piece' });
  }

  if (boxType === 'Potager') accessories.push({ accessoryType: 'Pied', quantity: 4, unit: 'piece' });
  accessories.push({ accessoryType: 'Coin 3 Départ', quantity: 8, unit: 'piece' });

  // L, B and B2 are expressed in metres at calculation time. 5 cm = 0.05 m.
  if (doorsCount === 1) {
    const portL = (L - 0.05) + B;
    parts.push(part('Ouvrant', 'Ouvrant H', H, 2));
    parts.push(part('Ouvrant', 'Ouvrant L', portL, 2));
    parts.push(part('Aluco', 'باب', portL - C, 1, H - C));
    accessories.push({ accessoryType: 'Coin Équerre', quantity: 4, unit: 'piece' });
    accessories.push({ accessoryType: 'Charnière', quantity: 2, unit: 'piece' });
    if (handlesEnabled) accessories.push({ accessoryType: 'Poignée', quantity: 1, unit: 'piece' });
  } else if (doorsCount === 2) {
    const portL = ((L - 0.05) + B2) / 2;
    parts.push(part('Ouvrant', 'Ouvrant H', H, 4));
    parts.push(part('Ouvrant', 'Ouvrant L', portL, 4));
    parts.push(part('Aluco', 'باب', portL - C, 2, H - C));
    accessories.push({ accessoryType: 'Coin Équerre', quantity: 8, unit: 'piece' });
    accessories.push({ accessoryType: 'Charnière', quantity: 4, unit: 'piece' });
    if (handlesEnabled) accessories.push({ accessoryType: 'Poignée', quantity: 2, unit: 'piece' });
  }

  return { parts, accessories };
}
