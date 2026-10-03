'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Layers3,
  Loader2,
  Maximize2,
  RefreshCw,
  Ruler,
  Save,
  Settings2,
  Sparkles,
  SquareStack,
  Trash2,
} from 'lucide-react';
import { optimizeCuts, partsFromCalculations, type OptimizationResult } from '@/domain/optimization/cut-optimizer';
import { getLabelLayout } from '@/domain/optimization/label-layout';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toCutPlanInserts } from '@/domain/optimization/save-cut-plans';

type DbPart = { id: string; box_id: string; material: string; part_type: string; length: number; width: number | null; quantity: number };
type DbBox = { id: string; number: number };

type FieldProps = {
  label: string;
  value: string;
  setValue: (value: string) => void;
  hint?: string;
};

export default function CutOptimizerPage() {
  const params = useParams<{ jobId: string }>();
  const [parts, setParts] = useState<DbPart[]>([]);
  const [boxNumbers, setBoxNumbers] = useState<Map<string, number>>(new Map());
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [resinW, setResinW] = useState('2.44');
  const [resinH, setResinH] = useState('1.22');
  const [alucoW, setAlucoW] = useState('2.44');
  const [alucoH, setAlucoH] = useState('1.22');
  const [kerf, setKerf] = useState('0.003');
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resin, setResin] = useState<OptimizationResult | null>(null);
  const [aluco, setAluco] = useState<OptimizationResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: job, error: je } = await supabase.from('workshop_jobs').select('project_id').eq('id', params.jobId).single();
        if (je) throw je;
        setProjectId(job.project_id);

        const [{ data: project, error: pe }, { data: boxes, error: be }] = await Promise.all([
          supabase.from('projects').select('name').eq('id', job.project_id).single(),
          supabase.from('project_boxes').select('id,number').eq('project_id', job.project_id).order('number'),
        ]);
        if (pe) throw pe;
        if (be) throw be;

        setProjectName(project.name);
        const boxRows = (boxes || []) as DbBox[];
        setBoxNumbers(new Map(boxRows.map((box) => [box.id, box.number])));
        const boxIds = boxRows.map((box) => box.id);
        if (!boxIds.length) return;

        const { data: rows, error: partError } = await supabase
          .from('box_parts')
          .select('id,box_id,material,part_type,length,width,quantity')
          .in('box_id', boxIds);
        if (partError) throw partError;
        setParts((rows || []) as DbPart[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل قطع المشروع.');
      } finally {
        setLoading(false);
      }
    })();
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
  const totalPartQuantity = useMemo(() => calculated.reduce((sum, part) => sum + Math.max(0, Number(part.quantity) || 0), 0), [calculated]);
  const totalSheets = (resin?.sheets.length || 0) + (aluco?.sheets.length || 0);
  const totalWaste = (resin?.totalWasteArea || 0) + (aluco?.totalWasteArea || 0);

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
            ? optimizeCuts('Résine', { width: Number(resinW), height: Number(resinH) }, resinParts, Number(kerf))
            : Promise.resolve(null),
          alucoParts.length
            ? optimizeCuts('Aluco', { width: Number(alucoW), height: Number(alucoH) }, alucoParts, Number(kerf))
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
  }, [loading, resinParts, alucoParts, resinW, resinH, alucoW, alucoH, kerf]);

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
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span>الورشة</span><span className="text-slate-300">/</span><span>تحسين القص</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> التدوير مفعل</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">تحسين القص</h1>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                    {projectName || 'المشروع'} · توزيع قطع Résine وAluco على أقل عدد ممكن من الألواح مع السماح بتدوير القطع.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
              <MiniStat icon={<SquareStack className="h-4 w-4" />} label="قطع" value={totalPartQuantity.toLocaleString('fr-FR')} />
              <MiniStat icon={<Layers3 className="h-4 w-4" />} label="الألواح" value={totalSheets.toLocaleString('fr-FR')} />
              <MiniStat icon={<Maximize2 className="h-4 w-4" />} label="المواد" value="2" />
              <MiniStat icon={<Trash2 className="h-4 w-4" />} label="الهدر" value={`${totalWaste.toFixed(2)} m²`} />
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="leading-6">{error}</p>
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right transition hover:bg-slate-50 sm:px-6"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Settings2 className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-black">إعدادات الألواح</span>
                <span className="mt-0.5 block text-xs text-slate-500">الأبعاد الفعلية للوح وسماكة القطع (Kerf)</span>
              </span>
            </span>
            <ChevronDown className={`h-5 w-5 text-slate-400 transition ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {settingsOpen && (
            <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <MaterialSettings
                  title="Résine"
                  accent="violet"
                  width={resinW}
                  height={resinH}
                  setWidth={setResinW}
                  setHeight={setResinH}
                />
                <MaterialSettings
                  title="Aluco"
                  accent="sky"
                  width={alucoW}
                  height={alucoH}
                  setWidth={setAlucoW}
                  setHeight={setAlucoH}
                />
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><Ruler className="h-4 w-4 text-slate-600" /></div>
                  <div><p className="text-sm font-bold">سماكة القطع / Kerf</p><p className="text-xs text-slate-500">المسافة التي تستهلكها شفرة القص بين قطعتين.</p></div>
                </div>
                <div className="w-full sm:max-w-[180px]"><SheetField label="Kerf بالمتر" value={kerf} setValue={setKerf} /></div>
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <LoadingState text="جارٍ تحميل قطع المشروع..." />
        ) : optimizing ? (
          <LoadingState text="جارٍ البحث عن أفضل توزيع للقطع..." detail="نختبر التدوير وترتيب القطع قبل عرض النتيجة." />
        ) : !calculated.length ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div><h2 className="text-lg font-black">نتيجة التحسين</h2><p className="mt-1 text-xs text-slate-500">المخططات التالية جاهزة للمراجعة والحفظ.</p></div>
              <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 sm:inline-flex"><Clock3 className="h-3.5 w-3.5" /> محسّنة تلقائيًا</span>
            </div>
            {resin && <OptimizerResult title="Résine" result={resin} />}
            {aluco && <OptimizerResult title="Aluco" result={aluco} />}

            {(resin || aluco) && (
              <div className="sticky bottom-3 z-30 mt-6 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_15px_45px_rgba(15,23,42,0.12)] backdrop-blur sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Check className="h-5 w-5" /></div>
                    <div><p className="text-sm font-black">المخططات جاهزة</p><p className="text-xs leading-5 text-slate-500">احفظ النتيجة لإظهارها في مستندات وطباعة المشروع.</p></div>
                  </div>
                  <button type="button" disabled={saving} onClick={savePlans} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'جارٍ الحفظ...' : 'حفظ مخططات التقطيع'}
                  </button>
                </div>
                {message && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{message}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"><div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">{icon}{label}</div><p className="mt-1.5 truncate text-lg font-black tracking-tight text-slate-900">{value}</p></div>;
}

function MaterialSettings({ title, accent, width, height, setWidth, setHeight }: { title: string; accent: 'violet' | 'sky'; width: string; height: string; setWidth: (value: string) => void; setHeight: (value: string) => void }) {
  const accentClasses = accent === 'violet' ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-sky-50 text-sky-700 border-sky-100';
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><span className={`rounded-full border px-3 py-1 text-xs font-black ${accentClasses}`}>{title}</span><span className="text-xs text-slate-400">عرض × ارتفاع · m</span></div><div className="grid grid-cols-2 gap-3"><SheetField label="العرض" value={width} setValue={setWidth} /><SheetField label="الارتفاع" value={height} setValue={setHeight} /></div></div>;
}

function SheetField({ label, value, setValue, hint }: FieldProps) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><div className="relative"><input type="number" min="0" step="0.001" value={value} onChange={(event) => setValue(event.target.value)} aria-label={label} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />{hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}</div></label>;
}

function LoadingState({ text, detail }: { text: string; detail?: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Loader2 className="h-6 w-6 animate-spin" /></div><p className="mt-4 text-sm font-black">{text}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}

function EmptyState() {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Layers3 className="h-6 w-6" /></div><h2 className="mt-4 text-base font-black">لا توجد قطع قابلة للقص</h2><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">اعتمد حساب الصناديق أولًا، ثم ارجع إلى هذه الصفحة لإنتاج مخططات القص.</p></div>;
}

function OptimizerResult({ title, result }: { title: string; result: OptimizationResult }) {
  const totalUsedArea = result.sheets.reduce((sum, sheet) => sum + sheet.usedArea, 0);
  return <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]">
    <div className="border-b border-slate-100 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${title === 'Résine' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}><Layers3 className="h-5 w-5" /></div><div><h2 className="text-xl font-black tracking-tight">مخطط {title}</h2><p className="mt-1 text-xs text-slate-500">{result.sheets.length} لوح · {totalUsedArea.toFixed(2)} m² مستخدمة · هدر {result.totalWasteArea.toFixed(2)} m²</p></div></div>
        <div className="flex flex-wrap gap-2 text-xs font-bold"><Metric label="الألواح" value={String(result.sheets.length)} /><Metric label="الاستغلال" value={`${(result.totalUtilization * 100).toFixed(1)}%`} /><Metric label="التدوير" value="مفعّل" /></div>
      </div>
    </div>
    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">
      {result.sheets.map((sheet) => <SheetCard key={sheet.sheetIndex} sheet={sheet} />)}
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400">{label}</span><strong className="mr-1.5 text-slate-800">{value}</strong></div>;
}

function SheetCard({ sheet }: { sheet: OptimizationResult['sheets'][number] }) {
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 transition hover:border-slate-300 hover:shadow-md">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3"><div><p className="text-sm font-black">لوح #{sheet.sheetIndex}</p><p className="mt-0.5 text-[11px] text-slate-400">{sheet.width.toFixed(3)} × {sheet.height.toFixed(3)} m</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{(sheet.utilization * 100).toFixed(1)}%</span></div>
    <div className="p-3 sm:p-4"><div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ aspectRatio: `${sheet.width} / ${sheet.height}` }}>
      <div className="pointer-events-none absolute inset-x-0 top-1.5 z-10 text-center text-[9px] font-bold text-slate-400">{sheet.width.toFixed(3)} × {sheet.height.toFixed(3)} m</div>
      {sheet.placements.map((placement) => {
        const layout = getLabelLayout({ width: placement.width, height: placement.height, label: placement.label, dimensionText: `${placement.width.toFixed(3)} × ${placement.height.toFixed(3)} m` });
        return <div key={placement.id} title={`${placement.label} — ${placement.width.toFixed(3)} × ${placement.height.toFixed(3)}${placement.rotated ? ' m · مدوّرة' : ' m'}`} className="absolute flex flex-col items-center justify-center overflow-hidden border border-slate-300 bg-white/85 px-1 text-center text-slate-800 transition hover:z-20 hover:bg-white hover:shadow-lg" style={{ left: `${(placement.x / sheet.width) * 100}%`, top: `${(placement.y / sheet.height) * 100}%`, width: `${(placement.width / sheet.width) * 100}%`, height: `${(placement.height / sheet.height) * 100}%`, fontSize: `${layout.fontSize}px`, lineHeight: `${layout.lineHeight}px` }}>
          <span className="max-w-full break-words font-black">{layout.labelLines.map((line, index) => <span key={index} className="block">{line}</span>)}</span>
          <span className="max-w-full break-words text-slate-500">{layout.dimensionLines.map((line, index) => <span key={index} className="block">{line}</span>)}</span>
          {placement.rotated && <span className="mt-0.5 text-[9px] font-bold text-blue-600">↻</span>}
        </div>;
      })}
    </div></div>
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500"><span>{sheet.placements.length} قطعة على اللوح</span><span>هدر {sheet.wasteArea.toFixed(2)} m²</span></div>
  </article>;
}
