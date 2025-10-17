import { http, createConfig, cookieStorage, createStorage } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { baseAccount } from 'wagmi/connectors';

export function getConfig() {
  return createConfig({
    chains: [baseSepolia],
    connectors: [
      baseAccount({
        appName: 'Intern',
        subAccounts: {
          creation: 'on-connect',
          defaultAccount: 'sub'
        },
        paymasterUrls: {
          [baseSepolia.id]: process.env.NEXT_PUBLIC_PAYMASTER_SERVICE_URL as string
        }
      } as any)
    ],
    storage: createStorage({
      storage: cookieStorage
    }),
    ssr: true,
    transports: {
      [baseSepolia.id]: http()
    }
  });
}

export const wagmiConfig = getConfig();

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
