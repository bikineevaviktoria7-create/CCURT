import { useState } from "react";
import { Image } from "lucide-react";
import { uiText } from "../../lib/uiText";
import type { Gesture } from "../../types/lesson";

export function GestureReference({ gesture }: { gesture: Gesture }) {
  const media = gesture.referenceMedia;
  const [failedSource, setFailedSource] = useState<string>();

  return (
    <figure className={`gesture-reference${gesture.positionOnly ? " is-position-only" : ""}${gesture.category === "word" ? " is-word" : ""}`} aria-label={`Эталон: ${gesture.title}`}>
      {gesture.category === "word" && <figcaption className="word-reference-title">{gesture.label}</figcaption>}
      {media && failedSource !== media.src ? (
        media.kind === "video" ? (
          <video onError={() => setFailedSource(media.src)} src={media.src} poster={media.poster} controls loop playsInline preload="none" aria-label={uiText(media.alt)} />
        ) : (
          <img onError={() => setFailedSource(media.src)} src={media.src} alt={uiText(media.alt)} loading="lazy" decoding="async" />
        )
      ) : (
        <div className="reference-placeholder">
          {gesture.category !== "word" && <span className="reference-label" aria-hidden="true">{gesture.label}</span>}
          <span className="reference-caption"><Image size={16} aria-hidden="true" /> {gesture.category === "word" ? "Эталон положения руки пока не добавлен" : "Жест урока"}</span>
          {gesture.category === "word" && <p className="word-reference-note">Для этого слова нужен проверенный образец</p>}
        </div>
      )}
      {gesture.positionOnly && <span className="position-only-badge">Оценивается только положение руки</span>}
    </figure>
  );
}
