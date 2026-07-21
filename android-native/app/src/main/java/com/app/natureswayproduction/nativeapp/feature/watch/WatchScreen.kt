package com.app.natureswayproduction.nativeapp.feature.watch

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.app.natureswayproduction.nativeapp.feature.feed.FeedCard
import com.app.natureswayproduction.nativeapp.feature.menu.GlobalMenuSheet
import com.app.natureswayproduction.nativeapp.feature.menu.MenuEntry
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonMuted
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WatchScreen(
    selectedItem: FeedCard?,
    positionLabel: String,
    isSignedIn: Boolean,
    currentUserUid: String?,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onOpenHome: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onOpenUpload: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenCitizenContestants: () -> Unit,
    onOpenSuperbossDirectory: () -> Unit,
    onOpenBackerDirectory: () -> Unit,
    onOpenAmbassadorDirectory: () -> Unit,
    onOpenMerchantMarketplace: () -> Unit,
    onOpenUserAbout: () -> Unit,
    onOpenSponsorInvestorAbout: () -> Unit,
    onOpenAboutPlanet: () -> Unit,
    onOpenPrivacyPolicy: () -> Unit,
    onSignOut: () -> Unit,
    repository: WatchActionRepository = WatchActionRepository(),
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val player = remember(context) {
        ExoPlayer.Builder(context).build().apply {
            playWhenReady = false
        }
    }
    var isSaved by remember(selectedItem?.id, currentUserUid) { mutableStateOf(false) }
    var isFollowingCreator by remember(selectedItem?.id, currentUserUid) { mutableStateOf(false) }
    var isLoadingPanel by remember { mutableStateOf(false) }
    var panelData by remember { mutableStateOf(WatchPanelPayload(emptyList(), emptyList())) }
    var showFollowPanel by remember { mutableStateOf(false) }
    var memberSearchTerm by rememberSaveable(selectedItem?.id) { mutableStateOf("") }
    var showMenuPanel by remember { mutableStateOf(false) }
    var statusNotice by remember { mutableStateOf<String?>(null) }

    DisposableEffect(player) {
        onDispose { player.release() }
    }

    val playbackUrl = selectedItem?.preferredPlaybackUrl()

    LaunchedEffect(selectedItem?.id, playbackUrl) {
        if (!playbackUrl.isNullOrBlank()) {
            player.stop()
            player.clearMediaItems()
            player.setMediaItem(MediaItem.fromUri(Uri.parse(playbackUrl)))
            player.prepare()
        } else {
            player.stop()
            player.clearMediaItems()
        }
    }

    LaunchedEffect(selectedItem?.id, currentUserUid, isSignedIn) {
        if (!isSignedIn || currentUserUid.isNullOrBlank() || selectedItem == null) {
            isSaved = false
            isFollowingCreator = false
            return@LaunchedEffect
        }

        isSaved = runCatching { repository.isSaved(currentUserUid, selectedItem.id) }.getOrDefault(false)
        isFollowingCreator = selectedItem.creatorUid
            ?.takeIf { it.isNotBlank() && it != currentUserUid }
            ?.let { creatorUid ->
                runCatching { repository.isFollowing(currentUserUid, creatorUid) }.getOrDefault(false)
            } ?: false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        when {
            selectedItem == null -> {
                HelperCard(
                    title = "Watch",
                    body = "Pick any live feed item to open the native player here."
                )
            }

            playbackUrl.isNullOrBlank() -> {
                HelperCard(
                    title = selectedItem.title,
                    body = buildString {
                        append("The native player is ready, but this item still has no playable media URL in the backend response.")
                        selectedItem.objectPath?.let {
                            append("\n\nObject path: ")
                            append(it)
                        }
                    }
                )
            }

            else -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                ) {
                        PlayerCard(
                            player = player,
                            modifier = Modifier.fillMaxSize(),
                        )
                    Column(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        WatchMeta(
                            selectedItem = selectedItem,
                            positionLabel = positionLabel
                        )
                        statusNotice?.let {
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = Color(0xCC151515)
                            ) {
                                Text(
                                    text = it,
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
                                )
                            }
                        }
                        WatchFooterBar(
                            isSaved = isSaved,
                            onHome = onOpenHome,
                            onFollow = {
                                if (!isSignedIn) {
                                    statusNotice = "Login first"
                                    return@WatchFooterBar
                                }
                                onOpenMeetUp()
                            },
                            onSave = {
                                if (!isSignedIn || currentUserUid.isNullOrBlank()) {
                                    statusNotice = "Login first"
                                    return@WatchFooterBar
                                }
                                scope.launch {
                                    runCatching { repository.toggleSaved(currentUserUid, selectedItem) }
                                        .onSuccess { saved ->
                                            isSaved = saved
                                            statusNotice = if (saved) {
                                                "Saved to Watch Later"
                                            } else {
                                                "Removed from Save / Watch"
                                            }
                                        }
                                        .onFailure {
                                            statusNotice = "Could not update Save / Watch right now"
                                        }
                                }
                            },
                            onMenu = {
                                showMenuPanel = true
                            }
                        )
                    }
                }
            }
        }
    }

    if (showFollowPanel) {
        val creatorMember = selectedItem?.creatorUid?.takeIf { it.isNotBlank() }?.let { creatorUid ->
            panelData.members.firstOrNull { it.uid == creatorUid } ?: WatchMember(
                uid = creatorUid,
                role = selectedItem?.category ?: "Creator",
                displayName = selectedItem?.performer ?: "Creator",
                email = "",
                subtitle = selectedItem?.category ?: "",
            )
        }
        val directoryMembers = remember(panelData.members, creatorMember) {
            buildList {
                if (creatorMember != null) add(creatorMember)
                panelData.members.forEach { member ->
                    if (creatorMember == null || member.uid != creatorMember.uid) {
                        add(member)
                    }
                }
            }
        }
        val filteredMembers = remember(directoryMembers, memberSearchTerm) {
            val term = memberSearchTerm.trim().lowercase()
            if (term.isBlank()) {
                directoryMembers
            } else {
                directoryMembers.filter { member ->
                    listOf(member.displayName, member.role, member.subtitle, member.email).any { value ->
                        value.lowercase().contains(term)
                    }
                }
            }
        }

        ModalBottomSheet(
            onDismissRequest = { showFollowPanel = false },
            containerColor = Color(0xFF111111)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "REQUEST MEET-UP",
                    color = ParagonMuted,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Choose a user to meet",
                    color = Color.White,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Select any member and open the meet-up request page from here.",
                    color = ParagonMuted,
                    style = MaterialTheme.typography.bodyMedium
                )

                if (isLoadingPanel) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 18.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = ParagonGold)
                    }
                } else {
                    if (panelData.requests.isNotEmpty()) {
                        Text(
                            text = if (panelData.requests.size == 1) {
                                "You Have Request for Meet-ups"
                            } else {
                                "You Have Requests for Meet-ups"
                            },
                            color = Color.White,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        panelData.requests.forEach { request ->
                            MeetUpRequestCard(
                                request = request,
                                onOpen = {
                                    showFollowPanel = false
                                    onOpenMeetUp()
                                }
                            )
                        }
                    }

                    SearchMembersCard(
                        searchTerm = memberSearchTerm,
                        onSearchChange = { memberSearchTerm = it },
                        memberCount = filteredMembers.size
                    )

                    Text(
                        text = "Members",
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (filteredMembers.isEmpty()) {
                        Text(
                            text = "No members found yet.",
                            color = ParagonMuted,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    } else {
                        filteredMembers.forEach { member ->
                            MemberRow(
                                member = member,
                                onOpenMeetUp = {
                                    showFollowPanel = false
                                    onOpenMeetUp()
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showMenuPanel) {
        GlobalMenuSheet(
            onDismiss = { showMenuPanel = false },
            entries = listOf(
                MenuEntry("Marketplace", "Digital products from Paragon Merchants") { showMenuPanel = false; onOpenMerchantMarketplace() },
                MenuEntry("The Citizen Contestants", "About Citizen Contestants") { showMenuPanel = false; onOpenCitizenContestants() },
                MenuEntry("Paragon Superbosses", "The Mentors") { showMenuPanel = false; onOpenSuperbossDirectory() },
                MenuEntry("Paragon Backers", "The Service Providers for Backer Contestants") { showMenuPanel = false; onOpenBackerDirectory() },
                MenuEntry("Paragon Ambassadors", "The Talent Ambassadors") { showMenuPanel = false; onOpenAmbassadorDirectory() },
                MenuEntry("Paragon Users", "Viewers, voters, buyers, and supporters") { showMenuPanel = false; onOpenUserAbout() },
                MenuEntry("Paragon Sponsors / Investors", "Partnerships, funding, and ecosystem support") { showMenuPanel = false; onOpenSponsorInvestorAbout() },
                MenuEntry("About Paragon Planet", "The app and reality system") { showMenuPanel = false; onOpenAboutPlanet() },
                MenuEntry("Privacy Policy", "Data, safety, payments, and user rights") { showMenuPanel = false; onOpenPrivacyPolicy() },
            )
        )
    }
}

@Composable
private fun PlayerCard(
    player: ExoPlayer,
    modifier: Modifier = Modifier,
) {
    val configuration = LocalConfiguration.current
    val isMobile = configuration.screenWidthDp <= 768
    var isPlaying by remember(player) { mutableStateOf(false) }
    var isLoading by remember(player) { mutableStateOf(true) }
    var currentPosition by remember(player) { mutableStateOf(0L) }
    var duration by remember(player) { mutableStateOf(0L) }
    var showControls by remember(player) { mutableStateOf(false) }
    var isMuted by remember(player) { mutableStateOf(true) }
    var videoSize by remember(player) { mutableStateOf(VideoSize.UNKNOWN) }
    var isScrubbing by remember(player) { mutableStateOf(false) }

    val isVertical = remember(videoSize) {
        videoSize.height > 0 && videoSize.width > 0 && videoSize.height > videoSize.width
    }
    val isLandscape = !isVertical
    val shouldContain = (isVertical && !isMobile) || (isLandscape && isMobile)

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                isLoading = playbackState == Player.STATE_BUFFERING || playbackState == Player.STATE_IDLE
                if (playbackState == Player.STATE_READY) {
                    duration = player.duration.coerceAtLeast(0L)
                    currentPosition = player.currentPosition.coerceAtLeast(0L)
                }
            }

            override fun onVideoSizeChanged(size: VideoSize) {
                videoSize = size
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    LaunchedEffect(player) {
        while (true) {
            duration = player.duration.coerceAtLeast(0L)
            currentPosition = player.currentPosition.coerceAtLeast(0L)
            delay(250)
        }
    }

    LaunchedEffect(showControls, isLoading, isScrubbing) {
        if (showControls && !isLoading && !isScrubbing) {
            delay(1800)
            showControls = false
        }
    }

    Box(
        modifier = modifier
            .background(Color.Black)
            .pointerInput(player, isLoading) {
                detectTapGestures(
                    onDoubleTap = { offset ->
                        if (duration <= 0L || isLoading) return@detectTapGestures
                        val seekDelta = if (offset.x < size.width / 2f) -10_000L else 10_000L
                        val nextPosition = (player.currentPosition + seekDelta).coerceIn(0L, duration)
                        player.seekTo(nextPosition)
                        currentPosition = nextPosition
                        showControls = true
                    },
                    onTap = {
                        if (isLoading) return@detectTapGestures
                        showControls = true
                        if (player.isPlaying) {
                            player.pause()
                        } else {
                            player.playWhenReady = true
                            player.play()
                        }
                    }
                )
            }
    ) {
        if (isLandscape && isMobile) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.White.copy(alpha = 0.06f))
            )
        }

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    this.player = player
                    useController = false
                    resizeMode = if (shouldContain) {
                        AspectRatioFrameLayout.RESIZE_MODE_FIT
                    } else {
                        AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    }
                    setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                    setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                }
            },
            update = { view ->
                view.player = player
                view.resizeMode = if (shouldContain) {
                    AspectRatioFrameLayout.RESIZE_MODE_FIT
                } else {
                    AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                }
            }
        )

        when {
            isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Color.Transparent
                    ) {
                        CircularProgressIndicator(color = ParagonGold)
                    }
                }
            }

            !isPlaying -> {
                Surface(
                    shape = CircleShape,
                    color = Color.White.copy(alpha = 0.92f),
                    modifier = Modifier.align(Alignment.Center)
                ) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.Black,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }
        }

        if (duration > 0L && showControls) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Color.Transparent)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = formatTime(currentPosition),
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall
                    )
                    Text(
                        text = formatTime(duration),
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
                Slider(
                    value = currentPosition.coerceAtMost(duration).toFloat(),
                    onValueChange = { next ->
                        isScrubbing = true
                        currentPosition = next.toLong()
                    },
                    onValueChangeFinished = {
                        isScrubbing = false
                        player.seekTo(currentPosition.coerceIn(0L, duration))
                        showControls = true
                    },
                    valueRange = 0f..duration.toFloat(),
                    colors = SliderDefaults.colors(
                        thumbColor = Color.White,
                        activeTrackColor = Color.White,
                        inactiveTrackColor = Color.White.copy(alpha = 0.35f)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        if (showControls) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = Color.Black.copy(alpha = 0.6f),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 20.dp, bottom = 56.dp)
                    .clickable {
                        val nextMuted = !isMuted
                        isMuted = nextMuted
                        player.volume = if (nextMuted) 0f else 1f
                        showControls = true
                    }
            ) {
                Text(
                    text = if (isMuted) "\uD83D\uDD07" else "\uD83D\uDD0A",
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }
        }
    }
}

