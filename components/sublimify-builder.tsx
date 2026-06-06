"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Home,
  Loader2,
  Mic,
  Music2,
  Pause,
  Play,
  Save,
  Settings2,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import { DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";

type Mode = "record" | "paste" | "generate";
type Style = "normal" | "silent" | "layered" | "ultra_layered";
type Ambience = "none" | "rain" | "brown";

const STYLES: { key: Style; label: string; description: string }[] = [
  { key: "normal", label: "Normal", description: "Clear affirmations under music or ambience." },
  { key: "silent", label: "Silent", description: "Very low voice level with filtered texture." },
  { key: "layered", label: "Layered", description: "Multiple offset affirmation layers for density." },
  { key: "ultra_layered", label: "Ultra layered", description: "Dense stacks with wider stereo spread." }
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

function createRobotNarratorBuffer(context: BaseAudioContext, text: string) {
  const words = text
    .replace(/[^\w\s'.-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 260);
  const wordDuration = 0.24;
  const gapDuration = 0.065;
  const duration = Math.max(1.2, words.length * (wordDuration + gapDuration));
  const buffer = context.createBuffer(1, Math.ceil(duration * context.sampleRate), context.sampleRate);
  const data = buffer.getChannelData(0);

  words.forEach((word, wordIndex) => {
    const start = Math.floor(wordIndex * (wordDuration + gapDuration) * context.sampleRate);
    const letters = word.toLowerCase().replace(/[^a-z]/g, "");
    const hash = [...letters].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const base = 92 + (hash % 50);
    const vowelLift = /[aeiou]/.test(letters) ? 38 : 12;
    const frequency = base + vowelLift;

    for (let i = 0; i < wordDuration * context.sampleRate && start + i < data.length; i += 1) {
      const t = i / context.sampleRate;
      const envelope = Math.min(1, i / 900) * Math.min(1, (wordDuration * context.sampleRate - i) / 1200);
      const pulse = Math.sin(2 * Math.PI * frequency * t);
      const buzz = Math.sin(2 * Math.PI * frequency * 2.03 * t) * 0.42;
      const formant = Math.sin(2 * Math.PI * (frequency * 3.7) * t) * 0.16;
      const gate = Math.sin(2 * Math.PI * 9 * t) > -0.45 ? 1 : 0.62;
      data[start + i] += (pulse + buzz + formant) * envelope * gate * 0.18;
    }
  });

  return buffer;
}

export default function SublimifyBuilder({ userEmail, owner }: { userEmail: string; owner: boolean }) {
  const [mode, setMode] = useState<Mode>("generate");
  const [topic, setTopic] = useState("");
  const [affirmations, setAffirmations] = useState("");
  const [style, setStyle] = useState<Style>("layered");
  const [ambience, setAmbience] = useState<Ambience>("brown");
  const [duration, setDuration] = useState(180);
  const [voiceVolume, setVoiceVolume] = useState(0.18);
  const [musicVolume, setMusicVolume] = useState(0.38);
  const [noiseVolume, setNoiseVolume] = useState(0.22);
  const [beatFrequency, setBeatFrequency] = useState(6);
  const [carrierFrequency, setCarrierFrequency] = useState(220);
  const [binaural, setBinaural] = useState(true);
  const [prompt, setPrompt] = useState(DEFAULT_SUBLIMINAL_PROMPT);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<{ context: AudioContext; nodes: AudioNode[]; audio?: HTMLAudioElement } | null>(null);

  const script = useMemo(() => linesToScript(affirmations), [affirmations]);
  const activeVoiceBlob = voiceBlob ?? recordedBlob;
  const activeVoiceUrl = useMemo(() => (activeVoiceBlob ? URL.createObjectURL(activeVoiceBlob) : ""), [activeVoiceBlob]);

  useEffect(() => {
    async function loadPrompt() {
      if (!owner) return;
      const response = await fetch("/api/sublimify/config");
      const data = await response.json();
      if (data.config?.prompt) setPrompt(data.config.prompt);
    }
    loadPrompt();
  }, [owner]);

  async function generateAffirmations() {
    if (!topic.trim()) return;
    setLoading("generate");
    setStatus("");
    const response = await fetch("/api/sublimify/generate-affirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count: 28 })
    });
    const data = await response.json();
    setLoading("");
    if (!response.ok) {
      setStatus(data.error ?? "Could not generate affirmations.");
      return;
    }
    setAffirmations(data.affirmations.join("\n"));
  }

  async function generateVoice() {
    if (!script) return;
    setLoading("voice");
    setStatus("");
    await new Promise((resolve) => setTimeout(resolve, 40));
    const context = new OfflineAudioContext(1, 1, 44100);
    const voice = createRobotNarratorBuffer(context, script);
    const wav = audioBufferToWav(voice);
    setLoading("");
    setVoiceBlob(wav);
    setMode("paste");
    setStatus("Free robot narrator generated locally.");
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
    const nodes: AudioNode[] = [];

    if (ambience !== "none") {
      const source = context.createBufferSource();
      source.buffer = createNoiseBuffer(context, 12, ambience);
      source.loop = true;
      const gain = context.createGain();
      gain.gain.value = noiseVolume;
      source.connect(gain).connect(context.destination);
      source.start();
      nodes.push(source, gain);
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
      nodes.push(left, right, gain);
    }

    let audio: HTMLAudioElement | undefined;
    if (activeVoiceUrl) {
      audio = new Audio(activeVoiceUrl);
      audio.loop = true;
      audio.volume = style === "silent" ? 0.04 : Math.min(1, voiceVolume);
      audio.play();
    }

    previewRef.current = { context, nodes, audio };
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
      source.buffer = createNoiseBuffer(context, renderDuration, ambience);
      const gain = context.createGain();
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
    const wav = audioBufferToWav(rendered);
    const url = URL.createObjectURL(wav);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sublimify-${style}.wav`;
    anchor.click();
    URL.revokeObjectURL(url);
    setLoading("");
    setStatus("WAV exported.");
  }

  return (
    <main className="sublimify-shell">
      <aside className="sublimify-sidebar">
        <div className="logo-row">
          <span className="brand-mark small">
            <Music2 size={18} />
          </span>
          <strong>Sublimify</strong>
        </div>
        <nav className="nav-tabs">
          <Link href="/">
            <Home size={18} />
            <span>Home</span>
          </Link>
          <Link href="/manifestation">
            <Sparkles size={18} />
            <span>Mentor</span>
          </Link>
        </nav>
        <div className="mini-stat">
          <span>Mode</span>
          <strong>{style.replace("_", " ")}</strong>
        </div>
        <div className="mini-stat">
          <span>Signed in</span>
          <strong>{userEmail}</strong>
        </div>
      </aside>

      <section className="sublimify-workspace">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Subliminal Builder</p>
            <h1>Design the audio beneath the belief.</h1>
          </div>
          <div className="header-actions">
            <button className="secondary-button" onClick={previewing ? stopPreview : startPreview}>
              {previewing ? <Pause size={17} /> : <Play size={17} />}
              {previewing ? "Stop" : "Preview bed"}
            </button>
            <button className="primary-button" onClick={exportWav} disabled={loading === "export"}>
              {loading === "export" ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
              Export WAV
            </button>
          </div>
        </header>

        <div className="sublimify-grid">
          <section className="tool-surface creation-panel">
            <h2>Affirmation Source</h2>
            <div className="segmented three">
              <button className={mode === "generate" ? "active" : ""} onClick={() => setMode("generate")}>Generate</button>
              <button className={mode === "paste" ? "active" : ""} onClick={() => setMode("paste")}>Paste</button>
              <button className={mode === "record" ? "active" : ""} onClick={() => setMode("record")}>Record</button>
            </div>

            {mode === "generate" && (
              <div className="field-row">
                <label>Topic</label>
                <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="self-love, wealth, deep confidence..." />
                <button className="primary-button" onClick={generateAffirmations} disabled={!topic.trim() || loading === "generate"}>
                  {loading === "generate" ? <Loader2 className="spin" size={17} /> : <Wand2 size={17} />}
                  Generate affirmations
                </button>
              </div>
            )}

            {mode === "record" && (
              <div className="record-panel">
                <button className={recording ? "danger-button" : "primary-button"} onClick={recording ? stopRecording : startRecording}>
                  <Mic size={17} />
                  {recording ? "Stop recording" : "Record my affirmations"}
                </button>
                {recordedBlob && <audio controls src={URL.createObjectURL(recordedBlob)} />}
              </div>
            )}

            <textarea
              value={affirmations}
              onChange={(event) => setAffirmations(event.target.value)}
              rows={12}
              placeholder="I am deeply confident.\nI naturally choose aligned action.\nMy mind accepts success as normal."
            />

            <button className="secondary-button" onClick={generateVoice} disabled={!script || loading === "voice"}>
              {loading === "voice" ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
              Generate free robot narrator
            </button>
            {voiceBlob && <audio controls src={URL.createObjectURL(voiceBlob)} />}
          </section>

          <section className="tool-surface">
            <h2>Subliminal Style</h2>
            <div className="style-list">
              {STYLES.map((item) => (
                <button key={item.key} className={style === item.key ? "style-card active" : "style-card"} onClick={() => setStyle(item.key)}>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="tool-surface">
            <h2>Sound Bed</h2>
            <div className="field-row">
              <label>Ambience</label>
              <select value={ambience} onChange={(event) => setAmbience(event.target.value as Ambience)}>
                <option value="none">None</option>
                <option value="rain">Rain texture</option>
                <option value="brown">Brown noise</option>
              </select>
            </div>
            <label className="drop-zone">
              <Upload size={22} />
              <span>{musicFile ? musicFile.name : "Upload MP3/WAV background music"}</span>
              <input type="file" accept="audio/*" onChange={(event) => setMusicFile(event.target.files?.[0] ?? null)} />
            </label>
            <label>Binaural beats</label>
            <div className="toggle-row">
              <input type="checkbox" checked={binaural} onChange={(event) => setBinaural(event.target.checked)} />
              <span>{binaural ? "Enabled" : "Disabled"}</span>
            </div>
            <label>Beat frequency: {beatFrequency} Hz</label>
            <input type="range" min="1" max="14" step="0.5" value={beatFrequency} onChange={(event) => setBeatFrequency(Number(event.target.value))} />
            <label>Carrier: {carrierFrequency} Hz</label>
            <input type="range" min="110" max="440" step="5" value={carrierFrequency} onChange={(event) => setCarrierFrequency(Number(event.target.value))} />
          </section>

          <section className="tool-surface">
            <h2>Mix Controls</h2>
            <label>Duration: {duration}s</label>
            <input type="range" min="30" max="1800" step="30" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
            <label>Affirmations: {Math.round(voiceVolume * 100)}%</label>
            <input type="range" min="0" max="1" step="0.01" value={voiceVolume} onChange={(event) => setVoiceVolume(Number(event.target.value))} />
            <label>Music: {Math.round(musicVolume * 100)}%</label>
            <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} />
            <label>Noise/rain: {Math.round(noiseVolume * 100)}%</label>
            <input type="range" min="0" max="1" step="0.01" value={noiseVolume} onChange={(event) => setNoiseVolume(Number(event.target.value))} />
          </section>

          {owner && (
            <section className="tool-surface owner-prompt-panel">
              <div className="section-title-row">
                <h2>Owner AI Prompt</h2>
                <Settings2 size={18} />
              </div>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} />
              <button className="secondary-button" onClick={savePrompt} disabled={loading === "prompt"}>
                <Save size={17} />
                Save generation prompt
              </button>
            </section>
          )}
        </div>

        {status && <p className="floating-status">{status}</p>}
      </section>
    </main>
  );
}
