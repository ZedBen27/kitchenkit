import type { Metadata } from 'next';
import './globals.css';
import './ibm-plex.css';
import './print.css';
import Navigation from './navigation';

export const metadata: Metadata = {
  title: 'KitchenKit',
  description: 'Workshop manufacturing management',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="shell">
          <Navigation />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
