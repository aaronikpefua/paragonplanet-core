package com.app.natureswayproduction.nativeapp.ppif.models

sealed class AuthResult {
    data class Success(
        val session: IdentitySession,
        val message: String? = null,
    ) : AuthResult()

    data class Failure(
        val message: String? = null,
    ) : AuthResult()
}
