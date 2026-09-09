package com.app.natureswayproduction.nativeapp.feature.live.broadcast

import android.content.Context
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.video.CameraHelper
import com.pedro.library.rtmp.RtmpCamera2
import com.pedro.library.view.OpenGlView

class ParagonLiveBroadcaster(
    private val context: Context,
    view: OpenGlView,
    private val onStateChanged: (LiveBroadcastState, String) -> Unit,
) : ConnectChecker {
    private val camera = RtmpCamera2(view, this)
    private var attachedView: OpenGlView? = view
    private var publishUrl: String = ""
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 3
    private var previewStarted = false
    private var encodersPrepared = false
    private var videoEnabled = true
    private val videoWidth = 640
    private val videoHeight = 480
    private val videoFps = 30
    private val videoBitrate = 1_200_000
    private val videoRotation = 90
    private val keyFrameIntervalSeconds = 2

    fun isPublishing(): Boolean = camera.isStreaming

    fun attachPreviewView(view: OpenGlView) {
        if (attachedView !== view) {
            runCatching {
                camera.replaceView(view)
                attachedView = view
                previewStarted = camera.isOnPreview
                if (videoEnabled) camera.glInterface.unMuteVideo() else camera.glInterface.muteVideo()
                if (camera.isStreaming) camera.requestKeyFrame()
            }.onFailure {
                onStateChanged(LiveBroadcastState.RECONNECTING, "Restoring camera preview.")
            }
        }
    }

    fun detachPreviewView() {
        if (attachedView == null) return
        runCatching {
            if (camera.isStreaming) {
                camera.replaceView(context)
                camera.requestKeyFrame()
            } else if (camera.isOnPreview) {
                camera.stopPreview()
            }
        }
        attachedView = null
        previewStarted = camera.isStreaming
    }

    fun startPreview() {
        if (previewStarted || camera.isOnPreview) return
        if (!prepareEncoders()) return
        runCatching {
            camera.startPreview(CameraHelper.Facing.FRONT, videoWidth, videoHeight, videoRotation)
            previewStarted = true
            onStateChanged(LiveBroadcastState.PREVIEW, "Preview ready.")
        }.onFailure { error ->
            previewStarted = false
            onStateChanged(
                LiveBroadcastState.ERROR,
                "Camera preview could not start. ${error::class.java.simpleName}"
            )
        }
    }

    fun stopPreview() {
        runCatching {
            if (camera.isOnPreview) {
                camera.stopPreview()
            }
        }
        previewStarted = false
    }

    fun startPublishing(rtmpsUrl: String, streamKey: String, frontCamera: Boolean, microphoneEnabled: Boolean) {
        if (rtmpsUrl.isBlank() || streamKey.isBlank()) {
            onStateChanged(LiveBroadcastState.ERROR, "Live ingest is missing.")
            return
        }
        if (camera.isStreaming) {
            onStateChanged(LiveBroadcastState.LIVE, "Already Live.")
            return
        }
        publishUrl = buildPublishUrl(rtmpsUrl, streamKey)
        reconnectAttempts = 0
        onStateChanged(LiveBroadcastState.PREPARING_ENCODER, "Preparing camera and microphone.")
        if (!prepareEncoders()) return
        if (!camera.isOnPreview) {
            runCatching {
                camera.startPreview(
                    if (frontCamera) CameraHelper.Facing.FRONT else CameraHelper.Facing.BACK,
                    videoWidth,
                    videoHeight,
                    videoRotation,
                )
                previewStarted = true
            }.onFailure { error ->
                onStateChanged(
                    LiveBroadcastState.ERROR,
                    "Camera preview could not start. ${error::class.java.simpleName}"
                )
                return
            }
        } else if (camera.isFrontCamera != frontCamera) {
            runCatching { camera.switchCamera() }
        }
        if (!microphoneEnabled) camera.disableAudio() else camera.enableAudio()
        onStateChanged(LiveBroadcastState.CONNECTING, "Connecting to Paragon Live.")
        camera.streamClient.setReTries(maxReconnectAttempts)
        camera.startStream(publishUrl)
    }

    fun stopPublishing() {
        onStateChanged(LiveBroadcastState.STOPPING, "Ending Live.")
        if (camera.isStreaming) {
            camera.stopStream()
        }
        stopPreview()
        onStateChanged(LiveBroadcastState.ENDED, "Live ended.")
    }

    fun release() {
        runCatching { if (camera.isStreaming) camera.stopStream() }
        runCatching { if (camera.isOnPreview) camera.stopPreview() }
        previewStarted = false
        encodersPrepared = false
        attachedView = null
    }

    fun switchCamera() {
        runCatching { camera.switchCamera() }
            .onFailure { onStateChanged(LiveBroadcastState.ERROR, "Could not switch camera.") }
    }

    fun setMicrophoneEnabled(enabled: Boolean) {
        if (enabled) camera.enableAudio() else camera.disableAudio()
    }

    fun setCameraEnabled(enabled: Boolean) {
        videoEnabled = enabled
        if (enabled) {
            camera.glInterface.unMuteVideo()
            if (!camera.isOnPreview) startPreview()
        } else {
            camera.glInterface.muteVideo()
        }
    }

    override fun onConnectionStarted(url: String) {
        onStateChanged(LiveBroadcastState.CONNECTING, "Connecting to Paragon Live.")
    }

    override fun onConnectionSuccess() {
        onStateChanged(LiveBroadcastState.LIVE, "Local publisher connected. Preparing viewers.")
    }

    override fun onConnectionFailed(reason: String) {
        if (reconnectAttempts < maxReconnectAttempts && publishUrl.isNotBlank()) {
            reconnectAttempts += 1
            onStateChanged(LiveBroadcastState.RECONNECTING, "Reconnecting Live stream.")
            if (!camera.streamClient.reTry(2_000, reason, publishUrl)) {
                onStateChanged(LiveBroadcastState.ERROR, "Live connection failed.")
            }
        } else {
            onStateChanged(LiveBroadcastState.ERROR, "Live connection failed.")
        }
    }

    override fun onNewBitrate(bitrate: Long) = Unit

    override fun onDisconnect() {
        onStateChanged(LiveBroadcastState.ENDED, "Live disconnected.")
    }

    override fun onAuthError() {
        onStateChanged(LiveBroadcastState.ERROR, "Live authorization failed.")
    }

    override fun onAuthSuccess() = Unit

    private fun buildPublishUrl(rtmpsUrl: String, streamKey: String): String {
        return "${rtmpsUrl.trimEnd('/')}/${streamKey.trimStart('/')}"
    }

    private fun prepareEncoders(): Boolean {
        if (encodersPrepared) return true
        val videoReady = camera.prepareVideo(videoWidth, videoHeight, videoFps, videoBitrate, keyFrameIntervalSeconds, videoRotation)
        val audioReady = camera.prepareAudio()
        encodersPrepared = videoReady && audioReady
        if (!encodersPrepared) {
            onStateChanged(LiveBroadcastState.ERROR, "Could not prepare Live encoder.")
        }
        return encodersPrepared
    }
}
