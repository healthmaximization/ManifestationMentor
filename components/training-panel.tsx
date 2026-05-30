"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, RefreshCw, Save, Send, Trash2, UploadCloud } from "lucide-react";
import { DEFAULT_SYSTEM_PROMPT, MANIFESTATION_METHODS } from "@/lib/config";
import type { Database } from "@/lib/supabase/types";

type Config = Database["public"]["Tables"]["manifestation_training_config"]["Row"];
type Doc = Database["public"]["Tables"]["manifestation_training_documents"]["Row"];
type QaPair = { topic: string; approach: string };

const TONES = ["warm & empathetic", "direct & tough", "spiritual", "practical & no-nonsense", "custom"];
const LENGTHS = ["concise", "medium", "detailed"];
const TRAITS = ["challenging", "supportive", "philosophical", "action-oriented", "intuitive"];

export default function TrainingPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewInput, setPreviewInput] = useState("");
  const [preview, setPreview] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function load() {
      const [configResponse, docsResponse] = await Promise.all([
        fetch("/api/training/config"),
        fetch("/api/training/documents")
      ]);
      setConfig((await configResponse.json()).config);
      setDocuments((await docsResponse.json()).documents ?? []);
    }
    load();
  }, []);

  if (!config) {
    return <div className="loading-panel">Loading training controls...</div>;
  }

  function updateConfig(patch: Partial<Config>) {
    setConfig((current) => (current ? { ...current, ...patch } : current));
  }

  async function save() {
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/training/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    const data = await response.json();
    setSaving(false);
    if (response.ok) {
      setConfig(data.config);
      setStatus("Saved");
    } else {
      setStatus(data.error ?? "Save failed");
    }
  }

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/training/documents", { method: "POST", body: form });
    const data = await response.json();
    setUploading(false);
    if (response.ok) setDocuments((current) => [data.document, ...current]);
    else setStatus(data.error ?? "Upload failed");
  }

  async function deleteDoc(id: string) {
    await fetch(`/api/training/documents/${id}`, { method: "DELETE" });
    setDocuments((current) => current.filter((doc) => doc.id !== id));
  }

  async function sendPreview(event: React.FormEvent) {
    event.preventDefault();
    const message = previewInput.trim();
    if (!message) return;
    setPreviewInput("");
    setPreviewLoading(true);
    setPreview((current) => [...current, { role: "user", content: message }]);
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, previewConfig: config })
    });
    const data = await response.json();
    setPreviewLoading(false);
    setPreview((current) => [...current, { role: "assistant", content: data.reply ?? data.error }]);
  }

  const qaPairs = Array.isArray(config.qa_pairs) ? (config.qa_pairs as QaPair[]) : [];

  return (
    <div className="training-layout">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Owner Training Panel</p>
          <h1>Shape the coach behind every response.</h1>
        </div>
        <button onClick={save} className="primary-button" disabled={saving}>
          <Save size={18} />
          {saving ? "Saving" : "Save"}
        </button>
      </header>

      <section className="training-grid">
        <div className="tool-surface">
          <h2>Style Configurator</h2>
          <div className="field-row">
            <label>Tone</label>
            <select value={config.tone} onChange={(event) => updateConfig({ tone: event.target.value })}>
              {TONES.map((tone) => (
                <option key={tone}>{tone}</option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <label>Response length</label>
            <div className="segmented">
              {LENGTHS.map((length) => (
                <button
                  key={length}
                  className={config.response_length === length ? "active" : ""}
                  onClick={() => updateConfig({ response_length: length })}
                >
                  {length}
                </button>
              ))}
            </div>
          </div>
          <div className="checkbox-grid">
            {TRAITS.map((trait) => (
              <label key={trait}>
                <input
                  type="checkbox"
                  checked={config.personality_traits.includes(trait)}
                  onChange={(event) => {
                    const traits = event.target.checked
                      ? [...config.personality_traits, trait]
                      : config.personality_traits.filter((item) => item !== trait);
                    updateConfig({ personality_traits: traits });
                  }}
                />
                {trait}
              </label>
            ))}
          </div>
          <textarea
            value={config.custom_instructions}
            onChange={(event) => updateConfig({ custom_instructions: event.target.value })}
            placeholder="Custom instructions"
            rows={4}
          />
        </div>

        <div className="tool-surface">
          <h2>Knowledge Uploader</h2>
          <label className="drop-zone">
            <UploadCloud size={24} />
            <span>{uploading ? "Uploading..." : "Drop or choose PDF, TXT, MD, or DOCX"}</span>
            <input type="file" accept=".pdf,.txt,.md,.docx" onChange={(event) => upload(event.target.files)} />
          </label>
          <div className="file-list">
            {documents.map((doc) => (
              <div key={doc.id} className="file-row">
                <FileText size={18} />
                <span>{doc.file_name}</span>
                <small>{Math.ceil(doc.file_size / 1024)} KB</small>
                <small>{doc.status}</small>
                <button onClick={() => deleteDoc(doc.id)} title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="tool-surface">
          <h2>Framework Builder</h2>
          <div className="field-row">
            <label>Methodology</label>
            <select value={config.methodology} onChange={(event) => updateConfig({ methodology: event.target.value })}>
              {MANIFESTATION_METHODS.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </div>
          <textarea
            rows={3}
            value={config.banned_phrases.join("\n")}
            onChange={(event) => updateConfig({ banned_phrases: event.target.value.split("\n").filter(Boolean) })}
            placeholder="Banned phrases or topics, one per line"
          />
          <div className="qa-list">
            {qaPairs.map((pair, index) => (
              <div key={index} className="qa-row">
                <input
                  value={pair.topic}
                  onChange={(event) => {
                    const next = [...qaPairs];
                    next[index] = { ...pair, topic: event.target.value };
                    updateConfig({ qa_pairs: next });
                  }}
                  placeholder="When user asks about..."
                />
                <input
                  value={pair.approach}
                  onChange={(event) => {
                    const next = [...qaPairs];
                    next[index] = { ...pair, approach: event.target.value };
                    updateConfig({ qa_pairs: next });
                  }}
                  placeholder="Respond with this approach..."
                />
              </div>
            ))}
          </div>
          <button className="secondary-button" onClick={() => updateConfig({ qa_pairs: [...qaPairs, { topic: "", approach: "" }] })}>
            <Plus size={17} />
            Add Q&A
          </button>
        </div>

        <div className="tool-surface prompt-editor">
          <h2>System Prompt Editor</h2>
          <textarea
            value={config.system_prompt}
            onChange={(event) => updateConfig({ system_prompt: event.target.value })}
            rows={13}
          />
          <button className="secondary-button" onClick={() => updateConfig({ system_prompt: DEFAULT_SYSTEM_PROMPT })}>
            <RefreshCw size={17} />
            Reset default
          </button>
        </div>

        <div className="tool-surface live-preview">
          <h2>Live Preview</h2>
          <div className="preview-stream">
            {preview.map((message, index) => (
              <p key={index} className={`preview-message ${message.role}`}>
                {message.content}
              </p>
            ))}
            {previewLoading && <p className="preview-message assistant">Thinking...</p>}
          </div>
          <form onSubmit={sendPreview} className="preview-composer">
            <input value={previewInput} onChange={(event) => setPreviewInput(event.target.value)} placeholder="Test a user question..." />
            <button title="Send preview">
              <Send size={17} />
            </button>
          </form>
          {status && <p className="notice">{status}</p>}
        </div>
      </section>
    </div>
  );
}
