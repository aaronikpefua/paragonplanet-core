package com.app.natureswayproduction.nativeapp.feature.meetup

import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView

@Composable
fun MeetUpScreen(
    meetUpViewModel: MeetUpViewModel,
    onBackToProfile: () -> Unit,
    onOpenFeed: () -> Unit,
) {
    val uiState by meetUpViewModel.uiState.collectAsState()
    var searchTerm by rememberSaveable { mutableStateOf("") }
    var selectedMemberId by rememberSaveable { mutableStateOf("") }
    var mealMode by rememberSaveable { mutableStateOf("dinner") }
    var experienceLevel by rememberSaveable { mutableStateOf("standard") }
    var callType by rememberSaveable { mutableStateOf("voice") }
    var selectedAreaTitle by rememberSaveable { mutableStateOf(DINNER_AREAS.first().title) }
    var selectedVideoId by rememberSaveable { mutableStateOf("") }
    var requestNote by rememberSaveable { mutableStateOf("") }
    var showRequestPage by rememberSaveable { mutableStateOf(false) }

    val filteredMembers = remember(uiState.dashboard.members, searchTerm) {
        val term = searchTerm.trim().lowercase()
        if (term.isBlank()) {
            uiState.dashboard.members
        } else {
            uiState.dashboard.members.filter { member ->
                listOf(member.displayName, member.role, member.subtitle).any { value ->
                    value.lowercase().contains(term)
                }
            }
        }
    }
    val activeAreas = remember(mealMode) {
        when (mealMode) {
            "lunch" -> LUNCH_AREAS
            "breakfast" -> BREAKFAST_AREAS
            else -> DINNER_AREAS
        }
    }
    val selectedArea = activeAreas.firstOrNull { it.title == selectedAreaTitle } ?: activeAreas.first()
    val selectedMember = filteredMembers.firstOrNull { it.uid == selectedMemberId }
        ?: uiState.dashboard.members.firstOrNull { it.uid == selectedMemberId }
        ?: filteredMembers.firstOrNull()
    val matchingVideos = remember(uiState.dashboard.videos, mealMode, selectedArea.title) {
        uiState.dashboard.videos.filter { video ->
            video.mealMode.equals(mealMode, ignoreCase = true) &&
                video.areaTitle.equals(selectedArea.title, ignoreCase = true)
        }
    }
    val selectedVideo = matchingVideos.firstOrNull { it.id == selectedVideoId } ?: matchingVideos.firstOrNull()
    val incomingAreaRequests = uiState.dashboard.incomingRequests.filter { it.requestKind == "area" }
    val incomingCallRequests = uiState.dashboard.incomingRequests.filter { it.requestKind != "area" }
    val selectedOutgoingRequests = uiState.dashboard.outgoingRequests.filter { request ->
        selectedMember == null || request.starId == selectedMember.uid
    }

    LaunchedEffect(filteredMembers) {
        if (selectedMemberId.isBlank() || uiState.dashboard.members.none { it.uid == selectedMemberId }) {
            selectedMemberId = filteredMembers.firstOrNull()?.uid.orEmpty()
        }
    }
    LaunchedEffect(activeAreas) {
        if (activeAreas.none { it.title == selectedAreaTitle }) {
            selectedAreaTitle = activeAreas.first().title
        }
    }
    LaunchedEffect(matchingVideos) {
        if (matchingVideos.none { it.id == selectedVideoId }) {
            selectedVideoId = matchingVideos.firstOrNull()?.id.orEmpty()
        }
    }
    LaunchedEffect(Unit) {
        meetUpViewModel.refresh()
    }
    LaunchedEffect(uiState.dashboard.members.size) {
        if (!uiState.isLoading) {
            showRequestPage = uiState.dashboard.members.isEmpty()
        }
    }
    LaunchedEffect(uiState.areaRequestSuccessCount) {
        if (uiState.areaRequestSuccessCount > 0) {
            showRequestPage = true
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            RequestMeetUpHeroCard(
                onBackToProfile = onBackToProfile,
                onOpenFeed = onOpenFeed,
                focusedMode = showRequestPage,
                selectedMember = selectedMember
            )
        }

        uiState.errorMessage?.let { error ->
            item {
                StatusCard(
                    title = "Needs attention",
                    body = error,
                    accent = Color(0xFFB00020)
                )
            }
        }

        if (uiState.isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        }

        selectedMember?.let { member ->
            if (showRequestPage) {
                item {
                    FocusedMeetUpCard(
                        member = member,
                        selectedVideo = selectedVideo,
                        matchingVideos = matchingVideos,
                        selectedVideoId = selectedVideo?.id.orEmpty(),
                        onVideoSelected = { selectedVideoId = it },
                        onBackToDirectory = { showRequestPage = false },
                        requestLabel = "${selectedArea.icon} ${selectedArea.title} • ${mealModeLabel(mealMode)} • ${experienceLabel(experienceLevel)}"
                    )
                }
                item {
                    SectionHeading("Pick the right meet-up area")
                }
                item {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("dinner", "lunch", "breakfast").forEach { option ->
                            SelectChip(
                                label = "\uD83C\uDF7D\uFE0F ${mealModeLabel(option)}",
                                selected = mealMode == option,
                                onClick = {
                                    mealMode = option
                                    selectedAreaTitle = when (option) {
                                        "lunch" -> LUNCH_AREAS.first().title
                                        "breakfast" -> BREAKFAST_AREAS.first().title
                                        else -> DINNER_AREAS.first().title
                                    }
                                }
                            )
                        }
                    }
                }
                item {
                    SectionHeading("${mealModeLabel(mealMode)} Meet-Up Areas")
                }
                item {
                    Text(
                        text = "Choose the setting that fits this level of access and energy.",
                        color = Color(0xFF52616B),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                items(activeAreas, key = { it.title }) { area ->
                    AreaCard(
                        area = area,
                        selected = selectedArea.title == area.title,
                        onClick = { selectedAreaTitle = area.title }
                    )
                }
                item {
                    SectionHeading("Selected standard")
                }
                items(EXPERIENCE_LEVELS, key = { it.key }) { level ->
                    ExperienceLevelCard(
                        level = level,
                        selected = experienceLevel == level.key,
                        onClick = { experienceLevel = level.key }
                    )
                }
                item {
                    RequestActionCard(
                        title = "Meet-Up Request",
                        body = "${selectedArea.icon} ${selectedArea.title} • ${mealModeLabel(mealMode)} • ${experienceLabel(experienceLevel)}",
                        buttonLabel = if (uiState.isSubmittingArea) "Submitting Meet-Up Request..." else "Submit Meet-Up Request",
                        enabled = !uiState.isSubmittingArea,
                        onClick = {
                            meetUpViewModel.submitAreaRequest(
                                member = member,
                                area = selectedArea,
                                mealMode = mealMode,
                                experienceLevel = experienceLevel,
                                callType = callType,
                                selectedVideo = selectedVideo
                            )
                        }
                    )
                }
                item {
                    SectionHeading("Call the star")
                }
                item {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CALL_TYPES.forEach { type ->
                            SelectChip(
                                label = "${type.icon} ${type.title}",
                                selected = callType == type.key,
                                onClick = { callType = type.key }
                            )
                        }
                    }
                }
                item {
                    CallRequestCard(
                        requestNote = requestNote,
                        onRequestNoteChange = { requestNote = it },
                        callType = callType,
                        isSubmitting = uiState.isSubmittingCall,
                        onSubmit = {
                            meetUpViewModel.submitCallRequest(
                                member = member,
                                mealMode = mealMode,
                                experienceLevel = experienceLevel,
                                callType = callType,
                                note = requestNote
                            )
                            requestNote = ""
                        }
                    )
                }
            } else {
                item {
                    SearchCard(
                        searchTerm = searchTerm,
                        onSearchChange = { searchTerm = it },
                        memberCount = filteredMembers.size
                    )
                }

                if (filteredMembers.isNotEmpty()) {
                    item {
                        SectionHeading("Choose a user to meet")
                    }
                    items(filteredMembers, key = { it.uid }) { directoryMember ->
                        MemberCard(
                            member = directoryMember,
                            isSelected = directoryMember.uid == selectedMember?.uid,
                            onClick = {
                                selectedMemberId = directoryMember.uid
                                showRequestPage = true
                            }
                        )
                    }
                }
            }

            item {
                SectionHeading("Your request records")
            }
            if (selectedOutgoingRequests.isEmpty()) {
                item {
                    EmptyStateCard("No request records sent to this selected member yet.")
                }
            } else {
                items(selectedOutgoingRequests.take(12), key = { it.id }) { request ->
                    RequestRecordCard(
                        request = request,
                        headline = if (request.requestKind == "area") formatMeetUpLabel(request) else requestTypeLabel(request.type),
                        subline = if (request.requestKind == "area") {
                            request.areaPitch.ifBlank { "Meet-up request" }
                        } else {
                            "${mealModeLabel(request.mealMode)} • ${experienceLabel(request.experienceLevel)}"
                        }
                    )
                }
            }
        }

        if (!showRequestPage) {
            item {
                SectionHeading("Incoming meet-up requests")
            }
            if (incomingAreaRequests.isEmpty()) {
                item {
                    EmptyStateCard("No incoming meet-up requests yet.")
                }
            } else {
                items(incomingAreaRequests.take(12), key = { it.id }) { request ->
                    IncomingRequestCard(
                        request = request,
                        isUpdating = uiState.activeRequestUpdateId == request.id,
                        onAccept = { meetUpViewModel.updateRequestStatus(request.id, "accepted") },
                        onDecline = { meetUpViewModel.updateRequestStatus(request.id, "declined") }
                    )
                }
            }

            item {
                SectionHeading("Incoming call requests")
            }
            if (incomingCallRequests.isEmpty()) {
                item {
                    EmptyStateCard("No incoming call requests yet.")
                }
            } else {
                items(incomingCallRequests.take(12), key = { it.id }) { request ->
                    IncomingRequestCard(
                        request = request,
                        isUpdating = uiState.activeRequestUpdateId == request.id,
                        onAccept = { meetUpViewModel.updateRequestStatus(request.id, "accepted") },
                        onDecline = { meetUpViewModel.updateRequestStatus(request.id, "declined") }
                    )
                }
            }
        }
    }
}

