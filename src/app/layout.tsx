import type { Metadata } from 'next';
import { Geist, Inter } from 'next/font/google';
import '@/components/arc/foundation.css';
import './globals.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Gr8r Studio',
    template: '%s | Gr8r Studio',
  },
  description: 'Shared work for people, systems, and agents.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" data-accent="blue" suppressHydrationWarning>
      <body className={`${geist.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
