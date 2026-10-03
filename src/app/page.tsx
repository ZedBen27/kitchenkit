'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Project = { id: string; name: string; status: string; created_at: string };
const statusLabels: Record<string, string> = { draft: 'مسودة', saved: 'محفوظ', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغى' };

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProjects() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/auth'); return; }
        const { data: membership, error: membershipError } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership) { router.replace('/onboarding'); return; }
        const { data, error: projectError } = await supabase.from('projects').select('id,name,status,created_at').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }).limit(20);
        if (projectError) throw projectError;
        setProjects((data || []) as Project[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل المشاريع.');
      } finally { setLoading(false); }
    }
    loadProjects();
  }, [router]);

  const counts = { total: projects.length, draft: projects.filter(p => p.status === 'draft').length, active: projects.filter(p => p.status === 'in_progress').length, done: projects.filter(p => p.status === 'completed').length };
  const recentProjects = projects.slice(0, 5);

  return (
    <section className="page">
      <header className="topbar"><strong>إدارة التصنيع</strong><span className="badge">مساحة العمل</span></header>
      <div className="page-head"><div><div className="eyebrow">نظرة عامة</div><h1>لوحة التحكم</h1><div className="subtitle">تابع المشاريع والحسابات والتصنيع من مكان واحد.</div></div><div className="actions"><Link className="btn" href="/workshop">الورشة</Link><Link className="btn primary" href="/projects/new">+ مشروع جديد</Link></div></div>
      {error && <div className="card notice" style={{ marginBottom: 20 }}>{error}</div>}
      <div className="stats"><div className="card"><div className="stat-label">إجمالي المشاريع</div><div className="stat-value">{loading ? '—' : counts.total}</div></div><div className="card"><div className="stat-label">مسودات</div><div className="stat-value">{loading ? '—' : counts.draft}</div></div><div className="card"><div className="stat-label">قيد التنفيذ</div><div className="stat-value">{loading ? '—' : counts.active}</div></div><div className="card"><div className="stat-label">مكتملة</div><div className="stat-value">{loading ? '—' : counts.done}</div></div></div>
      <section className="card"><div className="card-head"><span className="card-title">آخر المشاريع</span><Link className="btn" href="/projects/new">مشروع جديد</Link></div><div className="table-wrap"><table><thead><tr><th>المشروع</th><th>الحالة</th><th>فتح</th></tr></thead><tbody>{recentProjects.map(p => <tr key={p.id}><td><strong>{p.name}</strong></td><td><span className="badge">{statusLabels[p.status] || p.status}</span></td><td><Link className="btn" href={`/projects/${p.id}/boxes`}>فتح</Link></td></tr>)}{!loading && !recentProjects.length && <tr><td colSpan={3} className="empty">لا توجد مشاريع بعد. أنشئ أول مشروع.</td></tr>}</tbody></table></div><div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><Link className="btn" href="/projects">تصفح جميع المشاريع</Link></div></section>
    </section>
  );
}