private fun FeedCard.preferredPlaybackUrl(): String? {
    return mobileUrl
        ?.takeIf { it.isNotBlank() }
        ?: streamUrl?.takeIf { it.isNotBlank() }
        ?: desktopUrl?.takeIf { it.isNotBlank() }
        ?: originalUrl?.takeIf { it.isNotBlank() }
        ?: fileUrl?.takeIf { it.isNotBlank() }
}

@Composable
private fun WatchMeta(
    selectedItem: FeedCard,
    positionLabel: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = selectedItem.title,
            style = MaterialTheme.typography.headlineSmall,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = selectedItem.description,
            color = Color.White.copy(alpha = 0.82f),
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 5,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private fun formatTime(valueMs: Long): String {
    val totalSeconds = (valueMs / 1000L).coerceAtLeast(0L)
    val minutes = totalSeconds / 60L
    val seconds = totalSeconds % 60L
    return "${minutes}:${seconds.toString().padStart(2, '0')}"
}

@Composable
private fun WatchFooterBar(
    isSaved: Boolean,
    onHome: () -> Unit,
    onFollow: () -> Unit,
    onSave: () -> Unit,
    onMenu: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
    ) {
        FooterActionButton(icon = { Icon(Icons.Outlined.Home, null) }, onClick = onHome)
        FooterActionButton(icon = { Icon(Icons.Outlined.People, null) }, onClick = onFollow)
        FooterActionButton(
            icon = {
                Icon(
                    imageVector = if (isSaved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                    contentDescription = null
                )
            },
            onClick = onSave
        )
        FooterActionButton(icon = { Icon(Icons.Outlined.Menu, null) }, onClick = onMenu)
    }
}

@Composable
private fun FooterActionButton(
    icon: @Composable () -> Unit,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.Transparent,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            icon()
        }
    }
}

