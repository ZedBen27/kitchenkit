'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { getLabelLayout } from '@/domain/optimization/label-layout';

type Part = { material: string; part_type: string; length: number; width: number | null; quantity: number; category: string };
type Accessory = { accessory_type: string; quantity: number };
type CutPlacement = { id: string; x: number; y: number; width: number; height: number; label: string; rotated?: boolean };
type CutPlan = {
  id: string;
  material: 'Resine' | 'Aluco' | string;
  source_dimensions: {
    sheet_index: number;
    width: number;
    height: number;
    kerf: number;
    used_area: number;
    utilization: number;
  };
  placements: CutPlacement[];
  waste: number;
};

export default function WorkshopDocumentsPage() {
  const params = useParams<{ jobId: string }>();
  const [parts, setParts] = useState<Part[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [cutPlans, setCutPlans] = useState<CutPlan[]>([]);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { (async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: job, error: je } = await supabase.from('workshop_jobs').select('project_id').eq('id', params.jobId).single();
      if (je) throw je;
      const [{ data: p, error: pe }, { data: project, error: pre }, { data: plans, error: planError }] = await Promise.all([
        supabase.from('project_boxes').select('id').eq('project_id', job.project_id),
        supabase.from('projects').select('name').eq('id', job.project_id).single(),
        supabase.from('cut_plans').select('id,material,source_dimensions,placements,waste').eq('project_id', job.project_id).order('material').order('created_at', { ascending: true }),
      ]);
      if (pe) throw pe;
      if (pre) throw pre;
      if (planError) throw planError;
      setProjectName(project.name);
      setCutPlans((plans || []) as CutPlan[]);
      const boxIds = (p || []).map(x => x.id);
      if (!boxIds.length) return;
      const [{ data: partRows, error: partError }, { data: accessoryRows, error: accessoryError }] = await Promise.all([
        supabase.from('box_parts').select('category,material,part_type,length,width,quantity').in('box_id', boxIds),
        supabase.from('box_accessories').select('accessory_type,quantity').in('box_id', boxIds),
      ]);
      if (partError) throw partError;
      if (accessoryError) throw accessoryError;
      setParts((partRows || []) as Part[]);
      setAccessories((accessoryRows || []) as Accessory[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الوثائق.');
    }
  })(); }, [params.jobId]);

  const profileRows = useMemo(() => parts.filter(p => p.material === 'Profile' || p.category === 'profile'), [parts]);
  const resinRows = useMemo(() => parts.filter(p => p.material === 'Résine'), [parts]);
  const alucoRows = useMemo(() => parts.filter(p => p.material === 'Aluco'), [parts]);
  const resinPlans = useMemo(() => cutPlans.filter(p => p.material === 'Resine' || p.material === 'Résine'), [cutPlans]);
  const alucoPlans = useMemo(() => cutPlans.filter(p => p.material === 'Aluco'), [cutPlans]);

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto max-w-7xl px-6 py-8"><header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">الورشة / الوثائق</p><h1 className="text-3xl font-bold">وثائق التصنيع</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{projectName || 'المشروع'} — البيانات الفعلية المحسوبة ومخططات القص المحفوظة.</p></div><button onClick={() => window.print()} className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 font-semibold text-[hsl(var(--primary-foreground))] print:hidden">طباعة جميع الوثائق</button></header>{error && <div className="mb-5 rounded-lg border p-4 text-sm text-[hsl(var(--destructive))]">{error}</div>}
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">1. جدول القطع</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">المادة</th><th className="p-3 text-right">القطعة</th><th className="p-3 text-right">L</th><th className="p-3 text-right">H/P</th><th className="p-3 text-right">Qté</th></tr></thead><tbody>{parts.map((p, i) => <tr key={`${p.material}-${p.part_type}-${i}`} className="border-t"><td className="p-3">{p.material}</td><td className="p-3 font-medium">{p.part_type}</td><td className="p-3">{Number(p.length).toFixed(3)} m</td><td className="p-3">{p.width == null ? '—' : `${Number(p.width).toFixed(3)} m`}</td><td className="p-3">{p.quantity}</td></tr>)}{!parts.length && <tr><td colSpan={5} className="p-6">لا توجد قطع محسوبة بعد.</td></tr>}</tbody></table></div></section>
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">2. Résine</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">القطعة</th><th className="p-3 text-right">L</th><th className="p-3 text-right">H</th><th className="p-3 text-right">Qté</th></tr></thead><tbody>{resinRows.map((p, i) => <tr key={i} className="border-t"><td className="p-3">{p.part_type}</td><td className="p-3">{Number(p.length).toFixed(3)} m</td><td className="p-3">{p.width == null ? '—' : `${Number(p.width).toFixed(3)} m`}</td><td className="p-3">{p.quantity}</td></tr>)}</tbody></table></div></section>
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">3. Aluco / Ouvrant</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">المادة</th><th className="p-3 text-right">القطعة</th><th className="p-3 text-right">L</th><th className="p-3 text-right">H</th><th className="p-3 text-right">Qté</th></tr></thead><tbody>{[...alucoRows, ...profileRows.filter(p => p.part_type === 'Ouvrant H' || p.part_type === 'Ouvrant L')].map((p, i) => <tr key={i} className="border-t"><td className="p-3">{p.material}</td><td className="p-3">{p.part_type}</td><td className="p-3">{Number(p.length).toFixed(3)} m</td><td className="p-3">{p.width == null ? '—' : `${Number(p.width).toFixed(3)} m`}</td><td className="p-3">{p.quantity}</td></tr>)}</tbody></table></div></section>
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">4. الإكسسوارات</h2><div className="flex flex-wrap gap-2">{accessories.map((a, i) => <span key={`${a.accessory_type}-${i}`} className="rounded-md border px-3 py-2 text-sm">{a.accessory_type}: <strong>{a.quantity}</strong></span>)}</div></section>
    {(resinPlans.length > 0 || alucoPlans.length > 0) && <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><div className="mb-5"><h2 className="text-xl font-semibold">5. مخططات القص المحفوظة</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">هذه هي نفس المخططات التي تم حفظها من صفحة Cut Optimizer، مع الحفاظ على النسبة الحقيقية بين أبعاد اللوح والقطع.</p></div>{resinPlans.length > 0 && <SavedCutPlanGroup title="Résine" plans={resinPlans}/>} {alucoPlans.length > 0 && <SavedCutPlanGroup title="Aluco" plans={alucoPlans}/>}</section>}
  </div></main>;
}

