'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Ruler, Save, Settings2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type WorkshopSettings = {
  a: string;
  b: string;
  b2: string;
  c: string;
  t: string;
  r: string;
  resin_width: string;
  resin_height: string;
  aluco_width: string;
  aluco_height: string;
  kerf: string;
  ouvrant_length: string;
  profile_1_depart_length: string;
  profile_2_depart_long_length: string;
  profile_2_depart_short_length: string;
};

const defaults: WorkshopSettings = {
  a: '5.3', b: '1.7', b2: '3.4', c: '4', t: '', r: '',
  resin_width: '2.44', resin_height: '1.22', aluco_width: '2.44', aluco_height: '1.22', kerf: '0.003',
  ouvrant_length: '6', profile_1_depart_length: '6', profile_2_depart_long_length: '6', profile_2_depart_short_length: '6',
};

const cmToM = (value: string) => Number(value) / 100;
const mmToM = (value: string) => Number(value) / 1000;

export default function WorkshopSettingsPage() {
  const [settings, setSettings] = useState<WorkshopSettings>(defaults);
  const [organizationId, setOrganizationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('يجب تسجيل الدخول للوصول إلى إعدادات الورشة.');
        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership) throw new Error('لا توجد مؤسسة مرتبطة بهذا الحساب.');
        setOrganizationId(membership.organization_id);

        const { data, error: settingsError } = await supabase
          .from('workshop_settings')
          .select('a,b,b2,c,t,r,resin_width,resin_height,aluco_width,aluco_height,kerf,ouvrant_length,profile_1_depart_length,profile_2_depart_long_length,profile_2_depart_short_length')
          .eq('organization_id', membership.organization_id)
          .maybeSingle();
        if (settingsError) throw settingsError;
        if (data) {
          setSettings({
            a: String(Number(data.a) * 100),
            b: String(Number(data.b) * 100),
            b2: String(Number(data.b2) * 100),
            c: String(Number(data.c) * 1000),
            t: data.t == null ? '' : String(Number(data.t) * 100),
            r: data.r == null ? '' : String(Number(data.r) * 100),
            resin_width: String(data.resin_width),
            resin_height: String(data.resin_height),
            aluco_width: String(data.aluco_width),
            aluco_height: String(data.aluco_height),
            kerf: String(data.kerf),
            ouvrant_length: data.ouvrant_length == null ? '6' : String(data.ouvrant_length),
            profile_1_depart_length: data.profile_1_depart_length == null ? '6' : String(data.profile_1_depart_length),
            profile_2_depart_long_length: data.profile_2_depart_long_length == null ? '6' : String(data.profile_2_depart_long_length),
            profile_2_depart_short_length: data.profile_2_depart_short_length == null ? '6' : String(data.profile_2_depart_short_length),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل إعدادات الورشة.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update<K extends keyof WorkshopSettings>(key: K, value: WorkshopSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || saving) return;
    setSaving(true); setSaved(false); setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const payload = {
        organization_id: organizationId,
        a: cmToM(settings.a),
        b: cmToM(settings.b),
        b2: cmToM(settings.b2),
        c: mmToM(settings.c),
        t: settings.t.trim() ? cmToM(settings.t) : null,
        r: settings.r.trim() ? cmToM(settings.r) : null,
        resin_width: Number(settings.resin_width),
        resin_height: Number(settings.resin_height),
        aluco_width: Number(settings.aluco_width),
        aluco_height: Number(settings.aluco_height),
        kerf: Number(settings.kerf),
        ouvrant_length: settings.ouvrant_length.trim() ? Number(settings.ouvrant_length) : null,
        profile_1_depart_length: settings.profile_1_depart_length.trim() ? Number(settings.profile_1_depart_length) : null,
        profile_2_depart_long_length: settings.profile_2_depart_long_length.trim() ? Number(settings.profile_2_depart_long_length) : null,
        profile_2_depart_short_length: settings.profile_2_depart_short_length.trim() ? Number(settings.profile_2_depart_short_length) : null,
        updated_at: new Date().toISOString(),
      };
      const { error: saveError } = await supabase.from('workshop_settings').upsert(payload, { onConflict: 'organization_id' });
      if (saveError) throw saveError;
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ إعدادات الورشة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50/70 text-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/workshop" className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"><ArrowRight className="h-4 w-4" /> العودة إلى الورشة</Link>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Settings2 className="h-6 w-6" /></div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">إعدادات الورشة</h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">تُدخل هذه القيم مرة واحدة لمساحة العمل، وتُستخدم تلقائيًا في حسابات جميع المطابخ وتحسين القص.</p>
                </div>
              </div>
            </div>
            {saved && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"><Check className="h-4 w-4" /> تم الحفظ</span>}
          </div>
        </header>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الإعدادات...</div> : (
          <form onSubmit={save} className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionTitle title="إعدادات التصنيع" description="الوحدة المعروضة cm، باستثناء C بالـmm." />
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField label="A — إزاحة Résine" value={settings.a} unit="cm" onChange={(v) => update('a', v)} required />
                <NumberField label="B — الباب الواحد" value={settings.b} unit="cm" onChange={(v) => update('b', v)} required />
                <NumberField label="B2 — البابين" value={settings.b2} unit="cm" onChange={(v) => update('b2', v)} required />
                <NumberField label="C — Aluco" value={settings.c} unit="mm" onChange={(v) => update('c', v)} required />
                <NumberField label="T — الرفوف (L)" value={settings.t} unit="cm" onChange={(v) => update('t', v)} />
                <NumberField label="R — الرفوف (P)" value={settings.r} unit="cm" onChange={(v) => update('r', v)} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionTitle title="أطوال القضبان" description="طول القضيب القياسي الذي تُشترى منه المقاطع. الوحدة بالمتر، وتُحفظ هذه القيم كإعدادات عامة للورشة." />
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <NumberField label="Ouvrant" value={settings.ouvrant_length} unit="m" onChange={(v) => update('ouvrant_length', v)} />
                <NumberField label="1Départ" value={settings.profile_1_depart_length} unit="m" onChange={(v) => update('profile_1_depart_length', v)} />
                <NumberField label="2Départs Long" value={settings.profile_2_depart_long_length} unit="m" onChange={(v) => update('profile_2_depart_long_length', v)} />
                <NumberField label="2Départs Court" value={settings.profile_2_depart_short_length} unit="m" onChange={(v) => update('profile_2_depart_short_length', v)} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <SectionTitle title="إعدادات الألواح" description="الأبعاد الفعلية للوح المستخدمة في Cut Optimizer." />
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <MaterialCard title="Résine" width={settings.resin_width} height={settings.resin_height} setWidth={(v) => update('resin_width', v)} setHeight={(v) => update('resin_height', v)} />
                <MaterialCard title="Aluco" width={settings.aluco_width} height={settings.aluco_height} setWidth={(v) => update('aluco_width', v)} setHeight={(v) => update('aluco_height', v)} />
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-700"><Ruler className="h-5 w-5" /></span><div><p className="text-sm font-black">سماكة القطع / Kerf</p><p className="mt-0.5 text-xs text-slate-500">المسافة التي تستهلكها شفرة القص بين قطعتين.</p></div></div>
                <div className="mt-4 w-full sm:mt-0 sm:max-w-[220px]"><NumberField label="Kerf" value={settings.kerf} unit="m" onChange={(v) => update('kerf', v)} required /></div>
              </div>
            </section>

            <footer className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
              <p className="text-xs text-slate-500">سيتم تطبيق الإعدادات تلقائيًا على المشاريع والحسابات وتحسين القص.</p>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'جارٍ الحفظ...' : 'حفظ إعدادات الورشة'}</button>
            </footer>
          </form>
        )}
      </div>
    </main>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-lg font-black sm:text-xl">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>;
}

function NumberField({ label, value, unit, onChange, required }: { label: string; value: string; unit: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-slate-200"><input type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} required={required} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold outline-none" /><span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-500">{unit}</span></div></label>;
}

function MaterialCard({ title, width, height, setWidth, setHeight }: { title: string; width: string; height: string; setWidth: (value: string) => void; setHeight: (value: string) => void }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-black">{title}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">m · عرض × ارتفاع</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField label="العرض" value={width} unit="m" onChange={setWidth} required /><NumberField label="الارتفاع" value={height} unit="m" onChange={setHeight} required /></div></div>;
}
