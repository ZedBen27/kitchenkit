'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { optimizeCuts, partsFromCalculations } from '@/domain/optimization/cut-optimizer';
import { getLabelLayout } from '@/domain/optimization/label-layout';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toCutPlanInserts } from '@/domain/optimization/save-cut-plans';

type OptimizationObjective = 'min-sheets' | 'min-waste';
type DbPart = { id: string; box_id: string; material: string; part_type: string; length: number; width: number | null; quantity: number };
type DbBox = { id: string; number: number };

export default function CutOptimizerPage() {
  const params = useParams<{ jobId: string }>();
  const [parts, setParts] = useState<DbPart[]>([]);
  const [boxNumbers, setBoxNumbers] = useState<Map<string, number>>(new Map());
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [resinW, setResinW] = useState('2.44'); const [resinH, setResinH] = useState('1.22');
  const [alucoW, setAlucoW] = useState('2.44'); const [alucoH, setAlucoH] = useState('1.22'); const [kerf, setKerf] = useState('0.003');
  const [objective, setObjective] = useState<OptimizationObjective>('min-sheets');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');

  useEffect(() => { (async () => { try { const supabase = getSupabaseBrowserClient(); const { data: job, error: je } = await supabase.from('workshop_jobs').select('project_id').eq('id', params.jobId).single(); if (je) throw je; setProjectId(job.project_id); const [{ data: project, error: pe }, { data: boxes, error: be }] = await Promise.all([supabase.from('projects').select('name').eq('id', job.project_id).single(), supabase.from('project_boxes').select('id,number').eq('project_id', job.project_id).order('number')]); if (pe) throw pe; if (be) throw be; setProjectName(project.name); const boxRows = (boxes || []) as DbBox[]; setBoxNumbers(new Map(boxRows.map(b => [b.id, b.number]))); const boxIds = boxRows.map(b => b.id); if (!boxIds.length) return; const { data: rows, error: partError } = await supabase.from('box_parts').select('id,box_id,material,part_type,length,width,quantity').in('box_id', boxIds); if (partError) throw partError; setParts((rows || []) as DbPart[]); } catch (err) { setError(err instanceof Error ? err.message : 'تعذر تحميل قطع المشروع.'); } finally { setLoading(false); } })(); }, [params.jobId]);

  const calculated = useMemo(() => parts
    .filter(p => p.width != null && Number(p.width) > 0 && Number(p.length) > 0)
    .map(p => ({
      material: p.material,
      partType: `صندوق #${boxNumbers.get(p.box_id) ?? '?'} — ${p.part_type}`,
      length: Number(p.length),
      width: Number(p.width),
      quantity: Number(p.quantity),
    })), [parts, boxNumbers]);
  const resinParts = useMemo(() => partsFromCalculations(calculated, 'Résine'), [calculated]);
  const alucoParts = useMemo(() => partsFromCalculations(calculated, 'Aluco'), [calculated]);
  const resin = useMemo(() => resinParts.length ? optimizeCuts('Résine', { width: Number(resinW), height: Number(resinH) }, resinParts, Number(kerf), objective) : null, [resinParts, resinW, resinH, kerf, objective]);
  const aluco = useMemo(() => alucoParts.length ? optimizeCuts('Aluco', { width: Number(alucoW), height: Number(alucoH) }, alucoParts, Number(kerf), objective) : null, [alucoParts, alucoW, alucoH, kerf, objective]);

  async function savePlans() {
    if (!projectId || (!resin && !aluco)) return; setSaving(true); setError(''); setMessage('');
    try { const supabase = getSupabaseBrowserClient(); await supabase.from('cut_plans').delete().eq('project_id', projectId); const rows = [...(resin ? toCutPlanInserts(projectId, resin, Number(kerf)) : []), ...(aluco ? toCutPlanInserts(projectId, aluco, Number(kerf)) : [])]; if (rows.length) { const { error: insertError } = await supabase.from('cut_plans').insert(rows); if (insertError) throw insertError; } setMessage(`تم حفظ ${rows.length} مخطط/لوح للمشروع.`); } catch (err) { setError(err instanceof Error ? err.message : 'تعذر حفظ مخططات القص.'); } finally { setSaving(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto max-w-7xl px-6 py-8"><header className="mb-8"><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">الورشة / التحسين</p><h1 className="text-3xl font-bold">Cut Optimizer</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{projectName || 'المشروع'} — جميع قطع Résine وAluco القابلة للقص من كل الصناديق.</p></header>
    {error && <div className="mb-5 rounded-lg border p-4 text-sm text-[hsl(var(--destructive))]">{error}</div>}{message && <div className="mb-5 rounded-lg border p-4 text-sm">{message}</div>}
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-semibold">طريقة التحسين</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">اختر الأولوية التي سيستخدمها المحرك عند ترتيب الألواح.</p></div><div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl"><label className={`cursor-pointer rounded-lg border p-4 transition ${objective === 'min-sheets' ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/20' : ''}`}><span className="flex items-start gap-3"><input type="radio" name="optimization-objective" value="min-sheets" checked={objective === 'min-sheets'} onChange={() => setObjective('min-sheets')} className="mt-1"/><span><strong className="block">أقل عدد من الألواح</strong><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">يقلل عدد الألواح أولًا، ثم الهدر داخل هذا العدد.</span></span></span></label><label className={`cursor-pointer rounded-lg border p-4 transition ${objective === 'min-waste' ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/20' : ''}`}><span className="flex items-start gap-3"><input type="radio" name="optimization-objective" value="min-waste" checked={objective === 'min-waste'} onChange={() => setObjective('min-waste')} className="mt-1"/><span><strong className="block">أقل هدر ممكن</strong><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">يقلل مساحة البقايا أولًا، ثم عدد الألواح.</span></span></span></label></div></div></section>
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">أبعاد الألواح</h2><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5"><SheetField label="Résine — العرض" value={resinW} setValue={setResinW}/><SheetField label="Résine — الارتفاع" value={resinH} setValue={setResinH}/><SheetField label="Aluco — العرض" value={alucoW} setValue={setAlucoW}/><SheetField label="Aluco — الارتفاع" value={alucoH} setValue={setAlucoH}/><SheetField label="Kerf / سماكة القطع" value={kerf} setValue={setKerf}/></div><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">الوحدة: m.</p></section>
    {loading ? <div>جارٍ تحميل القطع...</div> : <>{!calculated.length && <div className="mb-6 rounded-lg border p-5">لا توجد قطع ألواح قابلة للقص بعد. اعتمد الحساب أولًا.</div>}{resin && <OptimizerResult title="Résine" result={resin}/>} {aluco && <OptimizerResult title="Aluco" result={aluco}/>} {(resin || aluco) && <button disabled={saving} onClick={savePlans} className="rounded-lg bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ مخططات التقطيع'}</button>}</>}
  </div></main>;
}

function SheetField({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><input type="number" min="0" step="0.001" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2.5"/></label>; }
function OptimizerResult({ title, result }: { title: string; result: ReturnType<typeof optimizeCuts> }) { const objectiveLabel = result.objective === 'min-sheets' ? 'أقل عدد من الألواح' : 'أقل هدر ممكن'; return <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-5 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">مخطط {title}</h2><p className="mt-1 text-xs font-medium text-[hsl(var(--primary))]">طريقة التحسين: {objectiveLabel}</p><p className="text-sm text-[hsl(var(--muted-foreground))]">{result.sheets.length} لوح · هدر {result.totalWasteArea.toFixed(3)} m² · استغلال {(result.totalUtilization * 100).toFixed(1)}%</p></div></div><div className="grid gap-5 lg:grid-cols-2">{result.sheets.map(sheet => <div key={sheet.sheetIndex} className="rounded-lg border p-4"><div className="mb-3 flex justify-between text-sm"><strong>لوح #{sheet.sheetIndex}</strong><span>{(sheet.utilization * 100).toFixed(1)}%</span></div><div className="relative aspect-[2/1] overflow-hidden border bg-[hsl(var(--muted))]"><div className="pointer-events-none absolute inset-x-0 top-1 z-10 text-center text-[10px] font-medium opacity-70">{sheet.width.toFixed(3)} × {sheet.height.toFixed(3)} m</div>{sheet.placements.map(p => { const layout = getLabelLayout({ width: p.width, height: p.height, label: p.label, dimensionText: `${p.width.toFixed(3)} × ${p.height.toFixed(3)} m` }); return <div key={p.id} title={`${p.label} — ${p.width.toFixed(3)} × ${p.height.toFixed(3)} m`} className="absolute flex flex-col items-center justify-center overflow-hidden border px-1 text-center" style={{ left: `${(p.x / sheet.width) * 100}%`, top: `${(p.y / sheet.height) * 100}%`, width: `${(p.width / sheet.width) * 100}%`, height: `${(p.height / sheet.height) * 100}%`, fontSize: `${layout.fontSize}px`, lineHeight: `${layout.lineHeight}px` }}><span className="max-w-full break-words font-semibold">{layout.labelLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span><span className="max-w-full break-words opacity-80">{layout.dimensionLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span></div>; })}</div></div>)}</div></section>; }
