package com.app.natureswayproduction.nativeapp.feature.live

import android.hardware.camera2.CameraCharacteristics
import androidx.compose.runtime.mutableStateOf
import com.app.natureswayproduction.nativeapp.data.api.StartLiveResult
import com.app.natureswayproduction.nativeapp.feature.live.broadcast.LiveBroadcastState
import com.app.natureswayproduction.nativeapp.feature.live.broadcast.LiveBroadcastRuntime
import com.app.natureswayproduction.nativeapp.feature.live.broadcast.ParagonLiveBroadcaster

/**
 * Activity-scoped state for an in-progress broadcast. The publisher must outlive the temporary
 * Live screen/preview composition so navigation cannot terminate or duplicate the RTMP session.
 */
class ParagonLiveBroadcastSessionState {
    val selectedPurpose = mutableStateOf<String?>(null)
    val liveTitle = mutableStateOf("")
    val liveDescription = mutableStateOf("")
    val scheduleDate = mutableStateOf("")
    val scheduleTime = mutableStateOf("")
    val showPreview = mutableStateOf(false)
    val cameraEnabled = mutableStateOf(true)
    val microphoneEnabled = mutableStateOf(true)
    val cameraLensFacing = mutableStateOf(CameraCharacteristics.LENS_FACING_FRONT)
    val statusMessage = mutableStateOf("")
    val startLiveResult = mutableStateOf<StartLiveResult?>(null)
    val isStartingLive = mutableStateOf(false)
    val startRequestId = mutableStateOf("")
    val broadcaster = LiveBroadcastRuntime.broadcaster
    val broadcastState = mutableStateOf(LiveBroadcastState.IDLE)
    val activeSessionMarked = mutableStateOf(false)

    fun detachPreview() {
        broadcaster.value?.detachPreviewView()
    }

    fun clearAfterEnd() {
        broadcaster.value?.release()
        broadcaster.value = null
        broadcastState.value = LiveBroadcastState.IDLE
        activeSessionMarked.value = false
        startLiveResult.value = null
        startRequestId.value = ""
        showPreview.value = false
    }
}
