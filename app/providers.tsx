"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ChatProvider } from "@/context/ChatContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyAppId) {
    // Handle the case where the Privy App ID is missing
    // You could render an error message or a fallback UI
    console.error("Privy App ID is not configured. Please set NEXT_PUBLIC_PRIVY_APP_ID in your environment variables.");
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Privy App ID is missing. Please configure it in your environment variables.
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // Customize Privy's appearance & behavior
        loginMethods: ['email', 'wallet', 'google', 'discord'],
        appearance: {
          theme: "light",
          accentColor: "#000000", // Black accent
          logo: "/placeholder-logo.png", // Use the logo found in /public
        },
        // Configure embedded wallets
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', // Create wallet if user logs in without one
        },
        // Add external wallet configurations if needed (e.g., Coinbase Smart Wallet)
        // externalWallets: {
        //   coinbaseWallet: {
        //     // Your preferred network for Coinbase Smart Wallet: base, base-sepolia, etc.
        //     connectionOptions: 'smartWalletOnly',
        //   },
        // },
      }}
    >
      <ChatProvider>{children}</ChatProvider>
    </PrivyProvider>
  );
}
