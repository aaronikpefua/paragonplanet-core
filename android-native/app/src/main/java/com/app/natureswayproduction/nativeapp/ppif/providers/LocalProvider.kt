package com.app.natureswayproduction.nativeapp.ppif.providers

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

interface LocalProvider : IdentityProvider {
    suspend fun signIn(request: IdentityRequest): AuthResult
    suspend fun register(request: IdentityRequest): AuthResult
    suspend fun signOut(request: IdentityRequest): AuthResult
}
