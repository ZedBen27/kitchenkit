'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Part = {
  material: string;
  part_type: string;
  length: number;
  quantity: number;
};

type Accessory = {
  accessory_type: string;
  quantity: number;
};

type CutPlan = {
  material: 'Résine' | 'Aluco' | 'Resine';
};

type WorkshopLengths = {
  ouvrant_length: number | null;
  profile_1_depart_length: number | null;
  profile_2_depart_long_length: number | null;
  profile_2_depart_short_length: number | null;
};

type PurchaseRow = {
  key: string;
  material: string;
  quantity: number;
  unit: string;
  color: string;
};

const profileOrder = ['1Départ', '2 Départ Long', '2 Départ Court'];

const accessoryOrder = [
  'Coin 3 Départ',
  'Coin 2 Départ',
  'Coin Équerre',
  'Charnière',
  'Poignée',
  'Pied',
];

export default function WorkshopPurchasesPage() {
  const params = useParams<{ jobId: string }>();
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [resinSheets, setResinSheets] = useState(0);
  const [alucoSheets, setAlucoSheets] = useState(0);
  const [workshopLengths, setWorkshopLengths] = useState<WorkshopLengths>({
    ouvrant_length: null,
    profile_1_depart_length: null,
    profile_2_depart_long_length: null,
    profile_2_depart_short_length: null,
  });
  const [colors, setColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const supabase = getSupabaseBrowserClient();

        const { data: job, error: jobError } = await supabase
          .from('workshop_jobs')
          .select('project_id')
          .eq('id', params.jobId)
          .single();
        if (jobError) throw jobError;

        const [{ data: project, error: projectError }, { data: boxes, error: boxesError }, { data: savedRows, error: savedError }, { data: cutPlans, error: cutPlansError }] = await Promise.all([
          supabase.from('projects').select('name,organization_id').eq('id', job.project_id).single(),
          supabase.from('project_boxes').select('id').eq('project_id', job.project_id),
          supabase.from('workshop_purchases').select('material,color').eq('project_id', job.project_id),
          supabase.from('cut_plans').select('material').eq('project_id', job.project_id),
        ]);

        if (projectError) throw projectError;
        if (boxesError) throw boxesError;
        if (savedError) throw savedError;
        if (cutPlansError) throw cutPlansError;

        const { data: workshopSettings, error: workshopSettingsError } = await supabase
          .from('workshop_settings')
          .select('ouvrant_length,profile_1_depart_length,profile_2_depart_long_length,profile_2_depart_short_length')
          .eq('organization_id', project.organization_id)
          .maybeSingle();
        if (workshopSettingsError) throw workshopSettingsError;

        setProjectId(job.project_id);
        setProjectName(project.name || 'المشروع');
        setWorkshopLengths({
          ouvrant_length: workshopSettings?.ouvrant_length == null ? null : Number(workshopSettings.ouvrant_length),
          profile_1_depart_length: workshopSettings?.profile_1_depart_length == null ? null : Number(workshopSettings.profile_1_depart_length),
          profile_2_depart_long_length: workshopSettings?.profile_2_depart_long_length == null ? null : Number(workshopSettings.profile_2_depart_long_length),
          profile_2_depart_short_length: workshopSettings?.profile_2_depart_short_length == null ? null : Number(workshopSettings.profile_2_depart_short_length),
        });

        const boxIds = (boxes || []).map((box) => box.id);
        if (boxIds.length) {
          const [{ data: partRows, error: partError }, { data: accessoryRows, error: accessoryError }] = await Promise.all([
            supabase.from('box_parts').select('material,part_type,length,quantity').in('box_id', boxIds),
            supabase.from('box_accessories').select('accessory_type,quantity').in('box_id', boxIds),
          ]);
          if (partError) throw partError;
          if (accessoryError) throw accessoryError;
          setParts((partRows || []) as Part[]);
          setAccessories((accessoryRows || []) as Accessory[]);
        } else {
          setParts([]);
          setAccessories([]);
        }

        const plans = (cutPlans || []) as CutPlan[];
        setResinSheets(plans.filter((plan) => plan.material === 'Résine' || plan.material === 'Resine').length);
        setAlucoSheets(plans.filter((plan) => plan.material === 'Aluco').length);
        setColors(Object.fromEntries((savedRows || []).map((row) => [row.material, row.color || ''])));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة السلع.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.jobId]);

  const rows = useMemo<PurchaseRow[]>(() => {
    const totals = new Map<string, { material: string; quantity: number; unit: string; order: number }>();

    const add = (key: string, material: string, quantity: number, unit: string, order: number) => {
      const amount = Number(quantity || 0);
      if (amount <= 0) return;
      const current = totals.get(key);
      totals.set(key, {
        material,
        quantity: (current?.quantity || 0) + amount,
        unit,
        order: current?.order ?? order,
      });
    };

    const profileLengthTotals = new Map<string, number>();
    let ouvrantLengthTotal = 0;

    for (const part of parts) {
      const type = String(part.part_type || '').trim();
      const length = Number(part.length || 0);
      const quantity = Number(part.quantity || 0);
      if (!type || length <= 0 || quantity <= 0) continue;

      if (part.material === 'Profile' && profileOrder.includes(type)) {
        profileLengthTotals.set(type, (profileLengthTotals.get(type) || 0) + length * quantity);
      } else if (part.material === 'Ouvrant') {
        ouvrantLengthTotal += length * quantity;
      }
    }

    const barQuantity = (totalLength: number, barLength: number | null) => {
      if (totalLength <= 0 || !barLength || barLength <= 0) return 0;
      return Math.ceil(totalLength / barLength);
    };

    const profileBars = [
      { type: '1Départ', length: workshopLengths.profile_1_depart_length, order: 0 },
      { type: '2 Départ Long', length: workshopLengths.profile_2_depart_long_length, order: 1 },
      { type: '2 Départ Court', length: workshopLengths.profile_2_depart_short_length, order: 2 },
    ];

    profileBars.forEach(({ type, length, order }) => {
      const totalLength = profileLengthTotals.get(type) || 0;
      const quantity = barQuantity(totalLength, length);
      if (quantity > 0) add(`Profile:${type}`, `Profile — ${type}`, quantity, 'قضيب', order);
    });

    if (ouvrantLengthTotal > 0) {
      const quantity = barQuantity(ouvrantLengthTotal, workshopLengths.ouvrant_length);
      if (quantity > 0) add('Ouvrant', 'Ouvrant', quantity, 'قضيب', 3);
    }

    const accessoryTotals = new Map<string, number>();
    for (const accessory of accessories) {
      const type = String(accessory.accessory_type || '').trim();
      if (!type) continue;
      accessoryTotals.set(type, (accessoryTotals.get(type) || 0) + Number(accessory.quantity || 0));
    }
    accessoryOrder.forEach((type, index) => add(`Accessoire:${type}`, `Accessoire — ${type}`, accessoryTotals.get(type) || 0, 'قطعة', 10 + index));
    for (const [type, quantity] of accessoryTotals) {
      if (!accessoryOrder.includes(type)) add(`Accessoire:${type}`, `Accessoire — ${type}`, quantity, 'قطعة', 20);
    }

    if (resinSheets > 0) add('Résine', 'Résine', resinSheets, 'لوح كامل', 4);
    if (alucoSheets > 0) add('Aluco', 'Aluco', alucoSheets, 'لوح كامل', 5);

    return [...totals.entries()]
      .sort(([, a], [, b]) => a.order - b.order || a.material.localeCompare(b.material, 'fr'))
      .map(([key, row]) => ({ ...row, key, color: colors[key] || colors[row.material] || '' }));
  }, [parts, accessories, resinSheets, alucoSheets, workshopLengths, colors]);

  const setColor = (key: string, color: string) => {
    setColors((current) => ({ ...current, [key]: color }));
    setMessage('');
  };

  const saveColors = async () => {
    if (!projectId || !rows.length) return;
    try {
      setSaving(true);
      setMessage('');
      setError('');
      const supabase = getSupabaseBrowserClient();
      const payload = rows.map((row) => ({
        project_id: projectId,
        material: row.key,
        quantity: row.quantity,
        color: colors[row.key] || null,
      }));
      const { error: saveError } = await supabase
        .from('workshop_purchases')
        .upsert(payload, { onConflict: 'project_id,material' });
      if (saveError) throw saveError;
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
              <p className="mt-2 text-sm text-slate-500">{projectName || 'المشروع'} — جدول شراء مجمع من الحسابات ومخططات تحسين القص.</p>
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
              <p className="mt-1 text-xs text-slate-500">البروفيلات وOuvrant محسوبة من مجموع أطوال القطع ÷ طول القضيب القياسي، مع التقريب إلى قضيب كامل. Résine وAluco محسوبان كألواح كاملة من مخطط التحسين.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{rows.length} أصناف</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">#</th>
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">المادة / الصنف</th>
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">الكمية المطلوبة</th>
                  <th className="border-b border-slate-200 px-5 py-4 text-right font-bold">اللون</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">جارٍ إعداد جدول الشراء…</td></tr>
                ) : rows.length ? rows.map((row, index) => (
                  <tr key={row.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-bold text-slate-400">{index + 1}</td>
                    <td className="px-5 py-4 font-black text-slate-800">{row.material}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex min-w-16 items-center justify-center rounded-lg bg-slate-100 px-3 py-2 font-black text-slate-800">{row.quantity}</span>
                      <span className="mr-2 text-xs text-slate-400">{row.unit}</span>
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={colors[row.key] || ''}
                        onChange={(event) => setColor(row.key, event.target.value)}
                        placeholder="أدخل اللون…"
                        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 print:border-slate-300"
                      />
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-400">لا توجد سلع محسوبة بعد. اعتمد الحسابات ثم احفظ مخططات Résine وAluco من صفحة تحسين القص.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6 print:hidden">
            <p className="text-xs text-slate-500">الكميات تلقائية من أطوال القطع وإعدادات الورشة ومخطط القص؛ يمكنك تعديل اللون فقط.</p>
            <button onClick={saveColors} disabled={saving || loading || !rows.length} className="rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-black text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'جارٍ الحفظ…' : 'حفظ الألوان'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