@Composable
private fun SearchMembersCard(
    searchTerm: String,
    onSearchChange: (String) -> Unit,
    memberCount: Int,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF171717))) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            OutlinedTextField(
                value = searchTerm,
                onValueChange = onSearchChange,
                label = { Text("Search users", color = Color(0xFFB7B7B7)) },
                textStyle = TextStyle(color = Color.White),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedBorderColor = Color.White,
                    unfocusedBorderColor = Color(0xFF4B4B4B),
                    cursorColor = Color.White,
                    focusedLabelColor = Color(0xFFB7B7B7),
                    unfocusedLabelColor = Color(0xFFB7B7B7),
                    focusedContainerColor = Color(0xFF171717),
                    unfocusedContainerColor = Color(0xFF171717)
                ),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Text(
                text = "$memberCount members available",
                color = ParagonMuted,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun CreatorCard(
    member: WatchMember,
    isFollowing: Boolean,
    canFollow: Boolean,
    onFollowToggle: () -> Unit,
    onMeetUp: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A1A))) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .background(
                            brush = Brush.linearGradient(listOf(Color(0xFFFF7A18), Color(0xFFFF2D95))),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = member.displayName.take(1).uppercase(),
                        color = Color.White,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = member.displayName,
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = member.role,
                        color = Color(0xFFFF8BB5),
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (member.subtitle.isNotBlank()) {
                        Text(
                            text = member.subtitle,
                            color = ParagonMuted,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (canFollow) {
                    Button(onClick = onFollowToggle) {
                        Text(if (isFollowing) "Following" else "Follow")
                    }
                }
                OutlinedButton(onClick = onMeetUp) {
                    Text("Meet-Up")
                }
            }
        }
    }
}

