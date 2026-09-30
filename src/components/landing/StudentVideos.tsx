import { useRef } from "react";
import { Film } from "lucide-react";
import surveyVideo from "../../../IMG_7516.MOV?url";
import benefitsVideo from "../../../IMG_7521.MP4?url";

interface StudentVideo {
  id: string;
  title: string;
  src?: string;
  poster?: string;
}

// Vite включает исходные ролики в production-сборку; порядок задаётся здесь.
const STUDENT_VIDEOS: readonly StudentVideo[] = [
  { id: "01", title: "Опрос студентов", src: surveyVideo, poster: undefined },
  { id: "02", title: "Почему это полезно?", src: benefitsVideo, poster: undefined },
];

function SurveyVideo({ src, poster, title }: { src: string; poster?: string; title: string }) {
  const started = useRef(false);
  return (
    <video
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      aria-label={title}
      onPlay={event => {
        // Start with audible playback; later mute/volume choices belong to the viewer.
        if (started.current) return;
        started.current = true;
        event.currentTarget.muted = false;
        event.currentTarget.volume = 1;
      }}
    />
  );
}

export function StudentVideos() {
  return (
    <section className="student-videos" aria-labelledby="student-videos-title">
      <div className="student-videos-heading">
        <h2 id="student-videos-title">Мы провели опрос среди наших студентов и вот что выяснили…</h2>
      </div>
      <div className="student-video-grid">
        {STUDENT_VIDEOS.map(video => (
          <figure className="student-video-card" key={video.id}>
            <div className="student-video-frame">
              {video.src ? (
                <SurveyVideo src={video.src} poster={video.poster} title={video.title} />
              ) : (
                <div className="student-video-placeholder">
                  <span className="student-video-number" aria-hidden="true">{video.id}</span>
                  <span className="student-video-icon"><Film size={30} aria-hidden="true" /></span>
                  <strong>Скоро здесь появится видео</strong>
                  <p>Студенты поделятся своим опытом</p>
                </div>
              )}
            </div>
            <figcaption>{video.title}</figcaption>
          </figure>
        ))}
      </div>
      <p className="student-videos-credit">Видео сделаны Викторией и Марией специально для Хакатона</p>
    </section>
  );
}
