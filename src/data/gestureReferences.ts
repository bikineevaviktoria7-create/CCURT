import type { ReferenceMedia } from "../types/lesson";

// Add only reviewed RSL references. The inventory and file conventions live in
// public/assets/gestures/README.md. All lesson sizes share this mapping.
export const gestureReferences: Readonly<Partial<Record<string, ReferenceMedia>>> = {};
