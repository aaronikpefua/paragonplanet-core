package com.app.natureswayproduction.nativeapp.ppif.models

/**
 * Model placeholder describing an identity provider's metadata.
 */
data class IdentityProvider(
    val id: AuthProvider,
    val displayName: String,
    val scopes: List<String> = emptyList()
)
