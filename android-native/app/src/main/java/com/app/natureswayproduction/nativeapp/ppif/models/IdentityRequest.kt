package com.app.natureswayproduction.nativeapp.ppif.models

data class IdentityRequest(
    val provider: AuthProvider,
    val email: String? = null,
    val password: String? = null,
    val phoneNumber: String? = null,
    val otp: String? = null,
    val verificationId: String? = null,
    val token: String? = null,
    val extras: Map<String, String> = emptyMap(),
)
