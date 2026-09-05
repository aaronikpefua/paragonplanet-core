package com.app.natureswayproduction.nativeapp.feature.live

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import android.view.Surface
import android.view.SurfaceHolder
import android.view.TextureView
import android.webkit.CookieManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.api.LiveChatMessage
import com.app.natureswayproduction.nativeapp.data.api.LiveSession
import com.app.natureswayproduction.nativeapp.data.api.StartLiveResult
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.app.natureswayproduction.nativeapp.feature.live.broadcast.LiveBroadcastState
import com.app.natureswayproduction.nativeapp.feature.live.broadcast.ParagonLiveBroadcaster
import com.google.firebase.auth.FirebaseAuth
import com.pedro.library.view.OpenGlView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.app.natureswayproduction.BuildConfig
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack
import org.webrtc.audio.JavaAudioDeviceModule
import org.webrtc.RendererCommon
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

private val liveTabs = listOf("Live Now", "Upcoming", "Following", "Replays")
private const val LIVE_NOW_REFRESH_MS = 7_000L
private const val LIVE_REPLAY_REFRESH_MS = 15_000L
private const val LIVE_SLOW_REFRESH_MS = 30_000L
private const val LIVE_CHAT_REFRESH_MS = 4_000L

private val livePurposesByRole = mapOf(
    "CITIZEN" to listOf("Campaign for Votes", "Live Performance", "Audience Q&A", "Why I Should Qualify", "Qualification Update", "Live Together"),
    "PROMOTER" to listOf("Promote a Citizen", "Citizen Interview", "Vote Campaign", "Audience Discussion", "Live Together"),
    "AMBASSADOR" to listOf("Promote a Citizen", "Citizen Interview", "Vote Campaign", "Audience Discussion", "Live Together"),
    "BACKER" to listOf("Sector Discussion", "Q&A", "Knowledge Challenge", "Service Promotion", "Live Together"),
    "SUPERNAL" to listOf("Expert Discussion", "Public Q&A", "Knowledge Challenge", "Professional Presentation", "Live Together"),
    "SUPERBOSS" to listOf("Expert Discussion", "Public Q&A", "Knowledge Challenge", "Professional Presentation", "Live Together"),
    "MERCHANT" to listOf("Product Demonstration", "Product Launch", "Buyer Q&A", "Marketplace Promotion"),
)

private enum class LiveSupportMode {
    VOTE,
    WATER,
    SPRAY,
    BOTTLE,
}

private data class LiveSprayChoice(
    val key: String,
    val amount: Int,
    val currency: String,
)

private data class LiveBottleChoice(
    val key: String,
    val icon: String,
    val title: String,
    val costLabel: String,
    val paragAmount: Int? = null,
    val gbaziloAmount: Int? = null,
)

private val liveSprayChoices = listOf(
    LiveSprayChoice("p1", 1, "PARAG"),
    LiveSprayChoice("g1", 1, "GBAZILO"),
    LiveSprayChoice("p10", 10, "PARAG"),
    LiveSprayChoice("g10", 10, "GBAZILO"),
    LiveSprayChoice("p50", 50, "PARAG"),
    LiveSprayChoice("g50", 50, "GBAZILO"),
    LiveSprayChoice("p100", 100, "PARAG"),
    LiveSprayChoice("g100", 100, "GBAZILO"),
)

