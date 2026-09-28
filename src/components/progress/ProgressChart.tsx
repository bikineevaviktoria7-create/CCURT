import type { LessonResult } from "../../types/progress";

/** Accuracy of the last sessions as a small SVG line chart (no chart library). */
export function ProgressChart({ sessions }: { sessions: readonly LessonResult[] }) {
  const recent = sessions.slice(-10);
  if (recent.length < 2)
    return (
      <p className="chart-empty">
        Пройдите ещё одно занятие — здесь появится график вашей точности.
      </p>
    );
  const width = 320;
  const height = 120;
  const pad = 14;
  const x = (index: number) => pad + (index / (recent.length - 1)) * (width - pad * 2);
  const y = (accuracy: number) => height - pad - (accuracy / 100) * (height - pad * 2);
  const points = recent.map((session, index) => `${x(index)},${y(session.accuracy)}`).join(" ");
  const average = Math.round(recent.reduce((sum, item) => sum + item.accuracy, 0) / recent.length);
  return (
    <figure className="progress-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Точность последних ${recent.length} занятий, в среднем ${average}%`}
      >
        <polygon
          className="chart-area"
          points={`${x(0)},${y(0)} ${points} ${x(recent.length - 1)},${y(0)}`}
        />
        {[0, 50, 100].map((level) => (
          <g key={level}>
            <line x1={pad} x2={width - pad} y1={y(level)} y2={y(level)} className="chart-grid" />
            <text x={width - pad} y={y(level) - 3} className="chart-label" textAnchor="end">
              {level}%
            </text>
          </g>
        ))}
        <polyline className="chart-line" points={points} />
        {recent.map((session, index) => (
          <circle key={session.sessionId} cx={x(index)} cy={y(session.accuracy)} r={4} className="chart-dot">
            <title>
              {new Date(session.completedAt).toLocaleDateString("ru-RU")}: {session.accuracy}%
            </title>
          </circle>
        ))}
      </svg>
      <figcaption>Точность последних занятий · в среднем {average}%</figcaption>
    </figure>
  );
}
