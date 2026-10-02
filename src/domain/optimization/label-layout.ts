export interface LabelLayoutInput { width: number; height: number; label: string; dimensionText: string; }
export interface LabelLayout { fontSize: number; lineHeight: number; labelLines: string[]; dimensionLines: string[]; textScale: number; }

function wrap(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) line = next;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function getLabelLayout({ width, height, label, dimensionText }: LabelLayoutInput): LabelLayout {
  const minSide = Math.max(0.02, Math.min(width, height));
  const area = Math.max(0.0001, width * height);
  const maxChars = Math.max(8, Math.min(28, Math.floor(minSide * 70)));
  const labelLines = wrap(label, maxChars);
  const dimensionLines = wrap(dimensionText, maxChars);
  const density = Math.sqrt(area);
  const fontSize = Math.max(7, Math.min(18, Math.round(8 + density * 18)));
  const lineHeight = Math.max(9, Math.round(fontSize * 1.15));
  const availableLines = Math.max(2, Math.floor((height / Math.max(width, height)) * 8) + 2);
  const totalLines = labelLines.length + dimensionLines.length;
  const textScale = totalLines > availableLines ? Math.max(0.65, availableLines / totalLines) : 1;
  return { fontSize: Math.max(7, Math.round(fontSize * textScale)), lineHeight: Math.max(9, Math.round(lineHeight * textScale)), labelLines, dimensionLines, textScale };
}