@Composable
private fun RequestMeetUpHeroCard(
    onBackToProfile: () -> Unit,
    onOpenFeed: () -> Unit,
    focusedMode: Boolean,
    selectedMember: MeetUpMember?,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = if (focusedMode) "SELECTED MEET-UP" else "REQUEST MEET-UP",
                style = MaterialTheme.typography.labelLarge,
                color = Color(0xFF6B5F4B),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = if (focusedMode) (selectedMember?.displayName ?: "Choose a user to meet") else "Choose a user to meet",
                style = MaterialTheme.typography.headlineMedium,
                color = Color(0xFF1F2933),
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = if (focusedMode) {
                    "${selectedMember?.role ?: "Member"} profile. Pick the right meet-up area, choose the setting that fits this level of access and energy, then submit your request."
                } else {
                    "Select any member and send a meet-up request to their profile."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF52616B)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                WebsitePillButton("Profile", onBackToProfile)
                WebsitePillButton("Home", onOpenFeed)
            }
        }
    }
}

@Composable
private fun WebsitePillButton(label: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(999.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFD7CDBD))
    ) {
        Text(
            text = label,
            color = Color(0xFF101828),
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun FocusedMeetUpCard(
    member: MeetUpMember,
    selectedVideo: MeetUpVideoPreview?,
    matchingVideos: List<MeetUpVideoPreview>,
    selectedVideoId: String,
    onVideoSelected: (String) -> Unit,
    onBackToDirectory: () -> Unit,
    requestLabel: String,
) {
    val context = LocalContext.current
    val player = remember(context) {
        ExoPlayer.Builder(context).build().apply {
            playWhenReady = true
            repeatMode = Player.REPEAT_MODE_ONE
        }
    }
    val playbackUrl = selectedVideo?.preferredPlaybackUrl()

    DisposableEffect(player) {
        onDispose { player.release() }
    }

    LaunchedEffect(selectedVideo?.id, playbackUrl) {
        if (!playbackUrl.isNullOrBlank()) {
            player.setMediaItem(MediaItem.fromUri(Uri.parse(playbackUrl)))
            player.repeatMode = Player.REPEAT_MODE_ONE
            player.prepare()
            player.playWhenReady = true
            player.play()
        } else {
            player.stop()
            player.clearMediaItems()
        }
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(70.dp)
                    .background(
                        brush = Brush.linearGradient(listOf(Color(0xFFFF7A59), Color(0xFFFF4D9D))),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = member.displayName.take(1).uppercase(),
                    color = Color.White,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.ExtraBold
                )
            }

            if (!playbackUrl.isNullOrBlank()) {
                PlayerCard(player = player)
            } else {
                EmptyStateCard("This selected meet-up video does not have a playable URL yet.")
            }

            Text(
                text = requestLabel,
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF4C4C4C)
            )

            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0xFFE2D8C8))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "VIDEOS FOR ${selectedVideo?.areaTitle?.ifBlank { "THIS AREA" } ?: "THIS AREA"}".uppercase(),
                        style = MaterialTheme.typography.labelLarge,
                        color = Color(0xFF6B5F4B),
                        fontWeight = FontWeight.Bold
                    )
                    if (matchingVideos.isEmpty()) {
                        Text("No area videos returned yet.", color = Color(0xFF52616B))
                    } else {
                        matchingVideos.take(6).forEach { video ->
                            VideoListRow(
                                video = video,
                                selected = video.id == selectedVideoId,
                                onClick = { onVideoSelected(video.id) }
                            )
                        }
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = onBackToDirectory, shape = RoundedCornerShape(10.dp)) {
                    Text("Back to directory")
                }
            }
        }
    }
}

