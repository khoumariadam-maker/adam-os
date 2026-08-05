import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Adam OS — Khoumari Adam Portfolio',
  description: 'Windows 9x-themed personal portfolio with Pixel Spider mascot, draggable windows, boot sequence, and bilingual EN/AR support.',
  authors: [{ name: 'Khoumari Adam' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden bg-base text-text">
        {children}
      </body>
    </html>
  );
}
