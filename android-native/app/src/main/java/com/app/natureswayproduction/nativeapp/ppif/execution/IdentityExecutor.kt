package com.app.natureswayproduction.nativeapp.ppif.execution

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

interface IdentityExecutor {
    suspend fun execute(request: IdentityRequest): AuthResult
}
