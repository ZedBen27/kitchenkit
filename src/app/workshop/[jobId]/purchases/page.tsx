'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Part = { material: string; category: string; quantity: number };
type Accessory = { quantity: number };
type PurchaseRow = { material: string; quantity: number; color: string };

export default function WorkshopPurchasesPage() {
  const params = useParams<{ jobId: string }>();
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseBrowserClient();
        const { data: job, error: jobError } = await supabase
          .from('workshop_jobs')
          .select('project_id')
          .eq('id', params.jobId)
          .single();
        if (jobError) throw jobError;

        const [{ data: project, error: projectError }, { data: boxes, error: boxesError }] = await Promise.all([
          supabase.from('projects').select('name').eq('id', job.project_id).single(),
          supabase.from('project_boxes').select('id').eq('project_id', job.project_id),
        ]);
        if (projectError) throw projectError;
        if (boxesError) throw boxesError;

        setProjectId(job.project_id);
        setProjectName(project.name || 'المشروع');

        const boxIds = (boxes || []).map((box) => box.id);
        if (!boxIds.length) {
          setLoading(false);
          return;
        }

        const [{ data: partRows, error: partError }, { data: accessoryRows, error: accessoryError }, { data: savedRows, error: savedError }] = await Promise.all([
          supabase.from('box_parts').select('material,category,quantity').in('box_id', boxIds),
          supabase.from('box_accessories').select('quantity').in('box_id', boxIds),
          supabase.from('workshop_purchases').select('material,color').eq('project_id', job.project_id),
        ]);
        if (partError) throw partError;
        if (accessoryError) throw accessoryError;
        if (savedError) throw savedError;

        setParts((partRows || []) as Part[]);
        setAccessories((accessoryRows || []) as Accessory[]);
        setColors(Object.fromEntries((savedRows || []).map((row) => [row.material, row.color || ''])));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة السلع.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.jobId]);

  const rows = useMemo<PurchaseRow[]>(() => {
    const totals = new Map<string, number>();
    for (const part of parts) {
      const material = String(part.material || '').trim() || 'غير محدد';
      totals.set(material, (totals.get(material) || 0) + Number(part.quantity || 0));
    }
    const accessoryTotal = accessories.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (accessoryTotal > 0) totals.set('Accessoire', (totals.get('Accessoire') || 0) + accessoryTotal);

    return Array.from(totals.entries())
      .filter(([, quantity]) => quantity > 0)
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([material, quantity]) => ({ material, quantity, color: colors[material] || '' }));
  }, [parts, accessories, colors]);

  const setColor = (material: string, color: string) => {
    setColors((current) => ({ ...current, [material]: color }));
    setMessage('');
  };

  const saveColors = async () => {
    if (!projectId) return;
    try {
      setSaving(true);
      setMessage('');
      const supabase = getSupabaseBrowserClient();
      const payload = rows.map((row) => ({
        project_id: projectId,
        material: row.material,
        quantity: row.quantity,
        color: colors[row.material] || null,
      }));
      if (payload.length) {
        const { error: saveError } = await supabase.from('workshop_purchases').upsert(payload, { onConflict: 'project_id,material' });
        if (saveError) throw saveError;
      }
      setMessage('تم حفظ ألوان السلع بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ ألوان السلع.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-500">الورشة / المشتريات</p>
              <h1 className="text-3xl font-black tracking-tight">قائمة السلع</h1>
              <p className="mt-2 text-sm text-slate-500">{projectName || 'المشروع'} — الكميات مجمعة تلقائياً من حسابات جميع المطابخ.</p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link href={`/workshop/${params.jobId}/documents`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">العودة للوثائق</Link>
              <button onClick={() => window.print()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">طباعة جدول الشراء</button>
            </div>
          </div>
        </header>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        {message && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:border-slate-300 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-black">جدول الشراء</h2>
              <p className="mt-1 text-xs text-slate-500">الكمية للقراءة فقط وتُحدّث من الحسابات. اللون يُدخل يدوياً.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{rows.length} أصناف</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">#</th>
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">المادة</th>
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">الكمية المطلوبة</th>
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">اللون</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">جارٍ حساب قائمة السلع…</td></tr>
                ) : rows.length ? rows.map((row, index) => (
                  <tr key={row.material} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-bold text-slate-400">{index + 1}</td>
                    <td className="px-5 py-4 font-black text-slate-800">{row.material}</td>
                    <td className="px-5 py-4"><span className="inline-flex min-w-16 items-center justify-center rounded-lg bg-slate-100 px-3 py-2 font-black text-slate-800">{row.quantity}</span> <span className="mr-1 text-xs text-slate-400">قطعة</span></td>
                    <td className="px-5 py-3">
                      <input
                        value={colors[row.material] || ''}
                        onChange={(event) => setColor(row.material, event.target.value)}
                        placeholder="أدخل اللون…"
                        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 print:border-slate-300"
                      />
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">لا توجد سلع محسوبة بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6 print:hidden">
            <p className="text-xs text-slate-500">يمكنك تعديل اللون في أي وقت، بينما الكمية مرتبطة بالحسابات تلقائياً.</p>
            <button onClick={saveColors} disabled={saving || loading || !rows.length} className="rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-black text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'جارٍ الحفظ…' : 'حفظ الألوان'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
