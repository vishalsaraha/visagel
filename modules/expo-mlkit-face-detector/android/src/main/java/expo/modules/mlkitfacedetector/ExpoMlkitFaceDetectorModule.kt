package expo.modules.mlkitfacedetector

import android.content.Context
import android.graphics.PointF
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class ExpoMlkitFaceDetectorModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React Application Context is null")

  override fun definition() = ModuleDefinition {
    Name("ExpoMlkitFaceDetector")

    AsyncFunction("detectFacesAsync") { imageUriString: String, optionsMap: Map<String, Any>?, promise: Promise ->
      try {
        val uri = if (imageUriString.startsWith("file://") || imageUriString.startsWith("content://")) {
          Uri.parse(imageUriString)
        } else {
          Uri.fromFile(File(imageUriString))
        }

        val inputImage = InputImage.fromFilePath(context, uri)

        // Parse options
        val modeStr = optionsMap?.get("mode") as? String ?: "accurate"
        val detectLandmarks = optionsMap?.get("detectLandmarks") as? Boolean ?: true
        val classifyModeStr = optionsMap?.get("classifyMode") as? String ?: "all"
        val minFaceSize = (optionsMap?.get("minFaceSize") as? Number)?.toFloat() ?: 0.15f
        val tracking = optionsMap?.get("tracking") as? Boolean ?: false

        val builder = FaceDetectorOptions.Builder()
          .setMinFaceSize(minFaceSize)

        if (modeStr == "fast") {
          builder.setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        } else {
          builder.setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        }

        if (detectLandmarks) {
          builder.setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
        } else {
          builder.setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
        }

        if (classifyModeStr == "all") {
          builder.setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        } else {
          builder.setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
        }

        if (tracking) {
          builder.enableTracking()
        }

        val detector = FaceDetection.getClient(builder.build())

        detector.process(inputImage)
          .addOnSuccessListener { faces ->
            val resultFaces = ArrayList<Map<String, Any?>>()

            for (face in faces) {
              val faceMap = HashMap<String, Any?>()
              val bounds = face.boundingBox

              val boundsMap = mapOf(
                "x" to bounds.left,
                "y" to bounds.top,
                "width" to bounds.width(),
                "height" to bounds.height()
              )
              faceMap["bounds"] = boundsMap
              faceMap["rollAngle"] = face.headEulerAngleZ.toDouble() // roll
              faceMap["yawAngle"] = face.headEulerAngleY.toDouble()  // yaw
              faceMap["pitchAngle"] = face.headEulerAngleX.toDouble() // pitch
              faceMap["smilingProbability"] = face.smilingProbability?.toDouble()
              faceMap["leftEyeOpenProbability"] = face.leftEyeOpenProbability?.toDouble()
              faceMap["rightEyeOpenProbability"] = face.rightEyeOpenProbability?.toDouble()
              faceMap["trackingId"] = face.trackingId

              // Landmarks
              val landmarksMap = HashMap<String, Any?>()
              face.getLandmark(FaceLandmark.LEFT_EYE)?.let {
                landmarksMap["leftEye"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.RIGHT_EYE)?.let {
                landmarksMap["rightEye"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.LEFT_EAR)?.let {
                landmarksMap["leftEar"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.RIGHT_EAR)?.let {
                landmarksMap["rightEar"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.LEFT_CHEEK)?.let {
                landmarksMap["leftCheek"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.RIGHT_CHEEK)?.let {
                landmarksMap["rightCheek"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.NOSE_BASE)?.let {
                landmarksMap["noseBase"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.MOUTH_LEFT)?.let {
                landmarksMap["mouthLeft"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.MOUTH_RIGHT)?.let {
                landmarksMap["mouthRight"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              face.getLandmark(FaceLandmark.MOUTH_BOTTOM)?.let {
                landmarksMap["mouthBottom"] = mapOf("x" to it.position.x, "y" to it.position.y)
              }
              faceMap["landmarks"] = landmarksMap

              resultFaces.add(faceMap)
            }

            val resultMap = mapOf(
              "hasFace" to (resultFaces.isNotEmpty()),
              "faceCount" to resultFaces.size,
              "faces" to resultFaces,
              "imageWidth" to inputImage.width,
              "imageHeight" to inputImage.height
            )

            promise.resolve(resultMap)
          }
          .addOnFailureListener { exception ->
            promise.reject("MLKIT_FACE_DETECTION_ERROR", exception.message ?: "Failed to detect faces with ML Kit", exception)
          }
          .addOnCompleteListener {
            detector.close()
          }
      } catch (e: Exception) {
        promise.reject("MLKIT_FACE_DETECTION_EXCEPTION", e.message ?: "Unexpected error during face detection", e)
      }
    }
  }
}
