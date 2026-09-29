import { settingsService } from "../services/settingsService";

// Sound and speech. Visual feedback stays primary (the audience is
// deaf and hard-of-hearing); these are optional extras controlled in settings.

let audio: AudioContext | null = null;
let lastHintAt = -Infinity;

// Called only from trusted user input, so browser autoplay restrictions are respected.
function unlock() {
  if (!settingsService.get().soundEnabled) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  } catch {
    /* Audio is optional. */
  }
}

function tone(frequencies: number[], duration = 0.18, gap = 0.035, volume = 0.14) {
  if (!settingsService.get().soundEnabled || !audio || audio.state !== "running") return;
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
    /* Audio is optional. */
  }
}

let russianVoice: SpeechSynthesisVoice | null | undefined;
function speak(text: string) {
  if (!settingsService.get().speechEnabled || !("speechSynthesis" in window)) return;
  russianVoice ??= speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ru")) ?? null;
  // No Russian voice installed: stay silent rather than read Russian with an English voice.
  if (!russianVoice) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = russianVoice;
  utterance.lang = "ru-RU";
  utterance.rate = 0.95;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

if (typeof window !== "undefined" && "speechSynthesis" in window)
  speechSynthesis.addEventListener?.("voiceschanged", () => {
    russianVoice = undefined;
  });

export const feedback = {
  unlock,
  success(spoken: string) {
    tone([660, 880]);
    speak(spoken);
  },
  hint() {
    const now = performance.now();
    if (now - lastHintAt < 2000) return;
    lastHintAt = now;
    tone([440], 0.13, 0, 0.075);
  },
  lessonComplete() {
    tone([523, 659, 784, 1047], 0.2, 0.04, 0.16);
  },
};
