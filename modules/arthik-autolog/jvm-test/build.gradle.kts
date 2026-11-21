import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
  kotlin("jvm") version "2.2.21"
}

repositories {
  mavenCentral()
}

val src = "../android/src/main/java/expo/modules/arthikautolog"

/**
 * Only native files with no Android types can be tested here, without changing the app (no new APK).
 * Today that is the privacy gate. The tests live in this folder, never inside the native module.
 */
val androidFree = listOf("FinancialFilter.kt")

sourceSets {
  main { kotlin.setSrcDirs(listOf(src)); kotlin.include(androidFree) }
}

java {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
  compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
  testImplementation("junit:junit:4.13.2")
}

tasks.test {
  testLogging { events("passed", "failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}
