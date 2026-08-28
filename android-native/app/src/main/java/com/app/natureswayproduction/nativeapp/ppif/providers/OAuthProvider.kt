package com.app.natureswayproduction.nativeapp.ppif.providers

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

interface OAuthProvider : IdentityProvider {
    suspend fun signIn(request: IdentityRequest): AuthResult
}