function SavedCutPlanGroup({ title, plans }: { title: string; plans: CutPlan[] }) {
  return <div className="mb-8 last:mb-0"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h3 className="text-lg font-semibold">مخططات {title}</h3><span className="text-sm text-[hsl(var(--muted-foreground))]">{plans.length} لوح</span></div><div className="grid gap-5 lg:grid-cols-2">{plans.map(plan => { const d = plan.source_dimensions; return <article key={plan.id} className="break-inside-avoid rounded-lg border p-4"><div className="mb-3 flex justify-between text-sm"><strong>لوح #{d.sheet_index}</strong><span>{(Number(d.utilization) * 100).toFixed(1)}% استغلال</span></div><div className="relative w-full overflow-hidden border bg-[hsl(var(--muted))]" style={{ aspectRatio: `${Number(d.width)} / ${Number(d.height)}` }}><div className="pointer-events-none absolute inset-x-0 top-1 z-10 text-center text-[10px] font-medium opacity-70">{Number(d.width).toFixed(3)} × {Number(d.height).toFixed(3)} m</div>{(plan.placements || []).map(p => { const layout = getLabelLayout({ width: Number(p.width), height: Number(p.height), label: p.label, dimensionText: `${Number(p.width).toFixed(3)} × ${Number(p.height).toFixed(3)} m` }); return <div key={p.id} title={`${p.label} — ${Number(p.width).toFixed(3)} × ${Number(p.height).toFixed(3)}${p.rotated ? ' m · مدوّرة' : ' m'}`} className="absolute flex flex-col items-center justify-center overflow-hidden border px-1 text-center" style={{ left: `${(Number(p.x) / Number(d.width)) * 100}%`, top: `${(Number(p.y) / Number(d.height)) * 100}%`, width: `${(Number(p.width) / Number(d.width)) * 100}%`, height: `${(Number(p.height) / Number(d.height)) * 100}%`, fontSize: `${layout.fontSize}px`, lineHeight: `${layout.lineHeight}px` }}><span className="max-w-full break-words font-semibold">{layout.labelLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span><span className="max-w-full break-words opacity-80">{layout.dimensionLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span></div>; })}</div><div className="mt-2 flex justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>الهدر: {Number(plan.waste).toFixed(3)} m²</span><span>Kerf: {Number(d.kerf).toFixed(3)} m</span></div></article>; })}</div></div>;
}
