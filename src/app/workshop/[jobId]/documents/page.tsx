'use client';

const profileRows = [
  ['0.900', '1Départ', '2', '2 Départ Long', '2'],
  ['0.800', '1Départ', '2', '2 Départ Court', '2'],
  ['0.600', '2 Départ Long', '4', '', ''],
];

const resinRows = [
  ['Arrière', '0.847', '0.747', '1'],
  ['Bas', '0.847', '0.547', '1'],
  ['Droite', '0.547', '0.747', '1'],
  ['Gauche', '0.547', '0.747', '1'],
];

export default function WorkshopDocumentsPage() {
  return <main dir="rtl" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-[hsl(var(--muted-foreground))]">الورشة / الوثائق</p><h1 className="text-3xl font-bold">وثائق التصنيع</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">جداول القطع والمخططات التي ترافق المشروع إلى الورشة.</p></div><button onClick={() => window.print()} className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 font-semibold text-[hsl(var(--primary-foreground))]">طباعة جميع الوثائق</button></header>
      <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">1. جدول قطع Profile</h2><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-[hsl(var(--muted))]"><tr><th className="p-3 text-right">Metrage</th><th className="p-3 text-right">Profile</th><th className="p-3 text-right">Qté</th><th className="p-3 text-right">Profile</th><th className="p-3 text-right">Qté</th></tr></thead><tbody>{profileRows.map((r, i) => <tr key={i} className="border-t">{r.map((v, j) => <td key={j} className="p-3">{v || '—'}</td>)}</tr>)}</tbody></table></div></section>
      <section className="mb-6 rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">2. مخطط قطع Résine</h2><div className="grid gap-4 md:grid-cols-2">{resinRows.map((r, i) => <div key={i} className="rounded-lg border p-4"><div className="mb-3 font-semibold">{r[0]}</div><div className="text-sm text-[hsl(var(--muted-foreground))]">L = {r[1]} m · H = {r[2]} m · Qté = {r[3]}</div><div className="mt-4 h-24 border border-dashed" /></div>)}</div></section>
      <section className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm print:shadow-none"><h2 className="mb-4 text-xl font-semibold">3. مخطط قطع Aluco</h2><div className="rounded-lg border p-5"><div className="flex min-h-32 items-center justify-center border border-dashed text-sm text-[hsl(var(--muted-foreground))]">مساحة مخطط Aluco — سيتم ربطها بنتيجة الـCut Optimizer</div></div></section>
    </div>
  </main>;
}
