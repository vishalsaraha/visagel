import ExpoModulesCore
import MLKitFaceDetection
import MLKitVision
import UIKit

public class ExpoMlkitFaceDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoMlkitFaceDetector")

    AsyncFunction("detectFacesAsync") { (imageUriString: String, optionsDict: [String: Any]?, promise: Promise) in
      guard let url = URL(string: imageUriString),
            let data = try? Data(contentsOf: url),
            let uiImage = UIImage(data: data) else {
        promise.reject("INVALID_IMAGE_URI", "Could not load image from URI: \(imageUriString)")
        return
      }

      let visionImage = VisionImage(image: uiImage)
      visionImage.orientation = uiImage.imageOrientation

      let options = FaceDetectorOptions()
      let modeStr = (optionsDict?["mode"] as? String) ?? "accurate"
      options.performanceMode = (modeStr == "fast") ? .fast : .accurate
      
      let detectLandmarks = (optionsDict?["detectLandmarks"] as? Bool) ?? true
      options.landmarkMode = detectLandmarks ? .all : .none

      let classifyModeStr = (optionsDict?["classifyMode"] as? String) ?? "all"
      options.classificationMode = (classifyModeStr == "all") ? .all : .none

      if let minFaceSize = optionsDict?["minFaceSize"] as? NSNumber {
        options.minFaceSize = CGFloat(minFaceSize.doubleValue)
      }

      if let tracking = optionsDict?["tracking"] as? Bool, tracking {
        options.isTrackingEnabled = true
      }

      let faceDetector = FaceDetector.faceDetector(options: options)

      faceDetector.process(visionImage) { faces, error in
        if let error = error {
          promise.reject("MLKIT_FACE_DETECTION_ERROR", error.localizedDescription)
          return
        }

        var resultFaces: [[String: Any?]] = []

        for face in (faces ?? []) {
          var faceMap: [String: Any?] = [:]
          let frame = face.frame

          faceMap["bounds"] = [
            "x": frame.origin.x,
            "y": frame.origin.y,
            "width": frame.size.width,
            "height": frame.size.height
          ]
          faceMap["rollAngle"] = face.headEulerAngleZ
          faceMap["yawAngle"] = face.headEulerAngleY
          faceMap["pitchAngle"] = face.headEulerAngleX
          faceMap["smilingProbability"] = face.hasSmilingProbability ? face.smilingProbability : nil
          faceMap["leftEyeOpenProbability"] = face.hasLeftEyeOpenProbability ? face.leftEyeOpenProbability : nil
          faceMap["rightEyeOpenProbability"] = face.hasRightEyeOpenProbability ? face.rightEyeOpenProbability : nil
          faceMap["trackingId"] = face.hasTrackingID ? face.trackingID : nil

          var landmarksMap: [String: Any] = [:]
          if let leftEye = face.landmark(ofType: .leftEye) {
            landmarksMap["leftEye"] = ["x": leftEye.position.x, "y": leftEye.position.y]
          }
          if let rightEye = face.landmark(ofType: .rightEye) {
            landmarksMap["rightEye"] = ["x": rightEye.position.x, "y": rightEye.position.y]
          }
          if let leftEar = face.landmark(ofType: .leftEar) {
            landmarksMap["leftEar"] = ["x": leftEar.position.x, "y": leftEar.position.y]
          }
          if let rightEar = face.landmark(ofType: .rightEar) {
            landmarksMap["rightEar"] = ["x": rightEar.position.x, "y": rightEar.position.y]
          }
          if let noseBase = face.landmark(ofType: .noseBase) {
            landmarksMap["noseBase"] = ["x": noseBase.position.x, "y": noseBase.position.y]
          }
          if let mouthLeft = face.landmark(ofType: .mouthLeft) {
            landmarksMap["mouthLeft"] = ["x": mouthLeft.position.x, "y": mouthLeft.position.y]
          }
          if let mouthRight = face.landmark(ofType: .mouthRight) {
            landmarksMap["mouthRight"] = ["x": mouthRight.position.x, "y": mouthRight.position.y]
          }
          if let mouthBottom = face.landmark(ofType: .mouthBottom) {
            landmarksMap["mouthBottom"] = ["x": mouthBottom.position.x, "y": mouthBottom.position.y]
          }
          faceMap["landmarks"] = landmarksMap

          resultFaces.append(faceMap)
        }

        let result: [String: Any] = [
          "hasFace": !resultFaces.isEmpty,
          "faceCount": resultFaces.count,
          "faces": resultFaces,
          "imageWidth": uiImage.size.width,
          "imageHeight": uiImage.size.height
        ]

        promise.resolve(result)
      }
    }
  }
}
