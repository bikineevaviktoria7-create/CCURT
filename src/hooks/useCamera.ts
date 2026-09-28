import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus =
  "loading" | "ready" | "denied" | "unavailable" | "busy" | "error";
export const cameraMessages: Record<
  Exclude<CameraStatus, "ready" | "loading">,
  { title: string; message: string }
> = {
  denied: {
    title: "Нет доступа к камере",
    message: "Разрешите доступ в настройках браузера и попробуйте снова.",
  },
  unavailable: {
    title: "Камера не найдена",
    message: "Подключите камеру или продолжите с демонстрацией.",
  },
  busy: {
    title: "Камера уже используется",
    message: "Закройте другие приложения, использующие камеру.",
  },
  error: {
    title: "Не удалось включить камеру",
    message: "Проверьте подключение камеры и попробуйте снова.",
  },
};
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("loading");
  const stop = useCallback(() => {
    generation.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);
  const start = useCallback(async () => {
    stop();
    const token = generation.current;
    setStatus("loading");
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      // Permission can resolve after navigation. Never leave such a stream running.
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      for (const track of stream.getVideoTracks())
        track.onended = () => {
          if (token === generation.current) setStatus("unavailable");
        };
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (token === generation.current) setStatus("ready");
    } catch (error) {
      if (token !== generation.current) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const name = error instanceof DOMException ? error.name : "";
      setStatus(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "unavailable"
            : name === "NotReadableError"
              ? "busy"
              : "error",
      );
    }
  }, [stop]);
  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);
  return { videoRef, status, start, stop };
}
