package com.app.natureswayproduction.nativeapp.ppif.models

import java.time.Instant

/**
 * Model placeholder representing an authenticated session.
 */
data class IdentitySession(
    val uid: String,
    val provider: AuthProvider,
    val email: String?,
    val createdAt: Instant = Instant.now()
)
