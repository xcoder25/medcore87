import type { Metadata } from 'next';
import '../styles/os.css';

export const metadata: Metadata = {
  title: 'MedCore OS • Intelligent Hospital Command Centre',
  description: 'Enterprise operational command centre unifying bed management, patient flow telemetry, hospital staffing, and M87 predictive AI insights.',
  icons: {
    icon: [{ url: '/medcore-logo.png', type: 'image/png' }],
    shortcut: '/medcore-logo.png',
    apple: '/medcore-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/medcore-logo.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
