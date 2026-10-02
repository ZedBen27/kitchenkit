'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('KitchenKit');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, workspace_name: workspace } },
      });
      if (error) throw error;
      if (!data.session) {
        setMessage('تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم عد إلى صفحة الدخول.');
      } else {
        setMessage('تم إنشاء الحساب. جارٍ فتح KitchenKit…');
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إتمام العملية.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-brand">
        <div className="brand-mark">K</div>
        <div>
          <div className="auth-logo">KitchenKit</div>
          <div className="auth-tagline">إدارة تصنيع المطابخ والصناديق من التصميم إلى الورشة</div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>تسجيل الدخول</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>إنشاء حساب</button>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">مرحبًا بك</p>
          <h1>{mode === 'login' ? 'ادخل إلى مساحة العمل' : 'أنشئ حساب KitchenKit'}</h1>
          <p>{mode === 'login' ? 'تابع مشاريعك وحسابات الصناديق والورشة من مكان واحد.' : 'ابدأ بمساحة عمل جديدة ثم أضف مشاريعك وصناديقك.'}</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label><span>الاسم</span><input value={name} onChange={e => setName(e.target.value)} required placeholder="اسمك أو اسم المسؤول" /></label>}
          {mode === 'signup' && <label><span>اسم مساحة العمل</span><input value={workspace} onChange={e => setWorkspace(e.target.value)} required placeholder="مثال: ورشة النور" /></label>}
          <label><span>البريد الإلكتروني</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" dir="ltr" /></label>
          <label><span>كلمة المرور</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="6 أحرف على الأقل" dir="ltr" /></label>
          {error && <div className="auth-alert error">{error}</div>}
          {message && <div className="auth-alert success">{message}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? 'جارٍ التنفيذ…' : mode === 'login' ? 'دخول إلى KitchenKit' : 'إنشاء الحساب'}</button>
        </form>

        <p className="auth-note">بيانات المشاريع خاصة بمساحة العمل المرتبطة بحسابك.</p>
      </section>
    </main>
  );
}
