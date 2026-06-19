import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Headphones,
  Mail,
  Quote,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  X
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";

const SKOOL_URL = "https://www.skool.com/subliminal-academy-6300";

const subliminalMistakes = [
  "They do not know how to listen effectively.",
  "They switch audios too quickly.",
  "They do not listen consistently enough.",
  "Limiting beliefs and mental blocks keep getting in the way.",
  "They never measure progress and quit before they notice change."
];

const subliminalOfferItems = [
  { icon: BookOpen, title: "6 complete courses", value: "$697 value", text: "A clear education path from subliminal basics to consistent implementation." },
  { icon: Users, title: "Exclusive community", value: "$397 value", text: "Accountability, feedback, shared wins, and support from people on the same path." },
  { icon: Route, title: "Systems and roadmaps", value: "$97 value", text: "Practical listening routines, progress tracking, and step-by-step implementation plans." }
];

const subliminalComments = [
  { name: "Faith", text: "I had tried subliminals on and off for years. This community finally helped me stay consistent and believe in the process." },
  { name: "Ahmed", text: "After months of listening with no direction, the structure helped me finally notice real progress." },
  { name: "Community member", text: "The biggest difference was knowing exactly what to do instead of constantly switching audios." }
];

const subliminalTestimonials = [
  { name: "Faith", quote: "I had tried subliminals on and off for years with little effect. Joining this community helped me believe in the process and actually stick to it." },
  { name: "Jelmer", quote: "The accountability and clarity changed everything. Instead of guessing, I finally had a system I could follow consistently." },
  { name: "Ahmed", quote: "I had been listening for months with zero direction. Two weeks into the community, I finally started noticing progress." }
];

const subliminalFaqs = [
  ["What are subliminals?", "Subliminals use positive affirmations or messages designed to be processed with less conscious focus. The Academy teaches you how to use them consistently and intentionally."],
  ["Do I need prior experience?", "No. The material is designed for beginners and experienced listeners. You can start with the foundations and follow the roadmaps step by step."],
  ["Will this work for me?", "Results vary and depend on factors such as consistency, expectations, habits, and how closely you follow the system. The Academy gives you structure, support, and tools; it does not promise a guaranteed outcome."],
  ["Can I cancel anytime?", "Yes. You stay in control of your membership and will not be charged for future months after cancellation."],
  ["What if I do not see results?", "You are covered by a 14-day money-back guarantee. Message us through Skool within that period if the Academy is not right for you."],
  ["Will the price stay the same?", "The price may increase for future members as the community grows. Members who join at $29/month keep that rate while their membership remains active."],
  ["How quickly can I notice changes?", "Some members report subtle changes in focus, confidence, or mindset early on. Larger changes generally require consistent practice over a longer period." ]
];

const manifestationMistakes = [
  "They constantly switch techniques.",
  "They focus on what is missing instead of the identity they are building.",
  "They do not stay consistent long enough.",
  "They reinforce limiting beliefs throughout the day.",
  "They never build subconscious alignment around the result they want."
];

const manifestationOfferItems = [
  { icon: BookOpen, title: "6 complete courses", value: "$697 value", text: "A clear learning path from manifestation foundations to consistent daily practice." },
  { icon: Users, title: "Exclusive community", value: "$397 value", text: "Accountability, feedback, shared progress, and support from people applying the same system." },
  { icon: Route, title: "Systems and roadmaps", value: "$97 value", text: "Practical routines for identity work, subconscious alignment, consistency, and progress tracking." }
];

const manifestationComments = [
  { name: "Faith", text: "I had tried different techniques on and off for years. The community finally helped me trust the process and stay consistent." },
  { name: "Ahmed", text: "After months of trying without direction, the structure helped me notice meaningful progress." },
  { name: "Community member", text: "The biggest difference was having one clear process instead of jumping to a new method every week." }
];

const manifestationTestimonials = [
  { name: "Faith", quote: "I had tried different techniques on and off for years with little effect. Joining this community helped me believe in the process and actually stick to it." },
  { name: "Jelmer", quote: "The accountability and clarity made manifestation practical. Instead of guessing, I finally had a system I could follow consistently." },
  { name: "Ahmed", quote: "I had spent months trying routines with no direction. Two weeks into the community, I finally started noticing progress." }
];

