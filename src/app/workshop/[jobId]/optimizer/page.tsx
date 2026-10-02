'use client';

import { useMemo, useState } from 'react';
import { optimizeCuts, CutPart } from '@/domain/optimization/cut-optimizer';

const parts: CutPart[] = [
  { id: 'resin-back', material: 'Résine', width: 0.847, height: 0.747, quantity: 2, label: 'Résine — arrière' },
  { id: 'resin-bottom', material: 'Résine', width: 0.847, height: 0.547, quantity: 2, label: 'Résine — inférieur' },
  { id: 'resin-side', material: 'Résine', width: 0.547, height: 0.747, quantity: 4, label: 'Résine — latéral' },
  { id: 'aluco-door', material: 'Aluco', width: 0.429, height: 0.796, quantity: 2, label: 'Aluco — porte' },
];

export default function CutOptimizerPage() {
  const [resinW, setResinW] = useState('2.44');
  const [resinH, setResinH] = useState('1.22');
  const [alucoW, setAlucoW] = useState('2.44');
  const [alucoH, setAlucoH] = useState('1.22');
  const [kerf, setKerf] = useState('0.003');

  const resin = useMemo(() => optimizeCuts('Résine', { width: Number(resinW), height: Number(resinH) }, parts.filter((p) => p.material === 'Résine'), Number(kerf)), [resinW, resinH, kerf]);
  const aluco = useMemo(() => optimizeCuts('Aluco', { width: Number(alucoW), height: Number(alucoH) }, parts.filter((p) => p.material === 'Aluco'), Number(kerf)), [alucoW, alucoH, kerf]);

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto max-w-7xl px-6 py-8">
    <header className="mb-8"><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">الورشة / التحسين</p><h1 className="text-3xl font-bold">Cut Optimizer</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">أدخل أبعاد ألواح Résine وAluco، وسيتم توزيع جميع القطع والكميات عليها مع السماح بالدوران لتقليل عدد الألواح والبقايا.</p></header>
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">أبعاد الألواح</h2><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5"><SheetField label="Résine — العرض" value={resinW} setValue={setResinW}/><SheetField label="Résine — الارتفاع" value={resinH} setValue={setResinH}/><SheetField label="Aluco — العرض" value={alucoW} setValue={setAlucoW}/><SheetField label="Aluco — الارتفاع" value={alucoH} setValue={setAlucoH}/><SheetField label="Kerf / سماكة القطع" value={kerf} setValue={setKerf}/></div><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">الوحدة: m. مثال 2.44 × 1.22 m.</p></section>
    <OptimizerResult title="Résine" result={resin}/><OptimizerResult title="Aluco" result={aluco}/>
  </div></main>;
}

function SheetField({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><input type="number" min="0" step="0.001" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2.5"/></label>; }

function OptimizerResult({ title, result }: { title: string; result: ReturnType<typeof optimizeCuts> }) { return <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-5 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">مخطط {title}</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">{result.sheets.length} لوح · هدر {result.totalWasteArea.toFixed(3)} m² · استغلال {(result.totalUtilization * 100).toFixed(1)}%</p></div></div><div className="grid gap-5 lg:grid-cols-2">{result.sheets.map((sheet) => <div key={sheet.sheetIndex} className="rounded-lg border p-4"><div className="mb-3 flex justify-between text-sm"><strong>لوح #{sheet.sheetIndex}</strong><span>{(sheet.utilization * 100).toFixed(1)}% استغلال</span></div><div className="relative aspect-[2/1] overflow-hidden border bg-[hsl(var(--muted))]">{sheet.placements.map((p) => <div key={p.id} title={p.label} className="absolute flex items-center justify-center overflow-hidden border bg-[hsl(var(--card))] text-[10px]" style={{ left: `${(p.x / sheet.width) * 100}%`, top: `${(p.y / sheet.height) * 100}%`, width: `${(p.width / sheet.width) * 100}%`, height: `${(p.height / sheet.height) * 100}%` }}>{p.label}</div>)}</div></div>)}</div></section>; }
