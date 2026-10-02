'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const defaults = { a: '5.3', b: '1.7', b2: '3.4', c: '4', t: '', r: '' };
const cmToM = (value: string) => Number(value) / 100;
const mmToM = (value: string) => Number(value) / 1000;

export default function NewProjectPage() {
  const router = useRouter();
  const [handles, setHandles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول قبل إنشاء مشروع.');

      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) throw new Error('لا توجد مؤسسة مرتبطة بهذا الحساب.');

      const clientName = String(form.get('clientName') || '').trim();
      const clientPayload = {
        organization_id: membership.organization_id,
        name: clientName,
        phone: String(form.get('phone') || '').trim() || null,
        address: String(form.get('address') || '').trim() || null,
      };
      const { data: client, error: clientError } = await supabase
        .from('clients').insert(clientPayload).select('id').single();
      if (clientError) throw clientError;

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({ organization_id: membership.organization_id, client_id: client.id, name: String(form.get('projectName')), status: 'draft' })
        .select('id').single();
      if (projectError) throw projectError;

      const { error: settingsError } = await supabase.from('project_settings').insert({
        project_id: project.id,
        a: cmToM(String(form.get('a'))),
        b: cmToM(String(form.get('b'))),
        b2: cmToM(String(form.get('b2'))),
        c: mmToM(String(form.get('c'))),
        t: String(form.get('t') || '') ? cmToM(String(form.get('t'))) : null,
        r: String(form.get('r') || '') ? cmToM(String(form.get('r'))) : null,
        handles_enabled: handles,
      });
      if (settingsError) throw settingsError;

      router.push(`/projects/${project.id}/boxes`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ المشروع.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">المشاريع / مشروع جديد</p><h1 className="text-3xl font-bold tracking-tight">إنشاء مشروع جديد</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">أدخل بيانات المشروع وقواعد التصنيع. تُحفظ القيم داخليًا بالمتر.</p></div>
          <a href="/" className="rounded-md border px-4 py-2 text-sm">العودة</a>
        </div>
        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><h2 className="text-lg font-semibold">بيانات المشروع</h2><div className="mt-5 grid gap-5 md:grid-cols-2"><Field label="اسم المشروع" name="projectName" placeholder="مثال: مطبخ العميل أحمد" required /><Field label="اسم العميل" name="clientName" placeholder="اسم العميل" required /><Field label="الهاتف" name="phone" placeholder="0550..." /><Field label="العنوان" name="address" placeholder="العنوان" /></div></section>
          <section className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm"><div><h2 className="text-lg font-semibold">إعدادات التصنيع</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">الوحدة المعروضة cm، باستثناء C بالـmm.</p></div><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><NumberField label="A — إزاحة Résine" name="a" defaultValue={defaults.a} unit="cm" required /><NumberField label="B — الباب الواحد" name="b" defaultValue={defaults.b} unit="cm" required /><NumberField label="B2 — البابين" name="b2" defaultValue={defaults.b2} unit="cm" required /><NumberField label="C — Aluco" name="c" defaultValue={defaults.c} unit="mm" required /><NumberField label="T — الرفوف (L)" name="t" defaultValue={defaults.t} unit="cm" required /><NumberField label="R — الرفوف (P)" name="r" defaultValue={defaults.r} unit="cm" required /></div><label className="mt-5 flex cursor-pointer items-center gap-3 rounded-lg border p-4"><input type="checkbox" checked={handles} onChange={(e) => setHandles(e.target.checked)} className="h-4 w-4" /><span><span className="block font-medium">الأبواب تتطلب مقابض</span><span className="text-sm text-[hsl(var(--muted-foreground))]">سيُضاف مقبض لكل باب عند الحساب.</span></span></label></section>
          {error && <div className="rounded-lg border border-[hsl(var(--destructive))] p-4 text-sm text-[hsl(var(--destructive))]">{error}</div>}
          <div className="flex justify-end"><button disabled={saving} type="submit" className="rounded-lg bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ والمتابعة إلى الصناديق'}</button></div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, name, placeholder, required }: { label: string; name: string; placeholder?: string; required?: boolean }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><input name={name} placeholder={placeholder} required={required} className="w-full rounded-lg border bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" /></label>; }
function NumberField({ label, name, defaultValue, unit, required }: { label: string; name: string; defaultValue: string; unit: string; required?: boolean }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span><div className="flex"><input name={name} defaultValue={defaultValue} type="number" step="any" min="0" required={required} className="min-w-0 flex-1 rounded-r-lg border bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" /><span className="flex items-center rounded-l-lg border border-r-0 bg-[hsl(var(--muted))] px-3 text-sm">{unit}</span></div></label>; }
