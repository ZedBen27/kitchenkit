const projects = [
  { id: 'PRJ-0042', name: 'Cuisine Benali', client: 'Ahmed Benali', boxes: 6, status: 'قيد التنفيذ', tone: 'warn' },
  { id: 'PRJ-0041', name: 'Projet El Bahia', client: 'Samir Haddad', boxes: 3, status: 'مسودة', tone: 'info' },
  { id: 'PRJ-0040', name: 'Atelier Nord', client: 'Karim Mansouri', boxes: 9, status: 'مكتمل', tone: 'success' },
];

export default function Dashboard() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">KitchenKit</div>
        <nav className="nav" aria-label="التنقل الرئيسي">
          <a className="active" href="#">لوحة التحكم</a>
          <a href="#projects">المشاريع</a>
          <a href="#workshop">الورشة</a>
          <a href="#clients">العملاء</a>
          <a href="#settings">الإعدادات</a>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <strong>إدارة التصنيع</strong>
          <span className="badge">حساب الشركة</span>
        </header>

        <section className="page">
          <div className="page-head">
            <div>
              <div className="eyebrow">نظرة عامة</div>
              <h1>لوحة التحكم</h1>
              <div className="subtitle">تابع المشاريع، الحسابات والتصنيع من مكان واحد.</div>
            </div>
            <div className="actions">
              <button className="btn">الورشة</button>
              <button className="btn primary">+ مشروع جديد</button>
            </div>
          </div>

          <div className="stats">
            <div className="card"><div className="stat-label">إجمالي المشاريع</div><div className="stat-value">42</div></div>
            <div className="card"><div className="stat-label">مسودات</div><div className="stat-value">7</div></div>
            <div className="card"><div className="stat-label">قيد التنفيذ</div><div className="stat-value">5</div></div>
            <div className="card"><div className="stat-label">مكتملة</div><div className="stat-value">30</div></div>
          </div>

          <div className="grid">
            <section className="card" id="projects">
              <div className="card-head"><span className="card-title">آخر المشاريع</span><button className="btn">عرض الكل</button></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>المشروع</th><th>العميل</th><th>الصناديق</th><th>الحالة</th></tr></thead>
                  <tbody>{projects.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><br /><small>{p.id}</small></td><td>{p.client}</td><td>{p.boxes}</td><td><span className={`badge ${p.tone}`}>{p.status}</span></td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="card" id="workshop">
              <div className="card-head"><span className="card-title">الورشة</span><span className="badge warn">5 قيد التنفيذ</span></div>
              <div className="empty">المشاريع التي تم إرسالها للتصنيع ستظهر هنا، مع إمكانية فتح الملخص وطباعة وثائق الورشة.</div>
              <button className="btn primary">فتح الورشة</button>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
