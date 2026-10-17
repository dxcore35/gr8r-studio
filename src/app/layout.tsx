import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/styles/index.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
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
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable}`}
      style={{ '--font': 'var(--font-geist)', '--mono': 'var(--font-geist-mono)' } as CSSProperties}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
