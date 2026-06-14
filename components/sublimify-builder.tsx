"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  GripVertical,
  Library,
  Loader2,
  Lock,
  LogOut,
  Mic,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Wand2,
  X,
  XCircle
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { DEFAULT_SUBLIMINAL_IDEA_PROMPT, DEFAULT_SUBLIMINAL_PROMPT } from "@/lib/config";

type Mode = "record" | "paste" | "generate";
type VoiceChoice = "record" | "tts";
type Style = "normal" | "silent" | "layered" | "ultra_layered";
type Ambience = "none" | "rain_soft" | "rain_heavy" | "rain_window" | "brown_soft" | "brown_deep" | "brown_warm" | "white_soft";
type BinauralRange = "delta" | "theta" | "alpha" | "beta";
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
  audioUrl?: string | null;
};

type SubliminalPlaylist = {
  id: string;
  title: string;
  createdAt: string;
  projectIds: string[];
};

const BASE_STEPS: Step[] = ["intention", "source"];
const FINISH_STEPS: Step[] = ["voice", "style", "sound", "export"];

const STYLES: { key: Style; label: string; description: string; available: boolean }[] = [
  { key: "normal", label: "Normal subliminal", description: "Audible affirmations beneath ambience or music.", available: true },
  { key: "silent", label: "Silent subliminal", description: "Voice layer is pushed very low into the background.", available: false },
  { key: "layered", label: "Layered subliminal", description: "Several offset voice layers for a denser effect.", available: false },
  { key: "ultra_layered", label: "Ultra layered", description: "A high-density stereo stack for a stronger build.", available: false }
];

const AMBIENCE_OPTIONS: { key: Ambience; label: string; description: string }[] = [
  { key: "none", label: "No generated sound", description: "Use only voice, uploaded audio, and optional binaural tones." },
  { key: "rain_soft", label: "Soft rain", description: "Light, gentle rain texture." },
  { key: "rain_heavy", label: "Heavy rain", description: "Thicker rain for more masking." },
  { key: "rain_window", label: "Window rain", description: "Soft rain with small drops and movement." },
  { key: "brown_soft", label: "Soft brown noise", description: "Smooth low noise under the affirmations." },
  { key: "brown_deep", label: "Deep brown noise", description: "Darker, stronger low-end masking." },
  { key: "brown_warm", label: "Warm brown noise", description: "Rounder and less intense." },
  { key: "white_soft", label: "Soft white noise", description: "Clean high-frequency masking for a lighter bed." }
];

const BINAURAL_OPTIONS: { key: BinauralRange; label: string; frequency: number; description: string }[] = [
  { key: "delta", label: "Delta", frequency: 2.5, description: "Very slow range for sleep-focused tracks." },
  { key: "theta", label: "Theta", frequency: 6, description: "Relaxed range for calm focus." },
  { key: "alpha", label: "Alpha", frequency: 10, description: "Clear and relaxed daytime listening." },
  { key: "beta", label: "Beta", frequency: 16, description: "Brighter range for focus and energy." }
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

async function audioBufferToCompressedAudio(buffer: AudioBuffer) {
  if (typeof MediaRecorder === "undefined") return audioBufferToWav(buffer);

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
  const context = new AudioContext({ sampleRate: buffer.sampleRate });
  const destination = context.createMediaStreamDestination();
  const source = context.createBufferSource();
  const chunks: BlobPart[] = [];

  source.buffer = buffer;
  source.connect(destination);

  return new Promise<Blob>((resolve, reject) => {
    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 96000
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      void context.close();
      reject(new Error("Could not compress subliminal audio."));
    };
    recorder.onstop = () => {
      void context.close();
      resolve(new Blob(chunks, { type: mimeType }));
    };
    source.onended = () => recorder.stop();

    recorder.start();
    source.start();
    void context.resume();
  });
}

async function readJsonResponse(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) return { error: fallback };

  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 220) || fallback };
  }
}

async function decodeBlob(context: BaseAudioContext, blob: Blob) {
  return context.decodeAudioData(await blob.arrayBuffer());
}

function createNoiseBuffer(context: BaseAudioContext, duration: number, ambience: Ambience) {
  const buffer = context.createBuffer(2, duration * context.sampleRate, context.sampleRate);
  let lastOut = 0;
  const isRain = ambience.startsWith("rain");
  const isWhiteNoise = ambience === "white_soft";
  const rainDropChance = ambience === "rain_heavy" ? 0.972 : ambience === "rain_window" ? 0.992 : 0.986;
  const rainBase = ambience === "rain_heavy" ? 0.24 : ambience === "rain_window" ? 0.11 : 0.15;
  const rainDrop = ambience === "rain_heavy" ? 0.85 : ambience === "rain_window" ? 0.55 : 0.68;
  const brownFilter = ambience === "brown_deep" ? 0.014 : ambience === "brown_warm" ? 0.026 : 0.02;
  const brownGain = ambience === "brown_deep" ? 4.2 : ambience === "brown_warm" ? 2.9 : 3.5;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      lastOut = isRain || isWhiteNoise ? white * 0.35 : (lastOut + brownFilter * white) / (1 + brownFilter);
      data[i] = isRain
        ? white * (Math.random() > rainDropChance ? rainDrop : rainBase)
        : isWhiteNoise
          ? white * 0.16
          : lastOut * brownGain;
    }
  }
  return buffer;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "matches voice length";
  const total = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return minutes ? `${minutes}:${remaining.toString().padStart(2, "0")}` : `${remaining}s`;
}