const manifestationFaqs = [
  ["What is manifestation?", "Manifestation is the practice of clarifying a desired result and aligning your thoughts, identity, habits, and actions with it. The Academy helps you turn that idea into a consistent process."],
  ["Do I need prior experience?", "No. The material is designed for beginners and experienced practitioners. You can start with the foundations and follow the roadmaps step by step."],
  ["Will this work for me?", "Results vary and depend on factors such as consistency, expectations, habits, and action. The Academy gives you structure, support, and practical tools; it does not promise a guaranteed outcome."],
  ["Can I cancel anytime?", "Yes. You stay in control of your membership and will not be charged for future months after cancellation."],
  ["What if I do not see results?", "You are covered by a 14-day money-back guarantee. Message us through Skool within that period if the Academy is not right for you."],
  ["Will the price stay the same?", "The price may increase for future members as the community grows. Members who join at $29/month keep that rate while their membership remains active."],
  ["How quickly can I notice changes?", "Some members report subtle changes in focus, confidence, or mindset early on. Larger changes generally require consistent practice and aligned action over a longer period."]
];

function JoinButton({ label = "Join Subliminal Academy" }: { label?: string }) {
  return (
    <Link className="academy-cta" href={SKOOL_URL} target="_blank" rel="noreferrer">
      {label} <ArrowRight size={18} />
    </Link>
  );
}

