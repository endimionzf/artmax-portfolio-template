import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import siteConfig from '@/site.config.json';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: siteConfig.site?.title || 'Artmax Studio',
  description: siteConfig.site?.description || 'Immersive 3D Spatial Portfolio & Journal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
