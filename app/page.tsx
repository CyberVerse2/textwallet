"use client"

import { useState } from "react"
import ChatInterface from "./chat-interface"
import LandingPage from "./landing-page"

export default function Page() {
  const [chatStarted, setChatStarted] = useState(false)

  return <>{chatStarted ? <ChatInterface /> : <LandingPage onStartChat={() => setChatStarted(true)} />}</>
}
