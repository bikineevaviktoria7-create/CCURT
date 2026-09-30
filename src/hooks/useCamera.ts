import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus =
  "loading" | "ready" | "denied" | "unavailable" | "busy" | "error";
/** Title and message shown for each camera failure. */
export const CAMERA_MESSAGES: Record<
  Exclude<CameraStatus, "ready" | "loading">,
  { title: string; message: string }
> = {
  denied: {
    title: "Нет доступа к камере",
    message: "Разрешите доступ в настройках браузера и попробуйте снова.",
  },
  unavailable: {
    title: "Камера не найдена",
    message: "Подключите камеру и попробуйте снова.",
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
function waitForVideo(video: HTMLVideoElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", check);
      video.removeEventListener("playing", check);
      video.removeEventListener("resize", check);
      signal.removeEventListener("abort", abort);
    };
    const check = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) { cleanup(); resolve(); }
    };
    const abort = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
    const timeout = window.setTimeout(() => { cleanup(); reject(new DOMException("Video not ready", "TimeoutError")); }, 15000);
    video.addEventListener("loadeddata", check);
    video.addEventListener("playing", check);
    video.addEventListener("resize", check);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort(); else check();
  });
}

/** Starts the front camera in `videoRef`, reports its status and releases all tracks on stop. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const attachedVideo = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const videoWait = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<CameraStatus>("loading");
  const release = useCallback(() => {
    videoWait.current?.abort();
    videoWait.current = null;
    const stream = streamRef.current;
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    streamRef.current = null;
    const video = attachedVideo.current;
    if (video && video.srcObject === stream) { video.pause(); video.srcObject = null; }
    attachedVideo.current = null;
  }, []);
  const stop = useCallback(() => {
    generation.current += 1;
    release();
  }, [release]);
  const start = useCallback(async () => {
    stop();
    const token = generation.current;
    setStatus("loading");
    // Serialize permission requests: even rapid retries never own two streams.
    const previous = pending.current;
    const request = (async () => {
      await previous;
      if (token !== generation.current) return;
      if (!navigator.mediaDevices?.getUserMedia) { setStatus("unavailable"); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
        });
        if (token !== generation.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        for (const track of stream.getVideoTracks()) track.onended = () => {
          if (token !== generation.current) return;
          stop();
          setStatus("unavailable");
        };
        const video = videoRef.current;
        if (!video) throw new DOMException("No video element", "InvalidStateError");
        attachedVideo.current = video;
        video.srcObject = stream;
        const controller = new AbortController();
        videoWait.current = controller;
        const ready = waitForVideo(video, controller.signal);
        await Promise.all([ready, video.play()]);
        if (token === generation.current) setStatus("ready");
      } catch (error) {
        if (token !== generation.current) return;
        release();
        const name = error instanceof DOMException ? error.name : "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError" ? "unavailable"
          : name === "NotReadableError" ? "busy" : "error");
      }
    })();
    pending.current = request;
    await request;
    if (pending.current === request) pending.current = null;
  }, [stop, release]);
  useEffect(() => { void start(); return stop; }, [start, stop]);
  return { videoRef, status, start, stop };
}
