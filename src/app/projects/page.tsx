'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Project = { id: string; name: string; status: string; client_id: string | null };
type Client = { id: string; name: string; phone: string | null; address: string | null };
const labels: Record<string, string> = { draft: 'مسودة', saved: 'محفوظ', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغى' };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { (async () => { try {
    const supabase = getSupabaseBrowserClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('سجّل الدخول للوصول إلى المشاريع.');
    const { data: membership, error: me } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle(); if (me) throw me; if (!membership) throw new Error('لا توجد مؤسسة مرتبطة بهذا الحساب.');
    const { data, error: pe } = await supabase.from('projects').select('id,name,status,client_id').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }); if (pe) throw pe;
    const ids = (data || []).map(p => p.client_id).filter(Boolean) as string[]; const { data: rows } = ids.length ? await supabase.from('clients').select('id,name,phone,address').in('id', ids) : { data: [] as Client[] };
    setProjects((data || []) as Project[]); setClients(Object.fromEntries((rows || []).map(c => [c.id, c as Client])));
  } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل المشاريع.'); } finally { setLoading(false); } })(); }, []);
  return <section className="page"><div className="page-head"><div><div className="eyebrow">المشاريع</div><h1>جميع المشاريع</h1><div className="subtitle">قائمة المشاريع مع بيانات العميل وحالة كل مشروع.</div></div><Link className="btn primary" href="/projects/new">+ مشروع جديد</Link></div>{error && <div className="card notice">{error}</div>}<div className="card"><div className="table-wrap"><table><thead><tr><th>المشروع</th><th>العميل</th><th>الهاتف</th><th>العنوان</th><th>الحالة</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="empty">جارٍ التحميل...</td></tr> : projects.map(p => { const c = p.client_id ? clients[p.client_id] : undefined; return <tr key={p.id}><td><strong>{p.name}</strong></td><td>{c?.name || '—'}</td><td dir="ltr">{c?.phone || '—'}</td><td>{c?.address || '—'}</td><td><span className="badge">{labels[p.status] || p.status}</span></td><td><Link className="btn" href={`/projects/${p.id}/boxes`}>فتح</Link></td></tr>; })}{!loading && !projects.length && <tr><td colSpan={6} className="empty">لا توجد مشاريع.</td></tr>}</tbody></table></div></div></section>;
}
