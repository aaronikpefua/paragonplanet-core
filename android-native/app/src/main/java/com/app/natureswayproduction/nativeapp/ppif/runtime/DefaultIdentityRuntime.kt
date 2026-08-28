package com.app.natureswayproduction.nativeapp.ppif.runtime

import com.app.natureswayproduction.nativeapp.ppif.core.AuthenticationManager
import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

class DefaultIdentityRuntime(
    private val authenticationManager: AuthenticationManager,
) : IdentityRuntime {
    override suspend fun signIn(request: IdentityRequest): AuthResult {
        return authenticationManager.signIn(request)
    }
}
