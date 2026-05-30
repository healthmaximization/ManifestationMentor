import { Database, KeyRound, Sparkles } from "lucide-react";

export default function SetupScreen() {
  return (
    <main className="auth-page">
      <section className="auth-panel setup-panel">
        <div className="brand-mark">
          <Sparkles size={22} />
        </div>
        <h1>AI Manifestation Advisor</h1>
        <p>Add your environment variables to connect Supabase and OpenRouter.</p>
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