@Composable
private fun PlayerCard(player: ExoPlayer) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF101828)),
        shape = RoundedCornerShape(20.dp)
    ) {
        AndroidView(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp),
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    this.player = player
                    useController = true
                    controllerAutoShow = true
                    controllerHideOnTouch = true
                    setShowFastForwardButton(false)
                    setShowRewindButton(false)
                    setShowPreviousButton(false)
                    setShowNextButton(false)
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                    setShutterBackgroundColor(android.graphics.Color.BLACK)
                }
            },
            update = { view ->
                view.player = player
                view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            }
        )
    }
}

private fun MeetUpVideoPreview.preferredPlaybackUrl(): String? {
    return mobileUrl?.takeIf { !it.isNullOrBlank() }
        ?: streamUrl?.takeIf { !it.isNullOrBlank() }
        ?: desktopUrl?.takeIf { !it.isNullOrBlank() }
        ?: originalUrl?.takeIf { !it.isNullOrBlank() }
        ?: fileUrl?.takeIf { !it.isNullOrBlank() }
}

@Composable
private fun VideoListRow(
    video: MeetUpVideoPreview,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, if (selected) Color(0xFF101828) else Color(0xFFD7CDBD)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(width = 42.dp, height = 28.dp)
                    .background(Color(0xFF101828), RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text("▶", color = Color.White, fontWeight = FontWeight.Bold)
            }
            Text(
                text = video.title,
                color = Color(0xFF101828),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun SearchCard(
    searchTerm: String,
    onSearchChange: (String) -> Unit,
    memberCount: Int,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Choose a user to meet",
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold
            )
            OutlinedTextField(
                value = searchTerm,
                onValueChange = onSearchChange,
                label = { Text("Search users", color = Color(0xFF5A534A)) },
                textStyle = TextStyle(color = Color(0xFF101828)),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color(0xFF101828),
                    unfocusedTextColor = Color(0xFF101828),
                    focusedBorderColor = Color(0xFF101828),
                    unfocusedBorderColor = Color(0xFFD7CDBD),
                    cursorColor = Color(0xFF101828),
                    focusedLabelColor = Color(0xFF5A534A),
                    unfocusedLabelColor = Color(0xFF5A534A),
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Text(
                text = "$memberCount members available",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF5A534A)
            )
        }
    }
}

