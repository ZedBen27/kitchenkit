'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Mode = 'documents' | 'optimizer' | 'purchases';
type Row = { jobId: string; projectId: string; project: string; client: string; status: string };
const config: Record<Mode, { title: string; eyebrow: string; description: string; href: (id: string) => string }> = {
  documents: { title: 'وثائق الورشة', eyebrow: 'التصنيع', description: 'اختر المشروع لفتح وثائق التصنيع الخاصة به.', href: id => `/workshop/${id}/documents` },
  optimizer: { title: 'تحسين القص', eyebrow: 'Cut Optimizer', description: 'اختر المشروع لفتح مخطط القص الخاص به.', href: id => `/workshop/${id}/optimizer` },
  purchases: { title: 'قائمة السلع', eyebrow: 'المشتريات', description: 'اختر المشروع لفتح جدول السلع والكميات المطلوبة.', href: id => `/workshop/${id}/purchases` },
};

export default function WorkshopProjectToolIndex({ mode }: { mode: Mode }) {
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const c = config[mode];
  useEffect(() => { (async () => { try {
    const supabase = getSupabaseBrowserClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('سجّل الدخول للوصول إلى الورشة.');
    const { data: membership, error: me } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle(); if (me) throw me; if (!membership) throw new Error('لا توجد مؤسسة مرتبطة بهذا الحساب.');
    const { data: projects, error: pe } = await supabase.from('projects').select('id,name,client_id').eq('organization_id', membership.organization_id); if (pe) throw pe;
    const ids = (projects || []).map(p => p.id); if (!ids.length) { setRows([]); return; }
    const { data: jobs, error: je } = await supabase.from('workshop_jobs').select('id,project_id,status').in('project_id', ids).order('started_at', { ascending: false }); if (je) throw je;
    const clientIds = (projects || []).map(p => p.client_id).filter(Boolean) as string[]; const { data: clients } = clientIds.length ? await supabase.from('clients').select('id,name').in('id', clientIds) : { data: [] as { id: string; name: string }[] };
    const pm = new Map((projects || []).map(p => [p.id, p])); const cm = new Map((clients || []).map(x => [x.id, x.name]));
    setRows((jobs || []).map(j => { const p = pm.get(j.project_id); return { jobId: j.id, projectId: j.project_id, project: p?.name || 'مشروع', client: p?.client_id ? cm.get(p.client_id) || '—' : '—', status: j.status }; }));
  } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل المشاريع.'); } finally { setLoading(false); } })(); }, []);
  return <section className="page"><div className="page-head"><div><div className="eyebrow">{c.eyebrow}</div><h1>{c.title}</h1><div className="subtitle">{c.description}</div></div><Link className="btn" href="/workshop">الورشة</Link></div>{error && <div className="card notice">{error}</div>}<div className="card"><div className="table-wrap"><table><thead><tr><th>المشروع</th><th>العميل</th><th>الحالة</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={4} className="empty">جارٍ التحميل...</td></tr> : rows.map(r => <tr key={r.jobId}><td><strong>{r.project}</strong></td><td>{r.client}</td><td><span className="badge">{r.status === 'in_progress' ? 'قيد التنفيذ' : r.status === 'completed' ? 'تم التنفيذ' : r.status === 'cancelled' ? 'ملغى' : r.status}</span></td><td><Link className="btn primary" href={c.href(r.jobId)}>فتح</Link></td></tr>)}{!loading && !rows.length && <tr><td colSpan={4} className="empty">لا توجد مشاريع معتمدة للورشة.</td></tr>}</tbody></table></div></div></section>;
}
