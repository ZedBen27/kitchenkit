'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const fields = [
  { key: 'first_name', label: 'الاسم', placeholder: 'الاسم' },
  { key: 'last_name', label: 'اللقب', placeholder: 'اللقب' },
  { key: 'company_name', label: 'اسم الحساب / الشركة', placeholder: 'اسم الحساب أو الشركة' },
  { key: 'company_phone', label: 'رقم الشركة', placeholder: 'رقم الشركة' },
] as const;

type ProfileState = Record<(typeof fields)[number]['key'], string>;

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileState>({
    first_name: '', last_name: '', company_name: '', company_phone: '',
  });
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [dark, setDark] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const m = u.user_metadata ?? {};
      setProfile({
        first_name: String(m.first_name ?? ''),
        last_name: String(m.last_name ?? ''),
        company_name: String(m.company_name ?? ''),
        company_phone: String(m.company_phone ?? ''),
      });
      setEmail(u.email ?? '');
    });
    const saved = localStorage.getItem('kitchenkit-theme');
    const isDark = saved === 'dark';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('kitchenkit-theme', next ? 'dark' : 'light');
  }

  async function save() {
    setSaving(true);
    setMessage('');
    setError('');
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      email,
      data: profile,
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing({});
    setMessage('تم حفظ الإعدادات بنجاح.');
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">← العودة إلى لوحة التحكم</Link>
        <header className="mt-8 mb-8">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">الحساب</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">الإعدادات</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">إدارة بيانات الحساب والمظهر.</p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
          <div className="border-b border-[hsl(var(--border))] px-6 py-5">
            <h2 className="font-semibold">بيانات الحساب</h2>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {fields.map((field) => (
              <div key={field.key} className="flex items-center gap-4 px-6 py-5">
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-sm font-medium">{field.label}</label>
                  {editing[field.key] ? (
                    <input
                      autoFocus
                      value={profile[field.key]}
                      onChange={(e) => setProfile((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    />
                  ) : (
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">{profile[field.key] || 'غير محدد'}</div>
                  )}
                </div>
                <button type="button" onClick={() => setEditing((e) => ({ ...e, [field.key]: !e[field.key] }))} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]" aria-label={`تعديل ${field.label}`}>✎ تعديل</button>
              </div>
            ))}
            <div className="flex items-center gap-4 px-6 py-5">
              <div className="min-w-0 flex-1">
                <label className="mb-2 block text-sm font-medium">إيميل الشركة</label>
                {editing.email ? (
                  <input autoFocus type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-left outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
                ) : (
                  <div dir="ltr" className="text-left text-sm text-[hsl(var(--muted-foreground))]">{email || 'غير محدد'}</div>
                )}
              </div>
              <button type="button" onClick={() => setEditing((e) => ({ ...e, email: !e.email }))} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]">✎ تعديل</button>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-6 py-5">
            <div>
              <h3 className="font-medium">المظهر</h3>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">التبديل بين الوضع الفاتح والداكن.</p>
            </div>
            <button type="button" role="switch" aria-checked={dark} onClick={toggleTheme} className={`relative h-7 w-12 rounded-full transition ${dark ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted-foreground)/.35)]'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${dark ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="text-sm">
            {message && <span className="text-[hsl(var(--success))]">{message}</span>}
            {error && <span className="text-[hsl(var(--destructive))]">{error}</span>}
          </div>
          <button onClick={save} disabled={saving} className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-60">
            {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </main>
  );
}
