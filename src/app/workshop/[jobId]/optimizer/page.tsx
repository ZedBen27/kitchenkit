'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { optimizeCuts, partsFromCalculations, CutPart } from '@/domain/optimization/cut-optimizer';
import { getLabelLayout } from '@/domain/optimization/label-layout';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { toCutPlanInserts } from '@/domain/optimization/save-cut-plans';

type DbPart = { id: string; material: string; part_type: string; length: number; width: number | null; quantity: number };

export default function CutOptimizerPage() {
  const params = useParams<{ jobId: string }>();
  const [parts, setParts] = useState<DbPart[]>([]);
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [resinW, setResinW] = useState('2.44'); const [resinH, setResinH] = useState('1.22');
  const [alucoW, setAlucoW] = useState('2.44'); const [alucoH, setAlucoH] = useState('1.22'); const [kerf, setKerf] = useState('0.003');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');

  useEffect(() => { (async () => { try { const supabase = getSupabaseBrowserClient(); const { data: job, error: je } = await supabase.from('workshop_jobs').select('project_id').eq('id', params.jobId).single(); if (je) throw je; setProjectId(job.project_id); const [{ data: project, error: pe }, { data: boxes, error: be }] = await Promise.all([supabase.from('projects').select('name').eq('id', job.project_id).single(), supabase.from('project_boxes').select('id').eq('project_id', job.project_id)]); if (pe) throw pe; if (be) throw be; setProjectName(project.name); const boxIds = (boxes || []).map(b => b.id); if (!boxIds.length) return; const { data: rows, error: partError } = await supabase.from('box_parts').select('id,material,part_type,length,width,quantity').in('box_id', boxIds); if (partError) throw partError; setParts((rows || []) as DbPart[]); } catch (err) { setError(err instanceof Error ? err.message : 'تعذر تحميل قطع المشروع.'); } finally { setLoading(false); } })(); }, [params.jobId]);

  const calculated = useMemo(() => parts.filter(p => p.width != null && Number(p.width) > 0 && Number(p.length) > 0), [parts]);
  const resinParts = useMemo(() => partsFromCalculations(calculated, 'Résine'), [calculated]);
  const alucoParts = useMemo(() => partsFromCalculations(calculated, 'Aluco'), [calculated]);
  const resin = useMemo(() => resinParts.length ? optimizeCuts('Résine', { width: Number(resinW), height: Number(resinH) }, resinParts, Number(kerf)) : null, [resinParts, resinW, resinH, kerf]);
  const aluco = useMemo(() => alucoParts.length ? optimizeCuts('Aluco', { width: Number(alucoW), height: Number(alucoH) }, alucoParts, Number(kerf)) : null, [alucoParts, alucoW, alucoH, kerf]);

  async function savePlans() {
    if (!projectId || (!resin && !aluco)) return; setSaving(true); setError(''); setMessage('');
    try { const supabase = getSupabaseBrowserClient(); await supabase.from('cut_plans').delete().eq('project_id', projectId); const rows = [...(resin ? toCutPlanInserts(projectId, resin, Number(kerf)) : []), ...(aluco ? toCutPlanInserts(projectId, aluco, Number(kerf)) : [])]; if (rows.length) { const { error: insertError } = await supabase.from('cut_plans').insert(rows); if (insertError) throw insertError; } setMessage(`تم حفظ ${rows.length} مخطط/لوح للمشروع.`); } catch (err) { setError(err instanceof Error ? err.message : 'تعذر حفظ مخططات القص.'); } finally { setSaving(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto max-w-7xl px-6 py-8"><header className="mb-8"><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">الورشة / التحسين</p><h1 className="text-3xl font-bold">Cut Optimizer</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{projectName || 'المشروع'} — جميع القطع الحقيقية المحسوبة للمشروع.</p></header>
    {error && <div className="mb-5 rounded-lg border p-4 text-sm text-[hsl(var(--destructive))]">{error}</div>}{message && <div className="mb-5 rounded-lg border p-4 text-sm">{message}</div>}
    <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><h2 className="mb-4 text-lg font-semibold">أبعاد الألواح</h2><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5"><SheetField label="Résine — العرض" value={resinW} setValue={setResinW}/><SheetField label="Résine — الارتفاع" value={resinH} setValue={setResinH}/><SheetField label="Aluco — العرض" value={alucoW} setValue={setAlucoW}/><SheetField label="Aluco — الارتفاع" value={alucoH} setValue={setAlucoH}/><SheetField label="Kerf / سماكة القطع" value={kerf} setValue={setKerf}/></div><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">الوحدة: m.</p></section>
    {loading ? <div>جارٍ تحميل القطع...</div> : <>{!calculated.length && <div className="mb-6 rounded-lg border p-5">لا توجد قطع ألواح قابلة للقص بعد. اعتمد الحساب أولًا.</div>}{resin && <OptimizerResult title="Résine" result={resin}/>} {aluco && <OptimizerResult title="Aluco" result={aluco}/>} {(resin || aluco) && <button disabled={saving} onClick={savePlans} className="rounded-lg bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ مخططات التقطيع'}</button>}</>}
  </div></main>;
}

function SheetField({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><input type="number" min="0" step="0.001" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2.5"/></label>; }
function OptimizerResult({ title, result }: { title: string; result: ReturnType<typeof optimizeCuts> }) { return <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-5 flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">مخطط {title}</h2><p className="text-sm text-[hsl(var(--muted-foreground))]">{result.sheets.length} لوح · هدر {result.totalWasteArea.toFixed(3)} m² · استغلال {(result.totalUtilization * 100).toFixed(1)}%</p></div></div><div className="grid gap-5 lg:grid-cols-2">{result.sheets.map(sheet => <div key={sheet.sheetIndex} className="rounded-lg border p-4"><div className="mb-3 flex justify-between text-sm"><strong>لوح #{sheet.sheetIndex}</strong><span>{(sheet.utilization * 100).toFixed(1)}%</span></div><div className="relative aspect-[2/1] overflow-hidden border bg-[hsl(var(--muted))]">{sheet.placements.map(p => { const layout = getLabelLayout({ width: p.width, height: p.height, label: p.label, dimensionText: `${p.width.toFixed(3)} × ${p.height.toFixed(3)} m` }); return <div key={p.id} title={`${p.label} — ${p.width.toFixed(3)} × ${p.height.toFixed(3)} m`} className="absolute flex flex-col items-center justify-center overflow-hidden border px-1 text-center" style={{ left: `${(p.x / sheet.width) * 100}%`, top: `${(p.y / sheet.height) * 100}%`, width: `${(p.width / sheet.width) * 100}%`, height: `${(p.height / sheet.height) * 100}%`, fontSize: `${layout.fontSize}px`, lineHeight: `${layout.lineHeight}px` }}><span className="max-w-full break-words font-semibold">{layout.labelLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span><span className="max-w-full break-words opacity-80">{layout.dimensionLines.map((line, i) => <span key={i} className="block">{line}</span>)}</span></div>; })}</div></div>)}</div></section>; }
