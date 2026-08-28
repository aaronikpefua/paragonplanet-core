package com.app.natureswayproduction.nativeapp.ppif.runtime

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

interface IdentityRuntime {
    suspend fun signIn(request: IdentityRequest): AuthResult
}
