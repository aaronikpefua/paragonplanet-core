package com.app.natureswayproduction.nativeapp.ppif.pipeline

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest
import com.app.natureswayproduction.nativeapp.ppif.runtime.IdentityRuntime

class RuntimeIdentityPipeline(
    private val identityRuntime: IdentityRuntime,
) : IdentityPipeline {
    override suspend fun execute(request: IdentityRequest): AuthResult {
        return identityRuntime.signIn(request)
    }
}