@Composable
private fun MemberCard(
    member: MeetUpMember,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Color(0xFFFFF7E5) else Color.White
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .background(Color(0xFF111111), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = member.displayName.take(1).uppercase(),
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = member.displayName,
                    color = Color(0xFF111111),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(text = member.role, color = Color(0xFF665B4A), style = MaterialTheme.typography.bodySmall)
                Text(text = member.subtitle, color = Color(0xFF665B4A), style = MaterialTheme.typography.bodySmall)
            }
            if (isSelected) {
                Text(
                    text = "Selected",
                    color = Color(0xFF8A5A00),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun SelectedMemberCard(member: MeetUpMember) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Selected member",
                style = MaterialTheme.typography.labelLarge,
                color = Color(0xFF8A5A00),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = member.displayName,
                style = MaterialTheme.typography.titleLarge,
                color = Color(0xFF111111),
                fontWeight = FontWeight.ExtraBold
            )
            Text(text = member.role, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodyMedium)
            Text(text = member.subtitle, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun ExperienceLevelCard(
    level: MeetUpExperienceLevel,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) Color(0xFFFFF7E5) else Color.White
        ),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${level.badge} ${level.title}",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color(0xFF111111),
                    fontWeight = FontWeight.Bold
                )
                if (selected) {
                    Text("Active", color = Color(0xFF8A5A00), fontWeight = FontWeight.Bold)
                }
            }
            Text(text = level.blurb, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                level.notes.forEach { note ->
                    SelectChip(label = note, selected = selected, onClick = onClick)
                }
            }
        }
    }
}

