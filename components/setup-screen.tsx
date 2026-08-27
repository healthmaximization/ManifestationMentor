import { Database, KeyRound } from "lucide-react";
import BrandLogo from "@/components/brand-logo";

export default function SetupScreen() {
  return (
    <main className="auth-page">
      <section className="auth-panel setup-panel">
        <BrandLogo />
        <h1>Subliminal Academy</h1>
        <p>Add your environment variables to connect Supabase, OpenRouter, and your creation tools.</p>
        <div className="setup-list">
          <div>
            <Database size={18} />
            <span>NEXT_PUBLIC_SUPABASE_URL</span>
          </div>
          <div>
            <KeyRound size={18} />
            <span>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
          </div>
          <div>
            <KeyRound size={18} />
            <span>SUPABASE_SERVICE_ROLE_KEY</span>
          </div>
          <div>
            <KeyRound size={18} />
            <span>OPENROUTER_API_KEY</span>
          </div>
        </div>
      </section>
    </main>
  );
}
