// Format displayed copy without changing lesson data or recognition results.
export function uiText(text: string) {
  return text.replace(/—/g, "–").replace(/[«»“”„‟]/g, '"').replace(/(?<!\.)\.(\s*)$/u, "$1");
}
