'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  CircleHelp,
  Clock3,
  Layers3,
  Loader2,
  Maximize2,
  Save,
  Sparkles,
} from 'lucide-react';
import { optimizeCuts, partsFromCalculations, type OptimizationResult } from '@/domain/optimization/cut-optimizer';
import { getLabelLayout } from '@/domain/optimization/label-layout';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toCutPlanInserts } from '@/domain/optimization/save-cut-plans';

type DbPart = {
  id: string;
  box_id: string;
  material: string;
  part_type: string;
  length: number;
  width: number | null;
  quantity: number;
};

type DbBox = { id: string; number: number };

export default function CutOptimizerPage() {
  const params = useParams<{ jobId: string }>();
  const [parts, setParts] = useState<DbPart[]>([]);
  const [boxNumbers, setBoxNumbers] = useState<Map<string, number>>(new Map());
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [kerf, setKerf] = useState('0.003');
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resin, setResin] = useState<OptimizationResult | null>(null);
  const [aluco, setAluco] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: job, error: jobError } = await supabase
          .from('workshop_jobs')
          .select('project_id')
          .eq('id', params.jobId)
          .single();
        if (jobError) throw jobError;

        const [{ data: project, error: projectError }, { data: boxes, error: boxesError }] = await Promise.all([
          supabase.from('projects').select('name,organization_id').eq('id', job.project_id).single(),
          supabase.from('project_boxes').select('id,number').eq('project_id', job.project_id).order('number'),
        ]);
        if (projectError) throw projectError;
        if (boxesError) throw boxesError;
        if (cancelled) return;

        setProjectId(job.project_id);
        setProjectName(project.name);
        const { data: workshopSettings } = await supabase
          .from('workshop_settings')
          .select('kerf')
          .eq('organization_id', project.organization_id)
          .maybeSingle();
        if (!cancelled && workshopSettings) setKerf(String(workshopSettings.kerf));

        const boxRows = (boxes || []) as DbBox[];
        setBoxNumbers(new Map(boxRows.map((box) => [box.id, box.number])));
        const boxIds = boxRows.map((box) => box.id);
        if (!boxIds.length) return;

        const { data: rows, error: partsError } = await supabase
          .from('box_parts')
          .select('id,box_id,material,part_type,length,width,quantity')
          .in('box_id', boxIds);
        if (partsError) throw partsError;
        if (!cancelled) setParts((rows || []) as DbPart[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل قطع المشروع.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.jobId]);

  const calculated = useMemo(
    () => parts
      .filter((part) => part.width != null && Number(part.width) > 0 && Number(part.length) > 0)
      .map((part) => ({
        material: part.material,
        partType: `صندوق #${boxNumbers.get(part.box_id) ?? '?'} — ${part.part_type}`,
        length: Number(part.length),
        width: Number(part.width),
        quantity: Number(part.quantity),
      })),
    [parts, boxNumbers],
  );

  const resinParts = useMemo(() => partsFromCalculations(calculated, 'Résine'), [calculated]);
  const alucoParts = useMemo(() => partsFromCalculations(calculated, 'Aluco'), [calculated]);
  const resinPartQuantity = useMemo(
    () => resinParts.reduce((sum, part) => sum + Math.max(0, Number(part.quantity) || 0), 0),
    [resinParts],
  );
  const alucoPartQuantity = useMemo(
    () => alucoParts.reduce((sum, part) => sum + Math.max(0, Number(part.quantity) || 0), 0),
    [alucoParts],
  );

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setOptimizing(true);
      setError('');
      setMessage('');
      try {
        const [resinResult, alucoResult] = await Promise.all([
          resinParts.length
            ? optimizeCuts('Résine', { width: 2.44, height: 1.22 }, resinParts, Number(kerf))
            : Promise.resolve(null),
          alucoParts.length
            ? optimizeCuts('Aluco', { width: 2.44, height: 1.22 }, alucoParts, Number(kerf))
            : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setResin(resinResult);
          setAluco(alucoResult);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تشغيل محرك تحسين التقطيع.');
      } finally {
        if (!cancelled) setOptimizing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, resinParts, alucoParts, kerf]);

  async function savePlans() {
    if (saving) return;
    if (!projectId) {
      setError('لم يتم تحديد المشروع. أعد تحميل صفحة التحسين.');
      return;
    }
    if (!resin && !aluco) {
      setError('لا توجد مخططات جاهزة للحفظ بعد.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('جارٍ حفظ مخططات التقطيع...');
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('انتهت جلسة الدخول. سجّل الدخول ثم حاول حفظ المخططات مرة أخرى.');

      const { error: deleteError } = await supabase.from('cut_plans').delete().eq('project_id', projectId);
      if (deleteError) throw deleteError;

      const rows = [
        ...(resin ? toCutPlanInserts(projectId, resin, Number(kerf)) : []),
        ...(aluco ? toCutPlanInserts(projectId, aluco, Number(kerf)) : []),
      ];
      if (!rows.length) throw new Error('لم يتم إنشاء أي مخطط قابل للحفظ.');

      const { error: insertError } = await supabase.from('cut_plans').insert(rows);
      if (insertError) throw insertError;
      setMessage(`تم الحفظ بنجاح ✓ — ${rows.length} مخطط/لوح محفوظ للمشروع.`);
    } catch (err) {
      if (err && typeof err === 'object' && 'message' in err) {
        const dbError = err as { message?: string; details?: string; hint?: string; code?: string };
        setError([dbError.message, dbError.details, dbError.hint, dbError.code ? `(${dbError.code})` : ''].filter(Boolean).join(' — '));
        setMessage('');
      } else {
        setError('تعذر حفظ مخططات القص.');
        setMessage('');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50/70 text-slate-950">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span>الورشة</span><span className="text-slate-300">/</span><span>تحسين القص</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> التدوير مفعّل</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Sparkles className="h-6 w-6" /></div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">تحسين القص</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                    {projectName || 'المشروع'} · توزيع قطع Résine وAluco على أقل عدد ممكن من الألواح مع السماح بتدوير القطع.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[620px]">
              <MaterialSummary title="Résine" sheets={resin?.sheets.length || 0} pieces={resinPartQuantity} />
              <MaterialSummary title="Aluco" sheets={aluco?.sheets.length || 0} pieces={alucoPartQuantity} />
              <MiniStat icon={<Maximize2 className="h-4 w-4" />} label="المواد" value="2" />
            </div>
          </div>
        </header>

        {error && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0" /><p className="leading-6">{error}</p></div>}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          <span>أبعاد الألواح وKerf تُدار مركزيًا من إعدادات الورشة.</span>
          <a href="/workshop/settings" className="font-black text-slate-800 underline underline-offset-4">فتح إعدادات الورشة</a>
        </div>

        {loading ? <LoadingState text="جارٍ تحميل قطع المشروع..." /> : optimizing ? <LoadingState text="جارٍ البحث عن أفضل توزيع للقطع..." detail="نختبر التدوير وترتيب القطع قبل عرض النتيجة." /> : !calculated.length ? <EmptyState /> : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3 px-1"><div><h2 className="text-lg font-black">نتيجة التحسين</h2><p className="mt-1 text-xs text-slate-500">المخططات التالية جاهزة للمراجعة والحفظ.</p></div><span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 sm:inline-flex"><Clock3 className="h-3.5 w-3.5" /> محسّنة تلقائيًا</span></div>
            {resin && <OptimizerResult title="Résine" result={resin} />}
            {aluco && <OptimizerResult title="Aluco" result={aluco} />}
            {(resin || aluco) && <div className="sticky bottom-3 z-30 mt-6 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Check className="h-5 w-5" /></div><div><p className="text-sm font-black">المخططات جاهزة</p><p className="text-xs leading-5 text-slate-500">احفظ النتيجة لإظهارها في مستندات وطباعة المشروع.</p></div></div><button type="button" disabled={saving} onClick={savePlans} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'جارٍ الحفظ...' : 'حفظ مخططات التقطيع'}</button></div>{message && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</p>}</div>}
          </>
        )}
      </div>
    </main>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">{icon}{label}</div><p className="mt-1.5 truncate text-lg font-black tracking-tight text-slate-900">{value}</p></div>;
}

function MaterialSummary({ title, sheets, pieces }: { title: string; sheets: number; pieces: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="flex items-center gap-1.5 text-xs font-black text-slate-600"><Layers3 className="h-4 w-4" />{title}</div><div className="mt-1.5 flex items-end justify-between gap-2"><div><p className="text-[10px] font-semibold text-slate-400">الألواح</p><p className="text-lg font-black tracking-tight text-slate-900">{sheets.toLocaleString('fr-FR')}</p></div><div className="text-right"><p className="text-[10px] font-semibold text-slate-400">القطع</p><p className="text-sm font-black text-slate-700">{pieces.toLocaleString('fr-FR')}</p></div></div></div>;
}

function LoadingState({ text, detail }: { text: string; detail?: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Loader2 className="h-6 w-6 animate-spin" /></div><p className="mt-4 text-sm font-black">{text}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}

function EmptyState() {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Layers3 className="h-6 w-6" /></div><h2 className="mt-4 text-base font-black">لا توجد قطع قابلة للقص</h2><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">اعتمد حساب الصناديق أولًا، ثم ارجع إلى هذه الصفحة لإنتاج مخططات القص.</p></div>;
}

function OptimizerResult({ title, result }: { title: string; result: OptimizationResult }) {
  const totalUsedArea = result.sheets.reduce((sum, sheet) => sum + sheet.usedArea, 0);
  return <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black tracking-tight">مخطط {title}</h2><p className="mt-1 text-xs text-slate-500">{result.sheets.length} لوح · {totalUsedArea.toFixed(2)} m² مستخدمة · هدر {result.totalWasteArea.toFixed(2)} m²</p></div><div className="flex flex-wrap gap-2 text-xs font-bold"><Metric label="الألواح" value={String(result.sheets.length)} /><Metric label="الاستغلال" value={`${(result.totalUtilization * 100).toFixed(1)}%`} /><Metric label="التدوير" value="مفعّل" /></div></div></div><div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">{result.sheets.map((sheet) => <SheetCard key={sheet.sheetIndex} sheet={sheet} />)}</div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400">{label}</span><strong className="mr-1.5 text-slate-800">{value}</strong></div>;
}

function SheetCard({ sheet }: { sheet: OptimizationResult['sheets'][number] }) {
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3"><div><p className="text-sm font-black">لوح #{sheet.sheetIndex}</p><p className="mt-0.5 text-[11px] text-slate-400">{sheet.width.toFixed(3)} × {sheet.height.toFixed(3)} m</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{(sheet.utilization * 100).toFixed(1)}%</span></div>
    <div className="p-3 sm:p-4">
      <div className="relative w-full pt-7 pr-8">
        <div className="pointer-events-none absolute left-0 right-8 top-0 flex h-6 items-center justify-center gap-2 text-[9px] font-semibold text-slate-500"><span className="h-px flex-1 bg-slate-300" /><span className="shrink-0 whitespace-nowrap">{sheet.width.toFixed(3)} m</span><span className="h-px flex-1 bg-slate-300" /></div>
        <div className="pointer-events-none absolute bottom-0 right-0 top-7 flex w-7 items-center justify-center"><div className="relative flex h-full w-full items-center justify-center"><span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300" /><span className="relative z-10 bg-slate-50 px-0.5 text-[9px] font-semibold text-slate-500" style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>{sheet.height.toFixed(3)} m</span></div></div>

        <div className="relative w-full overflow-hidden rounded-none border border-slate-300 bg-slate-100" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}>
          {sheet.placements.map((placement) => {
            const layout = getLabelLayout({ width: placement.width, height: placement.height, label: placement.label, dimensionText: `${placement.width.toFixed(3)} × ${placement.height.toFixed(3)} m` });
            const horizontalDimension = `${placement.width.toFixed(3)} m`;
            const verticalDimension = `${placement.height.toFixed(3)} m`;
            const dimensionFontSize = Math.max(7, Math.min(10, Math.round(layout.fontSize * 0.78)));
            const labelFontSize = Math.max(8, Math.min(13, layout.fontSize));
            return <div key={placement.id} title={`${placement.label} — ${placement.width.toFixed(3)} × ${placement.height.toFixed(3)}${placement.rotated ? ' m · مدوّرة' : ' m'}`} className="absolute overflow-hidden border border-slate-300 bg-white/90 text-slate-800 transition hover:z-20 hover:bg-white hover:shadow-lg" style={{ left: `${(placement.x / sheet.width) * 100}%`, top: `${(placement.y / sheet.height) * 100}%`, width: `${(placement.width / sheet.width) * 100}%`, height: `${(placement.height / sheet.height) * 100}%` }}>
              <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center gap-1" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1' }}><span className="h-px flex-1 bg-slate-300" /><span className="shrink-0 whitespace-nowrap font-semibold text-slate-500">{horizontalDimension}</span><span className="h-px flex-1 bg-slate-300" /></div>
              <div className="pointer-events-none absolute bottom-1 left-1 top-1 flex items-center justify-center" style={{ width: `${Math.max(14, dimensionFontSize + 5)}px` }}><div className="relative flex h-full w-full items-center justify-center"><span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-300" /><span className="relative z-10 bg-white px-0.5 font-semibold text-slate-500" style={{ fontSize: `${dimensionFontSize}px`, lineHeight: '1', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>{verticalDimension}</span></div></div>
              <div className="absolute inset-0 flex items-center justify-center px-5 py-5 text-center" style={{ fontSize: `${labelFontSize}px`, lineHeight: `${layout.lineHeight}px` }}><span className="max-w-[68%] break-words font-black leading-tight">{layout.labelLines.map((line, index) => <span key={index} className="block">{line}</span>)}</span></div>
              {placement.rotated && <span className="pointer-events-none absolute bottom-1 right-1 text-[8px] font-bold text-blue-600">↻</span>}
            </div>;
          })}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500"><span>{sheet.placements.length} قطعة على اللوح</span><span>هدر {sheet.wasteArea.toFixed(2)} m²</span></div>
    </div>
  </article>;
}
