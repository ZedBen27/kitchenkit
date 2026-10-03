'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Structure = 'ET' | 'SET' | 'Eco';
type BoxType = 'Potager' | 'Element';
type Box = { number: number; length: string; height: string; depth: string; structure: Structure; boxType: BoxType; shelves: number; doors: 0 | 1 | 2 };
const emptyBox = (number: number): Box => ({ number, length: '', height: '', depth: '', structure: 'ET', boxType: 'Potager', shelves: 0, doors: 0 });

export default function BoxesPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const [boxes, setBoxes] = useState<Box[]>([emptyBox(1)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const validBoxes = useMemo(() => boxes.filter((b) => Number(b.length) > 0 && Number(b.height) > 0 && Number(b.depth) > 0), [boxes]);
  const update = (index: number, patch: Partial<Box>) => setBoxes((current) => current.map((box, i) => (i === index ? { ...box, ...patch } : box)));
  const addBox = () => setBoxes((current) => [...current, emptyBox(current.length + 1)]);
  const removeBox = (index: number) => setBoxes((current) => current.filter((_, i) => i !== index).map((box, i) => ({ ...box, number: i + 1 })));

  async function saveBoxes() {
    setSaving(true); setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول قبل حفظ الصناديق.');
      if (!validBoxes.length) throw new Error('أدخل أبعاد صندوق واحد على الأقل.');
      const { error: deleteError } = await supabase.from('project_boxes').delete().eq('project_id', params.projectId);
      if (deleteError) throw deleteError;
      const payload = validBoxes.map((box) => ({ project_id: params.projectId, number: box.number, structure: box.structure, box_type: box.boxType, shelves_count: box.shelves, doors_count: box.doors, length: Number(box.length) / 100, height: Number(box.height) / 100, depth: Number(box.depth) / 100 }));
      const { error: insertError } = await supabase.from('project_boxes').insert(payload);
      if (insertError) throw insertError;
      const { error: statusError } = await supabase.from('projects').update({ status: 'saved' }).eq('id', params.projectId);
      if (statusError) throw statusError;
      router.push(`/projects/${params.projectId}/calculation`);
    } catch (err) { setError(err instanceof Error ? err.message : 'تعذر حفظ الصناديق.'); } finally { setSaving(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><div className="mx-auto max-w-7xl px-6 py-8">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">المشروع / الصناديق</p><h1 className="text-3xl font-bold tracking-tight">تعريف الصناديق</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">أدخل أبعاد كل صندوق واختر الهيكل ونوع الصندوق والأبواب والرفوف.</p></div><button onClick={addBox} className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 font-semibold text-[hsl(var(--primary-foreground))]">+ إضافة صندوق</button></header>
    <div className="space-y-5">{boxes.map((box, index) => <section key={box.number} className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><div className="mb-5 flex items-center justify-between gap-3"><div><span className="text-sm text-[hsl(var(--muted-foreground))]">الصندوق</span><h2 className="text-xl font-semibold">#{box.number}</h2></div>{boxes.length > 1 && <button onClick={() => removeBox(index)} className="rounded-md px-3 py-2 text-sm text-[hsl(var(--destructive))]">حذف الصندوق</button>}</div><div className="grid gap-5 md:grid-cols-3"><Dimension label="L — الطول" value={box.length} onChange={(value) => update(index, { length: value })} /><Dimension label="H — الارتفاع" value={box.height} onChange={(value) => update(index, { height: value })} /><Dimension label="P — العمق" value={box.depth} onChange={(value) => update(index, { depth: value })} /></div><div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4"><SelectField label="Structure" value={box.structure} options={['ET', 'SET', 'Eco']} onChange={(value) => update(index, { structure: value as Structure })} /><SelectField label="نوع الصندوق" value={box.boxType} options={['Potager', 'Element']} onChange={(value) => update(index, { boxType: value as BoxType })} /><SelectField label="عدد الرفوف" value={String(box.shelves)} options={Array.from({ length: 9 }, (_, i) => String(i))} onChange={(value) => update(index, { shelves: Number(value) })} /><SelectField label="عدد الأبواب" value={String(box.doors)} options={['0', '1', '2']} onChange={(value) => update(index, { doors: Number(value) as 0 | 1 | 2 })} /></div><div className="mt-5 rounded-lg bg-[hsl(var(--muted))] p-4 text-sm"><strong>معاينة:</strong> {box.length || '—'} × {box.height || '—'} × {box.depth || '—'} cm · {box.structure} · {box.boxType} · {box.shelves} رف · {box.doors} باب</div></section>)}</div>
    {error && <div className="mt-5 rounded-lg border border-[hsl(var(--destructive))] p-4 text-sm text-[hsl(var(--destructive))]">{error}</div>}
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-[hsl(var(--card))] p-5"><div className="text-sm text-[hsl(var(--muted-foreground))]">{validBoxes.length} صندوق جاهز للحساب</div><button disabled={!validBoxes.length || saving} onClick={saveBoxes} className="rounded-lg bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حساب الصناديق والمتابعة'}</button></footer>
  </div></main>;
}

function Dimension({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><div className="flex"><input type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" className="min-w-0 flex-1 rounded-r-lg border bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" /><span className="flex items-center rounded-l-lg border border-r-0 bg-[hsl(var(--muted))] px-3 text-sm">cm</span></div></label>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2.5 outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
