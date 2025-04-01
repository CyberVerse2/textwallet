import type React from "react"
import ClientLayout from "./client-layout"
import "./globals.css"

export const metadata = {
  title: "Text Wallet",
  description: "Your conversational DeFi assistant",
    generator: 'v0.dev'
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}



import './globals.css'