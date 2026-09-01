import { requireOptionalNativeModule } from 'expo-modules-core';
import * as ImageManipulator from 'expo-image-manipulator';
import { FaceDetectorOptions, FaceDetectionResult } from './ExpoMlkitFaceDetector.types';

// Native Google ML Kit module (available in dev-client / custom native builds)
const NativeModule = requireOptionalNativeModule('ExpoMlkitFaceDetector');

/**
 * Checks if a frame is dark, covered, or lacks contrast.
 */
async function checkFrameDarkOrCovered(imageUri: string): Promise<boolean> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 16, height: 16 } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.2, base64: true }
    );
    if (!result.base64) return true;
    
    // Check base64 length & variance
    const clean = result.base64.replace(/[^A-Za-z0-9+/=]/g, '');
    if (clean.length < 650) {
      return true; // Completely dark or uniform frame
    }
    
    // Check byte entropy / character variance
    const charSet = new Set(clean);
    if (charSet.size < 20) {
      return true; // Uniform color / covered lens
    }
    
    return false;
  } catch {
    return true;
  }
}

export default {
  /**
   * Checks if the native Google ML Kit module is compiled and available on this platform.
   */
  isAvailable(): boolean {
    return Boolean(NativeModule && typeof NativeModule.detectFacesAsync === 'function');
  },

  /**
   * Detects faces in an image at the given URI using Google ML Kit.
   * @param imageUri Local file URI (file:// or content://)
   * @param options Detector configuration options
   */
  async detectFacesAsync(
    imageUri: string,
    options?: FaceDetectorOptions
  ): Promise<FaceDetectionResult> {
    // 1. If native Google ML Kit binary is compiled, run native detection
    if (NativeModule && typeof NativeModule.detectFacesAsync === 'function') {
      return await NativeModule.detectFacesAsync(imageUri, options || {});
    }

    // 2. Fallback for Expo Go (where native MLKit binaries are not linked yet)
    // First, verify the camera is not covered or dark
    const isCovered = await checkFrameDarkOrCovered(imageUri);
    if (isCovered) {
      return {
        hasFace: false,
        faceCount: 0,
        faces: [],
        imageWidth: 0,
        imageHeight: 0,
      };
    }

    // Return empty if image cannot be processed
    return {
      hasFace: false,
      faceCount: 0,
      faces: [],
      imageWidth: 0,
      imageHeight: 0,
    };
  },
};
