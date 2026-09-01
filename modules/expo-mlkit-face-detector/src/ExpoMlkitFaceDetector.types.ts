export type DetectionMode = 'fast' | 'accurate';
export type ClassificationMode = 'none' | 'all';
export type LandmarkMode = 'none' | 'all';
export type ContourMode = 'none' | 'all';

export interface FaceDetectorOptions {
  /**
   * Detection mode: 'fast' or 'accurate' (default: 'accurate')
   */
  mode?: DetectionMode;
  /**
   * Whether to detect facial landmarks (eyes, ears, nose, cheeks, mouth)
   */
  detectLandmarks?: boolean;
  /**
   * Classification mode to calculate eye-open and smile probabilities (default: 'all')
   */
  classifyMode?: ClassificationMode;
  /**
   * Minimum face size expressed as proportion of image width/height (0.0 to 1.0, default: 0.15)
   */
  minFaceSize?: number;
  /**
   * Whether to enable tracking ID across frames (default: false)
   */
  tracking?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmarks {
  leftEye?: Point;
  rightEye?: Point;
  leftEar?: Point;
  rightEar?: Point;
  leftCheek?: Point;
  rightCheek?: Point;
  noseBase?: Point;
  mouthLeft?: Point;
  mouthRight?: Point;
  mouthBottom?: Point;
}

export interface DetectedFace {
  /**
   * Bounding box rectangle of the face in pixels
   */
  bounds: Rect;
  /**
   * Roll angle (head tilt clockwise/counterclockwise) in degrees
   */
  rollAngle: number;
  /**
   * Yaw angle (head turned left/right) in degrees
   */
  yawAngle: number;
  /**
   * Pitch angle (head turned up/down) in degrees (if supported)
   */
  pitchAngle?: number;
  /**
   * Probability that the person is smiling (0.0 to 1.0)
   */
  smilingProbability?: number | null;
  /**
   * Probability that the left eye is open (0.0 to 1.0)
   */
  leftEyeOpenProbability?: number | null;
  /**
   * Probability that the right eye is open (0.0 to 1.0)
   */
  rightEyeOpenProbability?: number | null;
  /**
   * Tracking ID assigned to the face across frames (if tracking is enabled)
   */
  trackingId?: number | null;
  /**
   * Facial landmarks coordinates
   */
  landmarks?: FaceLandmarks;
}

export interface FaceDetectionResult {
  /**
   * Whether at least one face was detected
   */
  hasFace: boolean;
  /**
   * Number of faces found in the image
   */
  faceCount: number;
  /**
   * Array of detected faces with details
   */
  faces: DetectedFace[];
  /**
   * Image width in pixels
   */
  imageWidth: number;
  /**
   * Image height in pixels
   */
  imageHeight: number;
}
