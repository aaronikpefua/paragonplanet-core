package com.app.natureswayproduction.nativeapp.ppif.linking

import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest

interface AccountLinkingService {
    suspend fun link(request: IdentityRequest): AuthResult
}
