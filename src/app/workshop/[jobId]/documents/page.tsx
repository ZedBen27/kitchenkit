'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { getLabelLayout } from '@/domain/optimization/label-layout';

type Box = { id: string; number: number };
type Part = { box_id: string; material: string; part_type: string; length: number; width: number | null; quantity: number; category: string };
type Accessory = { accessory_type: string; quantity: number };
type CutPlacement = { id: string; x: number; y: number; width: number; height: number; label: string; rotated?: boolean };
type CutPlan = {
  id: string;
  material: 'Resine' | 'Aluco' | string;
  source_dimensions: { sheet_index: number; width: number; height: number; kerf: number; used_area: number; utilization: number };
  placements: CutPlacement[];
  waste: number;
};
type ProfileRow = { part_type: string; length: number; quantity: number };
type AlucoRow = { boxNumber: number; part_type: string; length: number; width: number | null; quantity: number };
type OuvrantRow = { boxNumber: number; part_type: string; length: number; quantity: number };

const profileOrder = ['1Départ', '1 Départ', '2Départ Long', '2 Départ Long', '2Départes Long', '2 Départs Long', '2Départ Court', '2 Départ Court', '2Départes Court', '2 Départs Court'];

function formatCm(meters: number) {
  return Number((Number(meters) * 100).toFixed(2)).toString();
}

const partTypeLabel = (partType: string) => ({
  top: 'علوي',
  bottom: 'سفلي',
  right: 'جانبي',
  left: 'جانبي',
  back: 'خلفي',
  shelf: 'رف',
  door: 'باب',
}[partType] ?? partType);

function profileRowsForBox(rows: Part[]): ProfileRow[] {
  const grouped = new Map<string, ProfileRow>();
  for (const row of rows) {
    if (row.part_type === 'Ouvrant H' || row.part_type === 'Ouvrant L') continue;
    const key = `${row.part_type}|${Number(row.length).toFixed(6)}`;
    const current = grouped.get(key);
    if (current) current.quantity += Number(row.quantity) || 0;
    else grouped.set(key, { part_type: row.part_type, length: Number(row.length), quantity: Number(row.quantity) || 0 });
  }
  return [...grouped.values()].sort((a, b) => {
    const ai = profileOrder.findIndex(x => x === a.part_type);
    const bi = profileOrder.findIndex(x => x === b.part_type);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.part_type.localeCompare(b.part_type);
  });
}

function resinRowsForBox(rows: Part[]): Part[] {
  const grouped = new Map<string, Part>();
  for (const row of rows) {
    const lengthKey = Number(row.length).toFixed(6);
    const widthKey = row.width == null ? 'null' : Number(row.width).toFixed(6);
    const key = `${partTypeLabel(row.part_type)}|${lengthKey}|${widthKey}`;
    const current = grouped.get(key);
    if (current) current.quantity += Number(row.quantity) || 0;
    else grouped.set(key, { ...row, quantity: Number(row.quantity) || 0 });
  }
  return [...grouped.values()].sort((a, b) => a.part_type.localeCompare(b.part_type) || a.length - b.length || (a.width ?? -1) - (b.width ?? -1));
}

function alucoRowsForBoxes(boxes: Box[], parts: Part[]): AlucoRow[] {
  const grouped = new Map<string, AlucoRow>();
  const boxNumbers = new Map(boxes.map(box => [box.id, box.number]));
  for (const row of parts) {
    if (row.material !== 'Aluco') continue;
    const boxNumber = boxNumbers.get(row.box_id);
    if (boxNumber == null) continue;
    const lengthKey = Number(row.length).toFixed(6);
    const widthKey = row.width == null ? 'null' : Number(row.width).toFixed(6);
    const key = `${boxNumber}|${row.part_type}|${lengthKey}|${widthKey}`;
    const current = grouped.get(key);
    if (current) current.quantity += Number(row.quantity) || 0;
    else grouped.set(key, {
      boxNumber,
      part_type: row.part_type,
      length: Number(row.length),
      width: row.width == null ? null : Number(row.width),
      quantity: Number(row.quantity) || 0,
    });
  }
  return [...grouped.values()].sort((a, b) => a.boxNumber - b.boxNumber || a.part_type.localeCompare(b.part_type) || a.length - b.length || (a.width ?? -1) - (b.width ?? -1));
}

function ouvrantRowsForBoxes(boxes: Box[], parts: Part[]): OuvrantRow[] {
  const grouped = new Map<string, OuvrantRow>();
  const boxNumbers = new Map(boxes.map(box => [box.id, box.number]));
  for (const row of parts) {
    if (row.part_type !== 'Ouvrant H' && row.part_type !== 'Ouvrant L') continue;
    const boxNumber = boxNumbers.get(row.box_id);
    if (boxNumber == null) continue;
    const key = `${boxNumber}|${row.part_type}|${Number(row.length).toFixed(6)}`;
    const current = grouped.get(key);
    if (current) current.quantity += Number(row.quantity) || 0;
    else grouped.set(key, {
      boxNumber,
      part_type: row.part_type,
      length: Number(row.length),
      quantity: Number(row.quantity) || 0,
    });
  }
  return [...grouped.values()].sort((a, b) => a.boxNumber - b.boxNumber || a.part_type.localeCompare(b.part_type) || a.length - b.length);
}