@Composable
private fun MeetUpRequestCard(
    request: WatchMeetUpRequest,
    onOpen: () -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF181818))) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = request.otherUserName,
                color = Color.White,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${request.areaIcon} ${request.areaTitle} • ${mealModeDirectoryLabel(request.mealMode)} • ${experienceDirectoryLabel(request.experienceLevel)}",
                color = ParagonMuted,
                style = MaterialTheme.typography.bodySmall
            )
            Text(
                text = "${request.directionLabel} • ${request.status.replaceFirstChar { it.uppercase() }}",
                color = Color.White.copy(alpha = 0.72f),
                style = MaterialTheme.typography.bodySmall
            )
            OutlinedButton(onClick = onOpen) {
                Text(getMeetUpDirectoryActionLabel(request))
            }
        }
    }
}

@Composable
private fun MemberRow(
    member: WatchMember,
    onOpenMeetUp: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color(0xFF171717)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .background(
                        brush = Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFFEC4899))),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = member.displayName.take(1).uppercase(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = member.displayName,
                    color = Color.White,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = listOf(member.role, member.subtitle).filter { it.isNotBlank() }.joinToString(" • "),
                    color = ParagonMuted,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            OutlinedButton(onClick = onOpenMeetUp) {
                Text("Open")
            }
        }
    }
}

