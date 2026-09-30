/** Форматирует показываемый текст, не меняя данные уроков и результаты распознавания. */
export function uiText(text: string) {
  return text.replace(/—/g, "–").replace(/[«»“”„‟]/g, '"').replace(/(?<!\.)\.(\s*)$/u, "$1");
}