@Composable
private fun AreaCard(
    area: MeetUpArea,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) Color(0xFFFFF7E5) else Color.White
        ),
        shape = RoundedCornerShape(18.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(text = area.icon, style = MaterialTheme.typography.headlineSmall)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = area.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = Color(0xFF111111),
                    fontWeight = FontWeight.Bold
                )
                Text(text = area.pitch, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun MeetUpPreviewCard(
    selectedArea: MeetUpArea,
    experienceLevel: String,
    matchingVideos: List<MeetUpVideoPreview>,
    selectedVideoId: String,
    onVideoSelected: (String) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Meet-Up Request",
                style = MaterialTheme.typography.titleLarge,
                color = Color(0xFF111111),
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = "${selectedArea.icon} ${selectedArea.title}",
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${selectedArea.pitch}\n${experienceLabel(experienceLevel)}",
                color = Color(0xFF4C4C4C),
                style = MaterialTheme.typography.bodySmall
            )
            if (matchingVideos.isEmpty()) {
                Text(
                    text = "No meet-up preview videos were returned for this area yet.",
                    color = Color(0xFF665B4A),
                    style = MaterialTheme.typography.bodySmall
                )
            } else {
                Text(
                    text = "Area videos",
                    style = MaterialTheme.typography.labelLarge,
                    color = Color(0xFF8A5A00),
                    fontWeight = FontWeight.Bold
                )
                matchingVideos.take(6).forEach { video ->
                    SelectChip(
                        label = if (video.id == selectedVideoId) "Selected: ${video.title}" else video.title,
                        selected = video.id == selectedVideoId,
                        onClick = { onVideoSelected(video.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun RequestActionCard(
    title: String,
    body: String,
    buttonLabel: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold
            )
            Text(text = body, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
            Button(onClick = onClick, enabled = enabled, shape = RoundedCornerShape(10.dp)) {
                Text(buttonLabel)
            }
        }
    }
}

@Composable
private fun CallRequestCard(
    requestNote: String,
    onRequestNoteChange: (String) -> Unit,
    callType: String,
    isSubmitting: Boolean,
    onSubmit: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Call Request",
                style = MaterialTheme.typography.titleLarge,
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold
            )
            OutlinedTextField(
                value = requestNote,
                onValueChange = onRequestNoteChange,
                label = { Text("Short note", color = Color(0xFF5A534A)) },
                textStyle = TextStyle(color = Color(0xFF101828)),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color(0xFF101828),
                    unfocusedTextColor = Color(0xFF101828),
                    focusedBorderColor = Color(0xFF101828),
                    unfocusedBorderColor = Color(0xFFD7CDBD),
                    cursorColor = Color(0xFF101828),
                    focusedLabelColor = Color(0xFF5A534A),
                    unfocusedLabelColor = Color(0xFF5A534A),
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = onSubmit,
                enabled = !isSubmitting,
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(
                    if (isSubmitting) {
                        "Sending ${requestTypeLabel(callType)} Request..."
                    } else {
                        "Request ${requestTypeLabel(callType)}"
                    }
                )
            }
        }
    }
}

@Composable
private fun IncomingRequestCard(
    request: MeetUpRequestRecord,
    isUpdating: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = request.requesterName,
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold
            )
            Text(
                text = if (request.requestKind == "area") formatMeetUpLabel(request) else requestTypeLabel(request.type),
                color = Color(0xFF4C4C4C),
                style = MaterialTheme.typography.bodySmall
            )
            if (request.areaPitch.isNotBlank()) {
                Text(text = request.areaPitch, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
            }
            if (request.note.isNotBlank() && request.requestKind != "area") {
                Text(text = request.note, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
            }
            RequestStatusPill(status = request.status)
            if (request.status == "pending") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = onAccept, enabled = !isUpdating, shape = RoundedCornerShape(10.dp)) {
                        Text(if (isUpdating) "Updating..." else "Accept")
                    }
                    Button(onClick = onDecline, enabled = !isUpdating, shape = RoundedCornerShape(10.dp)) {
                        Text(if (isUpdating) "Updating..." else "Decline")
                    }
                }
            }
        }
    }
}

