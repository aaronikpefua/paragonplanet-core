package com.app.natureswayproduction.nativeapp.ppif.providers.twitter

import android.app.Activity
import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import com.app.natureswayproduction.nativeapp.data.auth.SessionSummary
import com.app.natureswayproduction.nativeapp.ppif.mappers.SessionSummaryMapper
import com.app.natureswayproduction.nativeapp.ppif.models.AuthProvider
import com.app.natureswayproduction.nativeapp.ppif.models.AuthResult
import com.app.natureswayproduction.nativeapp.ppif.providers.AndroidOAuthProvider

class TwitterProvider(
    private val signInWithX: suspend (Activity) -> SessionSummary,
) : AndroidOAuthProvider {
    constructor(sessionRepository: SessionRepository) : this(sessionRepository::signInWithX)

    override val providerId: AuthProvider = AuthProvider.TWITTER

    override suspend fun signIn(activity: Activity): AuthResult {
        return runCatching {
            val sessionSummary = signInWithX(activity)
            AuthResult.Success(
                session = SessionSummaryMapper.toIdentitySession(
                    summary = sessionSummary,
                    provider = providerId,
                ),
                message = sessionSummary.note,
            )
        }.getOrElse { error ->
            AuthResult.Failure(error.message)
        }
    }
}
