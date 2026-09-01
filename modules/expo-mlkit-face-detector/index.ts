import ExpoMlkitFaceDetectorModule from './src/ExpoMlkitFaceDetectorModule';
import { FaceDetectorOptions, FaceDetectionResult, DetectedFace } from './src/ExpoMlkitFaceDetector.types';

export * from './src/ExpoMlkitFaceDetector.types';

/**
 * Checks whether Google ML Kit native face detection is available on this device.
 */
export function isMlKitFaceDetectionAvailable(): boolean {
  return ExpoMlkitFaceDetectorModule.isAvailable();
}

/**
 * Detects faces in an image URI using Google ML Kit.
 * 
 * @param imageUri Local path or file URI of the captured image
 * @param options Optional FaceDetectorOptions for mode, classification, landmarks, min face size
 * @returns FaceDetectionResult containing face bounds, eye-open probabilities, yaw/roll angles, landmarks
 */
export async function detectFacesAsync(
  imageUri: string,
  options?: FaceDetectorOptions
): Promise<FaceDetectionResult> {
  return await ExpoMlkitFaceDetectorModule.detectFacesAsync(imageUri, options);
}

export default {
  isAvailable: isMlKitFaceDetectionAvailable,
  detectFacesAsync,
};
