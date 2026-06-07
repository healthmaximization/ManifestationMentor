declare module "mespeak" {
  type SpeakOptions = {
    amplitude?: number;
    pitch?: number;
    speed?: number;
    wordgap?: number;
    rawdata?: "array" | "buffer" | "base64" | "mime" | string;
  };

  const meSpeak: {
    isConfigLoaded(): boolean;
    isVoiceLoaded(): boolean;
    loadConfig(config: unknown): void;
    loadVoice(voice: unknown): void;
    speak(text: string, options?: SpeakOptions): unknown;
  };

  export default meSpeak;
}

declare module "mespeak/src/mespeak_config.json" {
  const value: unknown;
  export default value;
}

declare module "mespeak/voices/en/en-us.json" {
  const value: unknown;
  export default value;
}
