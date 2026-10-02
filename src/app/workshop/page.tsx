'use client';

import { useState } from 'react';

type Status = 'in_progress' | 'completed' | 'cancelled';
type Job = { id: string; project: string; client: string; boxes: number; status: Status; createdAt: string };

const initialJobs: Job[] = [
  { id: 'PRJ-001', project: 'مطبخ أحمد', client: 'أحمد', boxes: 4, status: 'in_progress', createdAt: '2026-10-02' },
  { id: 'PRJ-002', project: 'خزانة سارة', client: 'سارة', boxes: 2, status: 'in_progress', createdAt: '2026-10-01' },
];

const labels: Record<Status, string> = { in_progress: 'قيد التنفيذ', completed: 'تم التنفيذ', cancelled: 'ملغى' };

export default function WorkshopPage() {
  const [jobs, setJobs] = useState(initialJobs);
  const updateStatus = (id: string, status: Status) => setJobs((items) => items.map((job) => job.id === id ? { ...job, status } : job));

  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-8"><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">التشغيل</p><h1 className="text-3xl font-bold">الورشة</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">المشاريع المعتمدة للتنفيذ، مع حالة واضحة وإجراءات الورشة.</p></header>
      <div className="overflow-hidden rounded-xl border bg-[hsl(var(--card))] shadow-sm">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-4 text-right">المشروع</th><th className="p-4 text-right">العميل</th><th className="p-4 text-right">الصناديق</th><th className="p-4 text-right">الحالة</th><th className="p-4 text-right">الإجراءات</th></tr></thead>
          <tbody>{jobs.map((job) => <tr key={job.id} className="border-t"><td className="p-4"><div className="font-semibold">{job.project}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{job.id}</div></td><td className="p-4">{job.client}</td><td className="p-4">{job.boxes}</td><td className="p-4"><span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1">{labels[job.status]}</span></td><td className="p-4"><div className="flex flex-wrap gap-2">{job.status === 'in_progress' && <><button onClick={() => updateStatus(job.id, 'completed')} className="rounded-md bg-[hsl(var(--success))] px-3 py-2 font-medium text-[hsl(var(--success-foreground))]">تم التنفيذ</button><button onClick={() => updateStatus(job.id, 'cancelled')} className="rounded-md border px-3 py-2 text-[hsl(var(--destructive))]">إلغاء المشروع</button></>}<button className="rounded-md border px-3 py-2">وثائق الورشة</button></div></td></tr>)}</tbody>
        </table></div>
      </div>
    </div>
  </main>;
}
