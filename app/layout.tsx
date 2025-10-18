import type React from 'react';
import { Providers } from './providers';
import ClientLayout from './client-layout';
import './globals.css';
import '@coinbase/onchainkit/styles.css';

export const metadata = {
  title: 'TextWallet',
  description: 'Your conversational DeFi assistant',
  generator: 'v0.dev',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </head>
      <body>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
