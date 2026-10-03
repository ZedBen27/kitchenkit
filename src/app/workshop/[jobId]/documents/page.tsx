'use client';

import Link from 'next/link';
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
    <div className="mt-8 flex justify-center print:hidden"><Link href={`/workshop/${params.jobId}/purchases`} className="inline-flex items-center justify-center rounded-2xl bg-[hsl(var(--primary))] px-7 py-3 text-sm font-black text-[hsl(var(--primary-foreground))] shadow-sm transition hover:opacity-90">قائمة السلع</Link></div>
  </div></main>;
}

function SavedCutPlanGroup({ title, plans }: { title: string; plans: CutPlan[] }) {
  return <div className="mb-8 last:mb-0"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h3 className="text-lg font-semibold">مخططات {title}</h3><span className="text-sm text-[hsl(var(--muted-foreground))]">{plans.length} لوح</span></div><div className="grid gap-5 lg:grid-cols-2">{plans.map(plan => { const d = plan.source_dimensions; return <article key={plan.id} className="break-inside-avoid overflow-hidden rounded-none border bg-[hsl(var(--card))] print:break-inside-avoid"><div className="flex items-center justify-between gap-3 border-b bg-[hsl(var(--card))] px-4 py-3"><div><strong className="text-sm">لوح #{d.sheet_index}</strong><p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{Number(d.width).toFixed(3)} × {Number(d.height).toFixed(3)} m</p></div><span className="text-sm font-bold">{(Number(d.utilization) * 100).toFixed(1)}% استغلال</span></div><div className="p-3 sm:p-4"><div className="relative w-full pt-7 pr-8">
    <div className="pointer-events-none absolute left-0 right-8 top-0 flex h-6 items-center justify-center gap-2 text-[9px] font-semibold text-slate-500"><span className="h-px flex-1 bg-slate-300" /><span className="shrink-0 whitespace-nowrap">{Number(d.width).toFixed(3)} m</span><span className="h-px flex-1 bg-slate-300" /></div>
    <div className="pointer-events-none absolute bottom-0 right-0 top-7 flex w-7 items-center justify-center"><div className="relative flex h-full w-full items-center justify-center"><span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300" /><span className="relative z-10 bg-[hsl(var(--card))] px-0.5 text-[9px] font-semibold text-slate-500" style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>{Number(d.height).toFixed(3)} m</span></div></div>
    <div className="relative w-full overflow-hidden border border-slate-300 bg-[hsl(var(--muted))]" style={{ aspectRatio: `${Number(d.width)} / ${Number(d.height)}` }}>
      {(plan.placements || []).map(p => { const layout = getLabelLayout({ width: Number(p.width), height: Number(p.height), label: p.label, dimensionText: `${Number(p.width).toFixed(3)} × ${Number(p.height).toFixed(3)} m` }); const horizontalDimension = `${Number(p.width).toFixed(3)} m`; const verticalDimension = `${Number(p.height).toFixed(3)} m`; const dimensionFontSize = Math.max(7, Math.min(10, Math.round(layout.fontSize * 0.78))); const labelFontSize = Math.max(8, Math.min(13, layout.fontSize)); return <div key={p.id} title={`${p.label} — ${Number(p.width).toFixed(3)} × ${Number(p.height).toFixed(3)}${p.rotated ? ' m · مدوّرة' : ' m'}`} className="absolute overflow-hidden border border-slate-300 bg-white/90 text-slate-800 transition print:transition-none" style={{ left: `${(Number(p.x) / Number(d.width)) * 100}%`, top: `${(Number(p.y) / Number(d.height)) * 100}%`, width: `${(Number(p.width) / Number(d.width)) * 100}%`, height: `${(Number(p.height) / Number(d.height)) * 100}%` }}>
        <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center gap-1" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1' }}><span className="h-px flex-1 bg-slate-300" /><span className="shrink-0 whitespace-nowrap font-semibold text-slate-500">{horizontalDimension}</span><span className="h-px flex-1 bg-slate-300" /></div>
        <div className="pointer-events-none absolute bottom-1 left-1 top-1 flex items-center justify-center" style={{ width: `${Math.max(14, dimensionFontSize + 5)}px` }}><div className="relative flex h-full w-full items-center justify-center"><span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300" /><span className="relative z-10 bg-white px-0.5 font-semibold text-slate-500" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>{verticalDimension}</span></div></div>
        <div className="absolute inset-0 flex items-center justify-center px-5 py-5 text-center" style={{ fontSize: `${labelFontSize}px`, lineHeight: `${layout.lineHeight}px` }}><span className="max-w-[68%] break-words font-black leading-tight">{layout.labelLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span></div>
        {p.rotated && <span className="pointer-events-none absolute bottom-1 right-1 text-[8px] font-bold text-blue-600">↻</span>}
      </div>; })}
    </div>
  </div><div className="flex items-center justify-between border-t border-slate-200 bg-white px-1 py-2.5 text-xs text-[hsl(var(--muted-foreground))]"><span>Kerf: {Number(d.kerf).toFixed(3)} m</span><span>الهدر: {Number(plan.waste).toFixed(3)} m²</span></div></div></article>; })}</div></div>;
}