export default function WorkshopDocumentsPage() {
  const params = useParams<{ jobId: string }>();
  const [boxes, setBoxes] = useState<Box[]>([]);
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
      const [{ data: boxRows, error: be }, { data: project, error: pre }, { data: plans, error: planError }] = await Promise.all([
        supabase.from('project_boxes').select('id,number').eq('project_id', job.project_id).order('number', { ascending: true }),
        supabase.from('projects').select('name').eq('id', job.project_id).single(),
        supabase.from('cut_plans').select('id,material,source_dimensions,placements,waste').eq('project_id', job.project_id).order('material').order('created_at', { ascending: true }),
      ]);
      if (be) throw be;
      if (pre) throw pre;
      if (planError) throw planError;
      setBoxes((boxRows || []) as Box[]);
      setProjectName(project.name);
      setCutPlans((plans || []) as CutPlan[]);
      const boxIds = (boxRows || []).map(x => x.id);
      if (!boxIds.length) return;
      const [{ data: partRows, error: partError }, { data: accessoryRows, error: accessoryError }] = await Promise.all([
        supabase.from('box_parts').select('box_id,category,material,part_type,length,width,quantity').in('box_id', boxIds),
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

  const profileGroups = useMemo(() => boxes.map(box => ({ box, rows: profileRowsForBox(parts.filter(p => p.box_id === box.id && (p.material === 'Profile' || p.category === 'profile'))) })).filter(group => group.rows.length > 0), [boxes, parts]);
  const resinGroups = useMemo(() => boxes.map(box => ({ box, rows: resinRowsForBox(parts.filter(p => p.box_id === box.id && (p.material === 'Résine' || p.material === 'Resine'))) })).filter(group => group.rows.length > 0), [boxes, parts]);
  const alucoRows = useMemo(() => alucoRowsForBoxes(boxes, parts), [boxes, parts]);
  const ouvrantRows = useMemo(() => ouvrantRowsForBoxes(boxes, parts), [boxes, parts]);
  const accessoriesOnly = useMemo(() => accessories, [accessories]);
  const resinPlans = useMemo(() => cutPlans.filter(p => p.material === 'Resine' || p.material === 'Résine'), [cutPlans]);
  const alucoPlans = useMemo(() => cutPlans.filter(p => p.material === 'Aluco'), [cutPlans]);

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto max-w-7xl px-6 py-8">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">الورشة / الوثائق</p><h1 className="text-3xl font-bold">وثائق التصنيع</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{projectName || 'المشروع'} — البيانات الفعلية المحسوبة ومخططات القص المحفوظة.</p></div><button onClick={() => window.print()} className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 font-semibold text-[hsl(var(--primary-foreground))] print:hidden">طباعة جميع الوثائق</button></header>
    {error && <div className="mb-5 rounded-lg border p-4 text-sm text-[hsl(var(--destructive))]">{error}</div>}

    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">1. قطع Profile</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">جدول مستقل لكل صندوق، مع طول كل قطعة بالسنتيمتر والكمية المطلوبة.</p></div><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-semibold">{profileGroups.length} صناديق</span></div><div className="space-y-5">{profileGroups.map(({ box, rows }) => <article key={box.id} className="break-inside-avoid overflow-hidden rounded-lg border print:break-inside-avoid"><div className="flex items-center justify-between border-b bg-[hsl(var(--muted))] px-4 py-3"><h3 className="font-semibold">الصندوق #{box.number}</h3><span className="text-xs text-[hsl(var(--muted-foreground))]">{rows.length} أنواع قطع</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-[hsl(var(--card))]"><th className="p-3 text-right">القطعة</th><th className="p-3 text-right">طول القطعة (سم)</th><th className="p-3 text-right">Qté</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.part_type}-${row.length}-${i}`} className="border-b last:border-b-0"><td className="p-3 font-medium">{partTypeLabel(row.part_type)}</td><td className="p-3" dir="ltr">{formatCm(row.length)} cm</td><td className="p-3 font-semibold">{row.quantity}</td></tr>)}</tbody></table></div></article>)}{!profileGroups.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">لا توجد قطع Profile محسوبة بعد.</div>}</div></section>

    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">2. Ouvrant</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">جدول موحد لجميع الصناديق، مع جمع الكميات ذات نفس النوع والطول داخل الصندوق نفسه.</p></div><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-semibold">{new Set(ouvrantRows.map(row => row.boxNumber)).size} صناديق</span></div><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">رقم الصندوق</th><th className="p-3 text-right">القطعة</th><th className="p-3 text-right">L</th><th className="p-3 text-right">Qté</th></tr></thead><tbody>{ouvrantRows.map((p, i) => <tr key={`${p.boxNumber}-${p.part_type}-${p.length}-${i}`} className="border-t"><td className="p-3 font-semibold">#{p.boxNumber}</td><td className="p-3 font-medium">{partTypeLabel(p.part_type)}</td><td className="p-3" dir="ltr">{formatCm(p.length)} cm</td><td className="p-3 font-semibold">{p.quantity}</td></tr>)}</tbody></table></div>{!ouvrantRows.length && <div className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">لا توجد قطع Ouvrant محسوبة بعد.</div>}</section>

    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">3. Résine</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">جدول مستقل لكل صندوق، مع رقم الصندوق واسم القطعة وأبعادها والكمية.</p></div><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-semibold">{resinGroups.length} صناديق</span></div><div className="space-y-5">{resinGroups.map(({ box, rows }) => <article key={box.id} className="break-inside-avoid overflow-hidden rounded-lg border print:break-inside-avoid"><div className="flex items-center justify-between border-b bg-[hsl(var(--muted))] px-4 py-3"><h3 className="font-semibold">الصندوق #{box.number}</h3><span className="text-xs text-[hsl(var(--muted-foreground))]">{rows.length} أنواع قطع</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">رقم الصندوق</th><th className="p-3 text-right">اسم القطعة</th><th className="p-3 text-right">L</th><th className="p-3 text-right">H</th><th className="p-3 text-right">الكمية</th></tr></thead><tbody>{rows.map((p, i) => <tr key={`${p.part_type}-${p.length}-${p.width}-${i}`} className="border-t"><td className="p-3 font-semibold">#{box.number}</td><td className="p-3 font-medium">{partTypeLabel(p.part_type)}</td><td className="p-3" dir="ltr">{formatCm(p.length)} cm</td><td className="p-3" dir="ltr">{p.width == null ? '—' : `${formatCm(p.width)} cm`}</td><td className="p-3 font-semibold">{p.quantity}</td></tr>)}</tbody></table></div></article>)}{!resinGroups.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">لا توجد قطع Résine محسوبة بعد.</div>}</div></section>

    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><div className="mb-5 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">4. Aluco</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">جدول موحد لجميع الصناديق، مع تجميع القطع ذات نفس الاسم والأبعاد داخل الصندوق نفسه.</p></div><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-semibold">{new Set(alucoRows.map(row => row.boxNumber)).size} صناديق</span></div><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">رقم الصندوق</th><th className="p-3 text-right">اسم القطعة</th><th className="p-3 text-right">الطول</th><th className="p-3 text-right">العرض</th><th className="p-3 text-right">الكمية</th></tr></thead><tbody>{alucoRows.map((p, i) => <tr key={`${p.boxNumber}-${p.part_type}-${p.length}-${p.width}-${i}`} className="border-t"><td className="p-3 font-semibold">#{p.boxNumber}</td><td className="p-3 font-medium">{partTypeLabel(p.part_type)}</td><td className="p-3" dir="ltr">{formatCm(p.length)} cm</td><td className="p-3" dir="ltr">{p.width == null ? '—' : `${formatCm(p.width)} cm`}</td><td className="p-3 font-semibold">{p.quantity}</td></tr>)}</tbody></table></div>{!alucoRows.length && <div className="mt-3 rounded-lg border border-dashed p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">لا توجد قطع Aluco محسوبة بعد.</div>}</section>

    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">5. الإكسسوارات</h2><div className="flex flex-wrap gap-2">{accessoriesOnly.map((a, i) => <span key={`${a.accessory_type}-${i}`} className="rounded-md border px-3 py-2 text-sm" dir="ltr">{a.accessory_type}: <strong>{a.quantity}</strong></span>)}</div></section>

    {(resinPlans.length > 0 || alucoPlans.length > 0) && <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><div className="mb-5"><h2 className="text-xl font-semibold">6. مخططات القص المحفوظة</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">هذه هي نفس المخططات التي تم حفظها من صفحة Cut Optimizer، مع الحفاظ على النسبة الحقيقية بين أبعاد اللوح والقطع.</p></div>{resinPlans.length > 0 && <SavedCutPlanGroup title="Résine" plans={resinPlans}/>} {alucoPlans.length > 0 && <SavedCutPlanGroup title="Aluco" plans={alucoPlans}/>}</section>}
    <div className="mt-8 flex justify-center print:hidden"><Link href={`/workshop/${params.jobId}/purchases`} className="inline-flex items-center justify-center rounded-2xl bg-[hsl(var(--primary))] px-7 py-3 text-sm font-black text-[hsl(var(--primary-foreground))] shadow-sm transition hover:opacity-90">قائمة السلع</Link></div>
  </div></main>;
}

function SavedCutPlanGroup({ title, plans }: { title: string; plans: CutPlan[] }) {
  return <div className="mb-8 last:mb-0"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><h3 className="text-lg font-semibold">مخططات {title}</h3><span className="text-sm text-[hsl(var(--muted-foreground))]">{plans.length} لوح</span></div><div className="grid gap-5 lg:grid-cols-2">{plans.map(plan => { const d = plan.source_dimensions; return <article key={plan.id} className="break-inside-avoid overflow-hidden rounded-none border bg-[hsl(var(--card))] print:break-inside-avoid"><div className="flex items-center justify-between gap-3 border-b bg-[hsl(var(--card))] px-4 py-3"><div><strong className="text-sm">لوح #{d.sheet_index}</strong><p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]" dir="ltr">{formatCm(d.width)} × {formatCm(d.height)} cm</p></div><span className="text-sm font-bold">{(Number(d.utilization) * 100).toFixed(1)}% استغلال</span></div><div className="p-3 sm:p-4"><div className="relative w-full pt-7 pr-8"><div className="pointer-events-none absolute left-0 right-8 top-0 flex h-6 items-center justify-center gap-2 text-[9px] font-semibold text-slate-500" dir="ltr"><span className="h-px flex-1 bg-slate-300" /><span className="shrink-0 whitespace-nowrap">{formatCm(d.width)} cm</span><span className="h-px flex-1 bg-slate-300" /></div><div className="pointer-events-none absolute bottom-0 right-0 top-7 flex w-7 items-center justify-center"><div className="relative flex h-full w-full items-center justify-center"><span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300" /><span className="relative z-10 bg-[hsl(var(--card))] px-0.5 text-[9px] font-semibold text-slate-500" style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }} dir="ltr">{formatCm(d.height)} cm</span></div></div><div className="relative w-full overflow-hidden border border-slate-300 bg-[hsl(var(--muted))]" style={{ aspectRatio: `${Number(d.width)} / ${Number(d.height)}` }}>{(plan.placements || []).map(p => { const layout = getLabelLayout({ width: Number(p.width), height: Number(p.height), label: p.label, dimensionText: `${formatCm(p.width)} × ${formatCm(p.height)}` }); const horizontalDimension = `${formatCm(p.width)} cm`; const verticalDimension = `${formatCm(p.height)} cm`; const dimensionFontSize = Math.max(7, Math.min(10, Math.round(layout.fontSize * 0.78))); const labelFontSize = Math.max(8, Math.min(13, layout.fontSize)); return <div key={p.id} title={`${p.label} — ${formatCm(p.width)} × ${formatCm(p.height)}${p.rotated ? ' cm · مدوّرة' : ' cm'}`} className="absolute overflow-hidden border border-slate-300 bg-white/90 text-slate-800 transition print:transition-none" style={{ left: `${(Number(p.x) / Number(d.width)) * 100}%`, top: `${(Number(p.y) / Number(d.height)) * 100}%`, width: `${(Number(p.width) / Number(d.width)) * 100}%`, height: `${(Number(p.height) / Number(d.height)) * 100}%` }}><div className="pointer-events-none absolute inset-x-1 top-1 flex items-center gap-1" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1' }} dir="ltr"><span className="h-px flex-1 bg-slate-300" /><span className="shrink-0 whitespace-nowrap font-semibold text-slate-500">{horizontalDimension}</span><span className="h-px flex-1 bg-slate-300" /></div><div className="pointer-events-none absolute bottom-1 left-1 top-1 flex items-center justify-center" style={{ width: `${Math.max(14, dimensionFontSize + 5)}px` }}><div className="relative flex h-full w-full items-center justify-center"><span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300" /><span className="relative z-10 bg-white px-0.5 font-semibold text-slate-500" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }} dir="ltr">{verticalDimension}</span></div></div><div className="absolute inset-0 flex items-center justify-center px-5 py-5 text-center" style={{ fontSize: `${labelFontSize}px`, lineHeight: `${layout.lineHeight}px` }}><span className="max-w-[68%] break-words font-black leading-tight">{layout.labelLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span></div>{p.rotated && <span className="pointer-events-none absolute bottom-1 right-1 text-[8px] font-bold text-blue-600">↻</span>}</div>; })}</div></div><div className="flex items-center justify-between border-t border-slate-200 bg-white px-1 py-2.5 text-xs text-[hsl(var(--muted-foreground))]" dir="ltr"><span>Kerf: {formatCm(d.kerf)} cm</span><span dir="rtl">الهدر: {Number(plan.waste).toFixed(3)} m²</span></div></div></article>; })}</div></div>;
}
