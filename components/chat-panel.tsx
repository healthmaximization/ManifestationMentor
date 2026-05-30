"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Message = Database["public"]["Tables"]["manifestation_messages"]["Row"];
type Conversation = Database["public"]["Tables"]["manifestation_conversations"]["Row"];

export default function ChatPanel({
  activeConversationId,
  onConversationCreated
}: {
  activeConversationId: string;
  onConversationCreated: (conversation: Conversation) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMessages() {
      if (!activeConversationId) {
        setMessages([]);
        return;
      }

      const response = await fetch(`/api/conversations/${activeConversationId}/messages`);
      const data = await response.json();
      setMessages(data.messages ?? []);
    }

    loadMessages();
  }, [activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    setInput("");
    setError("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        conversation_id: activeConversationId,
        user_id: "local",
        role: "user",
        content,
        created_at: new Date().toISOString()
      }
    ]);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content, conversationId: activeConversationId || undefined })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    if (!activeConversationId && data.conversationId) {
      onConversationCreated({
        id: data.conversationId,
        user_id: "local",
        title: content.slice(0, 52),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        conversation_id: data.conversationId,
        user_id: "local",
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString()
      }
    ]);
  }

  return (
    <div className="chat-layout">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Manifestation Coach</p>
          <h1>Clarify the reality you are choosing.</h1>
        </div>
        <button className="icon-button" title="Clear local view" onClick={() => setMessages([])}>
          <Trash2 size={18} />
        </button>
      </header>

      <div className="message-stream">
        {messages.length === 0 && (
          <div className="empty-chat">
            <h2>What are you calling in?</h2>
            <p>Name the desire, the doubt, or the decision you want support with.</p>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <p>{message.content}</p>
          </article>
        ))}
        {loading && (
          <article className="message assistant typing">
            <span />
            <span />
            <span />
          </article>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="error chat-error">{error}</p>}
      <form onSubmit={send} className="composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask for clarity, belief work, a ritual, or an aligned action plan..."
          rows={2}
        />
        <button disabled={loading || !input.trim()} title="Send">
          <Send size={19} />
        </button>
      </form>
    </div>
  );
}
