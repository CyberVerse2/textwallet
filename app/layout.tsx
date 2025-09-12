import type React from 'react';
import { Providers } from './providers';
import ClientLayout from './client-layout';
import './globals.css';
import '@coinbase/onchainkit/styles.css';

export const metadata = {
  title: 'Text Wallet',
  description: 'Your conversational DeFi assistant',
  generator: 'v0.dev'
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}

import './globals.css';