function formatPlaybackTime(seconds: number) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LibraryAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    await audio.play();
    setPlaying(true);
  }

  function scrub(nextTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function changeVolume(nextVolume: number) {
    setVolume(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
  }

  return (
    <div className="custom-audio-player">
      <audio
        ref={audioRef}
        src={src}
        loop
        preload="metadata"
        onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause subliminal" : "Play subliminal"}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <input
        aria-label="Subliminal playback progress"
        type="range"
        min="0"
        max={audioDuration || 1}
        step="0.1"
        value={Math.min(currentTime, audioDuration || 1)}
        onChange={(event) => scrub(Number(event.target.value))}
      />
      <span>{formatPlaybackTime(currentTime)} / {formatPlaybackTime(audioDuration)}</span>
      <label className="audio-volume-control">
        <Volume2 size={14} />
        <input
          aria-label="Subliminal volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => changeVolume(Number(event.target.value))}
        />
      </label>
    </div>
  );
}

export default function SublimifyBuilder({ userEmail, owner, hasPro }: { userEmail: string; owner: boolean; hasPro: boolean }) {
  const [screen, setScreen] = useState<"library" | "builder">("library");
  const [activeStep, setActiveStep] = useState<Step>("intention");
  const [mode, setMode] = useState<Mode>(hasPro ? "generate" : "paste");
  const [topic, setTopic] = useState("");
  const [generationNotes, setGenerationNotes] = useState("");
  const [affirmations, setAffirmations] = useState("");
  const [style, setStyle] = useState<Style>("normal");
  const [ambience, setAmbience] = useState<Ambience>("none");
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceVolume, setVoiceVolume] = useState(0.15);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [beatVolume, setBeatVolume] = useState(0.25);
  const [binauralRange, setBinauralRange] = useState<BinauralRange>("theta");
  const [carrierFrequency] = useState(220);
  const [binaural, setBinaural] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_SUBLIMINAL_PROMPT);
  const [ideaPrompt, setIdeaPrompt] = useState(DEFAULT_SUBLIMINAL_IDEA_PROMPT);
  const [ideaSeed, setIdeaSeed] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState("");
  const [recording, setRecording] = useState(false);
  const [voiceChoice, setVoiceChoice] = useState<VoiceChoice | null>(null);
  const [showRecordingScript, setShowRecordingScript] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [ttsBlob, setTtsBlob] = useState<Blob | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [soundSectionOpen, setSoundSectionOpen] = useState(false);
  const [beatSectionOpen, setBeatSectionOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [projects, setProjects] = useState<SubliminalProject[]>([]);
  const [playlists, setPlaylists] = useState<SubliminalPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlistPlayingId, setPlaylistPlayingId] = useState("");
  const [playlistTrackIndex, setPlaylistTrackIndex] = useState(0);
  const [upgradePrompt, setUpgradePrompt] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playlistAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<{
    context: AudioContext;
    audios: HTMLAudioElement[];
    urls: string[];
    ambienceGain?: GainNode;
    beatGain?: GainNode;
    voiceAudio?: HTMLAudioElement;
    musicAudio?: HTMLAudioElement;
  } | null>(null);

  const initials = useMemo(() => userEmail.slice(0, 2).toUpperCase(), [userEmail]);
  const script = useMemo(() => linesToScript(affirmations), [affirmations]);
  const activeVoiceBlob = recordedBlob ?? ttsBlob;
  const activeVoiceUrl = useMemo(() => (activeVoiceBlob ? URL.createObjectURL(activeVoiceBlob) : ""), [activeVoiceBlob]);
  const duration = Math.max(1, Math.ceil(voiceDuration || 0));
  const affirmationCount = useMemo(() => affirmations.split("\n").filter((line) => line.trim()).length, [affirmations]);
  const selectedStyle = STYLES.find((item) => item.key === style) ?? STYLES[0];
  const selectedAmbience = AMBIENCE_OPTIONS.find((item) => item.key === ambience) ?? AMBIENCE_OPTIONS[0];
  const selectedBinaural = BINAURAL_OPTIONS.find((item) => item.key === binauralRange) ?? BINAURAL_OPTIONS[1];
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null;
  const selectedPlaylistProjects = selectedPlaylist
    ? selectedPlaylist.projectIds
      .map((projectId) => projects.find((project) => project.id === projectId))
      .filter((project): project is SubliminalProject => Boolean(project))
    : [];
  const activePlaylist = playlists.find((playlist) => playlist.id === playlistPlayingId) ?? null;
  const activePlaylistProjects = activePlaylist
    ? activePlaylist.projectIds
      .map((projectId) => projects.find((project) => project.id === projectId && project.audioUrl))
      .filter((project): project is SubliminalProject => Boolean(project))
    : [];
  const activePlaylistTrack = activePlaylistProjects[playlistTrackIndex] ?? null;
  const soundOptions = AMBIENCE_OPTIONS.filter((item) => item.key !== "none");
  const soundChoiceSummary = [
    ambience !== "none" ? selectedAmbience.label : "",
    musicFile ? "Custom upload" : ""
  ].filter(Boolean).join(" + ") || "None";
  const hasSoundBed = ambience !== "none" || Boolean(musicFile);
  const currentSteps = useMemo<Step[]>(() => {
    const sourceStep: Step[] = mode === "record" ? [] : mode === "paste" ? ["paste"] : ["generate"];
    return [...BASE_STEPS, ...sourceStep, ...FINISH_STEPS];
  }, [mode]);
  const activeStepIndex = Math.max(0, currentSteps.indexOf(activeStep));
  const isFree = !hasPro;
  const libraryLimitReached = isFree && projects.length >= 1;

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
    async function loadPlaylists() {
      if (!hasPro) return;
      const response = await fetch("/api/sublimify/playlists");
      if (!response.ok) return;
      const data = await response.json();
      setPlaylists((data.playlists ?? []) as SubliminalPlaylist[]);
    }
    loadPlaylists();
  }, [hasPro]);

  useEffect(() => {
    async function loadPrompt() {
      if (!owner) return;
      const response = await fetch("/api/sublimify/config");
      const data = await response.json();
      if (data.config?.prompt) setPrompt(data.config.prompt);
      if (data.config?.idea_prompt) setIdeaPrompt(data.config.idea_prompt);
    }
    loadPrompt();
  }, [owner]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 4500);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!activeVoiceBlob) {
      setVoiceDuration(0);
      return;
    }

    const url = URL.createObjectURL(activeVoiceBlob);
    const audio = new Audio(url);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setVoiceDuration(audio.duration);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => URL.revokeObjectURL(url);
  }, [activeVoiceBlob]);

  useEffect(() => {
    if (!activePlaylistTrack?.audioUrl) return;
    const audio = playlistAudioRef.current;
    if (!audio) return;
    audio.load();
    void audio.play().catch(() => setPlaylistPlayingId(""));
  }, [activePlaylistTrack?.audioUrl]);

  function goNext() {
    const nextStep = currentSteps[Math.min(currentSteps.length - 1, activeStepIndex + 1)];
    if (nextStep === "generate" && !generationNotes.trim() && topic.trim()) {
      setGenerationNotes(topic.trim());
    }
    if (nextStep === "export") {
      stopPreview();
    }
    setActiveStep(nextStep);
  }

  function handleWizardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || activeStep === "export" || !canContinue()) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.isContentEditable) return;
    event.preventDefault();
    goNext();
  }

  function goBack() {
    setActiveStep(currentSteps[Math.max(0, activeStepIndex - 1)]);
  }

  function updateVoiceVolume(nextVolume: number) {
    setVoiceVolume(nextVolume);
    if (previewRef.current?.voiceAudio) {
      previewRef.current.voiceAudio.volume = style === "silent" ? 0.04 : Math.min(1, nextVolume);
    }
  }

  function updateSoundVolume(nextVolume: number) {
    setSoundVolume(nextVolume);
    if (previewRef.current?.ambienceGain) previewRef.current.ambienceGain.gain.value = nextVolume;
    if (previewRef.current?.musicAudio) previewRef.current.musicAudio.volume = Math.min(1, nextVolume);
  }

  function updateBeatVolume(nextVolume: number) {
    setBeatVolume(nextVolume);
    if (previewRef.current?.beatGain) previewRef.current.beatGain.gain.value = nextVolume * 0.12;
  }

  function openUpgradePrompt(message: string) {
    setStatus("");
    setUpgradePrompt(message);
  }

  async function startCheckout(planKey: "monthly" | "yearly") {
    setLoading(`checkout-${planKey}`);
    setStatus("");
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey: "pro_bundle", planKey })
      });
      const data = await response.json().catch(() => ({ error: "Checkout did not return a valid response." }));
      if (!response.ok || !data.url) {
        setStatus(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setLoading("");
    }
  }

  function openBuilderWithTopic(initialTopic = "") {
    stopPreview();
    setTopic(initialTopic);
    setGenerationNotes("");
    setAffirmations("");
    setMode(hasPro ? "generate" : "paste");
    setStyle("normal");
    setAmbience("none");
    setBinaural(false);
    setBinauralRange("theta");
    setVoiceVolume(0.15);
    setSoundVolume(0.5);
    setBeatVolume(0.25);
    setRecordedBlob(null);
    setTtsBlob(null);
    setVoiceChoice(null);
    setShowRecordingScript(false);
    setMusicFile(null);
    setSoundSectionOpen(false);
    setBeatSectionOpen(false);
    setStatus("");
    setActiveStep("intention");
    setScreen("builder");
  }

  function startNewProject() {
    if (libraryLimitReached) {
      openUpgradePrompt("Free includes 1 custom subliminal in your library. Upgrade to Pro to create and save unlimited subliminals.");
      return;
    }
    openBuilderWithTopic("");
  }

  function selectIdea(idea: string) {
    openBuilderWithTopic(idea);
  }

  async function generateIdeas() {
    if (!owner) return;
    setLoading("ideas");
    setStatus("");
    const response = await fetch("/api/sublimify/generate-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: ideaSeed })
    });
    const data = await response.json();
    setLoading("");
    if (!response.ok) {
      setStatus(data.error ?? "Could not generate ideas.");
      return;
    }
    setIdeas(data.ideas ?? []);
  }

  async function saveProjectSnapshot(audioBlob?: Blob, renderedDuration = duration) {
    let response: Response;

    if (audioBlob) {
      const form = new FormData();
      const extension = audioBlob.type.includes("webm") ? "webm" : "wav";
      form.set("audio", audioBlob, `sublimify-${style}.${extension}`);
      form.set("title", topic || "Untitled subliminal");
      form.set("intention", topic);
      form.set("style", style);
      form.set("duration", String(renderedDuration));
      form.set("affirmationCount", String(affirmationCount));
      form.set("script", script);
      form.set("ambience", ambience);
      form.set("binaural", String(binaural));
      form.set("musicFileName", musicFile?.name ?? "");
      form.set("voiceSource", recordedBlob ? "recorded" : ttsBlob ? "text_to_speech" : "none");
      form.set("voiceVolume", String(voiceVolume));
      form.set("soundVolume", String(soundVolume));
      form.set("beatVolume", String(beatVolume));
      response = await fetch("/api/sublimify/projects", {
        method: "POST",
        body: form
      });
    } else {
      response = await fetch("/api/sublimify/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic || "Untitled subliminal",
          intention: topic,
          style,
          duration: renderedDuration,
          affirmationCount,
          script,
          ambience,
          binaural,
          musicFileName: musicFile?.name ?? null,
          voiceSource: recordedBlob ? "recorded" : ttsBlob ? "text_to_speech" : "none",
          voiceVolume,
          soundVolume,
          beatVolume
        })
      });
    }

    const data = await readJsonResponse(response, "Could not save subliminal.");
    if (!response.ok) throw new Error(data.error ?? "Could not save subliminal.");
    setProjects((current) => [data.project as SubliminalProject, ...current].slice(0, 50));
  }

  async function importSubliminal(file: File | null) {
    if (!file) return;
    if (libraryLimitReached) {
      openUpgradePrompt("Free includes 1 custom subliminal in your library. Upgrade to Pro to import and save more subliminals.");
      return;
    }
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

  async function createPlaylist() {
    if (!hasPro) {
      openUpgradePrompt("Playlists are included in Pro. Upgrade to organize multiple subliminals into repeatable listening flows.");
      return;
    }

    setLoading("playlist");
    setStatus("");
    const response = await fetch("/api/sublimify/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Playlist ${playlists.length + 1}` })
    });
    const data = await response.json();
    setLoading("");

    if (!response.ok) {
      setStatus(data.error ?? "Could not create playlist.");
      return;
    }

    setPlaylists((current) => [data.playlist as SubliminalPlaylist, ...current].slice(0, 50));
    setSelectedPlaylistId((data.playlist as SubliminalPlaylist).id);
    setStatus("Playlist created.");
  }

  async function updatePlaylist(playlistId: string, updates: Partial<Pick<SubliminalPlaylist, "title" | "projectIds">>) {
    if (!hasPro) {
      openUpgradePrompt("Playlists are included in Pro. Upgrade to organize multiple subliminals into repeatable listening flows.");
      return null;
    }

    setLoading(`playlist-${playlistId}`);
    setStatus("");
    try {
      const response = await fetch(`/api/sublimify/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const data = await response.json().catch(() => ({ error: "Could not update playlist." }));
      if (!response.ok) {
        setStatus(data.error ?? "Could not update playlist.");
        return null;
      }
      const nextPlaylist = data.playlist as SubliminalPlaylist;
      setPlaylists((current) => current.map((playlist) => (playlist.id === playlistId ? nextPlaylist : playlist)));
      return nextPlaylist;
    } finally {
      setLoading("");
    }
  }

  async function renamePlaylist(playlist: SubliminalPlaylist) {
    const nextTitle = window.prompt("Playlist name", playlist.title)?.trim();
    if (!nextTitle || nextTitle === playlist.title) return;
    const updated = await updatePlaylist(playlist.id, { title: nextTitle });
    if (updated) setStatus("Playlist renamed.");
  }

  async function deletePlaylist(playlistId: string) {
    if (!hasPro) {
      openUpgradePrompt("Playlists are included in Pro. Upgrade to organize multiple subliminals into repeatable listening flows.");
      return;
    }
    if (!window.confirm("Delete this playlist? Your subliminals stay in your library.")) return;

    setLoading(`playlist-${playlistId}`);
    setStatus("");
    try {
      const response = await fetch(`/api/sublimify/playlists/${playlistId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({ error: "Could not delete playlist." }));
      if (!response.ok) {
        setStatus(data.error ?? "Could not delete playlist.");
        return;
      }
      setPlaylists((current) => current.filter((playlist) => playlist.id !== playlistId));
      if (selectedPlaylistId === playlistId) setSelectedPlaylistId("");
      if (playlistPlayingId === playlistId) {
        playlistAudioRef.current?.pause();
        setPlaylistPlayingId("");
        setPlaylistTrackIndex(0);
      }
      setStatus("Playlist deleted.");
    } finally {
      setLoading("");
    }
  }

  async function addProjectToPlaylist(projectId: string) {
    if (!selectedPlaylist) return;
    if (selectedPlaylist.projectIds.includes(projectId)) return;
    const updated = await updatePlaylist(selectedPlaylist.id, { projectIds: [...selectedPlaylist.projectIds, projectId] });
    if (updated) setStatus("Subliminal added to playlist.");
  }

  async function removeProjectFromPlaylist(projectId: string) {
    if (!selectedPlaylist) return;
    const updated = await updatePlaylist(selectedPlaylist.id, {
      projectIds: selectedPlaylist.projectIds.filter((id) => id !== projectId)
    });
    if (updated) setStatus("Subliminal removed from playlist.");
  }

  async function movePlaylistProject(projectId: string, direction: -1 | 1) {
    if (!selectedPlaylist) return;
    const index = selectedPlaylist.projectIds.indexOf(projectId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedPlaylist.projectIds.length) return;
    const nextProjectIds = [...selectedPlaylist.projectIds];
    [nextProjectIds[index], nextProjectIds[nextIndex]] = [nextProjectIds[nextIndex], nextProjectIds[index]];
    const updated = await updatePlaylist(selectedPlaylist.id, { projectIds: nextProjectIds });
    if (updated) setStatus("Playlist reordered.");
  }

  function playPlaylist(playlist: SubliminalPlaylist) {
    const playableProjects = playlist.projectIds
      .map((projectId) => projects.find((project) => project.id === projectId && project.audioUrl))
      .filter((project): project is SubliminalProject => Boolean(project));

    if (playableProjects.length === 0) {
      setStatus("Add at least one ready subliminal before playing this playlist.");
      return;
    }

    if (playlistPlayingId === playlist.id) {
      playlistAudioRef.current?.pause();
      setPlaylistPlayingId("");
      setPlaylistTrackIndex(0);
      return;
    }

    setPlaylistPlayingId(playlist.id);
    setPlaylistTrackIndex(0);
  }

  function playNextPlaylistTrack() {
    if (!activePlaylist || activePlaylistProjects.length === 0) {
      setPlaylistPlayingId("");
      setPlaylistTrackIndex(0);
      return;
    }
    setPlaylistTrackIndex((current) => (current + 1) % activePlaylistProjects.length);
  }

  async function generateAffirmations() {
    if (isFree) {
      openUpgradePrompt("AI-generated affirmations are included in Pro. Upgrade to generate tailored affirmation scripts instantly.");
      return;
    }
    if (!topic.trim()) return;
    setLoading("generate");
    setStatus("");
    const guidedTopic = generationNotes.trim() || topic.trim();
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
    if (nextMode === "generate" && isFree) {
      openUpgradePrompt("AI-generated affirmations are a Pro feature. You can paste affirmations or record your own voice on Free.");
      return;
    }
    setMode(nextMode);
    setStatus("");
    if (nextMode === "generate" && !generationNotes.trim() && topic.trim()) {
      setGenerationNotes(topic.trim());
    }
    if (nextMode === "record") {
      setAffirmations("");
      setShowRecordingScript(false);
    }
    if (nextMode !== "record") {
      setRecordedBlob(null);
      setShowRecordingScript(false);
    }
    setTtsBlob(null);
    setVoiceChoice(null);
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
      body: JSON.stringify({ prompt, idea_prompt: ideaPrompt })
    });
    const data = await response.json();
    setLoading("");
    setStatus(response.ok ? "Sublimify prompt saved." : data.error ?? "Could not save prompt.");
  }

  async function startRecording() {
    setVoiceChoice("record");
    setShowRecordingScript(true);
    setTtsBlob(null);
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

  function toggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }
    startRecording();
  }

  async function generateTextToSpeech() {
    if (!script) return;
    setLoading("tts");
    setStatus("");
    stopPreview();
    setVoiceChoice("tts");
    setShowRecordingScript(false);
    setRecordedBlob(null);
    try {
      const response = await fetch("/api/sublimify/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Could not create text to speech audio." }));
        throw new Error(data.error ?? "Could not create text to speech audio.");
      }

      const audioBuffer = await response.arrayBuffer();
      setTtsBlob(new Blob([audioBuffer], { type: response.headers.get("Content-Type") ?? "audio/mpeg" }));
      setStatus("Text to speech voice created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create text to speech audio.");
    } finally {
      setLoading("");
    }
  }

  function stopPreview() {
    previewRef.current?.audios.forEach((audio) => audio.pause());
    previewRef.current?.urls.forEach((url) => URL.revokeObjectURL(url));
    previewRef.current?.context.close();
    previewRef.current = null;
    setPreviewing(false);
  }

  function startPreview(overrides: Partial<{ ambience: Ambience; binaural: boolean; binauralRange: BinauralRange; musicFile: File | null }> = {}) {
    stopPreview();
    const previewAmbience = overrides.ambience ?? ambience;
    const previewBinaural = overrides.binaural ?? binaural;
    const previewBinauralRange = BINAURAL_OPTIONS.find((item) => item.key === (overrides.binauralRange ?? binauralRange)) ?? selectedBinaural;
    const previewMusicFile = overrides.musicFile === undefined ? musicFile : overrides.musicFile;
    const context = new AudioContext();
    let ambienceGain: GainNode | undefined;
    let beatGain: GainNode | undefined;
    let voiceAudio: HTMLAudioElement | undefined;
    let musicAudio: HTMLAudioElement | undefined;

    if (previewAmbience !== "none") {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = createNoiseBuffer(context, 12, previewAmbience);
      source.loop = true;
      gain.gain.value = soundVolume;
      source.connect(gain).connect(context.destination);
      source.start();
      ambienceGain = gain;
    }

    if (previewBinaural) {
      const merger = context.createChannelMerger(2);
      const left = context.createOscillator();
      const right = context.createOscillator();
      const gain = context.createGain();
      left.frequency.value = carrierFrequency;
      right.frequency.value = carrierFrequency + previewBinauralRange.frequency;
      gain.gain.value = beatVolume * 0.12;
      left.connect(merger, 0, 0);
      right.connect(merger, 0, 1);
      merger.connect(gain).connect(context.destination);
      left.start();
      right.start();
      beatGain = gain;
    }

    const audios: HTMLAudioElement[] = [];
    const urls: string[] = [];
    if (activeVoiceUrl) {
      const audio = new Audio(activeVoiceUrl);
      audio.loop = true;
      audio.volume = style === "silent" ? 0.04 : Math.min(1, voiceVolume);
      audio.play();
      audios.push(audio);
      voiceAudio = audio;
    }

    if (previewMusicFile) {
      const musicUrl = URL.createObjectURL(previewMusicFile);
      const music = new Audio(musicUrl);
      music.loop = true;
      music.volume = Math.min(1, soundVolume);
      music.play();
      audios.push(music);
      urls.push(musicUrl);
      musicAudio = music;
    }

    previewRef.current = { context, audios, urls, ambienceGain, beatGain, voiceAudio, musicAudio };
    setPreviewing(true);
  }

  async function renderSubliminalWav() {
    const sampleRate = 44100;
    let voiceBuffer: AudioBuffer | null = null;

    if (activeVoiceBlob) {
      const voiceContext = new AudioContext();
      voiceBuffer = await decodeBlob(voiceContext, activeVoiceBlob);
      await voiceContext.close();
    }

    const renderDuration = Math.max(1, Math.min(3600, Math.ceil(voiceBuffer?.duration ?? duration)));
    const context = new OfflineAudioContext(2, renderDuration * sampleRate, sampleRate);

    if (ambience !== "none") {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = createNoiseBuffer(context, renderDuration, ambience);
      gain.gain.value = soundVolume;
      source.connect(gain).connect(context.destination);
      source.start(0);
    }

    if (binaural) {
      const merger = context.createChannelMerger(2);
      const left = context.createOscillator();
      const right = context.createOscillator();
      const gain = context.createGain();
      left.frequency.value = carrierFrequency;
      right.frequency.value = carrierFrequency + selectedBinaural.frequency;
      gain.gain.value = beatVolume * 0.12;
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
        gain.gain.value = soundVolume;
        source.connect(gain).connect(context.destination);
        source.start(start);
      }
    }

    if (voiceBuffer) {
      const layerCount = style === "ultra_layered" ? 7 : style === "layered" ? 4 : 1;
      const baseVolume = style === "silent" ? 0.035 : voiceVolume;
      for (let layer = 0; layer < layerCount; layer += 1) {
        for (let start = layer * 0.85; start < renderDuration; start += voiceBuffer.duration + 1.8) {
          const source = context.createBufferSource();
          const gain = context.createGain();
          const pan = context.createStereoPanner();
          source.buffer = voiceBuffer;
          source.playbackRate.value = style === "ultra_layered" ? 0.96 + layer * 0.012 : 1;
          gain.gain.value = baseVolume / Math.sqrt(layerCount);
          pan.pan.value = layerCount === 1 ? 0 : -0.6 + (1.2 * layer) / Math.max(1, layerCount - 1);
          source.connect(gain).connect(pan).connect(context.destination);
          source.start(start);
        }
      }
    }

    const rendered = await context.startRendering();
    return { blob: await audioBufferToCompressedAudio(rendered), duration: renderDuration };
  }

  async function saveToStudio() {
    stopPreview();
    setLoading("export");
    setStatus("");
    try {
      const rendered = await renderSubliminalWav();

      await saveProjectSnapshot(rendered.blob, rendered.duration);
      setStatus(hasPro ? "Subliminal saved to your studio." : "Subliminal saved to your studio. Upgrade to Pro to download.");
      setScreen("library");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save to your studio.");
    } finally {
      setLoading("");
    }
  }

  async function downloadProject(project: SubliminalProject) {
    if (!hasPro) {
      openUpgradePrompt("Downloads are included in Pro. Upgrade to download finished subliminals as audio files.");
      return;
    }

    if (!project.audioUrl) {
      setStatus("Audio is still processing. Try downloading again once it is ready.");
      return;
    }

    setLoading(`download-${project.id}`);
    setStatus("");
    try {
      const response = await fetch(project.audioUrl);
      if (!response.ok) throw new Error("Could not download audio.");
      const sourceBlob = await response.blob();
      const sourceName = project.title || "subliminal";

      try {
        const context = new AudioContext();
        const buffer = await decodeBlob(context, sourceBlob);
        await context.close();
        downloadBlob(audioBufferToWav(buffer), `${sourceName.replace(/[^a-zA-Z0-9._-]/g, "_")}.wav`);
      } catch {
        downloadBlob(sourceBlob, project.fileName ?? `${sourceName.replace(/[^a-zA-Z0-9._-]/g, "_")}.webm`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download audio.");
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="sublimify-minimal">
      <audio ref={playlistAudioRef} src={activePlaylistTrack?.audioUrl ?? undefined} onEnded={playNextPlaylistTrack} />
      <header className="minimal-topbar">
        {owner ? (
          <Link href="/" className="minimal-brand">
            <BrandLogo size="small" />
            <strong>Subliminal Academy</strong>
          </Link>
        ) : (
          <div className="minimal-brand" aria-label="Subliminal Academy">
            <BrandLogo size="small" />
            <strong>Subliminal Academy</strong>
          </div>
        )}
        <div className="minimal-top-actions">
          <form action="/api/auth/signout" method="post" className="minimal-account-row">
            <span className="avatar">{initials}</span>
            <span className="account-email">{userEmail}</span>
            <span className={hasPro ? "plan-badge pro" : "plan-badge free"}>
              {hasPro ? <Crown size={13} /> : null}
              {hasPro ? "PRO" : "FREE"}
            </span>
            {!hasPro && (
              <button
                type="button"
                className="account-upgrade-button"
                onClick={() => openUpgradePrompt("Upgrade to Pro to unlock AI affirmations, downloads, playlists, and unlimited saved subliminals.")}
              >
                <Crown size={14} /> Upgrade
              </button>
            )}
            <button type="submit" title="Sign out">
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </header>

      {screen === "library" && (
        <section className="subliminal-library">
          <div className="library-hero">
            <p className="eyebrow">My Subliminals</p>
            <h1>Your private subliminal studio.</h1>
            {owner && (
              <div className="idea-generator-panel">
                <div>
                  <span className="price-badge muted">Owner idea step</span>
                  <strong>Generate subliminal ideas first.</strong>
                  <p>Use this to quickly brainstorm product-ready subliminal concepts before opening the builder.</p>
                </div>
                <textarea
                  value={ideaSeed}
                  onChange={(event) => setIdeaSeed(event.target.value)}
                  rows={3}
                  placeholder="Optional: audience, niche, mood, goal, or trend. Example: beauty, confidence, glow up, relationships..."
                />
                <button className="secondary-button" onClick={generateIdeas} disabled={loading === "ideas"}>
                  {loading === "ideas" ? <Loader2 className="spin" size={17} /> : <Wand2 size={17} />} Generate ideas
                </button>
                {ideas.length > 0 && (
                  <div className="idea-list">
                    {ideas.map((idea) => (
                      <button key={idea} onClick={() => selectIdea(idea)}>
                        <span>{idea}</span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="library-actions">
              <button className="primary-button library-create" onClick={startNewProject}>
                <Plus size={18} /> Create subliminal
              </button>
              <label
                className={libraryLimitReached ? "secondary-button library-import limited" : "secondary-button library-import"}
                onClick={(event) => {
                  if (libraryLimitReached) {
                    event.preventDefault();
                    openUpgradePrompt("Free includes 1 custom subliminal in your library. Upgrade to Pro to import and save more subliminals.");
                  }
                }}
              >
                {loading === "import" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                Import subliminal
                <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac" disabled={libraryLimitReached} onChange={(event) => importSubliminal(event.target.files?.[0] ?? null)} />
              </label>
              <button className="secondary-button library-playlist" onClick={createPlaylist} disabled={loading === "playlist"}>
                {loading === "playlist" ? <Loader2 className="spin" size={18} /> : hasPro ? <Plus size={18} /> : <Lock size={18} />} Create new playlist
              </button>
            </div>
            {playlists.length > 0 && (
              <div className="playlist-strip">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    className={selectedPlaylistId === playlist.id ? "playlist-pill active" : "playlist-pill"}
                    onClick={() => setSelectedPlaylistId(selectedPlaylistId === playlist.id ? "" : playlist.id)}
                  >
                    <span>{playlist.title}</span>
                    <small>{playlist.projectIds.length} tracks</small>
                  </button>
                ))}
              </div>
            )}
            {selectedPlaylist && (
              <div className="playlist-manager">
                <div className="playlist-manager-head">
                  <div>
                    <strong>{selectedPlaylist.title}</strong>
                    <span>{selectedPlaylistProjects.length ? `${selectedPlaylistProjects.length} subliminals in this playlist` : "Add subliminals from your library below"}</span>
                    {playlistPlayingId === selectedPlaylist.id && activePlaylistTrack && <small>Now playing: {activePlaylistTrack.title}</small>}
                  </div>
                  <div>
                    <button className="icon-button" onClick={() => playPlaylist(selectedPlaylist)} aria-label={playlistPlayingId === selectedPlaylist.id ? "Pause playlist" : "Play playlist"}>
                      {playlistPlayingId === selectedPlaylist.id ? <Pause size={17} /> : <Play size={17} />}
                    </button>
                    <button className="icon-button" onClick={() => renamePlaylist(selectedPlaylist)} aria-label="Rename playlist">
                      <Settings2 size={17} />
                    </button>
                    <button className="icon-button danger" onClick={() => deletePlaylist(selectedPlaylist.id)} aria-label="Delete playlist">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="playlist-track-list">
                  {selectedPlaylistProjects.length === 0 ? (
                    <span className="playlist-empty">No tracks yet.</span>
                  ) : (
                    selectedPlaylistProjects.map((project, index) => (
                      <div key={project.id} className="playlist-track">
                        <GripVertical size={16} />
                        <div>
                          <strong>{project.title}</strong>
                          <span>{formatDuration(project.duration)}</span>
                        </div>
                        <button className="mini-button" onClick={() => movePlaylistProject(project.id, -1)} disabled={index === 0}>Up</button>
                        <button className="mini-button" onClick={() => movePlaylistProject(project.id, 1)} disabled={index === selectedPlaylistProjects.length - 1}>Down</button>
                        <button className="mini-button danger" onClick={() => removeProjectFromPlaylist(project.id)}>Remove</button>
                      </div>
                    ))
                  )}
                </div>

                <div className="playlist-add-list">
                  <span>Add from library</span>
                  {projects.filter((project) => !selectedPlaylist.projectIds.includes(project.id)).slice(0, 8).map((project) => (
                    <button key={project.id} onClick={() => addProjectToPlaylist(project.id)} disabled={!project.audioUrl || loading === `playlist-${selectedPlaylist.id}`}>
                      <Plus size={15} /> {project.title}
                    </button>
                  ))}
                  {projects.every((project) => selectedPlaylist.projectIds.includes(project.id)) && <small>All saved subliminals are already in this playlist.</small>}
                </div>
              </div>
            )}
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
                    <span>{project.imported ? "Imported audio" : `${project.affirmationCount} affirmations | ${project.style.replace("_", " ")} | ${formatDuration(project.duration)}`}</span>
                    {project.audioUrl ? (
                      <div className="library-audio">
                        <LibraryAudioPlayer src={project.audioUrl} />
                        <span><Repeat2 size={14} /> Loop enabled</span>
                      </div>
                    ) : (
                      <span>{project.imported ? "Audio is processing." : "Audio will appear here after saving/exporting."}</span>
                    )}
                  </div>
                  <div className="subliminal-row-actions">
                    <button className="secondary-button" onClick={() => downloadProject(project)} disabled={loading === `download-${project.id}`}>
                      {loading === `download-${project.id}` ? <Loader2 className="spin" size={16} /> : hasPro ? <Download size={16} /> : <Lock size={16} />}
                      Download
                    </button>
                    <small><Clock size={14} /> {new Date(project.createdAt).toLocaleDateString()}</small>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {screen === "builder" && (
        <section className="minimal-builder">
          <div className="minimal-progress">
            <button className="secondary-button" onClick={() => { stopPreview(); setScreen("library"); }}><ArrowLeft size={17} /> My Subliminals</button>
            <span>Step {activeStepIndex + 1} of {currentSteps.length}</span>
          </div>
          <div className="quiet-progress-bar"><span style={{ width: `${((activeStepIndex + 1) / currentSteps.length) * 100}%` }} /></div>

          <div className="single-step-card" onKeyDown={handleWizardKeyDown}>
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
                  <button className={mode === "generate" ? "quiz-option active" : "quiz-option"} onClick={() => selectMode("generate")}><Wand2 size={22} /><strong>Generate them for me</strong>{isFree && <small className="coming-soon">Pro</small>}<span>Build a script from your topic with guided details.</span></button>
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
                <p>Add examples, preferred wording, topics to include, or any requirements you have for the affirmations. Then generate and edit the script before creating the voice layer.</p>
                <textarea value={generationNotes} onChange={(event) => setGenerationNotes(event.target.value)} rows={5} placeholder="Example: include short present-tense lines, avoid complicated words, make it calm and confident, and focus on clear skin and daily self-care." autoFocus />
                <button className="primary-button" onClick={generateAffirmations} disabled={!topic.trim() || loading === "generate"}>{loading === "generate" ? <Loader2 className="spin" size={17} /> : isFree ? <Lock size={17} /> : <Wand2 size={17} />} {isFree ? "Upgrade for AI affirmations" : "Generate script"}</button>
                <textarea value={affirmations} onChange={(event) => setAffirmations(event.target.value)} rows={9} placeholder="Your generated affirmations will appear here..." />
              </>
            )}

            {activeStep === "voice" && (
              <>
                <p className="eyebrow">Voice Layer</p>
                <h1>How should the affirmations become audio?</h1>
                <p>{mode === "record" ? "Record your own voice. The final audio will match the length of your recording." : "Record your own voice or create a simple text-to-speech voice from the affirmations."}</p>
                {voiceChoice === "record" && showRecordingScript && affirmationCount > 0 && (
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
                <div className={mode === "record" ? "quiz-options one" : "quiz-options two"}>
                  <button className={voiceChoice === "record" ? "quiz-option active recommended-option" : "quiz-option recommended-option"} onClick={toggleRecording}><Mic size={22} /><small className="recommended-badge">Recommended</small><strong>{recording ? "Stop recording" : recordedBlob ? "Record again" : "Record my voice"}</strong><span>Use your microphone and read the affirmations yourself.</span></button>
                  {mode !== "record" && (
                    <button className={voiceChoice === "tts" ? "quiz-option active" : "quiz-option"} onClick={generateTextToSpeech} disabled={!script || loading === "tts"}>{loading === "tts" ? <Loader2 className="spin" size={22} /> : <Sparkles size={22} />}<strong>Text to speech</strong><span>Create a simple spoken voice from your affirmations.</span></button>
                  )}
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
                <p>Choose the background sound, beat range, and mix levels while previewing the result.</p>
                <div className="preview-panel">
                  <div>
                    <strong>Live subliminal preview</strong>
                    <span>Play the current mix, then adjust the sliders and options until it sits right.</span>
                    <small>Duration: {formatDuration(duration)}</small>
                  </div>
                  <button className="secondary-button" onClick={() => (previewing ? stopPreview() : startPreview())}>
                    {previewing ? <Pause size={17} /> : <Play size={17} />}
                    {previewing ? "Stop preview" : "Play preview"}
                  </button>
                </div>
                <div className="simple-controls">
                  <div className="toggle-control-group">
                    <button className={soundSectionOpen ? "toggle-header open" : "toggle-header"} onClick={() => setSoundSectionOpen((open) => !open)}>
                      <span><Music2 size={18} /> Music & sounds</span>
                      <strong>{soundChoiceSummary}</strong>
                      <ChevronDown size={18} />
                    </button>
                    {soundSectionOpen && (
                      <div className="quiz-options sound-options">
                        {soundOptions.map((item) => (
                          <button
                            key={item.key}
                            className={ambience === item.key ? "quiz-option active" : "quiz-option"}
                            onClick={() => {
                              const nextAmbience = ambience === item.key ? "none" : item.key;
                              setAmbience(nextAmbience);
                              startPreview({ ambience: nextAmbience });
                            }}
                          >
                            <Music2 size={22} />
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                        <label className={musicFile ? "quiz-option upload-sound-tile active" : "quiz-option upload-sound-tile"}>
                          <Upload size={22} />
                          <strong>{musicFile ? "Custom audio selected" : "Upload custom audio"}</strong>
                          <span>{musicFile ? musicFile.name : "Add your own music, soundscape, MP3, or WAV."}</span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(event) => {
                              const nextFile = event.target.files?.[0] ?? null;
                              setMusicFile(nextFile);
                              startPreview({ musicFile: nextFile });
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="toggle-control-group">
                    <button className={beatSectionOpen ? "toggle-header open" : "toggle-header"} onClick={() => setBeatSectionOpen((open) => !open)}>
                      <span><SlidersHorizontal size={18} /> Binaural beats</span>
                      <strong>{binaural ? `${selectedBinaural.label} - ${selectedBinaural.frequency} Hz` : "Off"}</strong>
                      <ChevronDown size={18} />
                    </button>
                    {beatSectionOpen && (
                      <div className="quiz-options beat-options">
                        {BINAURAL_OPTIONS.map((item) => {
                          const activeBeat = binaural && binauralRange === item.key;
                          return (
                        <button
                          key={item.key}
                          className={activeBeat ? "quiz-option active" : "quiz-option"}
                          onClick={() => {
                            const nextBinaural = !activeBeat;
                            setBinauralRange(item.key);
                            setBinaural(nextBinaural);
                            startPreview({ binaural: nextBinaural, binauralRange: item.key });
                          }}
                        >
                          <SlidersHorizontal size={20} />
                          <strong>{item.label} - {item.frequency} Hz</strong>
                          <span>{item.description}</span>
                        </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="mix-controls">
                    <h2>Volume mixer</h2>
                    <div className="mix-slider">
                      <div>
                        <span>Affirmations</span>
                        <strong>{Math.round(voiceVolume * 100)}%</strong>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={voiceVolume} onChange={(event) => updateVoiceVolume(Number(event.target.value))} />
                    </div>
                    {binaural && (
                      <div className="mix-slider">
                        <div>
                          <span>{selectedBinaural.label} binaural beats</span>
                          <strong>{Math.round(beatVolume * 100)}%</strong>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={beatVolume} onChange={(event) => updateBeatVolume(Number(event.target.value))} />
                      </div>
                    )}
                    {hasSoundBed && (
                      <div className="mix-slider">
                        <div>
                          <span>{soundChoiceSummary}</span>
                          <strong>{Math.round(soundVolume * 100)}%</strong>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={soundVolume} onChange={(event) => updateSoundVolume(Number(event.target.value))} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeStep === "export" && (
              <>
                <p className="eyebrow">Final Review</p>
                <h1>Your tailored subliminal is ready.</h1>
                <p>Review the final setup, then save it to your studio. Your creation will appear under My Subliminals.</p>
                <div className="clean-summary">
                  <div><span>Topic</span><strong>{topic || "Custom subliminal"}</strong></div>
                  <div><span>Affirmations</span><strong>{affirmationCount}</strong></div>
                  <div><span>Voice</span><strong>{recordedBlob ? "Your voice" : ttsBlob ? "Text to speech" : "Missing"}</strong></div>
                  <div><span>Style</span><strong>{selectedStyle.label}</strong></div>
                  <div><span>Sound</span><strong>{soundChoiceSummary}</strong></div>
                  <div><span>Binaural beats</span><strong>{binaural ? `${selectedBinaural.label} (${selectedBinaural.frequency} Hz)` : "Off"}</strong></div>
                  <div><span>Duration</span><strong>{formatDuration(duration)}</strong></div>
                  <div><span>Mix</span><strong>{Math.round(voiceVolume * 100)}% voice / {binaural ? `${Math.round(beatVolume * 100)}% beats` : "no beats"} / {hasSoundBed ? `${Math.round(soundVolume * 100)}% sound` : "no sound"}</strong></div>
                </div>
                <div className="minimal-actions">
                  <button className="primary-button" onClick={saveToStudio} disabled={loading === "export"}>{loading === "export" ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Save to studio</button>
                </div>
              </>
            )}

            <div className="wizard-nav">
              <button className="secondary-button" onClick={goBack} disabled={activeStepIndex === 0}>Back</button>
              {activeStep !== "export" && <button className="primary-button" onClick={goNext} disabled={!canContinue()}>Continue <ChevronRight size={17} /></button>}
            </div>
          </div>

          {owner && (
            <details className="creator-prompt-drawer">
              <summary><Settings2 size={17} /> Creator prompts</summary>
              <label>Subliminal idea prompt</label>
              <textarea value={ideaPrompt} onChange={(event) => setIdeaPrompt(event.target.value)} rows={7} />
              <label>Affirmation generation prompt</label>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} />
              <button className="secondary-button" onClick={savePrompt} disabled={loading === "prompt"}><Save size={17} /> Save prompts</button>
            </details>
          )}
        </section>
      )}

      {upgradePrompt && (
        <div className="upgrade-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
          <section className="upgrade-modal">
            <button className="modal-close" onClick={() => setUpgradePrompt("")} aria-label="Close upgrade options">
              <X size={18} />
            </button>
            <div className="upgrade-modal-copy">
              <span className="price-badge">Unlock Pro</span>
              <h2 id="upgrade-title">Upgrade your Subliminal studio.</h2>
              <p>{upgradePrompt}</p>
            </div>
            <div className="pricing-grid modal-pricing">
              <article className="price-card free">
                <span>Free</span>
                <strong>Start</strong>
                <ul className="plan-feature-list">
                  <li><CheckCircle2 size={16} /> Listen in your library</li>
                  <li><CheckCircle2 size={16} /> Manual creation</li>
                  <li><XCircle size={16} /> 1 saved custom subliminal</li>
                  <li><XCircle size={16} /> No AI affirmations</li>
                  <li><XCircle size={16} /> No downloads or playlists</li>
                </ul>
              </article>
              <article className="price-card recommended">
                <div className="price-badge">Recommended</div>
                <span>Pro monthly</span>
                <strong>$9/month</strong>
                <ul className="plan-feature-list">
                  <li><CheckCircle2 size={16} /> AI affirmation generation</li>
                  <li><CheckCircle2 size={16} /> Unlimited saved subliminals</li>
                  <li><CheckCircle2 size={16} /> Download finished audio</li>
                  <li><CheckCircle2 size={16} /> Playlists access</li>
                  <li><CheckCircle2 size={16} /> Best for monthly flexibility</li>
                </ul>
                <button className="primary-button" onClick={() => startCheckout("monthly")} disabled={loading === "checkout-monthly"}>
                  {loading === "checkout-monthly" ? <Loader2 className="spin" size={17} /> : <Crown size={17} />} Upgrade monthly
                </button>
              </article>
              <article className="price-card yearly-value">
                <div className="price-badge value">Best value</div>
                <span>Pro yearly</span>
                <strong>$99/year</strong>
                <ul className="plan-feature-list">
                  <li><CheckCircle2 size={16} /> All Pro monthly features</li>
                  <li><CheckCircle2 size={16} /> AI affirmation generation</li>
                  <li><CheckCircle2 size={16} /> Unlimited library</li>
                  <li><CheckCircle2 size={16} /> Downloads and playlists</li>
                  <li><CheckCircle2 size={16} /> Save compared to monthly</li>
                </ul>
                <button className="primary-button yearly-button" onClick={() => startCheckout("yearly")} disabled={loading === "checkout-yearly"}>
                  {loading === "checkout-yearly" ? <Loader2 className="spin" size={17} /> : <Crown size={17} />} Upgrade yearly
                </button>
              </article>
            </div>
          </section>
        </div>
      )}

      {status && <p className="floating-status">{status}</p>}
    </main>
  );
}
