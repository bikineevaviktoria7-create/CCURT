import { lessonSections } from "../../data/lessons";
import type { SectionId } from "../../types/lesson";

/** Название раздела урока из `lessonSections`; любой id, кроме "alphabet" (или отсутствующий урок), показывает раздел слов. */
export function SectionTitle({ sectionId }: { sectionId: SectionId | undefined }) {
  const id: SectionId = sectionId === "alphabet" ? "alphabet" : "words";
  return <>{lessonSections.find((section) => section.id === id)?.title}</>;
}
