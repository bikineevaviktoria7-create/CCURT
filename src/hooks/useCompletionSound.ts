import { useEffect, useRef } from "react";
import { soundFeedback } from "../lib/soundFeedback";

/** Plays the completion sound once, when the result first becomes available: celebration if passed, otherwise the neutral hint tone. */
export function useCompletionSound(found: boolean, passed: boolean) {
  const completionSoundPlayed = useRef(false);
  useEffect(() => {
    if (found && !completionSoundPlayed.current) {
      completionSoundPlayed.current = true;
      // A failed lesson (0 stars) gets the neutral hint tone instead of the celebration.
      if (passed) soundFeedback.lessonComplete();
      else soundFeedback.hint();
    }
  }, [found, passed]);
}
