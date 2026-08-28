package com.app.natureswayproduction.nativeapp.ppif.providers.twitter

import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import com.app.natureswayproduction.nativeapp.ppif.core.ProviderRegistry

fun ProviderRegistry.registerTwitterProvider(sessionRepository: SessionRepository) {
    register(TwitterProvider(sessionRepository))
}
