'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function WorkshopJobPage() {
  const params = useParams<{ jobId: string }>();
  const [job, setJob] = useState<{ id: string; project_id: string; status: string } | null>(null);
  const [project, setProject] = useState<{ name: string; status: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { (async () => { try { const supabase = getSupabaseBrowserClient(); const { data, error: e } = await supabase.from('workshop_jobs').select('id,project_id,status').eq('id', params.jobId).single(); if (e) throw e; setJob(data); const { data: p, error: pe } = await supabase.from('projects').select('name,status').eq('id', data.project_id).single(); if (pe) throw pe; setProject(p); } catch (err) { setError(err instanceof Error ? err.message : 'تعذر تحميل المشروع.'); } })(); }, [params.jobId]);

  if (error) return <main dir="rtl" className="p-8 text-[hsl(var(--destructive))]">{error}</main>;
  if (!job || !project) return <main dir="rtl" className="p-8">جارٍ تحميل المشروع...</main>;
  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))]"><div className="mx-auto max-w-5xl px-6 py-8"><Link href="/workshop" className="text-sm underline">← العودة إلى الورشة</Link><div className="mt-6 rounded-xl border bg-[hsl(var(--card))] p-6"><p className="text-sm text-[hsl(var(--muted-foreground))]">ورشة / مشروع</p><h1 className="mt-2 text-3xl font-bold">{project.name}</h1><p className="mt-2">الحالة: <strong>{job.status}</strong></p><div className="mt-8 grid gap-4 md:grid-cols-3"><Link href={`/projects/${job.project_id}/calculation`} className="rounded-lg border p-5"><strong>الحسابات</strong><span className="mt-2 block text-sm text-[hsl(var(--muted-foreground))]">مراجعة القطع والكميات</span></Link><Link href={`/workshop/${job.id}/optimizer`} className="rounded-lg border p-5"><strong>Cut Optimizer</strong><span className="mt-2 block text-sm text-[hsl(var(--muted-foreground))]">تحسين قص Résine وAluco</span></Link><Link href={`/workshop/${job.id}/documents`} className="rounded-lg border p-5"><strong>وثائق الورشة</strong><span className="mt-2 block text-sm text-[hsl(var(--muted-foreground))]">الجداول والمخططات</span></Link></div></div></div></main>;
}
