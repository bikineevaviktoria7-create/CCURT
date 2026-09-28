export type RecognitionStatus =
  | 'idle'
  | 'searching'
  | 'almost'
  | 'success'
  | 'incorrect'
  | 'environment-error';

export type GestureErrorCode =
  | 'FINGER_NOT_BENT'
  | 'FINGER_NOT_STRAIGHT'
  | 'THUMB_POSITION'
  | 'FINGER_SPREAD'
  | 'PALM_ORIENTATION'
  | 'HAND_LOCATION'
  | 'AMPLITUDE'
  | 'SPEED'
  | 'HAND_OUT_OF_FRAME'
  | 'LOW_LIGHT'
  | 'WRONG_HAND';

export interface RecognitionResult {
  status: RecognitionStatus;
  predictedGesture?: string;
  targetGesture: string;
  confidence: number;
  holdProgress: number;
  message?: string;
  errorCodes?: readonly GestureErrorCode[];
  incorrectLandmarks?: readonly number[];
  correctLandmarks?: readonly number[];
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

// Frame data is delivered to refs/canvas; it must not enter React state.
export interface HandFrame {
  timestamp: number;
  landmarks: readonly HandLandmark[];
}

export interface VisionAdapter {
  initialize(): Promise<void>;
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
  /** Semantic results only, limited to 5–10 updates per second. */
  subscribe(callback: (result: RecognitionResult) => void): () => void;
  subscribeFrames(callback: (frame: HandFrame) => void): () => void;
}
