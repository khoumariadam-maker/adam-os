import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { PROFILE } from '@/lib/profile';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const pixel = localFont({
  src: '../../public/fonts/PixelAE-Bold.ttf',
  variable: '--font-pixel',
  weight: '700',
  display: 'swap',
});

const description =
  'Portfolio of Khoumari Adam — embedded systems engineer (ESP32, robotics, Raspberry Pi AI home lab) — built as a playable Windows 98-style desktop. English & Arabic.';

export const metadata: Metadata = {
  metadataBase: new URL(`${PROFILE.siteUrl}/`),
  title: {
    default: 'Khoumari Adam — Embedded Systems Engineer | Adam OS',
    template: '%s | Khoumari Adam',
  },
  description,
  authors: [{ name: PROFILE.name }],
  keywords: ['Khoumari Adam', 'embedded systems', 'ESP32', 'robotics', 'portfolio', 'Bouira', 'Algeria', 'Raspberry Pi'],
  openGraph: {
    type: 'website',
    url: './',
    siteName: 'Adam OS',
    title: 'Khoumari Adam — Adam OS',
    description,
    locale: 'en_US',
    alternateLocale: ['ar_DZ'],
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Adam OS — Khoumari Adam portfolio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Khoumari Adam — Adam OS',
    description,
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0B10',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${mono.variable} ${pixel.variable} antialiased bg-base text-text`}>
        {children}
      </body>
    </html>
  );
}
