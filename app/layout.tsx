import type { Metadata } from 'next';

import { constants } from '@/data';

import 'the-new-css-reset/css/reset.css';
import '@/styles/tokens.css';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: constants.SITE_NAME,
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
