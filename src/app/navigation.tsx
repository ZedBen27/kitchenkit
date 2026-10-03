'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Settings2, UserCog, LogOut } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const items = [
  { href: '/', label: 'لوحة التحكم', match: (p: string) => p === '/' },
  { href: '/projects', label: 'جميع المشاريع', match: (p: string) => p.startsWith('/projects') },
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

  const bottomItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    textDecoration: 'none',
    padding: '9px 0',
  } as const;

  const dividerStyle = {
    ...bottomItemStyle,
    borderBottom: '1px solid hsl(var(--border) / .75)',
  } as const;

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
        <Link
          href="/workshop/settings"
          className={pathname.startsWith('/workshop/settings') ? 'active' : ''}
          style={dividerStyle}
        >
          <Settings2 size={18} strokeWidth={1.9} aria-hidden="true" />
          <span>إعدادات الورشة</span>
        </Link>
        <Link
          href="/settings"
          className={pathname === '/settings' ? 'active' : ''}
          style={dividerStyle}
        >
          <UserCog size={18} strokeWidth={1.9} aria-hidden="true" />
          <span>إعدادات الحساب</span>
        </Link>
        <button onClick={signOut} style={bottomItemStyle}>
          <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
