'use client';

import { useMemo } from 'react';
import { calculateBox, BoxInput, ProjectSettings } from '@/domain/calculations/calculate-box';

const settings: ProjectSettings = { a: 0.053, b: 0.017, b2: 0.034, c: 0.004, t: 0.02, r: 0.02, handlesEnabled: true };

const demoBoxes: BoxInput[] = [
  { length: 0.9, height: 0.8, depth: 0.6, structure: 'ET', boxType: 'Potager', shelvesCount: 2, doorsCount: 1 },
  { length: 1.2, height: 0.7, depth: 0.5, structure: 'SET', boxType: 'Element', shelvesCount: 1, doorsCount: 2 },
];

export default function CalculationPage() {
  const calculations = useMemo(() => demoBoxes.map((box, index) => ({ number: index + 1, box, result: calculateBox(box, settings) })), []);
  const totals = useMemo(() => calculations.flatMap((c) => c.result.parts).reduce((map, p) => {
    const key = `${p.material}|${p.partType}|${p.length}|${p.width ?? ''}`;
    const current = map.get(key);
    map.set(key, { ...p, quantity: (current?.quantity ?? 0) + p.quantity });
    return map;
  }, new Map<string, any>()), [calculations]);

  return (
    <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8">
          <p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">المشروع / الحساب</p>
          <h1 className="text-3xl font-bold">نتائج الحساب</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">مراجعة قطع Profiles وRésine وAluco والإكسسوارات قبل اعتماد المشروع.</p>
        </header>

        <div className="space-y-6">
          {calculations.map(({ number, box, result }) => (
            <section key={number} className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-xl font-semibold">الصندوق #{number}</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">{box.length} × {box.height} × {box.depth} m · {box.structure} · {box.boxType}</p></div>
                <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm">{result.parts.length} أنواع قطع</span>
              </div>
              <PartsTable parts={result.parts} />
              <div className="mt-5 border-t pt-5"><h3 className="mb-3 font-semibold">الإكسسوارات</h3><div className="flex flex-wrap gap-2">{result.accessories.map((a, i) => <span key={`${a.accessoryType}-${i}`} className="rounded-md border px-3 py-2 text-sm">{a.accessoryType}: <strong>{a.quantity}</strong></span>)}</div></div>
            </section>
          ))}

          <section className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">ملخص السلع</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">هذا ملخص القطع المطلوبة للشراء/التحضير، وليس مخزون المستودع.</p>
            <PartsTable parts={[...totals.values()]} />
            <button className="mt-6 rounded-lg bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))]">اعتماد الحساب</button>
          </section>
        </div>
      </div>
    </main>
  );
}

function PartsTable({ parts }: { parts: ReturnType<typeof calculateBox>['parts'] }) {
  return <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">المادة</th><th className="p-3 text-right">القطعة</th><th className="p-3 text-right">الطول</th><th className="p-3 text-right">العرض</th><th className="p-3 text-right">الكمية</th></tr></thead><tbody>{parts.map((p, i) => <tr key={`${p.material}-${p.partType}-${i}`} className="border-t"><td className="p-3">{p.material}</td><td className="p-3 font-medium">{p.partType}</td><td className="p-3">{p.length.toFixed(3)} m</td><td className="p-3">{p.width === undefined ? '—' : `${p.width.toFixed(3)} m`}</td><td className="p-3 font-semibold">{p.quantity}</td></tr>)}</tbody></table></div>;
}
