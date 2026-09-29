import { useState } from 'react';
import { Image } from 'lucide-react';
import type { Gesture } from '../../types/lesson';

export function GestureReference({ gesture }: { gesture: Gesture }) {
  const media = gesture.referenceMedia;
  const [failedSource, setFailedSource] = useState<string>();

  return (
    <figure className="gesture-reference" aria-label={`Эталон: ${gesture.title}`}>
      {media && failedSource !== media.src ? (
        media.kind === 'video' ? (
          <video onError={() => setFailedSource(media.src)} src={media.src} poster={media.poster} controls playsInline preload="none" aria-label={media.alt} />
        ) : (
          <img onError={() => setFailedSource(media.src)} src={media.src} alt={media.alt} loading="lazy" decoding="async" />
        )
      ) : (
        <div className="reference-placeholder">
          <span className="reference-label" aria-hidden="true">{gesture.label}</span>
          <span className="reference-caption"><Image size={16} aria-hidden="true" /> Проверенный эталон пока отсутствует</span>
          <span className="reference-help">Изображение или видео появится после проверки</span>
        </div>
      )}
    </figure>
  );
}
