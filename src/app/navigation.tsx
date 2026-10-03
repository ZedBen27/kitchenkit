'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const items = [
  { href: '/', label: 'لوحة التحكم', match: (p: string) => p === '/' },
  { href: '/projects', label: 'جميع المشاريع', match: (p: string) => p.startsWith('/projects') },
  { href: '/workshop/settings', label: 'إعدادات الورشة', match: (p: string) => p.startsWith('/workshop/settings') },
  { href: '/workshop/documents', label: 'وثائق الورشة', match: (p: string) => p.startsWith('/workshop/documents') || /\/workshop\/[^/]+\/documents/.test(p) },
  { href: '/workshop/optimizer', label: 'تحسين القص', match: (p: string) => p.startsWith('/workshop/optimizer') || /\/workshop\/[^/]+\/optimizer/.test(p) },
  { href: '/workshop/purchases', label: 'قائمة السلع', match: (p: string) => p.startsWith('/workshop/purchases') || /\/workshop\/[^/]+\/purchases/.test(p) },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/auth');
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">KitchenKit</Link>
      <nav className="nav" aria-label="التنقل الرئيسي">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={item.match(pathname) ? 'active' : ''}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span>مساحة العمل</span>
        <button onClick={signOut}>تسجيل الخروج</button>
      </div>
    </aside>
  );
}
