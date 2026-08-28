package com.app.natureswayproduction.nativeapp.ppif.mappers

import com.app.natureswayproduction.nativeapp.data.auth.SessionSummary
import com.app.natureswayproduction.nativeapp.ppif.models.AuthProvider
import com.app.natureswayproduction.nativeapp.ppif.models.IdentitySession

object SessionSummaryMapper {
    fun toIdentitySession(
        summary: SessionSummary,
        provider: AuthProvider,
    ): IdentitySession {
        return IdentitySession(
            uid = summary.uid.orEmpty(),
            provider = provider,
            email = summary.email,
        )
    }
}
