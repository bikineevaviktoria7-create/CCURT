import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  detectBody,
  detectHands,
  getHandLandmarker,
  getPoseLandmarker,
  onVideoFrames,
} from "../vision/landmarkers";
import { pickHand } from "../vision/recognizer";
import { createSkeletonOverlay } from "../lib/drawHandSkeleton";
import type { BodyReference, Hand, HandObservation } from "../vision/types";

export interface TrackedFrame {
  t: number;
  hand?: HandObservation;
  hands: HandObservation[];
  body?: BodyReference;
}

/**
 * Runs MediaPipe on a live video and draws the skeleton. Used by the admin panel,
 * where samples are recorded with exactly the same pipeline as the lessons.
 */
export function useHandTracking(
  video: RefObject<HTMLVideoElement>,
  canvas: RefObject<HTMLCanvasElement>,
  enabled: boolean,
  options: { withPose: boolean; dominantHand: Hand; highlight?: { incorrect?: number[]; correct?: number[] } },
  onFrame: (frame: TrackedFrame) => void,
) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const callback = useRef(onFrame);
  callback.current = onFrame;
  const highlight = useRef(options.highlight);
  highlight.current = options.highlight;
  const { withPose, dominantHand } = options;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let stop: (() => void) | undefined;
    const skeleton = createSkeletonOverlay(video.current, canvas.current);
    let count = 0;
    let body: BodyReference | undefined;
    setStatus("loading");
    Promise.all([
      getHandLandmarker(),
      withPose ? getPoseLandmarker().catch(() => null) : Promise.resolve(null),
    ]).then(
      ([hand, pose]) => {
        if (!active || !video.current) return;
        setStatus("ready");
        const element = video.current;
        stop = onVideoFrames(element, () => {
          count += 1;
          const hands = detectHands(hand, element);
          if (pose && count % 2 === 0) body = detectBody(pose, element) ?? body;
          const chosen = pickHand(hands, dominantHand);
          skeleton?.draw(chosen?.image ?? [], {
            incorrectLandmarks: highlight.current?.incorrect,
            correctLandmarks: highlight.current?.correct,
          });
          callback.current({ t: performance.now(), hand: chosen, hands, body });
        });
      },
      () => active && setStatus("error"),
    );
    return () => {
      active = false;
      stop?.();
      skeleton?.dispose();
    };
  }, [enabled, withPose, dominantHand, video, canvas]);
  return status;
}
