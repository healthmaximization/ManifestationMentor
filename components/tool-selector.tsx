"use client";

import Link from "next/link";
import { LogOut, MessageCircle, Music2, Sparkles } from "lucide-react";

export default function ToolSelector({ userEmail }: { userEmail: string }) {
  return (
    <main className="tool-home">
      <header className="tool-home-header">
        <div className="logo-row">
          <span className="brand-mark small">
            <Sparkles size={18} />
          </span>
          <strong>Subliminal Academy</strong>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="secondary-button" title="Sign out">
            <LogOut size={17} />
            Sign out
          </button>
        </form>
      </header>

      <section className="tool-hero">
        <p className="eyebrow">Signed in as {userEmail}</p>
        <h1>Choose your creation space.</h1>
        <p>Build subliminals, train the mentor, and keep every tool under one clean account.</p>
      </section>

      <section className="tool-cards">
        <Link href="/manifestation" className="tool-card">
          <MessageCircle size={24} />
          <span>Manifestation Mentor</span>
          <p>Chat, coach, train knowledge, and refine the owner-controlled AI personality.</p>
        </Link>
        <Link href="/sublimify" className="tool-card featured">
          <Music2 size={24} />
          <span>Sublimify Builder</span>
          <p>Create recorded, AI voice, silent, layered, binaural, and ambient subliminals.</p>
        </Link>
      </section>
    </main>
  );
}

