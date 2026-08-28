package com.app.natureswayproduction.nativeapp.ppif.core

import com.app.natureswayproduction.nativeapp.ppif.models.AuthProvider
import com.app.natureswayproduction.nativeapp.ppif.providers.IdentityProvider
import java.util.concurrent.ConcurrentHashMap

class ProviderRegistry {
    private val providers = ConcurrentHashMap<AuthProvider, IdentityProvider>()

    fun register(provider: IdentityProvider) {
        providers[provider.providerId] = provider
    }

    fun get(provider: AuthProvider): IdentityProvider? {
        return providers[provider]
    }

    fun contains(provider: AuthProvider): Boolean {
        return providers.containsKey(provider)
    }
}
