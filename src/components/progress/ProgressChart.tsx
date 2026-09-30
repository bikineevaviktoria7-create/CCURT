import type { LessonResult } from "../../types/progress";

const hasAssessed = (session: LessonResult) =>
  session.attempts.some((attempt) => attempt.assessed !== false);

/** Точность последних занятий в виде небольшого линейного SVG-графика (без библиотеки графиков). */
function AccuracyTrend({ sessions }: { sessions: readonly LessonResult[] }) {
  // У занятий только из неоцениваемых жестов нет измеренной точности.
  const recent = sessions.filter(hasAssessed).slice(-10);
  if (recent.length < 2)
    return (
      <p className="chart-empty">
        Пройдите ещё одно занятие – здесь появится график вашей точности
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


export function ProgressChart({ sessions }: { sessions: readonly LessonResult[] }) {
  const recent = sessions.slice(-10);
  const counts = { correct: 0, skipped: 0, other: 0 };
  for (const session of recent) {
    for (const attempt of session.attempts) {
      if (attempt.assessed === false) continue;
      if (attempt.success) counts.correct++;
      else if (attempt.skipped) counts.skipped++;
      else counts.other++;
    }
  }
  const total = counts.correct + counts.skipped + counts.other;
  const groups = [
    { label: "Правильно", count: counts.correct, className: "outcome-correct" },
    { label: "Пропущено", count: counts.skipped, className: "outcome-skipped" },
    { label: "Не получилось", count: counts.other, className: "outcome-other" },
  ];
  return (
    <div className="statistics-charts">
      <section className="accuracy-panel">
        <h3>Точность занятий</h3>
        <AccuracyTrend sessions={sessions} />
      </section>
      <section className="outcomes-panel">
        <h3>Практика в цифрах</h3>
        <p className="outcome-total">Всего попыток: <strong>{total}</strong></p>
        <p className="chart-empty">Учтено последних занятий: {recent.length}</p>
        <div className="outcome-bar" aria-hidden="true">
          {groups.map(group => <span key={group.className} className={group.className} style={{ width: `${total ? group.count / total * 100 : 0}%` }} />)}
        </div>
        <ul className="outcome-legend">
          {groups.map(group => <li key={group.className}><span className={`outcome-dot ${group.className}`} aria-hidden="true" /><span>{group.label}</span><strong>{group.count}</strong></li>)}
        </ul>
      </section>
    </div>
  );
}
