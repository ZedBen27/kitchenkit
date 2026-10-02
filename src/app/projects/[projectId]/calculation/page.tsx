'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { calculateBox, BoxInput, ProjectSettings } from '@/domain/calculations/calculate-box';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type DbBox = { id: string; number: number; structure: 'ET' | 'SET' | 'Eco'; box_type: 'Potager' | 'Element'; shelves_count: number; doors_count: 0 | 1 | 2; length: number; height: number; depth: number };
type SettingsRow = { a: number; b: number; b2: number; c: number; t: number | null; r: number | null; handles_enabled: boolean };

export default function CalculationPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const [boxes, setBoxes] = useState<DbBox[]>([]);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const [{ data: boxData, error: boxError }, { data: settingsData, error: settingsError }] = await Promise.all([
          supabase.from('project_boxes').select('id,number,structure,box_type,shelves_count,doors_count,length,height,depth').eq('project_id', params.projectId).order('number'),
          supabase.from('project_settings').select('a,b,b2,c,t,r,handles_enabled').eq('project_id', params.projectId).single(),
        ]);
        if (boxError) throw boxError;
        if (settingsError) throw settingsError;
        const row = settingsData as SettingsRow;
        setBoxes((boxData || []) as DbBox[]);
        setSettings({ a: Number(row.a), b: Number(row.b), b2: Number(row.b2), c: Number(row.c), t: Number(row.t ?? 0), r: Number(row.r ?? 0), handlesEnabled: row.handles_enabled });
      } catch (err) { setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الحساب.'); } finally { setLoading(false); }
    })();
  }, [params.projectId]);

  const calculations = useMemo(() => {
    if (!settings) return [];
    return boxes.map((box) => ({ number: box.number, box, result: calculateBox({ length: Number(box.length), height: Number(box.height), depth: Number(box.depth), structure: box.structure, boxType: box.box_type, shelvesCount: box.shelves_count, doorsCount: box.doors_count }, settings) }));
  }, [boxes, settings]);

  const totals = useMemo(() => {
    const map = new Map<string, any>();
    for (const calculation of calculations) for (const p of calculation.result.parts) {
      const key = `${p.material}|${p.partType}|${p.length}|${p.width ?? ''}`;
      const current = map.get(key);
      map.set(key, { ...p, quantity: (current?.quantity ?? 0) + p.quantity });
    }
    return [...map.values()];
  }, [calculations]);

  const accessoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const calculation of calculations) for (const a of calculation.result.accessories) map.set(a.accessoryType, (map.get(a.accessoryType) ?? 0) + a.quantity);
    return [...map.entries()].map(([accessoryType, quantity]) => ({ accessoryType, quantity }));
  }, [calculations]);

  async function approve() {
    if (!calculations.length) return;
    setSaving(true); setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول قبل اعتماد المشروع.');

      const { error: partsDeleteError } = await supabase.from('box_parts').delete().in('box_id', boxes.map((b) => b.id));
      if (partsDeleteError) throw partsDeleteError;
      const { error: accessoriesDeleteError } = await supabase.from('box_accessories').delete().in('box_id', boxes.map((b) => b.id));
      if (accessoriesDeleteError) throw accessoriesDeleteError;
      const partRows = calculations.flatMap((c) => c.result.parts.map((p) => ({ box_id: boxes.find((b) => b.number === c.number)!.id, category: p.category, material: p.material, part_type: p.partType, length: p.length, width: p.width ?? null, quantity: p.quantity, unit: p.unit })));
      const accessoryRows = calculations.flatMap((c) => c.result.accessories.map((a) => ({ box_id: boxes.find((b) => b.number === c.number)!.id, accessory_type: a.accessoryType, quantity: a.quantity, unit: a.unit })));
      if (partRows.length) { const { error } = await supabase.from('box_parts').insert(partRows); if (error) throw error; }
      if (accessoryRows.length) { const { error } = await supabase.from('box_accessories').insert(accessoryRows); if (error) throw error; }

      const { error: purchaseDeleteError } = await supabase.from('purchase_items').delete().eq('project_id', params.projectId);
      if (purchaseDeleteError) throw purchaseDeleteError;
      const purchaseRows = [
        ...totals.map((p) => ({ project_id: params.projectId, category: p.category, item_type: `${p.material}:${p.partType}`, quantity: p.quantity, unit: p.unit, source: 'calculation' })),
        ...accessoryTotals.map((a) => ({ project_id: params.projectId, category: 'accessory', item_type: a.accessoryType, quantity: a.quantity, unit: 'piece', source: 'calculation' })),
      ];
      if (purchaseRows.length) { const { error } = await supabase.from('purchase_items').insert(purchaseRows); if (error) throw error; }

      await supabase.from('workshop_jobs').delete().eq('project_id', params.projectId);
      const { error: jobError } = await supabase.from('workshop_jobs').insert({ project_id: params.projectId, status: 'in_progress', started_at: new Date().toISOString() });
      if (jobError) throw jobError;
      const { error: projectError } = await supabase.from('projects').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', params.projectId);
      if (projectError) throw projectError;
      router.push('/workshop');
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر اعتماد الحساب.'); } finally { setSaving(false); }
  }

  if (loading) return <main dir="rtl" className="p-8">جارٍ تحميل الحساب...</main>;
  if (error && !calculations.length) return <main dir="rtl" className="p-8 text-[hsl(var(--destructive))]">{error}</main>;

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto max-w-7xl px-6 py-8"><header className="mb-8"><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">المشروع / الحساب</p><h1 className="text-3xl font-bold">نتائج الحساب</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">مراجعة Profiles وRésine وOuvrant وAluco والإكسسوارات قبل إرسال المشروع للورشة.</p></header><div className="space-y-6">
    {calculations.map(({ number, box, result }) => <section key={number} className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">الصندوق #{number}</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">{box.length} × {box.height} × {box.depth} m · {box.structure} · {box.box_type}</p></div><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-sm">{result.parts.length} أنواع قطع</span></div><PartsTable parts={result.parts} /><div className="mt-5 border-t pt-5"><h3 className="mb-3 font-semibold">الإكسسوارات</h3><div className="flex flex-wrap gap-2">{result.accessories.map((a, i) => <span key={`${a.accessoryType}-${i}`} className="rounded-md border px-3 py-2 text-sm">{a.accessoryType}: <strong>{a.quantity}</strong></span>)}</div></div></section>)}
    <section className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><h2 className="mb-4 text-xl font-semibold">ملخص السلع</h2><p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">يتم إنشاء عناصر التحضير/الشراء من هذا الملخص عند الاعتماد.</p><PartsTable parts={totals} /><div className="mt-5 flex flex-wrap gap-2">{accessoryTotals.map((a) => <span key={a.accessoryType} className="rounded-md border px-3 py-2 text-sm">{a.accessoryType}: <strong>{a.quantity}</strong></span>)}</div>{error && <div className="mt-5 rounded-lg border border-[hsl(var(--destructive))] p-4 text-sm text-[hsl(var(--destructive))]">{error}</div>}<button disabled={saving || !calculations.length} onClick={approve} className="mt-6 rounded-lg bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{saving ? 'جارٍ الاعتماد...' : 'اعتماد الحساب وإرسال للورشة'}</button></section>
  </div></div></main>;
}

function PartsTable({ parts }: { parts: ReturnType<typeof calculateBox>['parts'] }) { return <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">المادة</th><th className="p-3 text-right">القطعة</th><th className="p-3 text-right">الطول</th><th className="p-3 text-right">العرض</th><th className="p-3 text-right">الكمية</th></tr></thead><tbody>{parts.map((p, i) => <tr key={`${p.material}-${p.partType}-${i}`} className="border-t"><td className="p-3">{p.material}</td><td className="p-3 font-medium">{p.partType}</td><td className="p-3">{p.length.toFixed(3)} m</td><td className="p-3">{p.width === undefined ? '—' : `${p.width.toFixed(3)} m`}</td><td className="p-3 font-semibold">{p.quantity}</td></tr>)}</tbody></table></div>; }
