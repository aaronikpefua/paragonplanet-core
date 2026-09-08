package com.app.natureswayproduction.nativeapp.data.appcheck

import android.util.Log
import com.google.firebase.appcheck.FirebaseAppCheck
import kotlinx.coroutines.tasks.await

class AppCheckRepository(
    private val firebaseAppCheck: FirebaseAppCheck = FirebaseAppCheck.getInstance(),
) {
    suspend fun getToken(forceRefresh: Boolean = false): String? {
        return try {
            firebaseAppCheck.getAppCheckToken(forceRefresh).await().token
        } catch (error: Exception) {
            Log.e("ParagonAppCheck", "App Check token acquisition failed: ${error.javaClass.simpleName}: ${error.message}")
            null
        }
    }
}
