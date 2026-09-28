import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Row {
  rank: number;
  name: string;
  total_score: number;
  lessons_completed: number;
  is_me: boolean;
}

/** Top learners by the sum of their best lesson scores (only first names are shown). */
export function Leaderboard({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.rpc("get_leaderboard", { p_limit: 10 }).then(({ data, error }) => {
      if (active) setRows(error ? [] : ((data ?? []) as Row[]));
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  if (!supabase) return null;
  return (
    <section className="leaderboard card" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title">
        <Trophy size={20} aria-hidden="true" /> Таблица рекордов
      </h2>
      {rows === null ? (
        <p>Загружаем…</p>
      ) : rows.length === 0 ? (
        <p>Пока пусто — завершите урок и станьте первым!</p>
      ) : (
        <ol>
          {rows.map((row) => (
            <li key={`${row.rank}-${row.name}`} className={row.is_me ? "me" : ""}>
              <span className="leader-rank">{row.rank}</span>
              <span className="leader-name">{row.is_me ? `${row.name} (вы)` : row.name}</span>
              <span className="leader-lessons">{row.lessons_completed} ур.</span>
              <strong>{row.total_score}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
