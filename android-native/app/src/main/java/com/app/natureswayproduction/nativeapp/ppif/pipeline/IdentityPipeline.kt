package com.app.natureswayproduction.nativeapp.ppif.pipeline

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

interface IdentityPipeline {
    suspend fun execute(request: IdentityRequest): AuthResult
}