export default function AcademyLanding({ angle = "subliminal" }: { angle?: "subliminal" | "manifestation" }) {
  const isManifestation = angle === "manifestation";
  const mistakes = isManifestation ? manifestationMistakes : subliminalMistakes;
  const offerItems = isManifestation ? manifestationOfferItems : subliminalOfferItems;
  const comments = isManifestation ? manifestationComments : subliminalComments;
  const testimonials = isManifestation ? manifestationTestimonials : subliminalTestimonials;
  const faqs = isManifestation ? manifestationFaqs : subliminalFaqs;
  const KickerIcon = isManifestation ? Sparkles : Headphones;

  return (
    <main className="academy-page">
      <header className="academy-nav">
        <Link href={isManifestation ? "/manifestation" : "/academy"} className="academy-brand">
          <BrandLogo size="small" />
          <strong>Subliminal Academy</strong>
        </Link>
        <Link className="academy-nav-cta" href={SKOOL_URL} target="_blank" rel="noreferrer">Join for $29/month</Link>
      </header>

      <section className="academy-hero" aria-labelledby="academy-title">
        <div className="academy-hero-mark"><BrandLogo /></div>
        <p className="academy-kicker"><KickerIcon size={16} /> {isManifestation ? "For people ready to stop switching techniques" : "For subliminal listeners ready for a real system"}</p>
        <h1 id="academy-title">{isManifestation ? <>Why most people <span>fail to manifest</span>, even when they try every technique.</> : <>Why most people <span>do not get results</span> from subliminals, even when they listen daily.</>}</h1>
        <p className="academy-hero-copy">{isManifestation ? "Most people spend months trying to manifest without seeing meaningful changes. Our step-by-step system helps you reprogram limiting patterns, build a new identity, and make manifestation finally click." : "Most people waste time listening without direction. Our step-by-step system shows you how to listen consistently, remove common roadblocks, and track what is actually changing."}</p>
        <div className="academy-hero-actions">
          <JoinButton label="Join the community" />
          <span><ShieldCheck size={17} /> 14-day money-back guarantee</span>
        </div>
        <small>$29/month. Cancel anytime.</small>
      </section>

      <section className="academy-comment-section" aria-labelledby="comments-title">
        <div className="academy-section-heading centered">
          <p className="academy-kicker">You have seen the comments</p>
          <h2 id="comments-title">{isManifestation ? <>Other people seem to create change. <span>You are still waiting.</span></> : <>Other listeners seem to move forward. <span>You are still waiting.</span></>}</h2>
        </div>
        <div className="academy-comment-wall" aria-label="Member experiences">
          {comments.map((comment) => (
            <article key={comment.name + comment.text} className="academy-comment">
              <div><span>{comment.name.slice(0, 1)}</span><strong>{comment.name}</strong><small>Member experience</small></div>
              <p>{comment.text}</p>
              <div className="academy-comment-meta"><CheckCircle2 size={14} /> Shared inside the community</div>
            </article>
          ))}
        </div>
      </section>

      <section className="academy-problem">
        <div className="academy-problem-copy">
          <p className="academy-kicker">The frustrating loop</p>
          <h2>{isManifestation ? <>You visualize. You affirm. You wait. <span>Nothing changes.</span></> : <>You watch. You listen. You wait. <span>Nothing happens.</span></>}</h2>
          <p>{isManifestation ? "You start wondering whether you are doing something wrong. You try another method, another technique, another routine, and still feel stuck." : "You start wondering whether something is wrong with you. You switch to another subliminal, then another, and still feel stuck."}</p>
          <strong>It is not your fault.</strong>
          <p>{isManifestation ? "Most people never create lasting change because nobody showed them how to turn manifestation into a clear, consistent process." : "Most listeners never get clear results because nobody showed them how to build a consistent process around what they are listening to."}</p>
        </div>
        <div className="academy-mistakes">
          <h3>{isManifestation ? "Why most people never manifest real results" : "Why most listeners never see real change"}</h3>
          {mistakes.map((mistake) => <div key={mistake}><X size={18} /><span>{mistake}</span></div>)}
        </div>
      </section>

      <section className="academy-system">
        <div className="academy-section-heading centered">
          <p className="academy-kicker">A complete implementation system</p>
          <h2>{isManifestation ? <>We do not just give you manifestation techniques. We give you the <span>system</span> that helps you apply them consistently.</> : <>We do not just give you affirmations. We give you the <span>system</span> that helps you use them effectively.</>}</h2>
        </div>
        <div className="academy-offer-grid">
          {offerItems.map((item) => (
            <article key={item.title}>
              <item.icon size={24} />
              <div><h3>{item.title}</h3><strong>{item.value}</strong></div>
              <p>{item.text}</p>
            </article>
          ))}
        </div>

        <div className="academy-offer">
          <div>
            <span>Total value</span>
            <del>$1,191</del>
            <strong>$29<small>/month</small></strong>
          </div>
          <ul>
            <li><Check size={17} /> All six courses</li>
            <li><Check size={17} /> Community access</li>
            <li><Check size={17} /> Systems and roadmaps</li>
            <li><Check size={17} /> Locked-in early access price</li>
          </ul>
          <JoinButton label="Start inside the Academy" />
          <p><ShieldCheck size={16} /> 14-day 100% money-back guarantee</p>
        </div>
      </section>

      <section className="academy-testimonials">
        <div className="academy-section-heading">
          <p className="academy-kicker">Member experiences</p>
          <h2>{isManifestation ? <>A clear process makes manifestation <span>easier to sustain.</span></> : <>Clarity and accountability make consistency <span>much easier.</span></>}</h2>
        </div>
        <div className="academy-testimonial-grid">
          {testimonials.map((testimonial) => (
            <figure key={testimonial.name}>
              <Quote size={22} />
              <blockquote>{testimonial.quote}</blockquote>
              <figcaption>{testimonial.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="academy-final-cta">
        <BrandLogo />
        <h2>{isManifestation ? <>Join the community where people turn manifestation into <span>real, consistent practice.</span></> : <>Join the community where subliminal listeners build a process for <span>real, consistent progress.</span></>}</h2>
        <p>{isManifestation ? "Get the courses, roadmaps, accountability, and support you need to stop switching techniques and start following a clear system." : "Get the courses, roadmaps, accountability, and support you need to stop guessing."}</p>
        <JoinButton label="Join for $29/month" />
        <small>14-day money-back guarantee. Cancel anytime.</small>
      </section>

      <section className="academy-faq" aria-labelledby="faq-title">
        <div className="academy-section-heading">
          <p className="academy-kicker">Frequently asked questions</p>
          <h2 id="faq-title">Everything you need to know before joining.</h2>
        </div>
        <div className="academy-faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span>+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="academy-bottom-offer">
        <div><strong>$29/month</strong><span>Early-access membership</span></div>
        <JoinButton label="Join Subliminal Academy" />
      </section>

      <footer className="academy-footer">
        <div className="academy-brand"><BrandLogo size="small" /><strong>Subliminal Academy</strong></div>
        <p>Educational content and community support only. Individual results vary.</p>
        <a href="mailto:jhdesigns1234@gmail.com"><Mail size={15} /> Contact support</a>
      </footer>
    </main>
  );
}
