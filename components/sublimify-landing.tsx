import Link from "next/link";
import { ArrowRight, CheckCircle2, Headphones, Layers3, Mic, Music2, Sparkles, Wand2 } from "lucide-react";

const steps = [
  { icon: Sparkles, title: "Choose the intention", text: "Start with the exact shift you want your mind to rehearse." },
  { icon: Wand2, title: "Create affirmations", text: "Generate, paste, or speak the affirmations in your own flow." },
  { icon: Layers3, title: "Shape the mix", text: "Pick silent, layered, binaural, ambience, rain, brown noise, or music." },
  { icon: Headphones, title: "Export your audio", text: "Download the finished subliminal and keep projects in your account." }
];

export default function SublimifyLanding() {
  return (
    <main className="sublimify-landing">
      <header className="landing-nav">
        <Link href="/" className="minimal-brand">
          <span className="brand-mark small"><Music2 size={18} /></span>
          <strong>Sublimify</strong>
        </Link>
        <Link className="secondary-button" href="/login?next=%2Fsublimify">
          Log in
        </Link>
      </header>

      <section className="sublimify-public-hero">
        <div className="landing-copy">
          <p className="eyebrow">Subliminal creator studio</p>
          <h1>Make a complete subliminal in a few simple steps.</h1>
          <p>
            Turn an intention into affirmations, voice, ambience, binaural beats, and a finished audio file without a messy timeline or complicated editor.
          </p>
          <div className="landing-actions">
            <Link className="primary-button" href="/login?next=%2Fsublimify&authMode=signup">
              Get started for free <ArrowRight size={18} />
            </Link>
            <Link className="secondary-button" href="/login?next=%2Fsublimify">
              Open my studio
            </Link>
          </div>
        </div>

        <div className="subliminal-preview" aria-hidden="true">
          <div className="preview-topline">
            <span />
            <strong>Confidence Reset</strong>
            <small>04:00</small>
          </div>
          <div className="wave-stack">
            {Array.from({ length: 34 }).map((_, index) => (
              <i key={index} style={{ height: `${22 + ((index * 17) % 58)}px` }} />
            ))}
          </div>
          <div className="preview-pills">
            <span><Mic size={14} /> Voice</span>
            <span><Layers3 size={14} /> Layered</span>
            <span><Music2 size={14} /> Brown noise</span>
          </div>
        </div>
      </section>

      <section className="landing-steps">
        {steps.map((step) => (
          <article key={step.title}>
            <step.icon size={22} />
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      <section className="landing-proof">
        <div>
          <CheckCircle2 size={20} />
          <span>Record your own voice or import existing subliminal audio</span>
        </div>
        <div>
          <CheckCircle2 size={20} />
          <span>Guided step-by-step creation without a complicated audio editor</span>
        </div>
      </section>
    </main>
  );
}
