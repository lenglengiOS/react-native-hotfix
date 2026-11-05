require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = "ReactNativeHotfix"
  s.module_name = "Hotfix"
  s.version = package["version"]
  s.summary = package["description"]
  s.homepage = "https://github.com/lenglengiOS/react-native-hotfix"
  s.license = { :type => "MIT", :file => "LICENSE" }
  s.authors = { "React Native Hotfix contributors" => "https://github.com/lenglengiOS" }
  s.platforms = { :ios => "15.1" }
  s.source = { :path => "." }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.9"
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
  }

  s.dependency "React-Core"
  install_modules_dependencies(s)
end