private fun getMeetUpDirectoryActionLabel(request: WatchMeetUpRequest): String {
    return when {
        request.status.equals("accepted", ignoreCase = true) -> "Meet-Up"
        request.status.equals("pending", ignoreCase = true) && request.directionLabel == "Received request" -> "Open Request"
        request.status.equals("pending", ignoreCase = true) -> "View Pending"
        else -> "View Request"
    }
}

private fun mealModeDirectoryLabel(mode: String): String {
    return when (mode.lowercase()) {
        "lunch" -> "Lunch"
        "breakfast" -> "Breakfast"
        else -> "Dinner"
    }
}

private fun experienceDirectoryLabel(level: String): String {
    return when (level.lowercase()) {
        "premium" -> "Premium Experience"
        "exclusive" -> "Exclusive Experience"
        "vip" -> "VIP Experience"
        "legendary" -> "Legendary Experience"
        else -> "Standard Experience"
    }
}

@Composable
private fun HelperCard(title: String, body: String) {
    Card {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(title, style = MaterialTheme.typography.titleLarge)
                Text(body, color = ParagonMuted)
            }
        }
    }
}

@Composable
private fun MenuAction(
    label: String,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFF1B1B1B),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Text(
            text = label,
            color = Color.White,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp)
        )
    }
}



