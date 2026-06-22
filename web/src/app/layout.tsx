import type { Metadata } from 'next';
import ClientRootLayout from './ClientRootLayout';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shopbook Mini POS Web',
  description: 'Premium web point of sale',
  keywords: ['shopbook', 'mini pos', 'point of sale', 'retail pos'],
  authors: [{ name: 'Pasan Pahasara Dewapriya' }],
  robots: 'index, follow',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClientRootLayout>{children}</ClientRootLayout>
      </body>
    </html>
  );
}
