Pod::Spec.new do |s|
  s.name           = 'ExpoMlkitFaceDetector'
  s.version        = '1.0.0'
  s.summary        = 'Google ML Kit Face Detection module for Expo'
  s.description    = 'Native Google ML Kit Face Detection integration for Expo React Native'
  s.author         = 'Branzept'
  s.homepage       = 'https://github.com/branzept/visagel'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'GoogleMLKit/FaceDetection', '~> 6.0.0'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
