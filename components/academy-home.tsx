import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Headphones,
  Layers3,
  Mail,
  Play,
  Route,
  Sparkles,
  Users,
  WandSparkles
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";

const studioSteps = ["Choose your topic", "Create or add affirmations", "Mix voice, sound and beats", "Save your finished audio"];

export default function AcademyHome() {
  return (
    <main className="academy-home">
      <header className="home-nav">
        <Link className="home-brand" href="/" aria-label="Subliminal Academy home">
          <BrandLogo size="small" />
          <strong>Subliminal Academy</strong>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="#products">Products</Link>
          <Link href="/academy">Academy</Link>
          <Link href="/studio">Studio</Link>
        </nav>
        <Link className="home-login" href="/login?next=%2Fstudio">Log in</Link>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-logo" aria-hidden="true"><BrandLogo /></div>
        <p className="home-eyebrow"><Sparkles size={15} /> Learn it. Build it. Make it yours.</p>
        <h1 id="home-title">Subliminal Academy</h1>
        <p>Everything you need to understand subliminals, build a consistent system, and create personalized audio in one place.</p>
        <div className="home-hero-actions">
          <Link className="home-primary" href="/studio">Create a subliminal free <ArrowRight size={18} /></Link>
          <Link className="home-secondary" href="/academy">Explore the Academy <BookOpen size={18} /></Link>
        </div>
        <div className="home-trust-row" aria-label="Platform benefits">
          <span><Check size={15} /> Step-by-step learning</span>
          <span><Check size={15} /> Personalized creation</span>
          <span><Check size={15} /> One Subliminal Academy account</span>
        </div>
      </section>

      <section className="home-product-intro" id="products">
        <p className="home-eyebrow">Your path inside Subliminal Academy</p>
        <h2>Create your audio free. Then learn how to get more from it.</h2>
      </section>

      <section className="home-product home-product-studio" aria-labelledby="studio-product-title">
        <div className="home-product-copy">
          <span className="home-product-number">01 / START FREE</span>
          <h2 id="studio-product-title">Subliminal Studio</h2>
          <p>Start by turning your own topic into a finished subliminal without a complicated audio editor. Build it around your goals, your affirmations, and the sounds you want to hear.</p>
          <ul>
            <li><WandSparkles size={18} /> Generate, paste, or record affirmations</li>
            <li><Layers3 size={18} /> Layer voice, music, noise, and binaural beats</li>
            <li><Headphones size={18} /> Save, organize, listen, and export</li>
          </ul>
          <Link className="home-product-link studio-link" href="/studio">Create your subliminal free <ArrowRight size={17} /></Link>
        </div>

        <div className="home-studio-preview" aria-label="Subliminal Studio audio preview">
          <div className="home-preview-top"><span>NEW SUBLIMINAL</span><strong>Confidence reset</strong></div>
          <div className="home-waveform" aria-hidden="true">
            {Array.from({ length: 36 }).map((_, index) => <i key={index} style={{ height: `${18 + ((index * 19) % 48)}px`, animationDelay: `${index * 45}ms` }} />)}
          </div>
          <div className="home-mix-row"><span><WandSparkles size={16} /> Affirmations</span><div><i style={{ width: "15%" }} /></div><strong>15%</strong></div>
          <div className="home-mix-row"><span><Layers3 size={16} /> Background sound</span><div><i style={{ width: "50%" }} /></div><strong>50%</strong></div>
          <div className="home-studio-steps">{studioSteps.map((step, index) => <span key={step} className={index < 3 ? "done" : ""}>{index + 1}</span>)}</div>
        </div>
      </section>

      <section className="home-product home-product-academy" aria-labelledby="academy-product-title">
        <div className="home-product-copy">
          <span className="home-product-number">02 / GET MORE FROM IT</span>
          <h2 id="academy-product-title">Subliminal Academy</h2>
          <p>Once your audio is ready, learn how to use it with purpose. Follow a complete education system with practical roadmaps, community support, and a process designed for consistency.</p>
          <ul>
            <li><BookOpen size={18} /> Six complete courses</li>
            <li><Route size={18} /> Clear systems and roadmaps</li>
            <li><Users size={18} /> Community and accountability</li>
          </ul>
          <Link className="home-product-link" href="/academy">Discover the Academy <ArrowRight size={17} /></Link>
        </div>

        <div className="home-academy-preview" aria-label="Academy curriculum preview">
          <div className="home-preview-top"><span>YOUR RESULTS ROADMAP</span><strong>3 of 6 complete</strong></div>
          <div className="home-course active"><span>01</span><div><small>FOUNDATIONS</small><strong>How subliminals work</strong></div><Check size={17} /></div>
          <div className="home-course active"><span>02</span><div><small>CONSISTENCY</small><strong>Build your listening system</strong></div><Check size={17} /></div>
          <div className="home-course current"><span>03</span><div><small>ALIGNMENT</small><strong>Remove common roadblocks</strong></div><Play size={17} fill="currentColor" /></div>
          <div className="home-course"><span>04</span><div><small>APPLICATION</small><strong>Track meaningful progress</strong></div><span className="course-time">42 min</span></div>
        </div>
      </section>

      <section className="home-final">
        <div className="home-final-logo"><BrandLogo /></div>
        <p className="home-eyebrow">Your complete subliminal space</p>
        <h2>Create your audio. Learn the system. Stay consistent.</h2>
        <div>
          <Link className="home-primary" href="/studio">Start creating free</Link>
          <Link className="home-secondary" href="/academy">Explore the Academy</Link>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-brand"><BrandLogo size="small" /><strong>Subliminal Academy</strong></div>
        <p>Education, community, and personalized subliminal creation.</p>
        <a href="mailto:jhdesigns1234@gmail.com"><Mail size={15} /> Contact support</a>
      </footer>
    </main>
  );
}
