import { useEffect, useRef } from "react";
import { soundFeedback } from "../lib/soundFeedback";

/** Один раз проигрывает звук завершения, когда результат впервые готов: праздничный при успехе, иначе нейтральный тон подсказки. */
export function useCompletionSound(found: boolean, passed: boolean) {
  const completionSoundPlayed = useRef(false);
  useEffect(() => {
    if (found && !completionSoundPlayed.current) {
      completionSoundPlayed.current = true;
      // Непройденный урок (0 звёзд) получает нейтральный тон подсказки вместо праздничного.
      if (passed) soundFeedback.lessonComplete();
      else soundFeedback.hint();
    }
  }, [found, passed]);
}
