import type { Metadata } from 'next';
import './globals.css';
import './kosans.css';

export const metadata: Metadata = {
  title: 'KitchenKit',
  description: 'Workshop manufacturing management',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
