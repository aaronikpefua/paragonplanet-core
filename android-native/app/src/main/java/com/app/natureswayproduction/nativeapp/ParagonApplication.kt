package com.app.natureswayproduction.nativeapp

import android.app.Application
import com.app.natureswayproduction.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory

class ParagonApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (FirebaseApp.getApps(this).isEmpty()) {
            checkNotNull(FirebaseApp.initializeApp(this)) {
                "Firebase was not initialized from google-services.json."
            }
        }

        val firebaseAppCheck = FirebaseAppCheck.getInstance()
        if (BuildConfig.DEBUG) {
            installDebugAppCheckProvider(firebaseAppCheck)
        } else {
            firebaseAppCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }
    }

    private fun installDebugAppCheckProvider(firebaseAppCheck: FirebaseAppCheck) {
        val factoryClass = Class.forName(
            "com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory"
        )
        val getInstanceMethod = factoryClass.getMethod("getInstance")
        val factory = getInstanceMethod.invoke(null) as AppCheckProviderFactory
        firebaseAppCheck.installAppCheckProviderFactory(factory)
    }
}

