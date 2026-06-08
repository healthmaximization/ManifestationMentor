"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import BrandLogo from "@/components/brand-logo";

export default function ToolSelector({ userEmail }: { userEmail: string }) {
  return (
    <main className="tool-home">
      <header className="tool-home-header">
        <div className="logo-row">
          <BrandLogo size="small" />
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
          <BrandLogo size="small" />
          <span>Manifestation Mentor</span>
          <p>Chat, coach, train knowledge, and refine the owner-controlled AI personality.</p>
        </Link>
        <Link href="/sublimify" className="tool-card featured">
          <BrandLogo size="small" />
          <span>Sublimify Builder</span>
          <p>Create recorded, AI voice, silent, layered, binaural, and ambient subliminals.</p>
        </Link>
      </section>
    </main>
  );
}
