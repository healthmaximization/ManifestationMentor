"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Download,
  Home,
  Library,
  Loader2,
  Mic,
  Music2,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import CreatorViewToggle from "@/components/creator-view-toggle";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";
import { useCreatorView } from "@/lib/use-creator-view";

type Mode = "record" | "paste" | "generate";
type Style = "normal" | "silent" | "layered" | "ultra_layered";
type Ambience = "none" | "rain" | "brown";
type Step = "intention" | "source" | "paste" | "generate" | "voice" | "style" | "sound" | "export";

type SubliminalProject = {
  id: string;
  title: string;
  style: Style;
  createdAt: string;
  duration: number;
  affirmationCount: number;
  ambience?: Ambience;
  binaural?: boolean;
  imported?: boolean;
  fileName?: string;
};

const BASE_STEPS: Step[] = ["intention", "source"];
const FINISH_STEPS: Step[] = ["voice", "style", "sound", "export"];

const STYLES: { key: Style; label: string; description: string; available: boolean }[] = [
  { key: "normal", label: "Normal subliminal", description: "Audible affirmations beneath ambience or music.", available: true },
  { key: "silent", label: "Silent subliminal", description: "Voice layer is pushed very low into the background.", available: false },
  { key: "layered", label: "Layered subliminal", description: "Several offset voice layers for a denser effect.", available: false },
  { key: "ultra_layered", label: "Ultra layered", description: "A high-density stereo stack for a stronger build.", available: false }
];

function linesToScript(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(". ");
}

function audioBufferToWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * channels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  function writeString(value: string) {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    offset += value.length;
  }

  writeString("RIFF");
  view.setUint32(offset, length - 8, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * channels * 2, true);
  offset += 4;
  view.setUint16(offset, channels * 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, length - offset - 4, true);
  offset += 4;

  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function decodeBlob(context: BaseAudioContext, blob: Blob) {
  return context.decodeAudioData(await blob.arrayBuffer());
}

function createNoiseBuffer(context: BaseAudioContext, duration: number, ambience: Ambience) {
  const buffer = context.createBuffer(2, duration * context.sampleRate, context.sampleRate);
  let lastOut = 0;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      lastOut = ambience === "brown" ? (lastOut + 0.02 * white) / 1.02 : white * 0.35;
      data[i] = ambience === "rain" ? white * (Math.random() > 0.986 ? 0.7 : 0.16) : lastOut * 3.5;
    }
  }
  return buffer;
}

