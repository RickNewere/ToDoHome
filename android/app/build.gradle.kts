plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The WebView target is configurable so the same source can point at the
// GitHub Pages build or at the local Vite dev server during testing.
val todoHomeUrl: String = (project.findProperty("TODOHOME_URL") as String?)
    ?: "https://ricknewere.github.io/ToDoHome/"

android {
    namespace = "it.ricknewere.todohome"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.ricknewere.todohome"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "WEB_URL", "\"$todoHomeUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the debug key: the app is sideloaded onto two phones,
            // it is never published to the Play Store.
            signingConfig = signingConfigs.getByName("debug")
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
}
