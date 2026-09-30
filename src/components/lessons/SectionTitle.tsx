import { lessonSections } from "../../data/lessons";
import type { SectionId } from "../../types/lesson";

/** Section name of a lesson from `lessonSections`; any id other than "alphabet" (or a missing lesson) shows the words section. */
export function SectionTitle({ sectionId }: { sectionId: SectionId | undefined }) {
  const id: SectionId = sectionId === "alphabet" ? "alphabet" : "words";
  return <>{lessonSections.find((section) => section.id === id)?.title}</>;
}
