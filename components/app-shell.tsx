"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Home, LogOut, MessageCircle, Settings2 } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import ChatPanel from "@/components/chat-panel";
import TrainingPanel from "@/components/training-panel";
import type { Database } from "@/lib/supabase/types";

type Conversation = Database["public"]["Tables"]["manifestation_conversations"]["Row"];

export default function AppShell({
  userEmail,
  owner,
  initialConversations
}: {
  userEmail: string;
  owner: boolean;
  initialConversations: Conversation[];
}) {
  const [view, setView] = useState<"chat" | "training">("chat");
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversations[0]?.id ?? "");
  const initials = useMemo(() => userEmail.slice(0, 2).toUpperCase(), [userEmail]);
  const canSeeTraining = owner;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo-row">
            <BrandLogo size="small" />
            <strong>Manifestation Mentor</strong>
          </div>
          <nav className="nav-tabs" aria-label="Main">
            <Link href="/" title="Home">
              <Home size={18} />
              <span>Home</span>
            </Link>
            <button className={view === "chat" ? "active" : ""} onClick={() => setView("chat")} title="Chat">
              <MessageCircle size={18} />
              <span>Chat</span>
            </button>
            <Link href="/sublimify" title="Sublimify">
              <BrandLogo size="small" />
              <span>Sublimify</span>
            </Link>
            {canSeeTraining && (
              <button className={view === "training" ? "active" : ""} onClick={() => setView("training")} title="Training">
                <Settings2 size={18} />
                <span>Training</span>
              </button>
            )}
          </nav>
        </div>

        <div className="conversation-list">
          <button
            className="new-chat"
            onClick={() => {
              setActiveConversationId("");
              setView("chat");
            }}
          >
            New conversation
          </button>
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={conversation.id === activeConversationId ? "conversation active" : "conversation"}
              onClick={() => {
                setActiveConversationId(conversation.id);
                setView("chat");
              }}
            >
              {conversation.title}
            </button>
          ))}
        </div>

        <form action="/api/auth/signout" method="post" className="account-row">
          <span className="avatar">{initials}</span>
          <span className="account-email">{userEmail}</span>
          <button title="Sign out">
            <LogOut size={17} />
          </button>
        </form>
      </aside>

      <section className="workspace">
        {view === "chat" || !canSeeTraining ? (
          <ChatPanel
            activeConversationId={activeConversationId}
            onConversationCreated={(conversation) => {
              setConversations((current) => [conversation, ...current]);
              setActiveConversationId(conversation.id);
            }}
          />
        ) : (
          <TrainingPanel />
        )}
      </section>
    </main>
  );
}
