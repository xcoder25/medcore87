import type { Metadata } from 'next';
import '../styles/admin.css';
import '../styles/command-centre.css';

export const metadata: Metadata = {
  title: 'Ministry of Health • National Health Operations & Regulatory Oversight',
  description: 'National health authority command console: multi-facility hospital network surveillance, disease outbreak monitoring, and accreditation compliance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
