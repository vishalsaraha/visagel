/**
 * faceMatch.ts
 * Unified Face Matching API for Visagel Attendance System
 * 
 * Interconnects with Biometric Face Engine (`utils/faceEngine.ts`) for:
 * 1. Local Edge Vector Feature Comparison (100% On-Device, Privacy-first).
 * 2. Enterprise Cloud AI API Matching (AWS Rekognition / Face++ / Azure).
 * 3. Passive Anti-Spoofing & Liveness Checks.
 */

import {
  extractFaceVector,
  computeCosineSimilarity,
  performLivenessCheck,
  matchFaceCloud,
  ModelEngineType,
  LivenessMode,
  CloudApiConfig,
  BiometricMatchResult,
} from './faceEngine';

export { BiometricMatchResult, ModelEngineType, LivenessMode, CloudApiConfig };

export interface FaceMatchOptions {
  minConfidence?: number;     // e.g. 75 (%)
  livenessMode?: LivenessMode; // 'strict' | 'balanced' | 'off'
  modelEngine?: ModelEngineType; // 'local' | 'cloud'
  cloudConfig?: CloudApiConfig;
}

/**
 * Compares a live camera snapshot against an array of enrolled employee face photos.
 * Returns the best matching employee index, confidence %, cosine distance, and liveness result.
 */
export async function findBestMatch(
  liveUri: string,
  enrolledPhotos: (string | null)[],
  options: FaceMatchOptions = {}
): Promise<BiometricMatchResult> {
  const {
    minConfidence = 75,
    livenessMode = 'balanced',
    modelEngine = 'local',
    cloudConfig,
  } = options;

  // 1. Run Passive Liveness & Anti-Spoofing Verification
  const liveness = await performLivenessCheck(liveUri, livenessMode);

  if (liveness.isCovered) {
    return {
      index: -1,
      confidence: 0,
      distance: 1.0,
      isCovered: true,
      livenessPassed: false,
      livenessScore: 0,
      livenessReason: liveness.reason,
    };
  }

  if (!liveness.passed) {
    return {
      index: -1,
      confidence: 0,
      distance: 1.0,
      isCovered: false,
      livenessPassed: false,
      livenessScore: liveness.score,
      livenessReason: liveness.reason,
    };
  }

  // 2. Perform Biometric Match
  if (modelEngine === 'cloud' && cloudConfig?.url && cloudConfig?.apiKey) {
    // ── CLOUD AI ENGINE ──────────────────────────────────────────────────
    let bestIndex = -1;
    let bestConfidence = 0;

    for (let idx = 0; idx < enrolledPhotos.length; idx++) {
      const photoUri = enrolledPhotos[idx];
      if (!photoUri) continue;

      const cloudRes = await matchFaceCloud(liveUri, photoUri, cloudConfig);
      if (cloudRes.confidence > bestConfidence) {
        bestConfidence = cloudRes.confidence;
        bestIndex = idx;
      }
    }

    if (bestIndex === -1 || bestConfidence < minConfidence) {
      return {
        index: -1,
        confidence: bestConfidence,
        distance: 1 - bestConfidence / 100,
        isCovered: false,
        livenessPassed: true,
        livenessScore: liveness.score,
      };
    }

    return {
      index: bestIndex,
      confidence: Math.round(bestConfidence),
      distance: 1 - bestConfidence / 100,
      isCovered: false,
      livenessPassed: true,
      livenessScore: liveness.score,
    };
  }

  // ── LOCAL EDGE BIOMETRIC VECTOR ENGINE ─────────────────────────────────
  try {
    const liveVector = await extractFaceVector(liveUri);
    let bestIndex = -1;
    let bestSimilarity = -1;

    for (let idx = 0; idx < enrolledPhotos.length; idx++) {
      const photoUri = enrolledPhotos[idx];
      if (!photoUri) continue;

      const enrolledVector = await extractFaceVector(photoUri);
      const similarity = computeCosineSimilarity(liveVector, enrolledVector);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = idx;
      }
    }

    // Convert similarity (-1.0 to 1.0) to Confidence % (scaled with non-linear biometric curve)
    // 0.85+ vector similarity = ~92-99% confidence
    const confidencePct =
      bestSimilarity <= 0
        ? 0
        : Math.min(99, Math.max(0, Math.round(Math.pow(bestSimilarity, 0.8) * 100)));

    if (bestIndex === -1 || confidencePct < minConfidence) {
      return {
        index: -1,
        confidence: confidencePct,
        distance: 1 - bestSimilarity,
        isCovered: false,
        livenessPassed: true,
        livenessScore: liveness.score,
      };
    }

    return {
      index: bestIndex,
      confidence: confidencePct,
      distance: 1 - bestSimilarity,
      isCovered: false,
      livenessPassed: true,
      livenessScore: liveness.score,
    };
  } catch (err) {
    console.error('[FaceMatch] Local engine error:', err);
    return {
      index: -1,
      confidence: 0,
      distance: 1.0,
      isCovered: false,
      livenessPassed: false,
      livenessScore: 0,
      livenessReason: 'Face matching error',
    };
  }
}
