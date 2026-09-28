import { settingsService } from "../services/settingsService";

// Sound, speech and vibration. Visual feedback stays primary (the audience is
// deaf and hard-of-hearing); these are optional extras controlled in settings.

let audio: AudioContext | null = null;
function tone(frequencies: number[], duration = 0.12, gap = 0.02, volume = 0.08) {
  if (!settingsService.get().soundEnabled) return;
  try {
    audio ??= new AudioContext();
    let start = audio.currentTime;
    for (const frequency of frequencies) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
      start += duration + gap;
    }
  } catch {
    /* Audio is optional. */
  }
}

function vibrate(pattern: number | number[]) {
  if (!settingsService.get().vibrationEnabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* Not supported. */
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
  success(spoken: string) {
    tone([660, 880]);
    vibrate(40);
    speak(spoken);
  },
  hint() {
    tone([330], 0.1, 0, 0.05);
    vibrate([25, 50, 25]);
  },
  lessonComplete() {
    tone([523, 659, 784, 1047], 0.14, 0.03);
    vibrate([60, 40, 60]);
  },
};