export default function SublimifyBuilder({ userEmail, owner }: { userEmail: string; owner: boolean }) {
  const [creatorView, setCreatorView] = useCreatorView(owner);
  const [screen, setScreen] = useState<"library" | "builder">("library");
  const [activeStep, setActiveStep] = useState<Step>("intention");
  const [mode, setMode] = useState<Mode>("generate");
  const [topic, setTopic] = useState("");
  const [generationNotes, setGenerationNotes] = useState("");
  const [affirmations, setAffirmations] = useState("");
  const [style, setStyle] = useState<Style>("normal");
  const [ambience, setAmbience] = useState<Ambience>("brown");
  const [duration, setDuration] = useState(180);
  const [voiceVolume] = useState(0.18);
  const [musicVolume] = useState(0.38);
  const [noiseVolume] = useState(0.22);
  const [beatFrequency] = useState(6);
  const [carrierFrequency] = useState(220);
  const [binaural, setBinaural] = useState(true);
  const [prompt, setPrompt] = useState(DEFAULT_SUBLIMINAL_PROMPT);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [projects, setProjects] = useState<SubliminalProject[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<{ context: AudioContext; audio?: HTMLAudioElement } | null>(null);

  const script = useMemo(() => linesToScript(affirmations), [affirmations]);
  const activeVoiceBlob = recordedBlob;
  const activeVoiceUrl = useMemo(() => (activeVoiceBlob ? URL.createObjectURL(activeVoiceBlob) : ""), [activeVoiceBlob]);
  const affirmationCount = useMemo(() => affirmations.split("\n").filter((line) => line.trim()).length, [affirmations]);
  const selectedStyle = STYLES.find((item) => item.key === style) ?? STYLES[0];
  const currentSteps = useMemo<Step[]>(() => {
    const sourceStep: Step[] = mode === "record" ? [] : mode === "paste" ? ["paste"] : ["generate"];
    return [...BASE_STEPS, ...sourceStep, ...FINISH_STEPS];
  }, [mode]);
  const activeStepIndex = Math.max(0, currentSteps.indexOf(activeStep));

  useEffect(() => {
    async function loadProjects() {
      const response = await fetch("/api/sublimify/projects");
      if (!response.ok) return;
      const data = await response.json();
      setProjects((data.projects ?? []) as SubliminalProject[]);
    }
    loadProjects();
  }, []);

  useEffect(() => {
    async function loadPrompt() {
      if (!owner || !creatorView) return;
      const response = await fetch("/api/sublimify/config");
      const data = await response.json();
      if (data.config?.prompt) setPrompt(data.config.prompt);
    }
    loadPrompt();
  }, [owner, creatorView]);

  function goNext() {
    setActiveStep(currentSteps[Math.min(currentSteps.length - 1, activeStepIndex + 1)]);
  }

  function goBack() {
    setActiveStep(currentSteps[Math.max(0, activeStepIndex - 1)]);
  }

  function startNewProject() {
    stopPreview();
    setTopic("");
    setGenerationNotes("");
    setAffirmations("");
    setMode("generate");
    setStyle("normal");
    setAmbience("brown");
    setDuration(180);
    setBinaural(true);
    setRecordedBlob(null);
    setMusicFile(null);
    setStatus("");
    setActiveStep("intention");
    setScreen("builder");
  }

  async function saveProjectSnapshot() {
    const response = await fetch("/api/sublimify/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: topic || "Untitled subliminal",
        intention: topic,
        style,
        duration,
        affirmationCount,
        script,
        ambience,
        binaural,
        musicFileName: musicFile?.name ?? null,
        voiceSource: recordedBlob ? "recorded" : "none"
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not save subliminal.");
    setProjects((current) => [data.project as SubliminalProject, ...current].slice(0, 50));
  }

  async function importSubliminal(file: File | null) {
    if (!file) return;
    setLoading("import");
    setStatus("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/sublimify/import", {
      method: "POST",
      body: form
    });
    const data = await response.json();
    setLoading("");
    if (!response.ok) {
      setStatus(data.error ?? "Could not import subliminal.");
      return;
    }
    setProjects((current) => [data.project as SubliminalProject, ...current].slice(0, 50));
    setStatus("Subliminal imported and saved to your account.");
  }

  async function generateAffirmations() {
    if (!topic.trim()) return;
    setLoading("generate");
    setStatus("");
    const guidedTopic = generationNotes.trim() ? `${topic.trim()}\nGuidance: ${generationNotes.trim()}` : topic.trim();
    const response = await fetch("/api/sublimify/generate-affirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: guidedTopic, count: 28 })
    });
    const data = await response.json();
    setLoading("");
    if (!response.ok) {
      setStatus(data.error ?? "Could not generate affirmations.");
      return;
    }
    setAffirmations(data.affirmations.join("\n"));
    setStatus("Affirmations generated. Edit anything that does not feel true yet.");
  }

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setStatus("");
    if (nextMode === "record") {
      setAffirmations("");
    }
    if (nextMode !== "record") {
      setRecordedBlob(null);
    }
  }

  function canContinue() {
    if (activeStep === "intention") return Boolean(topic.trim());
    if (activeStep === "paste") return affirmationCount > 0;
    if (activeStep === "generate") return affirmationCount > 0;
    if (activeStep === "voice") return Boolean(activeVoiceBlob);
    return true;
  }

  async function savePrompt() {
    setLoading("prompt");
    const response = await fetch("/api/sublimify/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    setLoading("");
    setStatus(response.ok ? "Sublimify prompt saved." : data.error ?? "Could not save prompt.");
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = () => {
      setRecordedBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      stream.getTracks().forEach((track) => track.stop());
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function stopPreview() {
    previewRef.current?.audio?.pause();
    previewRef.current?.context.close();
    previewRef.current = null;
    setPreviewing(false);
  }

  function startPreview() {
    stopPreview();
    const context = new AudioContext();

    if (ambience !== "none") {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = createNoiseBuffer(context, 12, ambience);
      source.loop = true;
      gain.gain.value = noiseVolume;
      source.connect(gain).connect(context.destination);
      source.start();
    }

    if (binaural) {
      const merger = context.createChannelMerger(2);
      const left = context.createOscillator();
      const right = context.createOscillator();
      const gain = context.createGain();
      left.frequency.value = carrierFrequency;
      right.frequency.value = carrierFrequency + beatFrequency;
      gain.gain.value = 0.035;
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(gain).connect(context.destination);
      left.start();
      right.start();
    }

    let audio: HTMLAudioElement | undefined;
    if (activeVoiceUrl) {
      audio = new Audio(activeVoiceUrl);
      audio.loop = true;
      audio.volume = style === "silent" ? 0.04 : Math.min(1, voiceVolume);
      audio.play();
    }

    previewRef.current = { context, audio };
    setPreviewing(true);
  }

  async function exportWav() {
    setLoading("export");
    setStatus("");
    const sampleRate = 44100;
    const renderDuration = Math.max(30, Math.min(3600, duration));
    const context = new OfflineAudioContext(2, renderDuration * sampleRate, sampleRate);

    if (ambience !== "none") {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = createNoiseBuffer(context, renderDuration, ambience);
      gain.gain.value = noiseVolume;
      source.connect(gain).connect(context.destination);
      source.start(0);
    }

    if (binaural) {
      const merger = context.createChannelMerger(2);
      const left = context.createOscillator();
      const right = context.createOscillator();
      const gain = context.createGain();
      left.frequency.value = carrierFrequency;
      right.frequency.value = carrierFrequency + beatFrequency;
      gain.gain.value = 0.035;
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(gain).connect(context.destination);
      left.start(0);
      right.start(0);
      left.stop(renderDuration);
      right.stop(renderDuration);
    }

    if (musicFile) {
      const music = await decodeBlob(context, musicFile);
      for (let start = 0; start < renderDuration; start += music.duration) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = music;
        gain.gain.value = musicVolume;
        source.connect(gain).connect(context.destination);
        source.start(start);
      }
    }

    if (activeVoiceBlob) {
      const voice = await decodeBlob(context, activeVoiceBlob);
      const layerCount = style === "ultra_layered" ? 7 : style === "layered" ? 4 : 1;
      const baseVolume = style === "silent" ? 0.035 : voiceVolume;
      for (let layer = 0; layer < layerCount; layer += 1) {
        for (let start = layer * 0.85; start < renderDuration; start += voice.duration + 1.8) {
          const source = context.createBufferSource();
          const gain = context.createGain();
          const pan = context.createStereoPanner();
          source.buffer = voice;
          source.playbackRate.value = style === "ultra_layered" ? 0.96 + layer * 0.012 : 1;
          gain.gain.value = baseVolume / Math.sqrt(layerCount);
          pan.pan.value = layerCount === 1 ? 0 : -0.6 + (1.2 * layer) / Math.max(1, layerCount - 1);
          source.connect(gain).connect(pan).connect(context.destination);
          source.start(start);
        }
      }
    }

    const rendered = await context.startRendering();
    const url = URL.createObjectURL(audioBufferToWav(rendered));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sublimify-${style}.wav`;
    anchor.click();
    URL.revokeObjectURL(url);
    try {
      await saveProjectSnapshot();
      setStatus("WAV exported and saved to your account.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "WAV exported, but could not save to your account.");
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="sublimify-minimal">
      <header className="minimal-topbar">
        <Link href="/" className="minimal-brand">
          <span className="brand-mark small"><Music2 size={18} /></span>
          <strong>Sublimify</strong>
        </Link>
        <div className="minimal-top-actions">
          <Link href="/manifestation" className="secondary-button"><Sparkles size={17} /> Mentor</Link>
          {owner && <CreatorViewToggle enabled={creatorView} onChange={setCreatorView} />}
        </div>
      </header>

      {screen === "library" && (
        <section className="subliminal-library">
          <div className="library-hero">
            <p className="eyebrow">My Subliminals</p>
            <h1>Your private subliminal studio.</h1>
            <p>Create deeply tailored subliminals through a quiet step-by-step flow. Start with one intention, answer a few focused questions, and export your audio when it feels right.</p>
            <div className="library-actions">
              <button className="primary-button library-create" onClick={startNewProject}>
                <Plus size={18} /> Create subliminal
              </button>
              <label className="secondary-button library-import">
                {loading === "import" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                Import subliminal
                <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac" onChange={(event) => importSubliminal(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>

          <div className="library-list">
            <div className="library-list-header">
              <div><Library size={18} /><span>Recent creations</span></div>
              <small>{projects.length} saved to your account</small>
            </div>
            {projects.length === 0 ? (
              <div className="empty-library">
                <Music2 size={26} />
                <strong>No subliminals yet</strong>
                <span>Your exported creations will be saved privately to your account.</span>
              </div>
            ) : (
              projects.map((project) => (
                <article key={project.id} className="subliminal-row">
                  <div>
                    <strong>{project.title}</strong>
                    <span>{project.imported ? "Imported audio" : `${project.affirmationCount} affirmations | ${project.style.replace("_", " ")} | ${Math.round(project.duration / 60)} min`}</span>
                  </div>
                  <small><Clock size={14} /> {new Date(project.createdAt).toLocaleDateString()}</small>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {screen === "builder" && (
        <section className="minimal-builder">
          <div className="minimal-progress">
            <button className="secondary-button" onClick={() => setScreen("library")}><ArrowLeft size={17} /> My Subliminals</button>
            <span>Step {activeStepIndex + 1} of {currentSteps.length}</span>
          </div>
          <div className="quiet-progress-bar"><span style={{ width: `${((activeStepIndex + 1) / currentSteps.length) * 100}%` }} /></div>

          <div className="single-step-card">
            {activeStep === "intention" && (
              <>
                <p className="eyebrow">Create Subliminal</p>
                <h1>What is this subliminal for?</h1>
                <p>Choose one clear outcome. This becomes the center of the affirmations, voice layer, and audio style.</p>
                <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Example: feel calm, confident, and magnetic on sales calls" autoFocus />
              </>
            )}

            {activeStep === "source" && (
              <>
                <p className="eyebrow">Affirmation Source</p>
                <h1>How do you want to create the affirmations?</h1>
                <p>Choose one path. The next screen adapts to this choice so the flow stays quiet and focused.</p>
                <div className="quiz-options">
                  <button className={mode === "generate" ? "quiz-option active" : "quiz-option"} onClick={() => selectMode("generate")}><Wand2 size={22} /><strong>Generate them for me</strong><span>Build a script from your intention with guided details.</span></button>
                  <button className={mode === "paste" ? "quiz-option active" : "quiz-option"} onClick={() => selectMode("paste")}><Sparkles size={22} /><strong>I already have affirmations</strong><span>Paste or write your own lines on the next screen.</span></button>
                  <button className={mode === "record" ? "quiz-option active" : "quiz-option"} onClick={() => selectMode("record")}><Mic size={22} /><strong>I want to speak them</strong><span>Go straight to recording your voice.</span></button>
                </div>
              </>
            )}

            {activeStep === "paste" && (
              <>
                <p className="eyebrow">Your Affirmations</p>
                <h1>Paste the exact lines you want in the subliminal.</h1>
                <p>Use one affirmation per line. Short, present-tense statements usually layer best in the final audio.</p>
                <textarea value={affirmations} onChange={(event) => setAffirmations(event.target.value)} rows={10} placeholder={"I feel calm and powerful.\nI trust my timing.\nI naturally take aligned action."} autoFocus />
              </>
            )}

            {activeStep === "generate" && (
              <>
                <p className="eyebrow">Guided Script</p>
                <h1>Help the AI shape the affirmations.</h1>
                <p>Add the feeling, identity shift, or situation this subliminal should reinforce. Then generate and refine the script before creating the voice layer.</p>
                <textarea value={generationNotes} onChange={(event) => setGenerationNotes(event.target.value)} rows={5} placeholder="Example: make it calm but confident, focused on self-worth, emotional safety, and taking bold action without overthinking." autoFocus />
                <button className="primary-button" onClick={generateAffirmations} disabled={!topic.trim() || loading === "generate"}>{loading === "generate" ? <Loader2 className="spin" size={17} /> : <Wand2 size={17} />} Generate script</button>
                <textarea value={affirmations} onChange={(event) => setAffirmations(event.target.value)} rows={9} placeholder="Your generated affirmations will appear here..." />
              </>
            )}

            {activeStep === "voice" && (
              <>
                <p className="eyebrow">Voice Layer</p>
                <h1>How should the affirmations become audio?</h1>
                <p>Record your own voice while reading the script below. This keeps the subliminal personal and natural.</p>
                {affirmationCount > 0 && (
                  <div className="recording-script">
                    <div>
                      <strong>Read this while recording</strong>
                      <span>{affirmationCount} affirmations</span>
                    </div>
                    <ol>
                      {affirmations.split("\n").filter((line) => line.trim()).map((line, index) => (
                        <li key={`${line}-${index}`}>{line.trim()}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="quiz-options one">
                  <button className="quiz-option" onClick={recording ? stopRecording : startRecording}><Mic size={22} /><strong>{recording ? "Stop recording" : "Record my voice"}</strong><span>Use your microphone and speak the affirmations yourself.</span></button>
                </div>
                {activeVoiceBlob && <audio controls src={URL.createObjectURL(activeVoiceBlob)} />}
              </>
            )}

            {activeStep === "style" && (
              <>
                <p className="eyebrow">Subliminal Style</p>
                <h1>What kind of subliminal do you want to create?</h1>
                <p>This decides how present or hidden the affirmation layer feels in the final mix.</p>
                <div className="quiz-options two">
                  {STYLES.map((item) => (
                    <button key={item.key} className={style === item.key ? "quiz-option active" : "quiz-option"} onClick={() => setStyle(item.key)} disabled={!item.available}><SlidersHorizontal size={22} /><strong>{item.label}</strong>{!item.available && <small className="coming-soon">Coming soon</small>}<span>{item.description}</span></button>
                  ))}
                </div>
              </>
            )}

            {activeStep === "sound" && (
              <>
                <p className="eyebrow">Sound Bed</p>
                <h1>What should play above the affirmations?</h1>
                <p>Keep it minimal, or add ambience, binaural beats, and your own uploaded audio.</p>
                <div className="quiz-options">
                  {(["none", "rain", "brown"] as Ambience[]).map((item) => (
                    <button key={item} className={ambience === item ? "quiz-option active" : "quiz-option"} onClick={() => setAmbience(item)}><Music2 size={22} /><strong>{item === "none" ? "No generated ambience" : item === "rain" ? "Rain texture" : "Brown noise"}</strong><span>{item === "none" ? "Use only voice, music, and optional binaural tones." : "Generated locally in the browser."}</span></button>
                  ))}
                </div>
                <label className="drop-zone"><Upload size={22} /><span>{musicFile ? musicFile.name : "Optional: upload MP3/WAV music or sound"}</span><input type="file" accept="audio/*" onChange={(event) => setMusicFile(event.target.files?.[0] ?? null)} /></label>
                <div className="simple-controls">
                  <label><input type="checkbox" checked={binaural} onChange={(event) => setBinaural(event.target.checked)} /> Add binaural beats</label>
                  <label>Duration: {Math.round(duration / 60)} min</label>
                  <input type="range" min="30" max="1800" step="30" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
                </div>
              </>
            )}

            {activeStep === "export" && (
              <>
                <p className="eyebrow">Final Review</p>
                <h1>Your tailored subliminal is ready.</h1>
                <p>Preview the current audio bed, then export the WAV. Your creation will appear under My Subliminals after export.</p>
                <div className="clean-summary">
                  <div><span>Intention</span><strong>{topic || "Custom subliminal"}</strong></div>
                  <div><span>Affirmations</span><strong>{affirmationCount}</strong></div>
                  <div><span>Voice</span><strong>{recordedBlob ? "Your voice" : "Missing"}</strong></div>
                  <div><span>Style</span><strong>{selectedStyle.label}</strong></div>
                  <div><span>Sound</span><strong>{ambience}{musicFile ? " + upload" : ""}</strong></div>
                </div>
                <div className="minimal-actions">
                  <button className="secondary-button" onClick={previewing ? stopPreview : startPreview}>{previewing ? <Pause size={17} /> : <Play size={17} />}{previewing ? "Stop preview" : "Preview"}</button>
                  <button className="primary-button" onClick={exportWav} disabled={loading === "export"}>{loading === "export" ? <Loader2 className="spin" size={17} /> : <Download size={17} />} Export WAV</button>
                </div>
              </>
            )}

            <div className="wizard-nav">
              <button className="secondary-button" onClick={goBack} disabled={activeStepIndex === 0}>Back</button>
              {activeStep !== "export" && <button className="primary-button" onClick={goNext} disabled={!canContinue()}>Continue <ChevronRight size={17} /></button>}
            </div>
          </div>

          {owner && creatorView && (
            <details className="creator-prompt-drawer">
              <summary><Settings2 size={17} /> Creator affirmation prompt</summary>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} />
              <button className="secondary-button" onClick={savePrompt} disabled={loading === "prompt"}><Save size={17} /> Save prompt</button>
            </details>
          )}
        </section>
      )}

      {status && <p className="floating-status">{status}</p>}
    </main>
  );
}
