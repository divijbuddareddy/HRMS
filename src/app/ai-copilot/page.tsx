"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";

interface ChatMessage {
  id: string;
  sender: "USER" | "AI";
  text: string;
  timestamp: string;
  metadata?: any;
}

export default function AICopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "AI",
      text: "👋 Hello! I am your AI Copilot for AI Automation Labs HRMS. I have secure, RBAC-guarded access to your organization's policies, leave balances, salary structures, tax calculators, and HR metrics. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const samplePrompts = [
    "What is my remaining Casual and Paid Leave balance?",
    "How does the New Tax Regime 2024-25 compare to the Old Regime for ₹15 LPA CTC?",
    "Explain the Sandwich Leave policy for weekends in our organization.",
    "Give me the formula for Gratuity computation under the 1972 Act.",
    "What are the pending approvals in my manager queue?",
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "USER",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend }),
      });
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "AI",
        text: data.response || "I processed your request, but could not generate a textual response.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        metadata: data.dataPoints,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "AI",
        text: "Apologies, I encountered an error connecting to the AI Gateway. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-300 to-blue-400">
                AI Copilot & Policy Assistant
              </h1>
              <p className="text-xs text-slate-400">
                Ground truth HRMS intelligence with strict tenant-isolation and role-based data boundary
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-purple-950/60 border border-purple-800/60 text-purple-300 text-xs font-semibold">
              RBAC Guard Active
            </span>
          </div>
        </header>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                msg.sender === "USER" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  msg.sender === "USER"
                    ? "bg-blue-600 text-white"
                    : "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20"
                }`}
              >
                {msg.sender === "USER" ? "U" : "✨"}
              </div>
              <div
                className={`p-4 rounded-2xl text-xs space-y-2 leading-relaxed ${
                  msg.sender === "USER"
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-slate-900/90 border border-slate-800/90 text-slate-200 rounded-tl-none shadow-xl"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`text-[10px] text-right ${
                    msg.sender === "USER" ? "text-blue-200" : "text-slate-500"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold animate-pulse">
                ✨
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-100"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-200"></span>
                <span>AI Copilot is analyzing statutory rules & tenant context...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Sample Prompts */}
        <div className="px-8 pb-3 flex gap-2 overflow-x-auto">
          {samplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium whitespace-nowrap transition"
            >
              💡 {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/70 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-3 max-w-5xl mx-auto"
          >
            <input
              type="text"
              placeholder="Ask anything (e.g., 'What are my tax deductions under New Regime?', 'Check my CL balance')..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-2xl text-xs shadow-lg shadow-indigo-500/25 transition-all"
            >
              Send Query
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
