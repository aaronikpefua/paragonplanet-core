package com.app.natureswayproduction.nativeapp.ppif.services

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

interface IdentityService {
    suspend fun authenticate(request: IdentityRequest): AuthResult
}
