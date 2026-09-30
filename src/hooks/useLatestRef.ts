import { useRef } from "react";

/** Ref that always holds the value from the latest render, for callbacks created earlier. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
