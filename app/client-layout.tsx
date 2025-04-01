"use client"

import type React from "react"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, Image, BarChart2, Settings, LogOut, Activity, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import TokenList from "./token-list"
import ActivityList from "./activity-list"
import "./globals.css"
import Sidebar from "./sidebar"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background p-6 overflow-hidden">
      <div className="max-w-6xl w-full mx-auto flex gap-6 h-full">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div
          className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col relative"
          style={{ boxShadow: "8px 8px 0px 0px #000000" }}
        >
          {/* Header */}
          <header className="p-6 border-b">
            <h1 className="font-bold text-xl">Text Wallet Assistant</h1>
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTabs() {
  const [activeTab, setActiveTab] = useState<"assets" | "activity">("assets")

  return (
    <>
      <div className="flex border-b-2 border-black">
        <button
          className={`flex-1 py-3 font-bold text-center transition-all duration-200 relative ${
            activeTab === "assets" ? "bg-yellow text-black" : "hover:bg-yellow/10"
          }`}
          onClick={() => setActiveTab("assets")}
          style={activeTab === "assets" ? { boxShadow: "inset 0px -2px 0px 0px #000000" } : {}}
        >
          <div className="flex items-center justify-center gap-2">
            <Wallet className="h-4 w-4" />
            <span>Assets</span>
          </div>
        </button>
        <button
          className={`flex-1 py-3 font-bold text-center transition-all duration-200 relative ${
            activeTab === "activity" ? "bg-yellow text-black" : "hover:bg-yellow/10"
          }`}
          onClick={() => setActiveTab("activity")}
          style={activeTab === "activity" ? { boxShadow: "inset 0px -2px 0px 0px #000000" } : {}}
        >
          <div className="flex items-center justify-center gap-2">
            <Activity className="h-4 w-4" />
            <span>Activity</span>
          </div>
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Connected Wallet - Always visible */}
          <div
            className="bg-muted rounded-xl p-4 mb-6 border-2 border-black"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Connected Wallet</span>
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
            </div>
            <div className="text-sm text-muted-foreground truncate">0x7a2...3f9c</div>
          </div>

          {activeTab === "assets" ? (
            <>
              {/* Assets Section */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Assets</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 border-2 border-black rounded-lg"
                      style={{ boxShadow: "2px 2px 0px 0px #000000" }}
                    >
                      <BarChart2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <TokenList />

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start mt-4 border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
                    style={{ boxShadow: "4px 4px 0px 0px #000000" }}
                  >
                    <span>Show More</span>
                    <ChevronDown className="ml-auto h-4 w-4" />
                  </Button>
                </div>

                {/* NFTs Section */}
                <div className="pt-4 border-t-2 border-black">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
                    style={{ boxShadow: "4px 4px 0px 0px #000000" }}
                  >
                    <Image className="mr-2 h-4 w-4" />
                    <span>NFTs</span>
                    <ChevronDown className="ml-auto h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Activity Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Recent Activity</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 border-2 border-black rounded-lg"
                    style={{ boxShadow: "2px 2px 0px 0px #000000" }}
                  >
                    <Activity className="h-4 w-4" />
                  </Button>
                </div>

                <ActivityList />
              </div>
            </>
          )}

          {/* Settings - Always at bottom */}
          <div className="pt-6 border-t-2 border-black mt-6">
            <Button
              variant="outline"
              className="w-full justify-start mb-2 border-2 border-black hover:bg-yellow/20 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
              style={{ boxShadow: "4px 4px 0px 0px #000000" }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-red-500 border-2 border-red-500 hover:bg-red-50 active:translate-y-1 active:shadow-none transition-all duration-100 rounded-xl font-bold"
              style={{ boxShadow: "4px 4px 0px 0px #000000" }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Disconnect</span>
            </Button>
          </div>
        </div>
      </ScrollArea>
    </>
  )
}

