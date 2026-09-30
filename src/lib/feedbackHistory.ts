import type { RecognitionResult } from "../types/vision";

// Только представление подсказок: распознавание и подсчёт очков работают с исходным результатом.
// Состояния в модуле нет: каждая функция получает прошлое представление и возвращает новое.

/** Прошлая подсказка в истории и признак того, что ошибку уже исправили. */
export interface FeedbackEntry {
  key: string;
  result: RecognitionResult;
  corrected: boolean;
}

/** Что показывается сейчас, история прошлых подсказок и кандидат на смену подсказки. */
export interface FeedbackPresentation {
  current: RecognitionResult;
  history: FeedbackEntry[];
  changedAt: number;
  candidateKey?: string;
  candidateSince?: number;
}

/** Ключ подсказки: одинаковые по смыслу результаты не сменяют друг друга. */
function feedbackKey(result: RecognitionResult) {
  const state = result.errorCodes?.length ? "correction" : result.status;
  return [state, result.referenceIssue, result.errorCodes?.join(), result.message].join("|");
}

/** Начальное представление: текущий результат без истории. */
export function initialFeedback(current: RecognitionResult): FeedbackPresentation {
  return { current, history: [], changedAt: -Infinity };
}

/** Следующее представление: подсказка меняется не чаще, чем позволяют задержки, прошлые ошибки уходят в историю. */
export function updateFeedback(previous: FeedbackPresentation, next: RecognitionResult, now: number): FeedbackPresentation {
  const key = feedbackKey(next);
  if (key === feedbackKey(previous.current))
    return { ...previous, current: { ...next, status: previous.current.status }, candidateKey: undefined, candidateSince: undefined };
  const urgent = Boolean(next.referenceIssue) || next.status === "success" || next.status === "environment-error";
  const candidateSince = previous.candidateKey === key ? previous.candidateSince ?? now : now;
  if (!urgent && (now - candidateSince < 300 || now - previous.changedAt < 800))
    return { ...previous, candidateKey: key, candidateSince };
  let history = previous.history;
  const old = previous.current;
  if (old.errorCodes?.length) {
    const corrected = next.status === "success" || Boolean(old.incorrectLandmarks?.length &&
      old.incorrectLandmarks.every(index => next.correctLandmarks?.includes(index)));
    const oldKey = feedbackKey(old);
    history = [{ key: oldKey, result: old, corrected }, ...history.filter(item => item.key !== oldKey)].slice(0, 4);
  }
  if (next.status === "success") history = history.map(item => ({ ...item, corrected: true }));
  return { current: next, history, changedAt: now };
}
