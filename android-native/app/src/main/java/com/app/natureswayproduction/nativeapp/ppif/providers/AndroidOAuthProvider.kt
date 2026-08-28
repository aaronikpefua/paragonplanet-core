package com.app.natureswayproduction.nativeapp.ppif.providers

import android.app.Activity
import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult

interface AndroidOAuthProvider : IdentityProvider {
    suspend fun signIn(activity: Activity): AuthResult
}
