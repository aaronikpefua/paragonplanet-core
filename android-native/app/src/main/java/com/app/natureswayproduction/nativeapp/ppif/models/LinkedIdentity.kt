package com.app.natureswayproduction.nativeapp.ppif.models

/**
 * Model placeholder representing a linked external identity.
 */
data class LinkedIdentity(
    val provider: AuthProvider,
    val providerUserId: String,
    val displayName: String?,
    val email: String?
)
