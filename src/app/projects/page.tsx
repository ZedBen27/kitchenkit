'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Project = { id: string; name: string; status: string; client_id: string | null };
type Client = { id: string; name: string; phone: string | null; address: string | null };
const labels: Record<string, string> = { draft: 'مسودة', saved: 'محفوظ', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغى' };
const statusClasses: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  saved: 'bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-300',
};
const statusOptions = ['draft', 'in_progress', 'completed', 'cancelled', 'saved'];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => { (async () => { try {
    const supabase = getSupabaseBrowserClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('سجّل الدخول للوصول إلى المشاريع.');
    const { data: membership, error: me } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle(); if (me) throw me; if (!membership) throw new Error('لا توجد مؤسسة مرتبطة بهذا الحساب.');
    const { data, error: pe } = await supabase.from('projects').select('id,name,status,client_id').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }); if (pe) throw pe;
    const ids = (data || []).map(p => p.client_id).filter(Boolean) as string[]; const { data: rows } = ids.length ? await supabase.from('clients').select('id,name,phone,address').in('id', ids) : { data: [] as Client[] };
    setProjects((data || []) as Project[]); setClients(Object.fromEntries((rows || []).map(c => [c.id, c as Client])));
  } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل المشاريع.'); } finally { setLoading(false); } })(); }, []);

  async function changeStatus(projectId: string, status: string) {
    setUpdatingStatusId(projectId);
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.from('projects').update({ status }).eq('id', projectId);
      if (updateError) throw updateError;
      setProjects(current => current.map(project => project.id === projectId ? { ...project, status } : project));
      setOpenStatusId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث حالة المشروع.');
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return <section className="page">
    <div className="page-head"><div><div className="eyebrow">المشاريع</div><h1>جميع المشاريع</h1><div className="subtitle">قائمة المشاريع مع بيانات العميل وحالة كل مشروع.</div></div><Link className="btn primary" href="/projects/new">+ مشروع جديد</Link></div>
    {error && <div className="card notice">{error}</div>}
    <div className="card"><div className="table-wrap"><table><thead><tr><th>المشروع</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={3} className="empty">جارٍ التحميل...</td></tr> : projects.map(p => {
        const c = p.client_id ? clients[p.client_id] : undefined;
        return <tr key={p.id}>
          <td className="!whitespace-normal">
            <div className="flex min-w-[300px] flex-col gap-1 py-0.5">
              <strong className="text-sm font-extrabold text-foreground">{p.name}</strong>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-muted-foreground" dir="rtl">
                <span>{c?.name || 'بدون عميل'}</span>
                <span aria-hidden="true">•</span>
                <span dir="ltr">{c?.phone || '—'}</span>
                <span aria-hidden="true">•</span>
                <span>{c?.address || '—'}</span>
              </div>
            </div>
          </td>
          <td><span className={`badge status-badge ${statusClasses[p.status] || 'bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300'}`}>{labels[p.status] || p.status}</span></td>
          <td>
            <div className="relative flex items-center gap-2">
              <Link className="btn" href={`/projects/${p.id}/boxes`}>فتح</Link>
              <div className="relative w-[175px]">
                <button type="button" className="btn w-full justify-center" onClick={() => setOpenStatusId(current => current === p.id ? null : p.id)} disabled={updatingStatusId === p.id} aria-haspopup="menu" aria-expanded={openStatusId === p.id}>
                  {updatingStatusId === p.id ? 'جارٍ التحديث...' : 'تغيير الحالة'}
                </button>
                {openStatusId === p.id && <div className="absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-[hsl(var(--card))] p-1.5 text-[hsl(var(--foreground))] shadow-xl" role="menu">
                  {statusOptions.map(option => <button key={option} type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold text-inherit transition hover:bg-[hsl(var(--muted))] disabled:cursor-default disabled:opacity-70" onClick={() => changeStatus(p.id, option)} disabled={option === p.status}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${option === 'draft' ? 'bg-amber-500' : option === 'in_progress' ? 'bg-blue-500' : option === 'completed' ? 'bg-emerald-500' : option === 'cancelled' ? 'bg-red-500' : 'bg-slate-400'}`} />
                    <span>{labels[option]}</span>
                    {option === p.status && <span className="mr-auto text-[10px] font-medium text-muted-foreground">الحالية</span>}
                  </button>)}
                </div>}
              </div>
            </div>
          </td>
        </tr>;
      })}
      {!loading && !projects.length && <tr><td colSpan={3} className="empty">لا توجد مشاريع.</td></tr>}
    </tbody></table></div></div>
  </section>;
}
