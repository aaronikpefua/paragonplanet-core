package com.app.natureswayproduction.nativeapp.feature.live.broadcast

import android.content.Context
import android.content.Intent
import android.media.MediaCodecInfo
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.video.CameraHelper
import com.pedro.library.rtmp.RtmpCamera2
import com.pedro.library.view.OpenGlView

class ParagonLiveBroadcaster(
    private val context: Context,
    view: OpenGlView,
    private val onStateChanged: (LiveBroadcastState, String) -> Unit,
) : ConnectChecker {
    // The encoder starts on an application-owned off-screen GL pipeline. A screen surface is only
    // an optional preview consumer and can be replaced without owning the publisher.
    private val camera = RtmpCamera2(context.applicationContext, true, this)
    private var attachedView: OpenGlView? = null
    private var attachedSurfaceReady = false
    private var publishUrl: String = ""
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 3
    private var previewStarted = false
    private var encodersPrepared = false
    private var videoEnabled = true
    private val videoWidth = 1280
    private val videoHeight = 720
    private val videoFps = 30
    private val videoBitrate = 2_200_000
    private val videoRotation = 90
    private val keyFrameIntervalSeconds = 2
    private var liveSessionId = ""
    private var liveMediaGeneration = 0L
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile private var lastEncodedFrameAtMs = 0L
    private var lastSentFrameAtMs = 0L
    private var lastSentVideoFrames = 0L
    private var recoveryAttempts = 0
    private var recoveryInProgress = false
    private var recoveringStreamRestart = false
    private val frameHealthCheck = object : Runnable {
        override fun run() {
            if (!camera.isStreaming) return
            val now = SystemClock.elapsedRealtime()
            val sent = camera.streamClient.getSentVideoFrames()
            if (sent > lastSentVideoFrames) {
                lastSentVideoFrames = sent
                lastSentFrameAtMs = now
                recoveryAttempts = 0
            }
            val encodedStalled = videoEnabled && now - lastEncodedFrameAtMs > FRAME_STALL_MS
            val sentStalled = videoEnabled && now - lastSentFrameAtMs > FRAME_STALL_MS
            Log.i(
                TAG,
                "mediaHealth streaming=${camera.isStreaming} preview=${camera.isOnPreview} " +
                    "sessionId=$liveSessionId mediaGeneration=$liveMediaGeneration videoEnabled=$videoEnabled sentFrames=$sent encodedAgeMs=${now - lastEncodedFrameAtMs} " +
                    "sentAgeMs=${now - lastSentFrameAtMs} recoveryAttempt=$recoveryAttempts"
            )
            if ((encodedStalled || sentStalled) && !recoveryInProgress) recoverVideoPipeline()
            mainHandler.postDelayed(this, HEALTH_INTERVAL_MS)
        }
    }

    init {
        camera.setFpsListener {
            lastEncodedFrameAtMs = SystemClock.elapsedRealtime()
        }
        attachPreviewView(view)
    }

    fun isPublishing(): Boolean = camera.isStreaming

    fun attachPreviewView(view: OpenGlView) {
        val surfaceReady = view.isAttachedToWindow && view.width > 0 && view.height > 0 &&
            view.holder.surface?.isValid == true
        if (!surfaceReady) {
            // Surface callbacks will retry after Android has created and sized the real surface.
            if (attachedView === view) attachedSurfaceReady = false
            return
        }
        if (attachedView !== view || !attachedSurfaceReady) {
            runCatching {
                camera.replaceView(view)
                attachedView = view
                attachedSurfaceReady = true
                previewStarted = camera.isOnPreview
                if (videoEnabled) camera.glInterface.unMuteVideo() else camera.glInterface.muteVideo()
                if (camera.isStreaming) camera.requestKeyFrame()
            }.onFailure {
                attachedSurfaceReady = false
                onStateChanged(LiveBroadcastState.RECONNECTING, "Restoring camera preview.")
            }
        }
    }

    fun detachPreviewView(expectedView: OpenGlView? = null) {
        // Surface destruction from the previous Compose destination can be delivered after the
        // replacement view has already attached. Never let that stale callback detach the new
        // preview (and therefore move the active encoder back to an off-screen GL surface).
        if (expectedView != null && attachedView !== expectedView) return
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
        attachedSurfaceReady = false
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

    fun startPublishing(
        rtmpsUrl: String,
        streamKey: String,
        frontCamera: Boolean,
        microphoneEnabled: Boolean,
        sessionId: String = "",
        mediaGeneration: Long = 0L,
    ) {
        if (rtmpsUrl.isBlank() || streamKey.isBlank()) {
            onStateChanged(LiveBroadcastState.ERROR, "Live ingest is missing.")
            return
        }
        if (camera.isStreaming) {
            onStateChanged(LiveBroadcastState.LIVE, "Already Live.")
            return
        }
        publishUrl = buildPublishUrl(rtmpsUrl, streamKey)
        liveSessionId = sessionId
        liveMediaGeneration = mediaGeneration
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
        ContextCompat.startForegroundService(
            context.applicationContext,
            Intent(context.applicationContext, LiveBroadcastForegroundService::class.java),
        )
        camera.startStream(publishUrl)
    }

    fun stopPublishing() {
        onStateChanged(LiveBroadcastState.STOPPING, "Ending Live.")
        if (camera.isStreaming) {
            camera.stopStream()
        }
        stopPreview()
        stopForegroundOwner()
        stopFrameHealth()
        onStateChanged(LiveBroadcastState.ENDED, "Live ended.")
    }

    fun release() {
        runCatching { if (camera.isStreaming) camera.stopStream() }
        runCatching { if (camera.isOnPreview) camera.stopPreview() }
        previewStarted = false
        encodersPrepared = false
        attachedView = null
        attachedSurfaceReady = false
        stopForegroundOwner()
        stopFrameHealth()
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
        val now = SystemClock.elapsedRealtime()
        lastEncodedFrameAtMs = now
        lastSentFrameAtMs = now
        lastSentVideoFrames = camera.streamClient.getSentVideoFrames()
        recoveryAttempts = 0
        recoveryInProgress = false
        recoveringStreamRestart = false
        mainHandler.removeCallbacks(frameHealthCheck)
        mainHandler.postDelayed(frameHealthCheck, HEALTH_INTERVAL_MS)
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

    override fun onNewBitrate(bitrate: Long) {
        Log.i(
            TAG,
            "publisherStats width=$videoWidth height=$videoHeight fps=$videoFps " +
                "targetBitrate=$videoBitrate actualBitrate=$bitrate codec=H264-baseline level=3.1 " +
                "gopSeconds=$keyFrameIntervalSeconds encoderImplementation=rootencoder-mediacodec " +
                "sessionId=$liveSessionId mediaGeneration=$liveMediaGeneration sentFrames=${camera.streamClient.getSentVideoFrames()}"
        )
    }

    override fun onDisconnect() {
        stopFrameHealth()
        if (recoveringStreamRestart) {
            onStateChanged(LiveBroadcastState.RECONNECTING, "Restarting Live video frames.")
        } else {
            onStateChanged(LiveBroadcastState.ENDED, "Live disconnected.")
        }
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
        // AVC Baseline prevents B-frame reordering; RootEncoder selects CBR when the device codec
        // supports it. Together with the 2s GOP this is the Cloudflare LL-HLS-safe profile.
        val videoReady = camera.prepareVideo(
            videoWidth,
            videoHeight,
            videoFps,
            videoBitrate,
            keyFrameIntervalSeconds,
            videoRotation,
            MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline,
            MediaCodecInfo.CodecProfileLevel.AVCLevel31,
        )
        val audioReady = camera.prepareAudio()
        encodersPrepared = videoReady && audioReady
        if (!encodersPrepared) {
            onStateChanged(LiveBroadcastState.ERROR, "Could not prepare Live encoder.")
        }
        return encodersPrepared
    }

    private fun recoverVideoPipeline() {
        recoveryInProgress = true
        recoveryAttempts += 1
        Log.w(TAG, "Video frame progression stalled; recovery attempt=$recoveryAttempts")
        onStateChanged(LiveBroadcastState.RECONNECTING, "Restoring Live camera frames.")
        val preview = attachedView
        runCatching {
            // replaceView closes/reopens Camera2 and rebinds the encoder input surface.
            camera.replaceView(context.applicationContext)
            if (preview != null && preview.isAttachedToWindow && preview.holder.surface?.isValid == true) {
                camera.replaceView(preview)
                attachedView = preview
                attachedSurfaceReady = true
            } else {
                attachedView = null
                attachedSurfaceReady = false
            }
            camera.requestKeyFrame()
        }.onFailure {
            onStateChanged(LiveBroadcastState.RECONNECTING, "Camera frame recovery is retrying.")
        }
        mainHandler.postDelayed({
            val now = SystemClock.elapsedRealtime()
            val sentFrames = camera.streamClient.getSentVideoFrames()
            val framesHealthy = sentFrames > lastSentVideoFrames &&
                now - lastEncodedFrameAtMs <= FRAME_STALL_MS
            if (framesHealthy) {
                lastSentVideoFrames = sentFrames
                lastSentFrameAtMs = now
                recoveryAttempts = 0
                Log.i(TAG, "Video frame progression recovered; sentFrames=$sentFrames")
                onStateChanged(LiveBroadcastState.LIVE, "Live camera frames restored.")
            } else if (recoveryAttempts == 1 && publishUrl.isNotBlank() && camera.isStreaming) {
                // A connected RTMP socket can outlive a dead encoder surface. Restart only the
                // publisher pipeline against the same input; never create a new Paragon session.
                recoveringStreamRestart = true
                Log.w(TAG, "Camera/GL rebind did not restore frames; restarting same RTMP publisher")
                camera.stopStream()
                mainHandler.postDelayed({
                    runCatching {
                        camera.startStream(publishUrl)
                        camera.requestKeyFrame()
                    }.onFailure {
                        onStateChanged(LiveBroadcastState.ERROR, "Live video frames could not recover.")
                    }
                }, RESTART_DELAY_MS)
            } else if (recoveryAttempts > 1) {
                onStateChanged(LiveBroadcastState.ERROR, "Live video frames stopped. End Live and try again.")
            }
            recoveryInProgress = false
        }, RECOVERY_VERIFY_MS)
    }

    private fun stopFrameHealth() {
        mainHandler.removeCallbacks(frameHealthCheck)
        recoveryInProgress = false
    }

    private fun stopForegroundOwner() {
        context.applicationContext.stopService(
            Intent(context.applicationContext, LiveBroadcastForegroundService::class.java)
        )
    }

    companion object {
        const val TAG = "ParagonLiveMedia"
        private const val HEALTH_INTERVAL_MS = 2_000L
        private const val FRAME_STALL_MS = 7_000L
        private const val RECOVERY_VERIFY_MS = 3_000L
        private const val RESTART_DELAY_MS = 750L
    }
}
