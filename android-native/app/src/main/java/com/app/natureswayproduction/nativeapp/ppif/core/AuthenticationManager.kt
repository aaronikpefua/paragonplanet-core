package com.app.natureswayproduction.nativeapp.ppif.core

import com.app.natureswayproduction.nativeapp.ppif.models.AuthProvider
import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.models.IdentityRequest
import com.app.natureswayproduction.nativeapp.ppif.providers.OAuthProvider

class AuthenticationManager(
    private val providerRegistry: ProviderRegistry,
) {
    suspend fun signIn(request: IdentityRequest): AuthResult {
        val provider = request.provider
        val identityProvider = providerRegistry.get(provider)
            ?: return AuthResult.Failure("Provider is not registered.")

        val oauthProvider = identityProvider as? OAuthProvider
            ?: return AuthResult.Failure("Provider does not support identity request sign-in.")

        return oauthProvider.signIn(request)
    }
}