@Composable
private fun RequestRecordCard(
    request: MeetUpRequestRecord,
    headline: String,
    subline: String,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = request.starName,
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF111111),
                fontWeight = FontWeight.Bold
            )
            Text(text = headline, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
            Text(text = subline, color = Color(0xFF4C4C4C), style = MaterialTheme.typography.bodySmall)
            RequestStatusPill(status = request.status)
        }
    }
}

@Composable
private fun RequestStatusPill(status: String) {
    val background = when (status.lowercase()) {
        "accepted" -> Color(0xFFE6F7ED)
        "declined" -> Color(0xFFFDECEC)
        else -> Color(0xFFF5EEE2)
    }
    val foreground = when (status.lowercase()) {
        "accepted" -> Color(0xFF177245)
        "declined" -> Color(0xFFB42318)
        else -> Color(0xFF5C4B33)
    }

    Surface(
        shape = RoundedCornerShape(999.dp),
        color = background
    ) {
        Text(
            text = status.replaceFirstChar { it.uppercase() },
            color = foreground,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
        )
    }
}

@Composable
private fun EmptyStateCard(message: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(16.dp),
            color = Color(0xFF4C4C4C)
        )
    }
}

@Composable
private fun StatusCard(
    title: String,
    body: String,
    accent: Color,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = title,
                color = accent,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
            Text(text = body, color = Color(0xFF333333), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun SelectChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(999.dp),
        color = if (selected) Color(0xFF111111) else Color.White,
        border = BorderStroke(1.dp, if (selected) Color(0xFF111111) else Color(0xFFD8CCBA))
    ) {
        Text(
            text = label,
            color = if (selected) Color.White else Color(0xFF111111),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}

@Composable
private fun SectionHeading(title: String) {
    Text(
        text = title,
        color = Color(0xFF111111),
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.ExtraBold,
        modifier = Modifier.padding(horizontal = 2.dp)
    )
}

