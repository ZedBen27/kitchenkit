export interface LabelLayoutInput {
  width: number;
  height: number;
  label: string;
  dimensionText: string;
}

export interface LabelLayout {
  fontSize: number;
  lineHeight: number;
  labelLines: string[];
  dimensionLines: string[];
  textScale: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrap(text: string, maxChars: number, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }

    if (line) lines.push(line);
    line = word;

    if (lines.length === maxLines - 1) {
      const rest = words.slice(words.indexOf(word) + 1).join(' ');
      if (rest) line = `${line} ${rest}`;
      break;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, maxLines).length ? lines.slice(0, maxLines) : [''];
}

function translatePartName(partName: string) {
  const labels: Record<string, string> = {
    top: 'علوي',
    bottom: 'سفلي',
    right: 'جانبي',
    left: 'جانبي',
    back: 'خلفي',
    shelf: 'رف',
    door: 'باب',
  };
  return labels[partName.trim().toLowerCase()] ?? partName;
}

function splitLabel(label: string, maxChars: number) {
  // Show only the box number inside each cutting piece (for example: "#2").
  // Part names are intentionally hidden; dimensions are rendered separately.
  const boxNumber = label.match(/#\d+/)?.[0];
  if (boxNumber) return [boxNumber];

  return wrap(label, maxChars, 1);
}

export function getLabelLayout({ width, height, label, dimensionText }: LabelLayoutInput): LabelLayout {
  const safeWidth = Math.max(0.02, Number(width) || 0.02);
  const safeHeight = Math.max(0.02, Number(height) || 0.02);
  const minSide = Math.min(safeWidth, safeHeight);
  const maxSide = Math.max(safeWidth, safeHeight);
  const area = safeWidth * safeHeight;

  const fontSize = clamp(Math.round(7 + minSide * 10), 8, 14);
  const lineHeight = clamp(Math.round(fontSize * 1.08), 9, 16);
  const maxChars = clamp(Math.floor(minSide * 28 + Math.min(maxSide, 1) * 2), 7, 18);
  const labelLines = splitLabel(label, maxChars);
  const dimensionLines = wrap(dimensionText.replace(/\s+m$/, ''), Math.max(7, maxChars), 1);

  const availableHeight = Math.max(20, minSide * 100);
  const textHeight = (labelLines.length + dimensionLines.length) * lineHeight;
  const textScale = clamp(availableHeight / Math.max(availableHeight, textHeight), 0.72, 1);

  return {
    fontSize: Math.max(8, Math.round(fontSize * textScale)),
    lineHeight: Math.max(9, Math.round(lineHeight * textScale)),
    labelLines,
    dimensionLines,
    textScale,
  };
}
