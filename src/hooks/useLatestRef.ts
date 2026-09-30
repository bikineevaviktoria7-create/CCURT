import { useRef } from "react";

/** Ref, который всегда хранит значение из последнего рендера, — для колбэков, созданных раньше. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