private val liveBottleChoices = listOf(
    LiveBottleChoice("mineral", "🥤", "Mineral", "2 PARAG", paragAmount = 2),
    LiveBottleChoice("malt", "🥛", "Malt", "3 PARAG", paragAmount = 3),
    LiveBottleChoice("juice", "🧃", "Juice", "4 PARAG", paragAmount = 4),
    LiveBottleChoice("mocktail", "🍹", "Mocktail", "5 PARAG", paragAmount = 5),
    LiveBottleChoice("beer", "🍺", "Beer", "6 PARAG", paragAmount = 6),
    LiveBottleChoice("gin", "🍸", "Gin", "7 PARAG", paragAmount = 7),
    LiveBottleChoice("rum", "🥃", "Rum", "8 PARAG", paragAmount = 8),
    LiveBottleChoice("whiskey", "🥃", "Whisky", "1 GBAZILO", gbaziloAmount = 1),
    LiveBottleChoice("vodka", "🍸", "Vodka", "9 PARAG", paragAmount = 9),
    LiveBottleChoice("cocktail", "🍸", "Cocktail", "G1 P2", paragAmount = 2, gbaziloAmount = 1),
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ParagonLiveScreen(
    currentRole: String?,
    onBackHome: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val apiService = remember { ParagonApiService() }
    val appCheckRepository = remember { AppCheckRepository() }
    val firebaseAuth = remember { FirebaseAuth.getInstance() }
    val normalizedRole = currentRole.orEmpty().trim().uppercase()
    val livePurposes = livePurposesByRole[normalizedRole].orEmpty()
    var selectedTab by remember { mutableStateOf(liveTabs.first()) }
    var showGoLivePurposes by remember { mutableStateOf(false) }
    var selectedPurpose by remember { mutableStateOf<String?>(null) }
    var liveTitle by remember { mutableStateOf("") }
    var liveDescription by remember { mutableStateOf("") }
    var scheduleDate by remember { mutableStateOf("") }
    var scheduleTime by remember { mutableStateOf("") }
    var showPreview by remember { mutableStateOf(false) }
    var cameraEnabled by remember { mutableStateOf(true) }
    var microphoneEnabled by remember { mutableStateOf(true) }
    var cameraLensFacing by remember { mutableStateOf(CameraCharacteristics.LENS_FACING_FRONT) }
    var permissionsRequested by remember { mutableStateOf(false) }
    var cameraReady by remember { mutableStateOf(context.hasPermission(Manifest.permission.CAMERA)) }
    var microphoneReady by remember { mutableStateOf(context.hasPermission(Manifest.permission.RECORD_AUDIO)) }
    var statusMessage by remember { mutableStateOf("") }
    var startLiveResult by remember { mutableStateOf<StartLiveResult?>(null) }
    var isStartingLive by remember { mutableStateOf(false) }
    var liveBroadcaster by remember { mutableStateOf<ParagonLiveBroadcaster?>(null) }
    var broadcastState by remember { mutableStateOf(LiveBroadcastState.IDLE) }
    var activeSessionMarked by remember { mutableStateOf(false) }
    var liveSessions by remember { mutableStateOf<List<LiveSession>>(emptyList()) }
    var isLoadingSessions by remember { mutableStateOf(false) }
    var selectedViewerSession by remember { mutableStateOf<LiveSession?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        permissionsRequested = true
        cameraReady = result[Manifest.permission.CAMERA] == true || context.hasPermission(Manifest.permission.CAMERA)
        microphoneReady = result[Manifest.permission.RECORD_AUDIO] == true || context.hasPermission(Manifest.permission.RECORD_AUDIO)
        showPreview = cameraReady && microphoneReady
        statusMessage = when {
            showPreview -> "Preview ready. Live streaming service is not configured yet."
            !cameraReady && !microphoneReady -> "Camera and microphone access are required to preview your Live. Enable them in Android Settings if permission was denied."
            !cameraReady -> "Camera access is required to preview your Live."
            else -> "Microphone access is required to preview your Live."
        }
    }

    LaunchedEffect(Unit) {
        cameraReady = context.hasPermission(Manifest.permission.CAMERA)
        microphoneReady = context.hasPermission(Manifest.permission.RECORD_AUDIO)
    }

    LaunchedEffect(selectedTab) {
        selectedViewerSession = null
    }

    LaunchedEffect(selectedTab, activeSessionMarked, selectedViewerSession?.id) {
        val user = firebaseAuth.currentUser ?: return@LaunchedEffect
        var firstLoad = true
        while (true) {
            if (selectedViewerSession != null) {
                delay(LIVE_SLOW_REFRESH_MS)
                continue
            }
            if (firstLoad) isLoadingSessions = true
            runCatching {
                val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                apiService.listParagonLiveSessions(token, appCheck, selectedTab).sessions
            }.onSuccess { sessions ->
                liveSessions = sessions
                selectedViewerSession?.let { selected ->
                    selectedViewerSession = sessions.firstOrNull { it.id == selected.id }
                }
            }.onFailure {
                if (firstLoad) liveSessions = emptyList()
            }
            isLoadingSessions = false
            firstLoad = false
            delay(
                when (selectedTab) {
                    "Live Now" -> LIVE_NOW_REFRESH_MS
                    "Replays" -> LIVE_REPLAY_REFRESH_MS
                    else -> LIVE_SLOW_REFRESH_MS
                }
            )
        }
    }

    LaunchedEffect(broadcastState, startLiveResult?.session?.id) {
        val sessionId = startLiveResult?.session?.id ?: return@LaunchedEffect
        if (broadcastState != LiveBroadcastState.LIVE) return@LaunchedEffect
        while (true) {
            runCatching {
                val user = firebaseAuth.currentUser ?: error("Sign in first.")
                val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                apiService.heartbeatParagonLive(token, appCheck, sessionId)
            }.onSuccess { activeSession ->
                startLiveResult = startLiveResult?.copy(session = activeSession)
            }
            delay(15_000)
        }
    }

    selectedViewerSession?.takeIf { selectedTab == "Live Now" }?.let { session ->
        LiveRoomViewer(
            session = session,
            onClose = { selectedViewerSession = null },
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("🔴 PARAGON LIVE", color = Color(0xFFD8A928), fontSize = 13.sp, fontWeight = FontWeight.Black)
                Text(if (showPreview) "Live Preview" else "Paragon Live Home", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
            }
            OutlinedButton(onClick = if (showPreview || selectedPurpose != null) {
                {
                    liveBroadcaster?.stopPublishing()
                    liveBroadcaster = null
                    broadcastState = LiveBroadcastState.IDLE
                    showPreview = false
                    selectedPurpose = null
                    statusMessage = ""
                }
            } else onBackHome) {
                Text(if (showPreview || selectedPurpose != null) "Back" else "Home")
            }
        }

        if (showPreview && selectedPurpose != null) {
            LivePreviewPanel(
                role = normalizedRole.displayRole(),
                purpose = selectedPurpose.orEmpty(),
                title = liveTitle,
                cameraReady = cameraReady,
                microphoneReady = microphoneReady,
                cameraLensFacing = cameraLensFacing,
                cameraEnabled = cameraEnabled,
                microphoneEnabled = microphoneEnabled,
                providerConfigured = startLiveResult?.provider?.configured == true,
                isStartingLive = isStartingLive,
                broadcastState = broadcastState,
                startLiveResult = startLiveResult,
                statusMessage = statusMessage.ifBlank { "Live streaming service is not configured yet." },
                onBroadcasterReady = { liveBroadcaster = it },
                onToggleCamera = {
                    val next = !cameraEnabled
                    cameraEnabled = next
                    liveBroadcaster?.setCameraEnabled(next)
                },
                onToggleMicrophone = {
                    val next = !microphoneEnabled
                    microphoneEnabled = next
                    liveBroadcaster?.setMicrophoneEnabled(next)
                },
                onFlipCamera = {
                    val newFacing = if (cameraLensFacing == CameraCharacteristics.LENS_FACING_FRONT) {
                        CameraCharacteristics.LENS_FACING_BACK
                    } else {
                        CameraCharacteristics.LENS_FACING_FRONT
                    }
                    cameraLensFacing = newFacing
                    statusMessage = if (newFacing == CameraCharacteristics.LENS_FACING_FRONT) {
                        "Front camera selected."
                    } else {
                        "Back camera selected."
                    }
                    liveBroadcaster?.switchCamera()
                },
                onGoLive = {
                    if (isStartingLive) return@LivePreviewPanel
                    val existingResult = startLiveResult
                    if (
                        existingResult?.ingest?.rtmpsUrl?.isNotBlank() == true &&
                        existingResult.ingest.rtmpsStreamKey.isNotBlank()
                    ) {
                        liveBroadcaster?.startPublishing(
                            rtmpsUrl = existingResult.ingest.rtmpsUrl,
                            streamKey = existingResult.ingest.rtmpsStreamKey,
                            frontCamera = cameraLensFacing == CameraCharacteristics.LENS_FACING_FRONT,
                            microphoneEnabled = microphoneEnabled,
                        )
                        return@LivePreviewPanel
                    }
                    isStartingLive = true
                    broadcastState = LiveBroadcastState.CREATING_SESSION
                    statusMessage = "Creating Paragon Live session..."
                    scope.launch {
                        runCatching {
                            val user = firebaseAuth.currentUser ?: error("Sign in first.")
                            val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                            val appCheck = appCheckRepository.getToken(forceRefresh = false)
                            apiService.startParagonLive(
                                idToken = token,
                                appCheckToken = appCheck,
                                hostRole = normalizedRole,
                                purpose = selectedPurpose.orEmpty(),
                                title = liveTitle.ifBlank { selectedPurpose.orEmpty() },
                                description = liveDescription,
                            )
                        }.onSuccess { result ->
                            startLiveResult = result
                            statusMessage = "Connecting Live broadcast..."
                            liveBroadcaster?.startPublishing(
                                rtmpsUrl = result.ingest.rtmpsUrl,
                                streamKey = result.ingest.rtmpsStreamKey,
                                frontCamera = cameraLensFacing == CameraCharacteristics.LENS_FACING_FRONT,
                                microphoneEnabled = microphoneEnabled,
                            )
                        }.onFailure { error ->
                            broadcastState = LiveBroadcastState.ERROR
                            statusMessage = if (error.message?.contains("configured", ignoreCase = true) == true) {
                                "Live streaming service is not configured yet."
                            } else {
                                error.message ?: "Could not start Paragon Live."
                            }
                        }
                        isStartingLive = false
                    }
                },
                onEndLive = {
                    liveBroadcaster?.stopPublishing()
                    startLiveResult?.session?.id?.takeIf { it.isNotBlank() }?.let { sessionId ->
                        scope.launch {
                            runCatching {
                                val user = firebaseAuth.currentUser ?: error("Sign in first.")
                                val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                                apiService.endParagonLive(token, appCheck, sessionId)
                            }
                        }
                    }
                    activeSessionMarked = false
                    startLiveResult = null
                    showPreview = false
                },
                onCancel = {
                    liveBroadcaster?.stopPublishing()
                    showPreview = false
                },
                onBroadcastStateChanged = { state, message ->
                    broadcastState = state
                    statusMessage = message
                },
            )
            DisposableEffect(Unit) {
                onDispose {
                    liveBroadcaster?.release()
                    liveBroadcaster = null
                    broadcastState = LiveBroadcastState.IDLE
                }
            }
            LaunchedEffect(broadcastState, startLiveResult?.session?.id) {
                val sessionId = startLiveResult?.session?.id.orEmpty()
                if (broadcastState == LiveBroadcastState.LIVE && sessionId.isNotBlank() && !activeSessionMarked) {
                    activeSessionMarked = true
                    statusMessage = "Cloudflare is confirming your Live stream..."
                    var markedLive = false
                    var providerConnected = false
                    var lastError: Throwable? = null
                    repeat(10) { attempt ->
                        if (markedLive) return@repeat
                        runCatching {
                            val user = firebaseAuth.currentUser ?: error("Sign in first.")
                            val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                            val appCheck = appCheckRepository.getToken(forceRefresh = false)
                            apiService.markParagonLiveActive(token, appCheck, sessionId)
                        }.onSuccess { activeSession ->
                            providerConnected = activeSession.providerLive
                            startLiveResult = startLiveResult?.copy(session = activeSession)
                            if (activeSession.viewerPlayable) {
                                markedLive = true
                                statusMessage = "You are Live."
                            } else if (activeSession.providerLive) {
                                statusMessage = "Provider connected. Preparing viewers... ${attempt + 1}/10"
                            } else {
                                statusMessage = "Waiting for Cloudflare ingest confirmation... ${attempt + 1}/10"
                            }
                            if (!markedLive) delay(3_000)
                        }.onFailure { error ->
                            lastError = error
                            statusMessage = "Waiting for Cloudflare Live confirmation... ${attempt + 1}/10"
                            delay(3_000)
                        }
                    }
                    if (!markedLive && !providerConnected) {
                        activeSessionMarked = false
                        statusMessage = lastError?.message ?: "Cloudflare has not confirmed this Live input is active yet."
                    } else if (!markedLive) {
                        statusMessage = "Provider connected. Preparing viewers..."
                    }
                }
            }
            return@Column
        }

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            liveTabs.forEach { tab ->
                Button(
                    onClick = { selectedTab = tab },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (selectedTab == tab) Color(0xFFD8A928) else Color(0xFF152033),
                        contentColor = if (selectedTab == tab) Color.Black else Color.White,
                    ),
                    shape = RoundedCornerShape(999.dp),
                ) {
                    Text(tab, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (livePurposes.isNotEmpty()) {
            Button(
                onClick = { showGoLivePurposes = !showGoLivePurposes },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD8A928), contentColor = Color.Black),
                shape = RoundedCornerShape(999.dp),
            ) {
                Text("+ Go Live", fontWeight = FontWeight.Black)
            }
        }

        if (showGoLivePurposes && selectedPurpose == null) {
            Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFF101820), shape = RoundedCornerShape(22.dp)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Choose Live purpose", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    livePurposes.forEach { purpose ->
                        Button(
                            onClick = {
                                selectedPurpose = purpose
                                liveTitle = purpose
                                statusMessage = "Live setup ready. Add a title and preview before going Live."
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF050505), contentColor = Color.White),
                            shape = RoundedCornerShape(16.dp),
                        ) {
                            Text(purpose, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            }
        }

        selectedPurpose?.let { purpose ->
            LiveSetupPanel(
                role = normalizedRole.displayRole(),
                purpose = purpose,
                title = liveTitle,
                description = liveDescription,
                scheduleDate = scheduleDate,
                scheduleTime = scheduleTime,
                cameraReady = cameraReady,
                microphoneReady = microphoneReady,
                permissionsRequested = permissionsRequested,
                statusMessage = statusMessage,
                onTitleChange = { liveTitle = it },
                onDescriptionChange = { liveDescription = it },
                onScheduleDateChange = { scheduleDate = it },
                onScheduleTimeChange = { scheduleTime = it },
                onPreview = {
                    if (!cameraReady || !microphoneReady) {
                        permissionsRequested = true
                        permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
                    } else {
                        showPreview = true
                        statusMessage = "Preview ready. Live streaming service is not configured yet."
                    }
                },
                onSchedule = {
                    val scheduledAt = buildScheduledIso(scheduleDate, scheduleTime)
                    if (scheduledAt.isBlank()) {
                        statusMessage = "Enter a valid future date and time to schedule Live."
                    } else {
                        scope.launch {
                            runCatching {
                                val user = firebaseAuth.currentUser ?: error("Sign in first.")
                                val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                                apiService.scheduleParagonLive(
                                    idToken = token,
                                    appCheckToken = appCheck,
                                    hostRole = normalizedRole,
                                    purpose = purpose,
                                    title = liveTitle.ifBlank { purpose },
                                    description = liveDescription,
                                    scheduledAt = scheduledAt,
                                )
                            }.onSuccess {
                                selectedTab = "Upcoming"
                                selectedPurpose = null
                                showGoLivePurposes = false
                                statusMessage = "Live scheduled."
                            }.onFailure { error ->
                                statusMessage = error.message ?: "Could not schedule Live."
                            }
                        }
                    }
                },
            )
        }

        LiveSessionsPanel(
            tab = selectedTab,
            sessions = liveSessions,
            loading = isLoadingSessions,
            selectedViewerSession = selectedViewerSession,
            onSelectSession = { selectedViewerSession = it },
            canHostLive = livePurposes.isNotEmpty(),
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun LiveSetupPanel(
    role: String,
    purpose: String,
    title: String,
    description: String,
    scheduleDate: String,
    scheduleTime: String,
    cameraReady: Boolean,
    microphoneReady: Boolean,
    permissionsRequested: Boolean,
    statusMessage: String,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onScheduleDateChange: (String) -> Unit,
    onScheduleTimeChange: (String) -> Unit,
    onPreview: () -> Unit,
    onSchedule: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFF101820), shape = RoundedCornerShape(22.dp)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("PARAGON LIVE SETUP", color = Color(0xFFD8A928), fontWeight = FontWeight.Black)
            Text("Role: $role", color = Color.White, fontWeight = FontWeight.Bold)
            Text("Purpose: $purpose", color = Color.White, fontWeight = FontWeight.Bold)
            Text("Audience: Public", color = Color.White)
            OutlinedTextField(value = title, onValueChange = onTitleChange, label = { Text("Live Title") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = description, onValueChange = onDescriptionChange, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
            Text("Optional schedule", color = Color(0xFFD8A928), fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = scheduleDate,
                    onValueChange = onScheduleDateChange,
                    label = { Text("Date YYYY-MM-DD") },
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = scheduleTime,
                    onValueChange = onScheduleTimeChange,
                    label = { Text("Time HH:MM") },
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                "Camera: ${permissionLabel(cameraReady, permissionsRequested)}",
                color = if (cameraReady) Color(0xFF8BFFB0) else Color(0xFFFFD166)
            )
            Text(
                "Microphone: ${permissionLabel(microphoneReady, permissionsRequested)}",
                color = if (microphoneReady) Color(0xFF8BFFB0) else Color(0xFFFFD166)
            )
            if (statusMessage.isNotBlank()) Text(statusMessage, color = Color(0xFFEAD9B8), fontSize = 12.sp)
            Button(
                onClick = onPreview,
                enabled = title.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD8A928), contentColor = Color.Black),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Preview Live", fontWeight = FontWeight.Black)
            }
            Button(
                onClick = onSchedule,
                enabled = title.isNotBlank() && scheduleDate.isNotBlank() && scheduleTime.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD8A928), contentColor = Color.Black),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Schedule Live", fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun LivePreviewPanel(
    role: String,
    purpose: String,
    title: String,
    cameraReady: Boolean,
    microphoneReady: Boolean,
    cameraLensFacing: Int,
    cameraEnabled: Boolean,
    microphoneEnabled: Boolean,
    providerConfigured: Boolean,
    isStartingLive: Boolean,
    broadcastState: LiveBroadcastState,
    startLiveResult: StartLiveResult?,
    statusMessage: String,
    onBroadcasterReady: (ParagonLiveBroadcaster) -> Unit,
    onToggleCamera: () -> Unit,
    onToggleMicrophone: () -> Unit,
    onFlipCamera: () -> Unit,
    onGoLive: () -> Unit,
    onEndLive: () -> Unit,
    onCancel: () -> Unit,
    onBroadcastStateChanged: (LiveBroadcastState, String) -> Unit,
) {
    val context = LocalContext.current
    val rootView = LocalView.current
    DisposableEffect(Unit) {
        val previousKeepScreenOn = rootView.keepScreenOn
        rootView.keepScreenOn = true
        onDispose { rootView.keepScreenOn = previousKeepScreenOn }
    }
    Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFF101820), shape = RoundedCornerShape(22.dp)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(360.dp)
                    .background(Color.Black, RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (cameraReady) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { viewContext ->
                            OpenGlView(viewContext).also { previewView ->
                                previewView.keepScreenOn = true
                                val broadcaster = ParagonLiveBroadcaster(
                                    context = context.applicationContext,
                                    view = previewView,
                                    onStateChanged = onBroadcastStateChanged,
                                )
                                onBroadcasterReady(broadcaster)
                                var previewStarted = false
                                fun startWhenReady() {
                                    if (previewStarted) return
                                    previewView.post {
                                        if (
                                            !previewStarted &&
                                            previewView.isAttachedToWindow &&
                                            previewView.width > 0 &&
                                            previewView.height > 0 &&
                                            previewView.holder.surface?.isValid == true
                                        ) {
                                            previewStarted = true
                                            broadcaster.startPreview()
                                        }
                                    }
                                }
                                previewView.holder.addCallback(object : SurfaceHolder.Callback {
                                    override fun surfaceCreated(holder: SurfaceHolder) {
                                        startWhenReady()
                                    }

                                    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                                        startWhenReady()
                                    }

                                    override fun surfaceDestroyed(holder: SurfaceHolder) {
                                        previewStarted = false
                                        broadcaster.stopPreview()
                                    }
                                })
                                previewView.addOnAttachStateChangeListener(object : android.view.View.OnAttachStateChangeListener {
                                    override fun onViewAttachedToWindow(view: android.view.View) {
                                        startWhenReady()
                                    }

                                    override fun onViewDetachedFromWindow(view: android.view.View) {
                                        previewStarted = false
                                        broadcaster.release()
                                    }
                                })
                                startWhenReady()
                            }
                        }
                    )
                    if (!cameraEnabled) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.Black.copy(alpha = 0.72f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("Camera preview is off", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                    DisposableEffect(Unit) {
                        onDispose {
                            onBroadcastStateChanged(LiveBroadcastState.STOPPING, "Closing Live preview.")
                        }
                    }
                } else {
                    Text("Camera preview is off", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
            Text("@$role host", color = Color(0xFFD8A928), fontWeight = FontWeight.Black)
            Text(title.ifBlank { purpose }, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text("Purpose: $purpose", color = Color(0xFFEAD9B8))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(onClick = onToggleMicrophone) { Text(if (microphoneEnabled) "🎤 Mute" else "🎤 Unmute") }
                OutlinedButton(onClick = onToggleCamera) { Text(if (cameraEnabled) "📹 Camera Off" else "📹 Camera On") }
                OutlinedButton(onClick = onFlipCamera) { Text("🔄 Flip") }
                OutlinedButton(onClick = onCancel) { Text("Cancel") }
            }
            startLiveResult?.let { result ->
                Text("Session: ${result.session.status}", color = Color(0xFF8BFFB0), fontWeight = FontWeight.Bold)
                Text(
                    "Provider: ${result.session.providerState ?: if (result.session.providerLive) "INGEST_CONNECTED" else "WAITING_FOR_INGEST"}",
                    color = Color(0xFF8BFFB0),
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Viewer: ${if (result.session.viewerPlayable) "READY" else "PREPARING"}",
                    color = Color(0xFF8BFFB0),
                    fontWeight = FontWeight.Bold,
                )
            }
            Text("Local publisher: ${broadcastState.name}", color = Color(0xFF8BFFB0), fontWeight = FontWeight.Bold)
            Text(statusMessage, color = Color(0xFFFFD166), fontWeight = FontWeight.Bold)
            if (startLiveResult?.session?.viewerPlayable == true) {
                startLiveResult?.session?.id?.takeIf { it.isNotBlank() }?.let { sessionId ->
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color.Black.copy(alpha = 0.34f),
                        shape = RoundedCornerShape(18.dp),
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Live Chat", color = Color(0xFFD8A928), fontWeight = FontWeight.Black)
                            LiveChatOverlay(sessionId = sessionId)
                        }
                    }
                }
            }
            if (broadcastState == LiveBroadcastState.LIVE || broadcastState == LiveBroadcastState.CONNECTING || broadcastState == LiveBroadcastState.RECONNECTING) {
                Button(
                    onClick = onEndLive,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB91C1C), contentColor = Color.White),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("END LIVE", fontWeight = FontWeight.Black)
                }
            } else {
                Button(
                    onClick = onGoLive,
                    enabled = cameraReady && microphoneReady && !isStartingLive,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD8A928), contentColor = Color.Black),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (isStartingLive) "STARTING..." else "GO LIVE", fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun LiveSessionsPanel(
    tab: String,
    sessions: List<LiveSession>,
    loading: Boolean,
    selectedViewerSession: LiveSession?,
    onSelectSession: (LiveSession?) -> Unit,
    canHostLive: Boolean,
) {
    Surface(modifier = Modifier.fillMaxWidth(), color = Color(0xFF0D0D0D), shape = RoundedCornerShape(24.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(tab, color = Color(0xFFD8A928), fontWeight = FontWeight.Black)
            selectedViewerSession?.let { selectedSession ->
                val selectedPlayback = selectedSession.selectedPlaybackUrl.orEmpty()
                val selectedTransport = selectedSession.selectedPlaybackTransport.orEmpty().lowercase()
                val usesWhep = tab != "Replays" && selectedTransport == "whep" && selectedPlayback.isNotBlank()
                val usesHls = selectedTransport == "hls" && selectedPlayback.isNotBlank()
                val viewerPath = when {
                    usesWhep -> "WHEP/WebRTC"
                    usesHls -> "HLS/Media3"
                    else -> "unavailable"
                }
                LaunchedEffect(selectedSession.id, viewerPath) {
                    logLiveViewerSelection(selectedSession, selectedPlayback.takeIf { usesHls }, selectedPlayback.takeIf { usesWhep }, viewerPath)
                }
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF101820),
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        LiveViewerHeader(tab = tab, session = selectedSession)
                        if (usesWhep) {
                            NativeWhepPlaybackPlayer(
                                whepUrl = selectedPlayback,
                            )
                        } else if (usesHls) {
                            LivePlaybackPlayer(playbackUrl = selectedPlayback)
                        } else if (selectedPlayback.isBlank()) {
                            Text(
                                "Preparing Live stream...",
                                color = Color(0xFFFFD166),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        if (tab != "Replays") {
                            LiveAudienceActionBar()
                        }
                    }
                }
            }
            when {
                loading -> Text("Loading Paragon Live...", color = Color.White, fontWeight = FontWeight.Bold)
                sessions.isEmpty() -> {
                    Text(emptyLiveMessageForTab(tab), color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    if (!canHostLive) {
                        Text(
                            "You can watch Paragon Live. Go Live is available to Citizens, Ambassadors, Backers, Superbosses, and Merchants.",
                            color = Color(0xFFB8C0CC),
                            fontSize = 13.sp,
                        )
                    }
                }
                else -> {
                    sessions.filterNot { session ->
                        selectedViewerSession?.id == session.id
                    }.forEach { session ->
                        val isReplay = tab == "Replays"
                        val isUpcoming = tab == "Upcoming"
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = Color(0xFF101820),
                            shape = RoundedCornerShape(18.dp),
                        ) {
                            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(liveCardStatusLabel(tab, session.status), color = Color(0xFFFFD166), fontWeight = FontWeight.Black)
                                Text("@${session.hostUsername}", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                Text("${session.hostRole.displayRole()} · ${session.purpose}", color = Color(0xFFEAD9B8), fontWeight = FontWeight.Bold)
                                Text(session.title, color = Color.White)
                                if (session.description.isNotBlank()) {
                                    Text(session.description, color = Color(0xFFB8C0CC), fontSize = 13.sp)
                                }
                                if (isUpcoming) {
                                    Text(formatLiveSchedule(session.scheduledAt), color = Color(0xFFFFD166), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                } else {
                                    Text(
                                        if (session.providerLive && !session.viewerPlayable) "Preparing Live stream..." else formatLiveDateForTab(tab, session),
                                        color = Color(0xFFFFD166),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                    )
                                    Button(
                                        onClick = { onSelectSession(if (selectedViewerSession?.id == session.id) null else session) },
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD8A928), contentColor = Color.Black),
                                    ) {
                                        Text(
                                            if (selectedViewerSession?.id == session.id) "Hide Stream" else if (isReplay) "Watch Replay" else if (session.providerLive && !session.viewerPlayable) "Open Live" else "Watch Live",
                                            fontWeight = FontWeight.Black,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LiveRoomViewer(
    session: LiveSession,
    onClose: () -> Unit,
) {
    val rootView = LocalView.current
    val scope = rememberCoroutineScope()
    val apiService = remember { ParagonApiService() }
    val appCheckRepository = remember { AppCheckRepository() }
    val firebaseAuth = remember { FirebaseAuth.getInstance() }
    val selectedPlayback = session.selectedPlaybackUrl.orEmpty()
    val selectedTransport = session.selectedPlaybackTransport.orEmpty().lowercase()
    val usesWhep = selectedTransport == "whep" && selectedPlayback.isNotBlank()
    val usesHls = selectedTransport == "hls" && selectedPlayback.isNotBlank()
    val viewerPath = when {
        usesWhep -> "WHEP/WebRTC"
        usesHls -> "HLS/Media3"
        else -> "unavailable"
    }
    var supportNotice by remember(session.id) { mutableStateOf("") }
    var supportMode by remember(session.id) { mutableStateOf<LiveSupportMode?>(null) }
    var selectedSpray by remember(session.id) { mutableStateOf(liveSprayChoices.first()) }
    var selectedBottle by remember(session.id) { mutableStateOf(liveBottleChoices.first()) }
    var processingSupportKey by remember(session.id) { mutableStateOf("") }

    DisposableEffect(Unit) {
        val previousKeepScreenOn = rootView.keepScreenOn
        rootView.keepScreenOn = true
        onDispose { rootView.keepScreenOn = previousKeepScreenOn }
    }

    LaunchedEffect(session.id, viewerPath) {
        logLiveViewerSelection(session, selectedPlayback.takeIf { usesHls }, selectedPlayback.takeIf { usesWhep }, viewerPath)
    }

    fun sendLiveSupport(actionKey: String, label: String, customParagAmount: Int? = null, customGbaziloAmount: Int? = null) {
        if (processingSupportKey.isNotBlank()) return
        scope.launch {
            processingSupportKey = actionKey
            supportNotice = "Sending $label..."
            runCatching {
                val user = firebaseAuth.currentUser ?: error("Login first.")
                val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                apiService.sendParagonLiveSupport(
                    idToken = token,
                    appCheckToken = appCheck,
                    sessionId = session.id,
                    actionKey = actionKey,
                    customParagAmount = customParagAmount,
                    customGbaziloAmount = customGbaziloAmount,
                )
            }.onSuccess {
                supportNotice = "$label sent"
                supportMode = null
            }.onFailure { error ->
                supportNotice = cleanLiveSupportError(error.message, label)
            }.also {
                processingSupportKey = ""
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        when {
            usesWhep -> NativeWhepPlaybackPlayer(
                whepUrl = selectedPlayback,
                modifier = Modifier.fillMaxSize(),
                onPlaybackUnavailable = {},
            )
            usesHls -> LivePlaybackPlayer(
                playbackUrl = selectedPlayback,
                modifier = Modifier.fillMaxSize(),
                showControls = false,
            )
            else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Preparing Live stream...", color = Color(0xFFFFD166), fontWeight = FontWeight.Black)
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .background(Color.Black.copy(alpha = 0.38f))
                .padding(horizontal = 14.dp, vertical = 14.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("🔴 PARAGON LIVE", color = Color(0xFFD8A928), fontSize = 12.sp, fontWeight = FontWeight.Black)
                Text("@${session.hostUsername}", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Black)
                Text(session.title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                if (session.description.isNotBlank()) {
                    Text(session.description, color = Color.White.copy(alpha = 0.82f), fontSize = 13.sp)
                }
            }
            OutlinedButton(
                onClick = onClose,
                modifier = Modifier.align(Alignment.TopEnd),
            ) {
                Text("Close")
            }
        }

        LiveSupportRail(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 10.dp),
            onVote = { supportMode = LiveSupportMode.VOTE },
            onPour = { supportMode = LiveSupportMode.WATER },
            onSpray = { supportMode = LiveSupportMode.SPRAY },
            onPop = { supportMode = LiveSupportMode.BOTTLE },
        )

        if (supportNotice.isNotBlank()) {
            Surface(
                color = Color.Black.copy(alpha = 0.48f),
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = 24.dp),
            ) {
                Text(
                    supportNotice,
                    color = Color(0xFFFFD166),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                )
            }
        }

        LiveChatOverlay(
            sessionId = session.id,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 12.dp, end = 86.dp, bottom = 14.dp),
        )

        supportMode?.let { mode ->
            LiveSupportTray(
                mode = mode,
                selectedSpray = selectedSpray,
                selectedBottle = selectedBottle,
                processingKey = processingSupportKey,
                notice = supportNotice,
                onDismiss = { supportMode = null },
                onSelectSpray = { selectedSpray = it },
                onSelectBottle = { selectedBottle = it },
                onConfirm = {
                    when (mode) {
                        LiveSupportMode.VOTE -> sendLiveSupport("vote", "Vote")
                        LiveSupportMode.WATER -> sendLiveSupport("pour_me_water", "Pour Me Water")
                        LiveSupportMode.SPRAY -> sendLiveSupport(
                            "spray_money",
                            "Spray Me Money",
                            customParagAmount = if (selectedSpray.currency == "PARAG") selectedSpray.amount else 0,
                            customGbaziloAmount = if (selectedSpray.currency == "GBAZILO") selectedSpray.amount else 0,
                        )
                        LiveSupportMode.BOTTLE -> sendLiveSupport(
                            selectedBottle.key,
                            "Pop ${selectedBottle.title}",
                            customParagAmount = selectedBottle.paragAmount,
                            customGbaziloAmount = selectedBottle.gbaziloAmount,
                        )
                    }
                },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(start = 14.dp, end = 14.dp, bottom = 92.dp),
            )
        }
    }
}

@Composable
private fun LiveSupportTray(
    mode: LiveSupportMode,
    selectedSpray: LiveSprayChoice,
    selectedBottle: LiveBottleChoice,
    processingKey: String,
    notice: String,
    onDismiss: () -> Unit,
    onSelectSpray: (LiveSprayChoice) -> Unit,
    onSelectBottle: (LiveBottleChoice) -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = when (mode) {
        LiveSupportMode.VOTE -> "Vote For Me"
        LiveSupportMode.WATER -> "Pour Me Water"
        LiveSupportMode.SPRAY -> "Spray Me Money"
        LiveSupportMode.BOTTLE -> "Pop Me a Bottle"
    }
    val confirmLabel = when (mode) {
        LiveSupportMode.VOTE -> if (processingKey == "vote") "Voting..." else "Vote 1 PARAG"
        LiveSupportMode.WATER -> if (processingKey == "pour_me_water") "Pouring..." else "Pour • 5 PARAG"
        LiveSupportMode.SPRAY -> if (processingKey == "spray_money") "Spraying..." else "Spray • ${selectedSpray.amount} ${selectedSpray.currency}"
        LiveSupportMode.BOTTLE -> if (processingKey == selectedBottle.key) "Popping..." else "Pop • ${selectedBottle.costLabel}"
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = Color.Black.copy(alpha = 0.34f),
        shape = RoundedCornerShape(24.dp),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text(
                    "×",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .clickable(onClick = onDismiss)
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
            when (mode) {
                LiveSupportMode.VOTE -> LiveSimpleSupportChoice(icon = "🗳️", label = "Vote 1 PARAG")
                LiveSupportMode.WATER -> LiveSimpleSupportChoice(icon = "🚿", label = "Pour 5 PARAG")
                LiveSupportMode.SPRAY -> LiveSprayChoicesRow(selectedSpray, onSelectSpray)
                LiveSupportMode.BOTTLE -> LiveBottleChoicesRow(selectedBottle, onSelectBottle)
            }
            if (notice.isNotBlank() && !notice.startsWith("Sending")) {
                Text(notice, color = Color(0xFFFFD166), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Button(
                enabled = processingKey.isBlank(),
                onClick = onConfirm,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD8A928), contentColor = Color.Black),
                shape = RoundedCornerShape(999.dp),
            ) {
                Text(confirmLabel, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun LiveSimpleSupportChoice(icon: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Text(icon, fontSize = 34.sp)
        Text(label, color = Color.White, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun LiveSprayChoicesRow(
    selected: LiveSprayChoice,
    onSelect: (LiveSprayChoice) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        liveSprayChoices.forEach { choice ->
            LiveOptionChip(
                selected = choice == selected,
                icon = "💵",
                title = choice.amount.toString(),
                subtitle = choice.currency,
                onClick = { onSelect(choice) },
            )
        }
    }
}

@Composable
private fun LiveBottleChoicesRow(
    selected: LiveBottleChoice,
    onSelect: (LiveBottleChoice) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        liveBottleChoices.forEach { choice ->
            LiveOptionChip(
                selected = choice == selected,
                icon = choice.icon,
                title = choice.title,
                subtitle = choice.costLabel,
                onClick = { onSelect(choice) },
            )
        }
    }
}

@Composable
private fun LiveOptionChip(
    selected: Boolean,
    icon: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Surface(
        color = if (selected) Color(0xFFD8A928) else Color.Black.copy(alpha = 0.42f),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.clickable(onClick = onClick),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(icon, fontSize = 24.sp)
            Text(title, color = if (selected) Color.Black else Color.White, fontWeight = FontWeight.Black)
            Text(subtitle, color = if (selected) Color.Black else Color(0xFFFFD166), fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun LiveSupportRail(
    modifier: Modifier = Modifier,
    onVote: () -> Unit,
    onPour: () -> Unit,
    onSpray: () -> Unit,
    onPop: () -> Unit,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        LiveRailAction(icon = "🗳️", label = "Vote", onClick = onVote)
        LiveRailAction(icon = "🚿", label = "Pour", onClick = onPour)
        LiveRailAction(icon = "💵", label = "Spray", onClick = onSpray)
        LiveRailAction(icon = "🍾", label = "Pop", onClick = onPop)
        LiveRailAction(icon = "↗", label = "Share")
    }
}

@Composable
private fun LiveRailAction(
    icon: String,
    label: String,
    onClick: () -> Unit = {},
) {
    Column(
        modifier = Modifier
            .background(Color.Black.copy(alpha = 0.28f), RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(icon, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(label, color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun LiveChatOverlay(
    sessionId: String,
    modifier: Modifier = Modifier,
    showComposer: Boolean = true,
) {
    val scope = rememberCoroutineScope()
    val apiService = remember { ParagonApiService() }
    val appCheckRepository = remember { AppCheckRepository() }
    val firebaseAuth = remember { FirebaseAuth.getInstance() }
    var chatText by remember(sessionId) { mutableStateOf("") }
    var messages by remember(sessionId) { mutableStateOf<List<LiveChatMessage>>(emptyList()) }
    var notice by remember(sessionId) { mutableStateOf("") }

    LaunchedEffect(sessionId) {
        while (true) {
            runCatching {
                val user = firebaseAuth.currentUser ?: return@runCatching emptyList()
                val token = user.getIdToken(false).await().token ?: return@runCatching emptyList()
                val appCheck = appCheckRepository.getToken(forceRefresh = false)
                apiService.fetchParagonLiveChat(token, appCheck, sessionId)
            }.onSuccess { latest ->
                notice = ""
                if (latest.isNotEmpty() || messages.isEmpty()) messages = latest
            }.onFailure { error ->
                notice = cleanLiveChatError(error.message)
            }
            delay(LIVE_CHAT_REFRESH_MS)
        }
    }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LiveChatStack(
            messages = if (messages.isEmpty()) {
                listOf("Live Chat")
            } else {
                messages.takeLast(6).map { "${it.userName}: ${it.text}" }
            },
        )
        if (notice.isNotBlank()) {
            Text(notice, color = Color(0xFFFFD166), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        if (showComposer) {
            LiveChatComposer(
                value = chatText,
                onValueChange = { chatText = it },
                onSend = {
                    val text = chatText.trim()
                    if (text.isBlank()) return@LiveChatComposer
                    scope.launch {
                        notice = ""
                        runCatching {
                            val user = firebaseAuth.currentUser ?: error("Login first.")
                            val token = user.getIdToken(false).await().token ?: error("Could not get auth token.")
                            val appCheck = appCheckRepository.getToken(forceRefresh = false)
                            apiService.postParagonLiveChat(token, appCheck, sessionId, text)
                        }.onSuccess { message ->
                            messages = (messages + message).takeLast(50)
                            chatText = ""
                        }.onFailure { error ->
                            notice = error.message?.substringAfter(": ") ?: "Could not send message"
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun LiveChatStack(
    messages: List<String>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        messages.takeLast(5).forEach { message ->
            Surface(
                color = Color.Black.copy(alpha = 0.34f),
                shape = RoundedCornerShape(999.dp),
            ) {
                Text(
                    text = message,
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun LiveChatComposer(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            modifier = Modifier.weight(1f),
            color = Color.Black.copy(alpha = 0.42f),
            shape = RoundedCornerShape(999.dp),
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                placeholder = { Text("Say hi...", color = Color.White.copy(alpha = 0.62f)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Button(
            onClick = onSend,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD8A928), contentColor = Color.Black),
            shape = RoundedCornerShape(999.dp),
        ) {
            Text("Send", fontWeight = FontWeight.Black)
        }
    }
}

private fun logLiveViewerSelection(
    session: LiveSession,
    playbackUrl: String?,
    whepUrl: String?,
    viewerPath: String,
) {
    if (!BuildConfig.DEBUG) return
    Log.d(
        "ParagonLiveViewer",
        "selected session=${session.id} " +
            "publisherTransport=${session.publisherTransport.orEmpty()} " +
            "playbackTransport=${session.playbackTransport.orEmpty()} " +
            "hasLiveInputId=${!session.liveInputId.isNullOrBlank()} " +
            "hasPlaybackId=${!session.playbackId.isNullOrBlank()} " +
            "hasHls=${!playbackUrl.isNullOrBlank()} " +
            "hasWhep=${!whepUrl.isNullOrBlank()} " +
            "viewerPath=$viewerPath"
    )
}

private fun logLiveTiming(scope: String, sessionId: String, event: String, startedAt: Long, detail: String = "") {
    if (!BuildConfig.DEBUG) return
    val elapsedMs = System.currentTimeMillis() - startedAt
    Log.d(
        "ParagonLiveTiming",
        "scope=$scope session=$sessionId event=$event elapsedMs=$elapsedMs${if (detail.isBlank()) "" else " $detail"}"
    )
}

private fun cleanLiveSupportError(rawMessage: String?, label: String): String {
    val raw = rawMessage.orEmpty()
    val jsonError = raw.substringAfter("\"error\":\"", missingDelimiterValue = "")
        .substringBefore("\"")
        .replace("\\\"", "\"")
    val message = jsonError.ifBlank {
        raw.substringAfter(": ", missingDelimiterValue = raw)
            .substringAfter("Request failed", missingDelimiterValue = raw)
            .trim()
    }
    return when {
        message.contains("own Live", ignoreCase = true) -> "You cannot support your own Live."
        message.contains("Insufficient", ignoreCase = true) ||
            message.contains("wallet", ignoreCase = true) -> "Fund Your Wallet"
        message.isNotBlank() && !message.startsWith("{") -> message
        else -> "Could not send $label."
    }
}

private fun cleanLiveChatError(rawMessage: String?): String {
    val raw = rawMessage.orEmpty()
    val jsonError = raw.substringAfter("\"error\":\"", missingDelimiterValue = "")
        .substringBefore("\"")
        .replace("\\\"", "\"")
    val message = jsonError.ifBlank {
        raw.substringAfter(": ", missingDelimiterValue = raw).trim()
    }
    return when {
        message.contains("not found", ignoreCase = true) -> "Live chat is reconnecting..."
        message.contains("Too Many", ignoreCase = true) -> "Live chat is updating slowly..."
        message.isNotBlank() && !message.startsWith("{") -> message
        else -> "Live chat is reconnecting..."
    }
}

@Composable
private fun LiveViewerHeader(tab: String, session: LiveSession) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (tab == "Replays") "▶ REPLAY" else "🔴 LIVE",
                color = Color(0xFFFFD166),
                fontWeight = FontWeight.Black,
            )
            Text(
                if (tab == "Replays") "Playback" else "Watching now",
                color = Color(0xFFB8C0CC),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Text(session.title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
        Text(
            "@${session.hostUsername} · ${session.hostRole.displayRole()} · ${session.purpose}",
            color = Color(0xFFEAD9B8),
            fontWeight = FontWeight.Bold,
        )
        if (session.description.isNotBlank()) {
            Text(session.description, color = Color(0xFFB8C0CC), fontSize = 13.sp)
        }
        Text(
            formatLiveDateForTab(tab, session),
            color = Color(0xFFFFD166),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun LiveAudienceActionBar() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color.Black.copy(alpha = 0.44f),
            shape = RoundedCornerShape(999.dp),
        ) {
            Text(
                "Say something...",
                color = Color(0xFFB8C0CC),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 11.dp),
                fontWeight = FontWeight.Bold,
            )
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("👏 React", "🗳 Vote", "↗ Share", "+ Follow").forEach { label ->
                Surface(color = Color(0xFF0D1B2A), shape = RoundedCornerShape(999.dp)) {
                    Text(
                        label,
                        color = if (label.contains("Vote")) Color(0xFFFFD166) else Color.White,
                        modifier = Modifier.padding(horizontal = 13.dp, vertical = 8.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
            }
        }
    }
}

@Composable
private fun NativeWhepPlaybackPlayer(
    whepUrl: String,
    modifier: Modifier = Modifier
        .fillMaxWidth()
        .height(430.dp),
    onPlaybackUnavailable: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val timingStartMs = remember(whepUrl) { System.currentTimeMillis() }
    var playerState by remember(whepUrl) { mutableStateOf("Connecting Live...") }
    val eglBase = remember(whepUrl) { EglBase.create() }
    var whepClient by remember(whepUrl) { mutableStateOf<NativeWhepClient?>(null) }

    DisposableEffect(whepUrl) {
        onDispose {
            whepClient?.release()
            whepClient = null
            eglBase.release()
        }
    }

    Box(
        modifier = modifier.background(Color.Black, RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { viewContext ->
                SurfaceViewRenderer(viewContext).apply {
                    init(eglBase.eglBaseContext, null)
                    setEnableHardwareScaler(true)
                    setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                    setMirror(false)
                    whepClient = NativeWhepClient(
                        context = context.applicationContext,
                        eglBase = eglBase,
                        renderer = this,
                        scope = scope,
                        onState = { playerState = it },
                        onPlaybackUnavailable = onPlaybackUnavailable,
                        timingStartMs = timingStartMs,
                    ).also { it.connect(whepUrl) }
                }
            },
        )
        if (playerState.isNotBlank()) {
            Text(playerState, color = Color(0xFFFFD166), fontWeight = FontWeight.Black)
        }
    }
}

private class NativeWhepClient(
    private val context: Context,
    private val eglBase: EglBase,
    private val renderer: SurfaceViewRenderer,
    private val scope: CoroutineScope,
    private val onState: (String) -> Unit,
    private val onPlaybackUnavailable: () -> Unit,
    private val timingStartMs: Long,
) {
    private val released = AtomicBoolean(false)
    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var requestJob: Job? = null
    private var startupTimeoutJob: Job? = null
    private var videoTrack: VideoTrack? = null
    private val firstTrackAttached = AtomicBoolean(false)

    fun connect(whepUrl: String) {
        if (whepUrl.isBlank()) {
            onState("Live playback unavailable.")
            return
        }
        initializeFactory(context)
        logLiveTiming("android-whep", "selected", "T3_peer_factory_start", timingStartMs)
        startupTimeoutJob = scope.launch {
            delay(10_000)
            if (!released.get() && !firstTrackAttached.get()) {
                logLiveTiming("android-whep", "selected", "whep_first_frame_timeout", timingStartMs)
                onState("Switching Live playback...")
                onPlaybackUnavailable()
            }
        }
        val audioModule = JavaAudioDeviceModule.builder(context).createAudioDeviceModule()
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(audioModule)
            .setVideoDecoderFactory(decoderFactory)
            .setVideoEncoderFactory(encoderFactory)
            .createPeerConnectionFactory()
        audioModule.release()

        val observer = object : PeerConnection.Observer {
            override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                when (state) {
                    PeerConnection.IceConnectionState.CONNECTED,
                    PeerConnection.IceConnectionState.COMPLETED -> {
                        logLiveTiming("android-whep", "selected", "T6_peer_connected", timingStartMs)
                        onState("")
                    }
                    PeerConnection.IceConnectionState.FAILED,
                    PeerConnection.IceConnectionState.DISCONNECTED,
                    PeerConnection.IceConnectionState.CLOSED -> {
                        onState("Live playback unavailable.")
                        onPlaybackUnavailable()
                    }
                    else -> onState("Connecting Live...")
                }
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) = Unit
            override fun onIceCandidate(candidate: IceCandidate) = Unit
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
            override fun onAddStream(stream: MediaStream) = Unit
            override fun onRemoveStream(stream: MediaStream) = Unit
            override fun onDataChannel(channel: DataChannel) = Unit
            override fun onRenegotiationNeeded() = Unit
            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {
                val track = receiver.track()
                if (track is VideoTrack) attachVideoTrack(track)
                if (track is AudioTrack) onState("")
            }
            override fun onTrack(transceiver: RtpTransceiver) {
                val track = transceiver.receiver.track()
                if (track is VideoTrack) attachVideoTrack(track)
                if (track is AudioTrack) onState("")
            }
        }

        peerConnection = factory?.createPeerConnection(
            PeerConnection.RTCConfiguration(emptyList()),
            observer,
        )
        val connection = peerConnection
        if (connection == null) {
            onState("Live playback unavailable.")
            return
        }
        connection.addTransceiver(
            MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO,
            RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY),
        )
        connection.addTransceiver(
            MediaStreamTrack.MediaType.MEDIA_TYPE_AUDIO,
            RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY),
        )
        connection.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(description: SessionDescription) {
                if (released.get()) return
                connection.setLocalDescription(object : SimpleSdpObserver() {
                    override fun onSetSuccess() {
                        requestJob = scope.launch {
                            postOfferToWhep(whepUrl, connection, description)
                        }
                    }
                }, description)
            }

            override fun onCreateFailure(error: String) {
                if (BuildConfig.DEBUG) Log.d("ParagonLiveViewer", "WHEP offer failed")
                onState("Live playback unavailable.")
                onPlaybackUnavailable()
            }
        }, MediaConstraintsProvider.offerConstraints())
    }

    private fun attachVideoTrack(track: VideoTrack) {
        if (videoTrack === track) return
        firstTrackAttached.set(true)
        startupTimeoutJob?.cancel()
        videoTrack?.removeSink(renderer)
        videoTrack = track
        track.addSink(renderer)
        logLiveTiming("android-whep", "selected", "T5_video_track_attached", timingStartMs)
        onState("")
    }

    private suspend fun postOfferToWhep(
        whepUrl: String,
        connection: PeerConnection,
        originalDescription: SessionDescription,
    ) {
        onState("Connecting Live...")
        logLiveTiming("android-whep", "selected", "T4_offer_posting", timingStartMs)
        val answer = withContext(Dispatchers.IO) {
            val localDescription = connection.localDescription ?: originalDescription
            val http = (URL(whepUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 30_000
                readTimeout = 30_000
                doOutput = true
                setRequestProperty("Content-Type", "application/sdp")
                setRequestProperty("Accept", "application/sdp")
            }
            runCatching {
                http.outputStream.use { stream ->
                    stream.write(localDescription.description.toByteArray(Charsets.UTF_8))
                }
                val code = http.responseCode
                val body = if (code in 200..299) {
                    http.inputStream.bufferedReader().use { it.readText() }
                } else {
                    http.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                }
                if (code !in 200..299 || body.isBlank()) error("WHEP response failed")
                body
            }.also {
                http.disconnect()
            }.getOrThrow()
        }
        if (released.get()) return
        connection.setRemoteDescription(
            object : SimpleSdpObserver() {
                override fun onSetFailure(error: String) {
                    if (BuildConfig.DEBUG) Log.d("ParagonLiveViewer", "WHEP answer failed")
                    onState("Live playback unavailable.")
                    onPlaybackUnavailable()
                }
            },
            SessionDescription(SessionDescription.Type.ANSWER, answer),
        )
    }

    fun release() {
        if (!released.compareAndSet(false, true)) return
        requestJob?.cancel()
        startupTimeoutJob?.cancel()
        videoTrack?.removeSink(renderer)
        videoTrack = null
        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null
        factory?.dispose()
        factory = null
        renderer.release()
    }

    companion object {
        private val initialized = AtomicBoolean(false)

        private fun initializeFactory(context: Context) {
            if (!initialized.compareAndSet(false, true)) return
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(context)
                    .setEnableInternalTracer(false)
                    .createInitializationOptions()
            )
        }
    }
}

private open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(description: SessionDescription) = Unit
    override fun onSetSuccess() = Unit
    override fun onCreateFailure(error: String) = Unit
    override fun onSetFailure(error: String) = Unit
}

private object MediaConstraintsProvider {
    fun offerConstraints() = org.webrtc.MediaConstraints().apply {
        mandatory.add(org.webrtc.MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
        mandatory.add(org.webrtc.MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
    }
}

@Composable
@SuppressLint("SetJavaScriptEnabled")
private fun WebRtcLivePlaybackPlayer(whepUrl: String, iframePlaybackId: String) {
    val encodedWhepUrl = remember(whepUrl) {
        Base64.encodeToString(whepUrl.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
    }
    val encodedPlayerUrl = remember(iframePlaybackId) {
        val playerUrl = if (iframePlaybackId.isNotBlank()) {
            "https://iframe.videodelivery.net/$iframePlaybackId?autoplay=true&controls=true&muted=false"
        } else {
            ""
        }
        Base64.encodeToString(playerUrl.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
    }
    val html = remember(encodedWhepUrl, encodedPlayerUrl) {
        """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
          <style>
            html,body{margin:0;height:100%;background:#000;color:#ffd166;font-family:sans-serif;overflow:hidden}
            video,iframe{width:100%;height:100%;border:0;object-fit:contain;background:#000}
            #status{position:absolute;left:12px;right:12px;bottom:12px;font-weight:800;font-size:13px;text-shadow:0 1px 2px #000;pointer-events:none}
          </style>
        </head>
        <body>
          <video id="video" autoplay playsinline controls></video>
          <iframe id="player" style="display:none" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen></iframe>
          <div id="status">Connecting Live player...</div>
          <script>
            const statusEl = document.getElementById('status');
            const player = document.getElementById('player');
            const video = document.getElementById('video');
            const whepUrl = atob('$encodedWhepUrl');
            const playerUrl = atob('$encodedPlayerUrl');
            if (playerUrl) {
              video.style.display = 'none';
              player.style.display = 'block';
              player.src = playerUrl;
              setTimeout(() => { statusEl.textContent = ''; }, 2500);
            } else {
              startWhep();
            }
            async function startWhep() {
              try {
                if (!whepUrl || !window.RTCPeerConnection) throw new Error('WHEP unavailable');
                const pc = new RTCPeerConnection();
                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });
                pc.onconnectionstatechange = () => {
                  if (pc.connectionState === 'connected') statusEl.textContent = '';
                  if (pc.connectionState === 'failed') statusEl.textContent = 'Live playback unavailable. Please try again.';
                };
                pc.ontrack = event => {
                  const stream = event.streams && event.streams[0];
                  if (stream && video.srcObject !== stream) {
                    video.srcObject = stream;
                    video.play().catch(() => {});
                    statusEl.textContent = '';
                  }
                };
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await new Promise(resolve => {
                  if (pc.iceGatheringState === 'complete') return resolve();
                  pc.addEventListener('icegatheringstatechange', () => {
                    if (pc.iceGatheringState === 'complete') resolve();
                  });
                  setTimeout(resolve, 2500);
                });
                const response = await fetch(whepUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/sdp', 'Accept': 'application/sdp' },
                  body: pc.localDescription && pc.localDescription.sdp
                });
                const answer = await response.text();
                if (!response.ok) throw new Error('WHEP failed');
                await pc.setRemoteDescription({ type: 'answer', sdp: answer });
              } catch (error) {
                console.log('ParagonLive WHEP playback failed: ' + (error && error.name ? error.name : 'Error'));
                statusEl.textContent = 'Live playback unavailable. Please try again.';
              }
            }
          </script>
        </body>
        </html>
        """.trimIndent()
    }
    DisposableEffect(whepUrl, iframePlaybackId) {
        onDispose { }
    }
    if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
    AndroidView(
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
            .background(Color.Black, RoundedCornerShape(16.dp)),
        factory = { viewContext ->
            WebView(viewContext).apply {
                setBackgroundColor(android.graphics.Color.BLACK)
                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                        if (BuildConfig.DEBUG) {
                            Log.d("ParagonLiveViewer", "WebView console: ${consoleMessage.message()}")
                        }
                        return true
                    }
                }
                webViewClient = WebViewClient()
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                loadDataWithBaseURL("https://paragonplanet.com", html, "text/html", "UTF-8", null)
            }
        }
    )
}

@Composable
private fun LivePlaybackPlayer(
    playbackUrl: String,
    modifier: Modifier = Modifier
        .fillMaxWidth()
        .height(430.dp),
    showControls: Boolean = true,
) {
    val context = LocalContext.current
    var playerState by remember(playbackUrl) { mutableStateOf("Connecting Live...") }
    val timingStartMs = remember(playbackUrl) { System.currentTimeMillis() }
    val player = remember(playbackUrl) {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                500,
                3_000,
                250,
                500,
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .build()
            .apply {
            logLiveTiming("android-hls", "selected", "T3_player_created", timingStartMs)
            setMediaItem(
                MediaItem.Builder()
                    .setUri(playbackUrl)
                    .setLiveConfiguration(
                        MediaItem.LiveConfiguration.Builder()
                            .setTargetOffsetMs(1_500)
                            .setMinPlaybackSpeed(0.97f)
                            .setMaxPlaybackSpeed(1.05f)
                            .build()
                    )
                    .build()
            )
            playWhenReady = true
            prepare()
        }
    }
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                playerState = when (playbackState) {
                    Player.STATE_BUFFERING -> {
                        logLiveTiming("android-hls", "selected", "T4_buffering", timingStartMs)
                        "Buffering Live..."
                    }
                    Player.STATE_READY -> {
                        logLiveTiming("android-hls", "selected", "T6_ready_first_frame", timingStartMs)
                        ""
                    }
                    Player.STATE_ENDED -> {
                        logLiveTiming("android-hls", "selected", "live_ended", timingStartMs)
                        "This Live has ended."
                    }
                    else -> "Connecting Live..."
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                if (BuildConfig.DEBUG) {
                    Log.d("ParagonLiveViewer", "Media3 playback error=${error.errorCodeName}")
                    logLiveTiming("android-hls", "selected", "playback_error", timingStartMs, "code=${error.errorCodeName}")
                }
                playerState = "Live playback unavailable."
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black, RoundedCornerShape(16.dp)),
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    useController = showControls
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    this.player = player
                }
            },
            update = { view ->
                view.useController = showControls
                view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                view.player = player
            }
        )
        if (playerState.isNotBlank()) {
            Text(playerState, color = Color(0xFFFFD166), fontWeight = FontWeight.Black)
        }
    }
}

private fun emptyLiveMessageForTab(tab: String): String {
    return when (tab) {
        "Live Now" -> "No broadcaster at the moment. Check Upcoming for scheduled Lives."
        "Upcoming" -> "No upcoming Lives scheduled."
        "Following" -> "Lives from people you follow will appear here."
        else -> "No replays available yet."
    }
}

private fun liveCardStatusLabel(tab: String, status: String): String {
    return when (tab) {
        "Upcoming" -> "🗓 UPCOMING"
        "Replays" -> "▶ REPLAY"
        else -> "🔴 ${if (status.equals("ACTIVE", ignoreCase = true)) "LIVE" else status}"
    }
}

private fun formatLiveSchedule(value: String?): String {
    if (value.isNullOrBlank()) return "Scheduled time pending"
    val date = runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        parser.parse(value)
    }.getOrNull() ?: runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        parser.parse(value)
    }.getOrNull() ?: return value
    val display = SimpleDateFormat("dd MMM yyyy · h:mm a", Locale.getDefault())
    val diffMs = date.time - System.currentTimeMillis()
    val countdown = if (diffMs > 0) {
        val totalMinutes = (diffMs / 60000).coerceAtLeast(0)
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        if (hours > 0) " · Starts in ${hours}h ${minutes}m" else " · Starts in ${minutes}m"
    } else {
        ""
    }
    return "${display.format(date)}$countdown"
}

private fun formatLiveDateForTab(tab: String, session: LiveSession): String {
    val value = when (tab) {
        "Replays" -> session.endedAt ?: session.actualStartedAt ?: session.wentLiveAt ?: session.startedAt ?: session.createdAt
        else -> session.actualStartedAt ?: session.wentLiveAt ?: session.startedAt ?: session.createdAt
    }
    val label = if (tab == "Replays") "Broadcast" else "Started"
    return formatLiveTimestamp(value, label)
}

private fun formatLiveTimestamp(value: String?, label: String): String {
    if (value.isNullOrBlank()) return ""
    val date = parseLiveDate(value) ?: return value
    val display = SimpleDateFormat("dd MMM yyyy · h:mm a", Locale.getDefault())
    return "$label: ${display.format(date)}"
}

private fun buildScheduledIso(dateText: String, timeText: String): String {
    val raw = "${dateText.trim()} ${timeText.trim()}"
    val date = runCatching {
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).parse(raw)
    }.getOrNull() ?: return ""
    if (date.time <= System.currentTimeMillis()) return ""
    val output = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    return output.format(date)
}

private fun parseLiveDate(value: String): java.util.Date? {
    return runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        parser.parse(value)
    }.getOrNull() ?: runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        parser.parse(value)
    }.getOrNull()
}

@SuppressLint("MissingPermission")
@Composable
private fun NativeCameraPreview(
    lensFacing: Int,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var cameraDevice by remember { mutableStateOf<CameraDevice?>(null) }
    var captureSession by remember { mutableStateOf<CameraCaptureSession?>(null) }
    val cameraThread = remember { HandlerThread("ParagonLivePreviewCamera").apply { start() } }
    val cameraHandler = remember { Handler(cameraThread.looper) }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { captureSession?.close() }
            runCatching { cameraDevice?.close() }
            runCatching { cameraThread.quitSafely() }
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { viewContext ->
            TextureView(viewContext).apply {
                surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
                        val manager = viewContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                        val cameraId = manager.cameraIdList.firstOrNull { id ->
                            manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING) == lensFacing
                        } ?: manager.cameraIdList.firstOrNull().orEmpty()
                        if (cameraId.isBlank()) return
                        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                            override fun onOpened(camera: CameraDevice) {
                                cameraDevice = camera
                                surfaceTexture.setDefaultBufferSize(width.coerceAtLeast(640), height.coerceAtLeast(480))
                                val surface = Surface(surfaceTexture)
                                camera.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
                                    override fun onConfigured(session: CameraCaptureSession) {
                                        captureSession = session
                                        val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                                            addTarget(surface)
                                            set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
                                        }.build()
                                        session.setRepeatingRequest(request, null, cameraHandler)
                                    }

                                    override fun onConfigureFailed(session: CameraCaptureSession) = Unit
                                }, cameraHandler)
                            }

                            override fun onDisconnected(camera: CameraDevice) { camera.close() }
                            override fun onError(camera: CameraDevice, error: Int) { camera.close() }
                        }, cameraHandler)
                    }

                    override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) = Unit
                    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean = true
                    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
                }
            }
        }
    )
}

private fun Context.hasPermission(permission: String): Boolean {
    return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
}

private fun permissionLabel(isReady: Boolean, requested: Boolean): String {
    return when {
        isReady -> "✓ Ready"
        requested -> "Permission denied"
        else -> "Permission needed"
    }
}

private fun String.displayRole(): String {
    return when (this) {
        "PROMOTER", "AMBASSADOR" -> "Ambassador"
        "SUPERNAL", "SUPERBOSS" -> "Superboss"
        else -> lowercase().replaceFirstChar { it.titlecase() }
    }
}
