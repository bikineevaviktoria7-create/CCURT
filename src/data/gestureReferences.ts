import type { ReferenceMedia } from "../types/lesson";
import { alphabet } from "./alphabet";

// Fingerspelling illustrations (dactyl chart, one SVG per letter, the letter is
// signed as seen by the person facing the signer). File name = gesture id.
// Words have no illustrations yet; GestureReference shows a placeholder for them.
export const gestureReferences: Readonly<Partial<Record<string, ReferenceMedia>>> = Object.fromEntries(
  alphabet.map((letter) => [
    letter.id,
    {
      kind: "image",
      src: `/assets/gestures/${letter.id}.svg`,
      alt: `Как показывать букву ${letter.label} дактилем`,
    } satisfies ReferenceMedia,
  ]),
);
