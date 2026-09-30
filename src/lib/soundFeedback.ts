import { settingsService } from "../services/settingsService";
import type { SettingsStore } from "../services/settingsService";

// Звук и речь. Главной остаётся визуальная обратная связь (аудитория —
// глухие и слабослышащие); это необязательные дополнения, включаемые в настройках.

/** Настройки, от которых зависят сигналы. */
type SoundSettings = Pick<SettingsStore, "get">;

/** Необязательные звуковые и речевые сигналы урока. */
export interface SoundFeedbackApi {
  /** Создаёт или возобновляет аудиоконтекст; вызывать только из действия пользователя. */
  unlock(): void;
  success(spoken: string): void;
  hint(): void;
  lessonComplete(): void;
}

/** Звуковые и речевые сигналы; каждый учитывает настройки пользователя. */
export class SoundFeedback implements SoundFeedbackApi {
  private settings: SoundSettings;
  private audio: AudioContext | null = null;
  private lastHintAt = -Infinity;
  private russianVoice: SpeechSynthesisVoice | null | undefined;

  constructor(settings: SoundSettings) {
    this.settings = settings;
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      speechSynthesis.addEventListener?.("voiceschanged", this.resetVoice);
  }

  // Вызывается только из действия пользователя, поэтому ограничения автовоспроизведения браузера соблюдены.
  unlock = () => {
    if (!this.settings.get().soundEnabled) return;
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === "suspended") void this.audio.resume().catch(() => undefined);
    } catch {
      /* Звук необязателен. */
    }
  };

  success(spoken: string) {
    this.tone([660, 880]);
    this.speak(spoken);
  }

  hint() {
    const now = performance.now();
    if (now - this.lastHintAt < 2000) return;
    this.lastHintAt = now;
    this.tone([440], 0.13, 0, 0.075);
  }

  lessonComplete() {
    this.tone([523, 659, 784, 1047], 0.2, 0.04, 0.16);
  }

  private tone(frequencies: number[], duration = 0.18, gap = 0.035, volume = 0.14) {
    const audio = this.audio;
    if (!this.settings.get().soundEnabled || !audio || audio.state !== "running") return;
    try {
      let start = audio.currentTime;
      for (const frequency of frequencies) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(volume, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start);
        oscillator.stop(start + duration);
        start += duration + gap;
      }
    } catch {
      /* Звук необязателен. */
    }
  }

  private speak(text: string) {
    if (!this.settings.get().speechEnabled || !("speechSynthesis" in window)) return;
    this.russianVoice ??= speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ru")) ?? null;
    // Русского голоса нет: лучше промолчать, чем читать русский текст английским голосом.
    if (!this.russianVoice) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.russianVoice;
    utterance.lang = "ru-RU";
    utterance.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  /** Поле-стрелка: обработчик `voiceschanged`. */
  private resetVoice = () => {
    this.russianVoice = undefined;
  };
}

/** Необязательные звуковые и речевые сигналы урока; каждый учитывает настройки пользователя. */
export const soundFeedback: SoundFeedbackApi = new SoundFeedback(settingsService);
