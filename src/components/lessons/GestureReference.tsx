import { Image } from 'lucide-react';
import type { Gesture } from '../../types/lesson';

export function GestureReference({ gesture }: { gesture: Gesture }) {
  const media = gesture.referenceMedia;

  return (
    <figure className="gesture-reference" aria-label={`Эталон: ${gesture.title}`}>
      {media ? (
        media.kind === 'video' ? (
          <video src={media.src} poster={media.poster} controls playsInline preload="none" aria-label={media.alt} />
        ) : (
          <img src={media.src} alt={media.alt} loading="lazy" decoding="async" />
        )
      ) : (
        <div className="reference-placeholder">
          <span className="reference-label" aria-hidden="true">{gesture.label}</span>
          <span className="reference-caption"><Image size={16} aria-hidden="true" /> Эталон появится здесь</span>
          <span className="text-xs text-text-secondary">Ожидаем проверенные материалы РЖЯ</span>
        </div>
      )}
    </figure>
  );
}
