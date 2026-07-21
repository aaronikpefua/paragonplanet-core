package com.app.natureswayproduction.nativeapp.data.appcheck

import com.google.firebase.appcheck.FirebaseAppCheck
import kotlinx.coroutines.tasks.await

class AppCheckRepository(
    private val firebaseAppCheck: FirebaseAppCheck = FirebaseAppCheck.getInstance(),
) {
    suspend fun getToken(forceRefresh: Boolean = false): String? {
        return runCatching {
            firebaseAppCheck.getAppCheckToken(forceRefresh).await().token
        }.getOrNull()
    }
}
