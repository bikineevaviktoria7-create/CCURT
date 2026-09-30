import { Film } from "lucide-react";

type StudentVideo = { id: string; title: string; src?: string; poster?: string };

// Add local paths here once the team's clips are ready; undefined renders a placeholder.
const STUDENT_VIDEOS: readonly StudentVideo[] = [
  { id: "01", title: "Опрос студентов", src: undefined, poster: undefined },
  { id: "02", title: "Почему это полезно?", src: undefined, poster: undefined },
];

export function StudentVideos() {
  return (
    <section className="student-videos" aria-labelledby="student-videos-title">
      <div className="student-videos-heading">
        <h2 id="student-videos-title">Мы провели опрос среди наших студентов и вот что выяснили..</h2>
      </div>
      <div className="student-video-grid">
        {STUDENT_VIDEOS.map(video => (
          <figure className="student-video-card" key={video.id}>
            <div className="student-video-frame">
              {video.src ? (
                <video src={video.src} poster={video.poster} controls playsInline preload="none" aria-label={video.title} />
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
