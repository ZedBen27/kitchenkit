'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('KitchenKit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth');
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc('create_workspace_for_current_user', { p_name: name.trim() });
      if (error) throw error;
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء مساحة العمل.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-heading">
          <p className="eyebrow">الخطوة الأولى</p>
          <h1>أنشئ مساحة العمل</h1>
          <p>مساحة العمل تجمع العملاء والمشاريع والحسابات والورشة الخاصة بك.</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label><span>اسم الورشة أو الشركة</span><input value={name} onChange={e => setName(e.target.value)} required placeholder="مثال: ورشة النور" /></label>
          {error && <div className="auth-alert error">{error}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء مساحة العمل والمتابعة'}</button>
        </form>
      </section>
    </main>
  );
}
