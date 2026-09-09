package com.app.natureswayproduction.nativeapp.feature.live.broadcast

import androidx.compose.runtime.mutableStateOf

/** Process-scoped owner for the active publisher. UI destinations only attach a preview. */
object LiveBroadcastRuntime {
    val broadcaster = mutableStateOf<ParagonLiveBroadcaster?>(null)
}
