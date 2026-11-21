// Standalone JVM build that runs the Automatic Logging native unit tests in seconds, without generating the
// Android project. It only reads the module's Android-free Kotlin files; nothing here is part of the app.
pluginManagement {
  repositories {
    gradlePluginPortal()
    mavenCentral()
  }
}
rootProject.name = "arthik-autolog-jvm-test"
