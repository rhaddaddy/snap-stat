plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The signing key comes from the ANDROID_KEYSTORE secret (see .github/workflows/android.yml),
// so every build is signed the same way and installs over the last one.
val keyFile = rootProject.file("release.jks")

android {
    namespace = "com.rhaddaddy.snapstat"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rhaddaddy.snapstat"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "1.0"
    }

    signingConfigs {
        create("release") {
            storeFile = keyFile
            storePassword = System.getenv("KEY_PASSWORD") ?: "snapstat"
            keyAlias = "snapstat"
            keyPassword = System.getenv("KEY_PASSWORD") ?: "snapstat"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.browser:browser:1.8.0")
    // On-device text reading, used by the match tracker to spot the end-of-match screen.
    // The Google Play services version keeps the app small; the phone downloads the reader once.
    implementation("com.google.android.gms:play-services-mlkit-text-recognition:19.0.1")
}
