package com.app.natureswayproduction.nativeapp.feature.feed

import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.app.natureswayproduction.R
import com.app.natureswayproduction.nativeapp.feature.menu.GlobalMenuSheet
import com.app.natureswayproduction.nativeapp.feature.menu.MenuEntry
import com.app.natureswayproduction.nativeapp.feature.watch.VideoCommentItem
import com.app.natureswayproduction.nativeapp.feature.watch.WatchActionRepository
import com.app.natureswayproduction.nativeapp.feature.watch.WatchMember
import com.app.natureswayproduction.nativeapp.feature.watch.WatchPanelPayload
import com.app.natureswayproduction.nativeapp.feature.watch.WatchMeetUpRequest
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonMuted
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class SupportChoice(
    val key: String,
    val icon: String,
    val title: String,
    val costLabel: String,
    val note: String,
    val creatorXp: Int,
    val rankBoost: Int,
)

private data class SprayNoteChoice(
    val id: String,
    val amount: Int,
    val currency: String,
    val drawableRes: Int,
)

private enum class SupportSheetMode {
    SPRAY,
    BOTTLE,
}

private data class FeedActionFeedback(
    val actionKey: String,
    val label: String,
    val amountParag: Int = 0,
    val amountGbazilo: Int = 0,
)

private val sprayNoteChoices = listOf(
    SprayNoteChoice("p1", 1, "PARAG", R.drawable.spray_note_p1),
    SprayNoteChoice("g1", 1, "GBAZILO", R.drawable.spray_note_g1),
    SprayNoteChoice("p10", 10, "PARAG", R.drawable.spray_note_p10),
    SprayNoteChoice("g10", 10, "GBAZILO", R.drawable.spray_note_g10),
    SprayNoteChoice("p50", 50, "PARAG", R.drawable.spray_note_p50),
    SprayNoteChoice("g50", 50, "GBAZILO", R.drawable.spray_note_g50),
    SprayNoteChoice("p100", 100, "PARAG", R.drawable.spray_note_p100),
    SprayNoteChoice("g100", 100, "GBAZILO", R.drawable.spray_note_g100),
)

private val bottleChoices = listOf(
    SupportChoice("mineral", "🥤", "Mineral", "2 PARAG", "Clean support drop", 2, 1),
    SupportChoice("malt", "🥛", "Malt", "3 PARAG", "Smooth fan energy", 4, 2),
    SupportChoice("juice", "🧃", "Juice", "4 PARAG", "Fresh spotlight lift", 6, 3),
    SupportChoice("mocktail", "🍹", "Mocktail", "5 PARAG", "Styled celebration push", 8, 5),
    SupportChoice("beer", "🍺", "Beer", "6 PARAG", "Crowd mood booster", 12, 8),
    SupportChoice("gin", "🍸", "Gin", "7 PARAG", "Sharper stage glow", 15, 10),
    SupportChoice("rum", "🥃", "Rum", "8 PARAG", "Heavy fan respect", 18, 12),
    SupportChoice("vodka", "🍾", "Vodka", "9 PARAG", "Big celebration wave", 22, 15),
    SupportChoice("whiskey", "🧊", "Whiskey", "1 GBAZILO", "Premium spotlight burst", 50, 30),
    SupportChoice("cocktail", "🍸", "Cocktail", "2 PARAG • 1 GBAZILO", "Ultimate party trigger", 70, 50),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    feedViewModel: FeedViewModel,
    isSignedIn: Boolean,
    currentUserUid: String?,
    isAdmin: Boolean,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenWalletFunding: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onOpenCitizenContestants: () -> Unit,
    onOpenSuperbossDirectory: () -> Unit,
    onOpenBackerDirectory: () -> Unit,
    onOpenAmbassadorDirectory: () -> Unit,
    onOpenMerchantMarketplace: () -> Unit,
    onOpenUserAbout: () -> Unit,
    onOpenSponsorInvestorAbout: () -> Unit,
    onOpenAboutPlanet: () -> Unit,
    onOpenPrivacyPolicy: () -> Unit,
    onOpenAdmin: () -> Unit,
    onSignOut: () -> Unit,
    onOpenWatch: (FeedCard) -> Unit,
) {
    val state by feedViewModel.uiState.collectAsState()
    val pagerState = rememberPagerState(pageCount = { state.items.size })
    LaunchedEffect(pagerState.currentPage, state.items) {
        state.items.getOrNull(pagerState.currentPage)?.let(feedViewModel::selectItem)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (state.items.isEmpty()) {
            EmptyFeedState(
                summary = state.summary,
                errorMessage = state.errorMessage,
                onRefresh = feedViewModel::refresh
            )
        } else {
            VerticalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { page ->
                val item = state.items[page]
                FeedStagePage(
                    item = item,
                    isActive = pagerState.currentPage == page,
                    isSignedIn = isSignedIn,
                    currentUserUid = currentUserUid,
                    onOpenUpload = onOpenUpload,
                    onOpenProfile = onOpenProfile,
                    onOpenSignIn = onOpenSignIn,
                    onOpenWallet = onOpenWallet,
                    onOpenWalletFunding = onOpenWalletFunding,
                    onOpenMeetUp = onOpenMeetUp,
                    onOpenCitizenContestants = onOpenCitizenContestants,
                    onOpenSuperbossDirectory = onOpenSuperbossDirectory,
                    onOpenBackerDirectory = onOpenBackerDirectory,
                    onOpenAmbassadorDirectory = onOpenAmbassadorDirectory,
                    onOpenMerchantMarketplace = onOpenMerchantMarketplace,
                    onOpenUserAbout = onOpenUserAbout,
                    onOpenSponsorInvestorAbout = onOpenSponsorInvestorAbout,
                    onOpenAboutPlanet = onOpenAboutPlanet,
                    onOpenPrivacyPolicy = onOpenPrivacyPolicy,
                    onSignOut = onSignOut,
                    onRefreshFeed = feedViewModel::refresh,
                    onOpenWatch = { onOpenWatch(item) }
                )
            }
        }

        TopStageBar(
            isSignedIn = isSignedIn,
            isAdmin = isAdmin,
            onOpenUpload = onOpenUpload,
            onOpenProfile = onOpenProfile,
            onOpenSignIn = onOpenSignIn,
            onOpenAdmin = onOpenAdmin,
            onSignOut = onSignOut,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedStagePage(
    item: FeedCard,
    isActive: Boolean,
    isSignedIn: Boolean,
    currentUserUid: String?,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenWalletFunding: () -> Unit,
    onOpenMeetUp: () -> Unit,
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
    onRefreshFeed: () -> Unit,
    onOpenWatch: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val watchRepository = remember { WatchActionRepository() }
    val player = remember(context, item.id) {
        ExoPlayer.Builder(context).build().apply {
            repeatMode = ExoPlayer.REPEAT_MODE_ONE
            playWhenReady = false
            volume = 0f
        }
    }
    val playbackUrl = item.preferredPlaybackUrl()
    var showMenu by remember { mutableStateOf(false) }
    var showFollowPanel by remember { mutableStateOf(false) }
    var isLoadingPanel by remember { mutableStateOf(false) }
    var panelData by remember { mutableStateOf(WatchPanelPayload(emptyList(), emptyList())) }
    var isSaved by remember(item.id, currentUserUid) { mutableStateOf(false) }
    var isFollowingCreator by remember(item.id, currentUserUid) { mutableStateOf(false) }
    var statusNotice by remember { mutableStateOf<String?>(null) }
    var actionFeedback by remember(item.id) { mutableStateOf<FeedActionFeedback?>(null) }
    var localVoteCount by remember(item.id) { mutableStateOf(item.supportCount) }
    var localCommentCount by remember(item.id) { mutableStateOf(item.commentCount) }
    var localPourCount by remember(item.id) { mutableStateOf(item.pourCount) }
    var localSprayCount by remember(item.id) { mutableStateOf(item.sprayCount) }
    var localBottleCount by remember(item.id) { mutableStateOf(item.bottleCount) }
    var showCommentSheet by remember { mutableStateOf(false) }
    var isLoadingComments by remember { mutableStateOf(false) }
    var comments by remember { mutableStateOf<List<VideoCommentItem>>(emptyList()) }
    var commentDraft by remember { mutableStateOf("") }
    var isPostingComment by remember { mutableStateOf(false) }
    var showSupportSheet by remember { mutableStateOf(false) }
    var showSprayPicker by remember { mutableStateOf(false) }
    var supportSheetMode by remember { mutableStateOf(SupportSheetMode.SPRAY) }
    var isSendingVote by remember { mutableStateOf(false) }
    var processingSupportKey by remember { mutableStateOf("") }
    var supportError by remember { mutableStateOf("") }

    LaunchedEffect(playbackUrl) {
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

    LaunchedEffect(isActive, playbackUrl) {
        if (playbackUrl.isNullOrBlank()) {
            player.volume = 0f
            player.playWhenReady = false
            player.pause()
        } else if (isActive) {
            player.volume = 1f
            player.playWhenReady = true
            player.play()
        } else {
            player.volume = 0f
            player.playWhenReady = false
            player.pause()
        }
    }

    DisposableEffect(player) {
        onDispose {
            player.volume = 0f
            player.playWhenReady = false
            player.release()
        }
    }

    LaunchedEffect(actionFeedback) {
        if (actionFeedback != null) {
            kotlinx.coroutines.delay(1200)
            actionFeedback = null
        }
    }

    LaunchedEffect(item.id, currentUserUid, isSignedIn) {
        if (!isSignedIn || currentUserUid.isNullOrBlank()) {
            isSaved = false
            isFollowingCreator = false
            return@LaunchedEffect
        }

        isSaved = runCatching { watchRepository.isSaved(currentUserUid, item.id) }.getOrDefault(false)
        isFollowingCreator = item.creatorUid
            ?.takeIf { it.isNotBlank() && it != currentUserUid }
            ?.let { creatorUid ->
                runCatching { watchRepository.isFollowing(currentUserUid, creatorUid) }.getOrDefault(false)
            } ?: false
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (!playbackUrl.isNullOrBlank()) {
            WebsiteParityNativePlayer(
                player = player,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF181818), Color(0xFF070707))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = item.title,
                    color = Color.White,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }


        val feedback = actionFeedback
        if (feedback != null) {
            FeedActionFeedbackOverlay(
                modifier = Modifier.align(Alignment.Center),
                feedback = feedback
            )
        }

        Row(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 10.dp, bottom = 118.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            if (showSprayPicker) {
                InlineSprayNotePicker(
                    options = sprayNoteChoices,
                    isProcessing = processingSupportKey == "spray_money",
                    onSelect = { note ->
                        if (processingSupportKey == "spray_money") return@InlineSprayNotePicker
                        if (item.creatorUid == currentUserUid) {
                            supportError = "You cannot support your own video."
                            statusNotice = "You cannot support your own video."
                            return@InlineSprayNotePicker
                        }
                        processingSupportKey = "spray_money"
                        supportError = ""
                        scope.launch {
                            runCatching {
                                watchRepository.sendSprayMoney(
                                    item,
                                    customParagAmount = if (note.currency == "PARAG") note.amount else 0,
                                    customGbaziloAmount = if (note.currency == "GBAZILO") note.amount else 0
                                )
                            }
                                .onSuccess {
                                    localSprayCount += 1
                                    actionFeedback = FeedActionFeedback(
                                        actionKey = "spray_money",
                                        label = "Spray Money",
                                        amountParag = if (note.currency == "PARAG") note.amount else 0,
                                        amountGbazilo = if (note.currency == "GBAZILO") note.amount else 0
                                    )
                                    statusNotice = if (note.currency == "GBAZILO") {
                                        "Gbazilo spray sent"
                                    } else {
                                        "Parag spray sent"
                                    }
                                }
                                .onFailure {
                                    val message = it.toSupportActionMessage()
                                    supportError = message
                                    statusNotice = message
                                    if (shouldRedirectSupportErrorToWallet(message)) {
                                        onOpenWallet()
                                    }
                                }
                            processingSupportKey = ""
                        }
                    }
                )
            }
            RightActionRail(
                supportCount = localVoteCount,
                pourCount = localPourCount,
                sprayCount = localSprayCount,
                bottleCount = localBottleCount,
                onVote = {
                if (!isSignedIn) {
                    onOpenSignIn()
                    return@RightActionRail
                }
                if (isSendingVote) return@RightActionRail
                isSendingVote = true
                scope.launch {
                    runCatching { watchRepository.sendVote(item) }
                        .onSuccess {
                            showSprayPicker = false
                            localVoteCount += 1
                            actionFeedback = FeedActionFeedback(actionKey = "vote", label = "Vote")
                            statusNotice = "Vote sent"
                        }
                        .onFailure {
                            val message = it.message ?: "Could not send vote right now"
                            if (message.contains("Insufficient PARAG balance", ignoreCase = true)) {
                                onOpenWalletFunding()
                            } else {
                                statusNotice = message
                            }
                        }
                    isSendingVote = false
                }
            },
            onOpenPourWater = {
                if (!isSignedIn) {
                    onOpenSignIn()
                    return@RightActionRail
                }
                if (item.creatorUid == currentUserUid) {
                    supportError = "You cannot support your own video."
                    statusNotice = "You cannot support your own video."
                    return@RightActionRail
                }
                if (processingSupportKey == "pour_me_water") return@RightActionRail
                processingSupportKey = "pour_me_water"
                supportError = ""
                scope.launch {
                    runCatching { watchRepository.sendSpraySupport(item) }
                        .onSuccess {
                            showSprayPicker = false
                            localPourCount += 1
                            actionFeedback = FeedActionFeedback(actionKey = "pour_me_water", label = "Pour Me Water")
                            statusNotice = "Pour Me Water sent"
                        }
                        .onFailure {
                            val message = it.toSupportActionMessage()
                            supportError = message
                            statusNotice = message
                            if (shouldRedirectSupportErrorToWallet(message)) {
                                onOpenWallet()
                            }
                        }
                    processingSupportKey = ""
                }
            },
            onOpenSupport = {
                if (!isSignedIn) {
                    onOpenSignIn()
                    return@RightActionRail
                }
                supportError = ""
                showSprayPicker = !showSprayPicker
            },
            onOpenBottle = {
                if (!isSignedIn) {
                    onOpenSignIn()
                    return@RightActionRail
                }
                showSprayPicker = false
                supportSheetMode = SupportSheetMode.BOTTLE
                supportError = ""
                showSupportSheet = true
            }
        )
        }

        StageMeta(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .padding(start = 14.dp, end = 84.dp, bottom = 54.dp),
            item = item,
            onOpenWatch = onOpenWatch
        )

        FeedFooterActions(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(end = 18.dp, bottom = 8.dp),
            isSaved = isSaved,
            onHome = onRefreshFeed,
            onFollow = {
                if (!isSignedIn) {
                    onOpenSignIn()
                    return@FeedFooterActions
                }
                onOpenMeetUp()
            },
            viewCount = item.viewCount,
            commentCount = localCommentCount,
            onComments = {
                showCommentSheet = true
                isLoadingComments = true
                scope.launch {
                    comments = runCatching { watchRepository.loadComments(item.id) }
                        .getOrElse {
                            statusNotice = "Could not load comments right now"
                            emptyList()
                        }
                    isLoadingComments = false
                }
            },
            onSave = {
                if (!isSignedIn || currentUserUid.isNullOrBlank()) {
                    onOpenSignIn()
                    return@FeedFooterActions
                }
                scope.launch {
                    runCatching { watchRepository.toggleSaved(currentUserUid, item) }
                        .onSuccess { saved ->
                            isSaved = saved
                            statusNotice = if (saved) "Saved to Watch Later" else "Removed from Save / Watch"
                        }
                        .onFailure {
                            statusNotice = "Could not update Save / Watch right now"
                        }
                }
            },
            onMenu = { showMenu = true }
        )

        statusNotice?.let { notice ->
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color(0xCC151515),
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .navigationBarsPadding()
                    .padding(start = 14.dp, end = 90.dp, bottom = 8.dp)
            ) {
                Text(
                    text = notice,
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
                )
            }
        }
    }

    if (showMenu) {
        GlobalMenuSheet(
            onDismiss = { showMenu = false },
            entries = listOf(
                MenuEntry("Marketplace", "Digital products from Paragon Merchants") { showMenu = false; onOpenMerchantMarketplace() },
                MenuEntry("The Citizen Contestants", "About Citizen Contestants") { showMenu = false; onOpenCitizenContestants() },
                MenuEntry("Paragon Superbosses", "The Mentors") { showMenu = false; onOpenSuperbossDirectory() },
                MenuEntry("Paragon Backers", "The Service Providers for Backer Contestants") { showMenu = false; onOpenBackerDirectory() },
                MenuEntry("Paragon Ambassadors", "The Talent Ambassadors") { showMenu = false; onOpenAmbassadorDirectory() },
                MenuEntry("Paragon Users", "Viewers, voters, buyers, and supporters") { showMenu = false; onOpenUserAbout() },
                MenuEntry("Paragon Sponsors / Investors", "Partnerships, funding, and ecosystem support") { showMenu = false; onOpenSponsorInvestorAbout() },
                MenuEntry("About Paragon Planet", "The app and reality system") { showMenu = false; onOpenAboutPlanet() },
                MenuEntry("Privacy Policy", "Data, safety, payments, and user rights") { showMenu = false; onOpenPrivacyPolicy() },
            )
        )
    }

    if (showFollowPanel) {
        val creatorMember = item.creatorUid?.takeIf { it.isNotBlank() }?.let { creatorUid ->
            panelData.members.firstOrNull { it.uid == creatorUid } ?: WatchMember(
                uid = creatorUid,
                role = item.category,
                displayName = item.performer,
                email = "",
                subtitle = item.category,
            )
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
                    text = "Meet-ups",
                    color = ParagonMuted,
                    style = MaterialTheme.typography.labelLarge
                )
                Text(
                    text = "Meet-ups with friends",
                    color = Color.White,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                if (creatorMember != null) {
                    FeedCreatorCard(
                        member = creatorMember,
                        isFollowing = isFollowingCreator,
                        canFollow = !currentUserUid.isNullOrBlank() && creatorMember.uid != currentUserUid,
                        onFollowToggle = {
                            if (currentUserUid.isNullOrBlank()) {
                                onOpenSignIn()
                                return@FeedCreatorCard
                            }
                            scope.launch {
                                runCatching { watchRepository.toggleFollow(currentUserUid, creatorMember) }
                                    .onSuccess { following ->
                                        isFollowingCreator = following
                                        statusNotice = if (following) "Following creator" else "Unfollowed"
                                    }
                                    .onFailure {
                                        statusNotice = "Could not update follow right now"
                                    }
                            }
                        },
                        onMeetUp = {
                            showFollowPanel = false
                            onOpenMeetUp()
                        }
                    )
                }

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
                            FeedMeetUpRequestCard(
                                request = request,
                                onOpen = {
                                    showFollowPanel = false
                                    onOpenMeetUp()
                                }
                            )
                        }
                    }
                    Text(
                        text = "Members",
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    panelData.members.forEach { member ->
                        FeedMemberRow(
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

    if (showCommentSheet) {
        ModalBottomSheet(
            onDismissRequest = { showCommentSheet = false },
            containerColor = Color(0xFF111111)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text("VIDEO DISCUSSION", color = ParagonMuted, style = MaterialTheme.typography.labelLarge)
                Text("Comments", color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                when {
                    isLoadingComments -> CircularProgressIndicator(color = ParagonGold)
                    comments.isEmpty() -> Text("No comments yet. Start the conversation.", color = ParagonMuted)
                    else -> comments.forEach { comment ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A1A))) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(comment.userName, color = Color.White, fontWeight = FontWeight.Bold)
                                Text(comment.text, color = ParagonMuted)
                            }
                        }
                    }
                }
                OutlinedTextField(
                    value = commentDraft,
                    onValueChange = { commentDraft = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Write a comment") }
                )
                Button(
                    onClick = {
                        if (commentDraft.isBlank()) {
                            statusNotice = "Write a comment first"
                            return@Button
                        }
                        isPostingComment = true
                        scope.launch {
                            runCatching { watchRepository.addComment(item, commentDraft) }
                                .onSuccess {
                                    commentDraft = ""
                                    comments = watchRepository.loadComments(item.id)
                                    localCommentCount = comments.size
                                    statusNotice = "Comment posted"
                                }
                                .onFailure {
                                    statusNotice = it.message ?: "Could not post comment right now"
                                }
                            isPostingComment = false
                        }
                    },
                    enabled = !isPostingComment
                ) {
                    Text(if (isPostingComment) "Sending..." else "Post Comment")
                }
            }
        }
    }

    if (showSupportSheet) {
        ModalBottomSheet(
            onDismissRequest = { showSupportSheet = false },
            containerColor = Color.Transparent
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 14.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("PARAGON SUPPORT", color = Color(0xFF475467), style = MaterialTheme.typography.labelSmall)
                            Text(
                                if (supportSheetMode == SupportSheetMode.SPRAY) "Spray Money" else "Pop a Bottle 4 Me",
                                color = Color(0xFF101828),
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(999.dp),
                            color = Color.White,
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD0D5DD)),
                            modifier = Modifier.clickable { showSupportSheet = false }
                        ) {
                            Text(
                                "Close",
                                color = Color(0xFF101828),
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }

                    val horizontalScrollState = rememberScrollState()
                    if (supportSheetMode == SupportSheetMode.SPRAY) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(horizontalScrollState),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            SupportOptionCard(
                                modifier = Modifier.width(190.dp),
                                icon = "💸",
                                title = "Parag",
                                costLabel = "1 PARAG",
                                note = "Tap to spray 1 Parag at a time.",
                                creatorXp = 2,
                                rankBoost = 1,
                                buttonLabel = if (processingSupportKey == "spray_money") "..." else "Tap",
                                enabled = processingSupportKey != "spray_money",
                                onClick = {
                                    if (processingSupportKey == "spray_money") return@SupportOptionCard
                                    if (item.creatorUid == currentUserUid) {
                                        supportError = "You cannot support your own video."
                                        statusNotice = "You cannot support your own video."
                                        return@SupportOptionCard
                                    }
                                    processingSupportKey = "spray_money"
                                    supportError = ""
                                    scope.launch {
                                        runCatching { watchRepository.sendSprayMoney(item, customParagAmount = 1, customGbaziloAmount = 0) }
                                            .onSuccess {
                                                localSprayCount += 1
                                                actionFeedback = FeedActionFeedback(
                                                    actionKey = "spray_money",
                                                    label = "Spray Money",
                                                    amountParag = 1
                                                )
                                                statusNotice = "Parag spray sent"
                                            }
                                            .onFailure {
                                                val message = it.toSupportActionMessage()
                                                supportError = message
                                                statusNotice = message
                                                if (shouldRedirectSupportErrorToWallet(message)) {
                                                    onOpenWallet()
                                                }
                                            }
                                        processingSupportKey = ""
                                    }
                                }
                            )
                            SupportPreviewCard(
                                modifier = Modifier.width(270.dp),
                                item = item,
                                stageLine = "Tap Parag or Gbazilo to spray support live"
                            )
                            SupportOptionCard(
                                modifier = Modifier.width(190.dp),
                                icon = "💸",
                                title = "Gbazilo",
                                costLabel = "1 GBAZILO",
                                note = "Tap to spray 1 Gbazilo at a time.",
                                creatorXp = 50,
                                rankBoost = 30,
                                buttonLabel = if (processingSupportKey == "spray_money") "..." else "Tap",
                                enabled = processingSupportKey != "spray_money",
                                onClick = {
                                    if (processingSupportKey == "spray_money") return@SupportOptionCard
                                    if (item.creatorUid == currentUserUid) {
                                        supportError = "You cannot support your own video."
                                        statusNotice = "You cannot support your own video."
                                        return@SupportOptionCard
                                    }
                                    processingSupportKey = "spray_money"
                                    supportError = ""
                                    scope.launch {
                                        runCatching { watchRepository.sendSprayMoney(item, customParagAmount = 0, customGbaziloAmount = 1) }
                                            .onSuccess {
                                                localSprayCount += 1
                                                actionFeedback = FeedActionFeedback(
                                                    actionKey = "spray_money",
                                                    label = "Spray Money",
                                                    amountGbazilo = 1
                                                )
                                                statusNotice = "Gbazilo spray sent"
                                            }
                                            .onFailure {
                                                val message = it.toSupportActionMessage()
                                                supportError = message
                                                statusNotice = message
                                                if (shouldRedirectSupportErrorToWallet(message)) {
                                                    onOpenWallet()
                                                }
                                            }
                                        processingSupportKey = ""
                                    }
                                }
                            )
                        }
                    } else {
                        val leftChoices = bottleChoices.take(5)
                        val rightChoices = bottleChoices.drop(5)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(horizontalScrollState),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Column(
                                modifier = Modifier.width(190.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                leftChoices.forEach { choice ->
                                    SupportOptionCard(
                                        icon = choice.icon,
                                        title = choice.title,
                                        costLabel = choice.costLabel,
                                        note = choice.note,
                                        creatorXp = choice.creatorXp,
                                        rankBoost = choice.rankBoost,
                                        buttonLabel = if (processingSupportKey == choice.key) "..." else "Pop",
                                        enabled = processingSupportKey != choice.key,
                                        onClick = {
                                            if (processingSupportKey == choice.key) return@SupportOptionCard
                                            if (item.creatorUid == currentUserUid) {
                                                supportError = "You cannot support your own video."
                                                statusNotice = "You cannot support your own video."
                                                return@SupportOptionCard
                                            }
                                            processingSupportKey = choice.key
                                            supportError = ""
                                            scope.launch {
                                                runCatching { watchRepository.sendBottleSupport(item, choice.key) }
                                                    .onSuccess {
                                                        localBottleCount += 1
                                                        actionFeedback = FeedActionFeedback(actionKey = choice.key, label = choice.title)
                                                        statusNotice = "Pop ${choice.title} sent"
                                                        showSupportSheet = false
                                                    }
                                                    .onFailure {
                                                        val message = it.toSupportActionMessage()
                                                        supportError = message
                                                        statusNotice = message
                                                        if (shouldRedirectSupportErrorToWallet(message)) {
                                                            onOpenWallet()
                                                        }
                                                    }
                                                processingSupportKey = ""
                                            }
                                        }
                                    )
                                }
                            }
                            SupportPreviewCard(
                                modifier = Modifier.width(270.dp),
                                item = item,
                                stageLine = "Celebrate your favourite star for Paragon Citizen"
                            )
                            Column(
                                modifier = Modifier.width(190.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                rightChoices.forEach { choice ->
                                    SupportOptionCard(
                                        icon = choice.icon,
                                        title = choice.title,
                                        costLabel = choice.costLabel,
                                        note = choice.note,
                                        creatorXp = choice.creatorXp,
                                        rankBoost = choice.rankBoost,
                                        buttonLabel = if (processingSupportKey == choice.key) "..." else "Pop",
                                        enabled = processingSupportKey != choice.key,
                                        onClick = {
                                            if (processingSupportKey == choice.key) return@SupportOptionCard
                                            if (item.creatorUid == currentUserUid) {
                                                supportError = "You cannot support your own video."
                                                statusNotice = "You cannot support your own video."
                                                return@SupportOptionCard
                                            }
                                            processingSupportKey = choice.key
                                            supportError = ""
                                            scope.launch {
                                                runCatching { watchRepository.sendBottleSupport(item, choice.key) }
                                                    .onSuccess {
                                                        localBottleCount += 1
                                                        actionFeedback = FeedActionFeedback(actionKey = choice.key, label = choice.title)
                                                        statusNotice = "Pop ${choice.title} sent"
                                                        showSupportSheet = false
                                                    }
                                                    .onFailure {
                                                        val message = it.toSupportActionMessage()
                                                        supportError = message
                                                        statusNotice = message
                                                        if (shouldRedirectSupportErrorToWallet(message)) {
                                                            onOpenWallet()
                                                        }
                                                    }
                                                processingSupportKey = ""
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }

                    if (supportError.isNotBlank()) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFFFEF2F2)
                        ) {
                            Text(
                                text = supportError,
                                color = Color(0xFFB42318),
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WebsiteParityNativePlayer(
    player: ExoPlayer,
    modifier: Modifier = Modifier,
) {
    val configuration = LocalConfiguration.current
    val isMobile = configuration.screenWidthDp <= 768
    var isPlaying by remember(player) { mutableStateOf(false) }
    var isLoading by remember(player) { mutableStateOf(true) }
    var hasError by remember(player) { mutableStateOf(false) }
    var hasEnded by remember(player) { mutableStateOf(false) }
    var isMuted by remember(player) { mutableStateOf(player.volume == 0f) }
    var currentPosition by remember(player) { mutableStateOf(0L) }
    var duration by remember(player) { mutableStateOf(0L) }
    var isScrubbing by remember(player) { mutableStateOf(false) }
    var showControls by remember(player) { mutableStateOf(false) }
    var videoSize by remember(player) { mutableStateOf(VideoSize.UNKNOWN) }

    val isVertical = videoSize.height > 0 && videoSize.width > 0 && videoSize.height > videoSize.width
    val isLandscape = !isVertical
    val useContain = (isVertical && !isMobile) || (isLandscape && isMobile)

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
                if (playing) {
                    showControls = true
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                isLoading = playbackState == Player.STATE_BUFFERING || playbackState == Player.STATE_IDLE
                if (playbackState == Player.STATE_READY) {
                    duration = player.duration.coerceAtLeast(0L)
                    currentPosition = player.currentPosition.coerceAtLeast(0L)
                }
                if (playbackState == Player.STATE_ENDED) {
                    hasEnded = true
                    showControls = true
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                hasError = true
                isLoading = false
                showControls = true
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
            currentPosition = player.currentPosition.coerceAtLeast(0L)
            duration = player.duration.coerceAtLeast(0L)
            delay(250)
        }
    }

    LaunchedEffect(showControls, isLoading, hasError, isScrubbing, hasEnded) {
        if (showControls && !isLoading && !hasError && !isScrubbing) {
            delay(1800)
            showControls = false
        }
    }

    Box(
        modifier = modifier
            .background(Color.Black)
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    this.player = player
                    useController = false
                    resizeMode = if (useContain) {
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
                view.resizeMode = if (useContain) {
                    AspectRatioFrameLayout.RESIZE_MODE_FIT
                } else {
                    AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                }
            }
        )

        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = ParagonGold)
            }
        }

        if (hasError && !isLoading) {
            Text(
                text = "Failed",
                color = Color.White,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.align(Alignment.Center)
            )
        }

        if (!isLoading && !hasError) {
            Surface(
                shape = CircleShape,
                color = Color.White.copy(alpha = if (isPlaying) 0.18f else 0.92f),
                modifier = Modifier
                    .align(Alignment.Center)
                    .clickable {
                        showControls = true
                        if (player.isPlaying) {
                            player.pause()
                        } else {
                            hasEnded = false
                            player.playWhenReady = true
                            player.play()
                        }
                    }
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (isPlaying) "Pause" else "Play",
                    tint = if (isPlaying) Color.White else Color.Black,
                    modifier = Modifier.padding(14.dp)
                )
            }
        }

        if (duration > 0L && showControls) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = feedFormatTime(currentPosition),
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall
                    )
                    Text(
                        text = feedFormatTime(duration),
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
                Slider(
                    value = currentPosition.coerceAtMost(duration).toFloat(),
                    onValueChange = { next ->
                        isScrubbing = true
                        currentPosition = next.toLong()
                        player.seekTo(currentPosition)
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
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .graphicsLayer(scaleY = 0.2f)
                )
            }

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color.Black.copy(alpha = 0.6f),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 20.dp, bottom = 56.dp)
                    .clickable {
                        isMuted = !isMuted
                        player.volume = if (isMuted) 0f else 1f
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

private fun feedFormatTime(valueMs: Long): String {
    val totalSeconds = (valueMs / 1000L).coerceAtLeast(0L)
    val minutes = totalSeconds / 60L
    val seconds = totalSeconds % 60L
    return "${minutes}:${seconds.toString().padStart(2, '0')}"
}

@Composable
private fun WebsiteParityFeedPlayer(
    streamUrl: String,
    isActive: Boolean,
    modifier: Modifier = Modifier,
) {
    val pageHtml = remember {
        """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background: #000;
              overflow: hidden;
            }
            #root {
              position: relative;
              width: 100%;
              height: 100%;
              background: #000;
              overflow: hidden;
            }
            video {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              background: #000;
              object-position: center;
              display: block;
            }
            #backdrop {
              filter: blur(18px);
              transform: scale(1.08);
              opacity: 0.56;
              z-index: 0;
              pointer-events: none;
              display: none;
            }
            #player {
              z-index: 2;
            }
            #touchArea {
              position: absolute;
              inset: 0;
              z-index: 3;
            }
            .overlay {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: 4;
              color: #fff;
              pointer-events: none;
              display: none;
            }
            #loaderLogo {
              width: 82px;
              height: 82px;
              border-radius: 20px;
              object-fit: cover;
              box-shadow: 0 0 34px rgba(255, 205, 86, 0.5);
            }
            #pauseGlyph {
              font-size: 50px;
            }
            #timelineWrap {
              position: absolute;
              left: 16px;
              right: 16px;
              bottom: 8px;
              z-index: 10;
              padding: 4px 0 0;
              display: none;
            }
            #timeRow {
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #fff;
              font-size: 11px;
              font-weight: 700;
              margin-bottom: 2px;
              text-shadow: 0 2px 10px rgba(0,0,0,0.75);
            }
            #timeline {
              width: 100%;
              height: 4px;
            }
            #muteButton {
              position: absolute;
              bottom: 56px;
              right: 20px;
              z-index: 10;
              background: rgba(0,0,0,0.6);
              color: #fff;
              border: none;
              padding: 6px 10px;
              border-radius: 8px;
              cursor: pointer;
              display: none;
            }
          </style>
        </head>
        <body>
          <div id="root">
            <video id="backdrop" muted playsinline autoplay loop preload="metadata" aria-hidden="true"></video>
            <video id="player" muted playsinline autoplay loop preload="metadata"></video>
            <div id="touchArea"></div>
            <div id="loadingOverlay" class="overlay">
              <img id="loaderLogo" src="/logo-v2.png" alt="Paragon Planet" />
            </div>
            <div id="pausedOverlay" class="overlay">
              <div id="pauseGlyph">▶</div>
            </div>
            <div id="timelineWrap">
              <div id="timeRow">
                <span id="currentTime">0:00</span>
                <span id="durationTime">0:00</span>
              </div>
              <input id="timeline" type="range" min="0" max="0" step="0.1" value="0" />
            </div>
            <button id="muteButton">🔇</button>
          </div>
          <script>
            const video = document.getElementById('player');
            const backdrop = document.getElementById('backdrop');
            const touchArea = document.getElementById('touchArea');
            const loadingOverlay = document.getElementById('loadingOverlay');
            const pausedOverlay = document.getElementById('pausedOverlay');
            const timelineWrap = document.getElementById('timelineWrap');
            const timeline = document.getElementById('timeline');
            const currentTimeLabel = document.getElementById('currentTime');
            const durationTimeLabel = document.getElementById('durationTime');
            const muteButton = document.getElementById('muteButton');

            let hls = null;
            let currentUrl = '';
            let externalActive = false;
            let paused = false;
            let muted = true;
            let loading = false;
            let error = false;
            let ended = false;
            let isVertical = false;
            let isScrubbing = false;
            let showControls = false;
            let controlsTimer = null;
            let tapTimeout = null;
            let lastTap = { time: 0, side: null };

            function isMobile() {
              return window.innerWidth <= 768;
            }

            function formatTime(value) {
              const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              return minutes + ':' + String(seconds).padStart(2, '0');
            }

            function syncTimeline() {
              currentTimeLabel.textContent = formatTime(video.currentTime || 0);
              const duration = Number.isFinite(video.duration) ? video.duration : 0;
              durationTimeLabel.textContent = formatTime(duration);
              timeline.max = duration;
              timeline.value = Math.min(video.currentTime || 0, duration);
            }

            function updateFit() {
              const landscape = !isVertical;
              const shouldContain = (isVertical && !isMobile()) || (landscape && isMobile());
              video.style.objectFit = shouldContain ? 'contain' : 'cover';
              backdrop.style.objectFit = 'cover';
              const shouldShowMobileBackdrop = isMobile() && landscape && !currentUrl.includes('.m3u8');
              backdrop.style.display = shouldShowMobileBackdrop ? 'block' : 'none';
            }

            function clearControlsTimer() {
              if (controlsTimer) {
                window.clearTimeout(controlsTimer);
                controlsTimer = null;
              }
            }

            function scheduleControlsHide() {
              clearControlsTimer();
              if (loading || error || isScrubbing) return;
              controlsTimer = window.setTimeout(() => {
                showControls = false;
                renderState();
              }, 1800);
            }

            function revealControls() {
              showControls = true;
              renderState();
              scheduleControlsHide();
            }

            async function safePlay() {
              if (error || !externalActive) return;
              try {
                await video.play();
                paused = false;
                ended = false;
                loading = false;
                scheduleControlsHide();
              } catch (err) {
                paused = true;
                showControls = true;
                renderState();
              }
            }

            function togglePlay() {
              if (loading || error) return;
              if (video.paused) {
                safePlay();
              } else {
                video.pause();
                paused = true;
                renderState();
              }
            }

            function skipBySeconds(seconds) {
              if (!Number.isFinite(video.duration)) return;
              const nextTime = Math.min(Math.max(0, video.currentTime + seconds), video.duration || 0);
              video.currentTime = nextTime;
              syncTimeline();
              revealControls();
            }

            function renderState() {
              loadingOverlay.style.display = loading ? 'block' : 'none';
              pausedOverlay.style.display = (!loading && !error && !ended && paused) ? 'block' : 'none';
              timelineWrap.style.display = (showControls && Number.isFinite(video.duration) && video.duration > 0) ? 'block' : 'none';
              muteButton.style.display = showControls ? 'block' : 'none';
              muteButton.textContent = muted ? '🔇' : '🔊';
            }

            function destroyHls() {
              if (hls) {
                hls.destroy();
                hls = null;
              }
            }

            function initSource(url) {
              currentUrl = url || '';
              destroyHls();
              video.removeAttribute('src');
              backdrop.removeAttribute('src');
              video.load();
              backdrop.load();

              if (!currentUrl) {
                loading = false;
                error = true;
                paused = true;
                ended = false;
                renderState();
                return;
              }

              loading = true;
              error = false;
              paused = false;
              muted = true;
              ended = false;
              showControls = false;
              isScrubbing = false;
              video.muted = true;
              backdrop.muted = true;
              syncTimeline();
              renderState();

              const isHlsUrl = currentUrl.includes('.m3u8');
              if (isHlsUrl && window.Hls && window.Hls.isSupported()) {
                hls = new window.Hls({
                  enableWorker: true,
                  startLevel: -1,
                  capLevelToPlayerSize: true,
                  lowLatencyMode: false,
                  maxBufferLength: 15,
                  backBufferLength: 10,
                  maxMaxBufferLength: 30,
                  maxBufferHole: 0.5,
                  maxFragLookUpTolerance: 0.25,
                });
                hls.attachMedia(video);
                hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(currentUrl));
                hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                  loading = false;
                  renderState();
                  if (externalActive) safePlay();
                });
                hls.on(window.Hls.Events.ERROR, (_event, data) => {
                  if (!data.fatal) return;
                  if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                    hls.startLoad();
                  } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                  } else {
                    destroyHls();
                    error = true;
                    loading = false;
                    renderState();
                  }
                });
              } else {
                video.src = currentUrl;
                video.preload = isHlsUrl ? 'metadata' : 'auto';
                video.load();
                backdrop.src = currentUrl;
                backdrop.load();
                if (externalActive) safePlay();
              }
            }

            function setPlayerState(url, active) {
              externalActive = !!active;
              if (url !== currentUrl) {
                initSource(url);
              } else if (externalActive) {
                safePlay();
              } else {
                video.pause();
              }
            }

            touchArea.addEventListener('click', (e) => {
              if (loading || error) return;
              const rect = touchArea.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const side = x < rect.width / 2 ? 'left' : 'right';
              const now = Date.now();
              if (lastTap.side === side && now - lastTap.time < 280) {
                if (tapTimeout) {
                  window.clearTimeout(tapTimeout);
                  tapTimeout = null;
                }
                lastTap = { time: 0, side: null };
                skipBySeconds(side === 'left' ? -10 : 10);
                return;
              }
              lastTap = { time: now, side };
              if (tapTimeout) window.clearTimeout(tapTimeout);
              tapTimeout = window.setTimeout(() => {
                revealControls();
                togglePlay();
                tapTimeout = null;
              }, 220);
            });

            muteButton.addEventListener('click', (e) => {
              e.stopPropagation();
              muted = !muted;
              video.muted = muted;
              renderState();
              revealControls();
              if (!video.paused) return;
              safePlay();
            });

            timeline.addEventListener('pointerdown', () => {
              isScrubbing = true;
              showControls = true;
              clearControlsTimer();
              renderState();
            });
            timeline.addEventListener('input', (e) => {
              const nextTime = Number(e.target.value);
              video.currentTime = nextTime;
              syncTimeline();
            });
            timeline.addEventListener('change', (e) => {
              isScrubbing = false;
              video.currentTime = Number(e.target.value);
              syncTimeline();
              scheduleControlsHide();
            });

            video.addEventListener('loadedmetadata', () => {
              isVertical = video.videoHeight > video.videoWidth;
              updateFit();
              syncTimeline();
              loading = false;
              renderState();
            });
            video.addEventListener('canplay', () => {
              isVertical = video.videoHeight > video.videoWidth;
              updateFit();
              syncTimeline();
              loading = false;
              renderState();
              if (externalActive) safePlay();
            });
            video.addEventListener('waiting', () => {
              loading = true;
              renderState();
            });
            video.addEventListener('playing', () => {
              loading = false;
              error = false;
              paused = false;
              ended = false;
              syncTimeline();
              renderState();
              scheduleControlsHide();
            });
            video.addEventListener('pause', () => {
              if (!video.ended) {
                paused = true;
                showControls = true;
                renderState();
                clearControlsTimer();
              }
            });
            video.addEventListener('play', () => {
              paused = false;
              ended = false;
              renderState();
              scheduleControlsHide();
            });
            video.addEventListener('ended', () => {
              ended = true;
              paused = false;
              loading = false;
              showControls = true;
              renderState();
              clearControlsTimer();
              if (video.loop && externalActive) safePlay();
            });
            video.addEventListener('error', () => {
              error = true;
              loading = false;
              showControls = true;
              renderState();
              clearControlsTimer();
            });
            video.addEventListener('timeupdate', () => {
              if (!isScrubbing) syncTimeline();
            });
            video.addEventListener('durationchange', syncTimeline);
            window.addEventListener('resize', updateFit);
            window.setPlayerState = setPlayerState;
            renderState();
          </script>
        </body>
        </html>
        """.trimIndent()
    }

    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                overScrollMode = WebView.OVER_SCROLL_NEVER
                setBackgroundColor(android.graphics.Color.BLACK)
                webChromeClient = WebChromeClient()
                webViewClient = WebViewClient()
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                settings.useWideViewPort = true
                settings.loadWithOverviewMode = true
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                loadDataWithBaseURL("https://www.paragonplanet.com", pageHtml, "text/html", "utf-8", null)
            }
        },
        update = { webView ->
            val safeUrl = streamUrl
                .replace("\\", "\\\\")
                .replace("'", "\\'")
            webView.evaluateJavascript(
                "window.setPlayerState('$safeUrl', ${if (isActive) "true" else "false"});",
                null
            )
        }
    )
}

@Composable
private fun TopStageBar(
    isSignedIn: Boolean,
    isAdmin: Boolean,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenAdmin: () -> Unit,
    onSignOut: () -> Unit,
) {
        Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .padding(top = 20.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                painter = painterResource(id = R.drawable.paragon_logo),
                contentDescription = "Paragon Planet logo",
                modifier = Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(8.dp))
            )
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "Paragon Planet",
                    color = Color.White,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            HeaderGlyphButton("⬆️", Color(0xFF3CA8FF), onOpenUpload)
            HeaderGlyphButton("👤", Color(0xFF3CA8FF), onOpenProfile)
            if (isAdmin) {
                HeaderGlyphButton("🛠", Color(0xFF8EB7FF), onOpenAdmin)
            }
            if (isSignedIn) {
                HeaderGlyphButton("🚪", ParagonGold, onSignOut)
            } else {
                HeaderGlyphButton("🔑", ParagonGold, onOpenSignIn)
            }
        }
    }
}

@Composable
private fun HeaderGlyphButton(
    glyph: String,
    tint: Color,
    onClick: () -> Unit,
) {
    Surface(
        color = Color.Transparent,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 2.dp, vertical = 2.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = glyph,
                color = tint,
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}

@Composable
private fun InlineSprayNotePicker(
    options: List<SprayNoteChoice>,
    isProcessing: Boolean,
    onSelect: (SprayNoteChoice) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xCC111722)),
        shape = RoundedCornerShape(16.dp)
    ) {
        FlowRow(
            modifier = Modifier.padding(10.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            maxItemsInEachRow = 2
        ) {
            options.forEach { note ->
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color.Transparent,
                    modifier = Modifier
                        .width(144.dp)
                        .height(96.dp)
                        .clickable(enabled = !isProcessing) { onSelect(note) }
                ) {
                    Image(
                        painter = painterResource(id = note.drawableRes),
                        contentDescription = "${note.amount} ${note.currency}",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit
                    )
                }
            }
        }
    }
}

@Composable
private fun FeedActionFeedbackOverlay(
    modifier: Modifier = Modifier,
    feedback: FeedActionFeedback,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        color = Color(0xD9111111)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = when (feedback.actionKey) {
                    "vote" -> "❤️"
                    "spray_money" -> "💸"
                    "pour_me_water" -> "💧"
                    else -> "🍾"
                },
                fontSize = 32.sp
            )
            Text(
                text = when (feedback.actionKey) {
                    "vote" -> "+1 Vote"
                    "spray_money" -> if (feedback.amountGbazilo > 0) "${feedback.amountGbazilo} Gbazilo" else "${feedback.amountParag} Parag"
                    "pour_me_water" -> "Pour Me Water"
                    else -> "Pop ${feedback.label}"
                },
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}
@Composable
private fun RightActionRail(
    modifier: Modifier = Modifier,
    supportCount: Int,
    pourCount: Int,
    sprayCount: Int,
    bottleCount: Int,
    onVote: () -> Unit,
    onOpenPourWater: () -> Unit,
    onOpenSupport: () -> Unit,
    onOpenBottle: () -> Unit,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(18.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        RailAction(
            icon = "❤️",
            iconColor = Color(0xFFE53935),
            value = supportCount.toString(),
            onClick = onVote
        )
        RailAction(
            icon = "💧",
            iconColor = Color(0xFF8EDBFF),
            value = pourCount.toString(),
            onClick = onOpenPourWater
        )
        RailAction(
            icon = "💸",
            iconColor = Color(0xFF59D46A),
            value = sprayCount.toString(),
            onClick = onOpenSupport
        )
        RailAction(
            icon = "🍾",
            iconColor = Color(0xFFF5D26C),
            value = bottleCount.toString(),
            onClick = onOpenBottle
        )
    }
}

@Composable
private fun RailAction(
    icon: String,
    iconColor: Color,
    value: String,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier.clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Text(
            text = icon,
            color = iconColor,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        Text(
            text = value,
            color = Color.White,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun StageMeta(
    modifier: Modifier = Modifier,
    item: FeedCard,
    onOpenWatch: () -> Unit,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = item.title,
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = item.category,
            color = Color.White.copy(alpha = 0.86f),
            style = MaterialTheme.typography.bodyLarge
        )
        Text(
            text = item.description,
            color = Color.White.copy(alpha = 0.82f),
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun FeedFooterActions(
    modifier: Modifier = Modifier,
    isSaved: Boolean,
    viewCount: Int,
    commentCount: Int,
    onHome: () -> Unit,
    onFollow: () -> Unit,
    onComments: () -> Unit,
    onSave: () -> Unit,
    onMenu: () -> Unit,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        FeedFooterActionButton(icon = { Icon(Icons.Outlined.Home, contentDescription = null, tint = Color.White) }, onClick = onHome)
        FeedFooterActionButton(icon = { Icon(Icons.Outlined.People, contentDescription = null, tint = Color.White) }, onClick = onFollow)
        FeedFooterActionButton(
            count = viewCount,
            icon = { Text("👀", color = Color.White, fontSize = 16.sp) },
            onClick = {}
        )
        FeedFooterActionButton(
            count = commentCount,
            icon = { Text("💬", color = Color.White, fontSize = 16.sp) },
            onClick = onComments
        )
        FeedFooterActionButton(
            icon = {
                Icon(
                    imageVector = if (isSaved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                    contentDescription = null,
                    tint = Color.White
                )
            },
            onClick = onSave
        )
        FeedFooterActionButton(icon = { Icon(Icons.Outlined.Menu, contentDescription = null, tint = Color.White) }, onClick = onMenu)
    }
}

@Composable
private fun FeedFooterActionButton(
    count: Int? = null,
    icon: @Composable () -> Unit,
    onClick: () -> Unit,
) {
    Surface(
        color = Color.Transparent,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier.padding(vertical = 6.dp, horizontal = 2.dp),
            contentAlignment = Alignment.Center
        ) {
            icon()
            if (count != null) {
                Text(
                    text = count.toString(),
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .background(Color.Black.copy(alpha = 0.72f), CircleShape)
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                )
            }
        }
    }
}

private fun formatSupportBadge(costLabel: String): String {
    val upper = costLabel.uppercase()
    val gbaziloMatch = Regex("(\\d+)\\s+GBAZILO").find(upper)?.groupValues?.getOrNull(1)
    val paragMatch = Regex("(\\d+)\\s+PARAG").find(upper)?.groupValues?.getOrNull(1)
    val parts = buildList {
        if (!gbaziloMatch.isNullOrBlank()) add("G$gbaziloMatch")
        if (!paragMatch.isNullOrBlank()) add("P$paragMatch")
    }
    return parts.joinToString(" ").ifBlank { upper.trim() }
}

@Composable
private fun SupportOptionCard(
    modifier: Modifier = Modifier,
    icon: String,
    title: String,
    costLabel: String,
    note: String,
    creatorXp: Int,
    rankBoost: Int,
    buttonLabel: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFFFF)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = Color.Transparent,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            ) {
                Column(
                    modifier = Modifier
                        .width(110.dp)
                        .background(
                            brush = Brush.linearGradient(listOf(Color(0xFFFFF7ED), Color(0xFFFDE68A))),
                            shape = RoundedCornerShape(18.dp)
                        )
                        .padding(horizontal = 12.dp, vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(999.dp),
                        color = Color.White.copy(alpha = 0.84f),
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text(
                            text = formatSupportBadge(costLabel),
                            color = Color(0xFF344054),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                    Text(icon, fontSize = 30.sp)
                    Text(
                        text = title,
                        color = Color(0xFF101828),
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center,
                        lineHeight = 18.sp
                    )
                    Button(
                        onClick = onClick,
                        enabled = enabled,
                        shape = RoundedCornerShape(999.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF101828)),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 7.dp)
                    ) {
                        Text(
                            text = buttonLabel,
                            color = Color.White,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
            Text(
                text = note,
                color = Color(0xFF475467),
                style = MaterialTheme.typography.bodySmall,
                lineHeight = 16.sp
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SupportMetaPill("Creator +$creatorXp XP")
                SupportMetaPill("Rank +$rankBoost")
            }
        }
    }
}

@Composable
private fun SupportVariableCard(
    modifier: Modifier = Modifier,
    icon: String,
    title: String,
    amount: String,
    onAmountChange: (String) -> Unit,
    helperText: String,
    note: String,
    creatorXp: Int,
    rankBoost: Int,
    buttonLabel: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFFFF)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Column(
                modifier = Modifier
                    .width(110.dp)
                    .align(Alignment.CenterHorizontally)
                    .background(
                        brush = Brush.linearGradient(listOf(Color(0xFFFFF7ED), Color(0xFFFDE68A))),
                        shape = RoundedCornerShape(18.dp)
                    )
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Color.White.copy(alpha = 0.84f),
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(
                        text = "P${maxOf(1, amount.toIntOrNull() ?: 0)}",
                        color = Color(0xFF344054),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
                Text(icon, fontSize = 32.sp)
                Text(
                    text = title,
                    color = Color(0xFF101828),
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )
                OutlinedTextField(
                    value = amount,
                    onValueChange = onAmountChange,
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                        color = Color(0xFF101828),
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.Bold
                    ),
                    placeholder = {
                        Text(
                            "Parag",
                            color = Color(0xFF667085),
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center
                        )
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0x33101828),
                        unfocusedBorderColor = Color(0x33101828),
                        focusedTextColor = Color(0xFF101828),
                        unfocusedTextColor = Color(0xFF101828),
                        cursorColor = Color(0xFF101828),
                        focusedContainerColor = Color.White.copy(alpha = 0.92f),
                        unfocusedContainerColor = Color.White.copy(alpha = 0.92f)
                    )
                )
                Button(
                    onClick = onClick,
                    enabled = enabled,
                    shape = RoundedCornerShape(999.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF101828)),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 7.dp)
                ) {
                    Text(
                        text = buttonLabel,
                        color = Color.White,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Text(
                text = note,
                color = Color(0xFF475467),
                style = MaterialTheme.typography.bodySmall,
                lineHeight = 16.sp
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SupportMetaPill("Creator +$creatorXp XP")
                SupportMetaPill("Rank +$rankBoost")
            }
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFFF8FAFC)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "💸 Note Rain",
                        color = Color(0xFF0F172A),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = helperText,
                        color = Color(0xFF334155),
                        style = MaterialTheme.typography.bodySmall,
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun SupportMetaPill(label: String) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = Color(0xFFEEF2FF)
    ) {
        Text(
            text = label,
            color = Color(0xFF344054),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun SupportPreviewCard(
    modifier: Modifier = Modifier,
    item: FeedCard,
    stageLine: String,
) {
    val previewUrl = item.preferredPlaybackUrl()
    val context = LocalContext.current
    var showPreview by remember(item.id, previewUrl) { mutableStateOf(false) }
    val previewPlayer = remember(context, item.id, previewUrl, showPreview) {
        if (showPreview && !previewUrl.isNullOrBlank()) {
            ExoPlayer.Builder(context).build().apply {
                repeatMode = ExoPlayer.REPEAT_MODE_ONE
                volume = 0f
            }
        } else {
            null
        }
    }

    LaunchedEffect(previewUrl, showPreview) {
        if (showPreview && previewPlayer != null && !previewUrl.isNullOrBlank()) {
            previewPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(previewUrl)))
            previewPlayer.prepare()
            previewPlayer.playWhenReady = true
            previewPlayer.play()
        }
    }

    DisposableEffect(previewPlayer) {
        onDispose {
            previewPlayer?.playWhenReady = false
            previewPlayer?.release()
        }
    }

    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(listOf(Color(0xFF131826), Color(0xFF0F172A))),
                    shape = RoundedCornerShape(22.dp)
                )
                .padding(horizontal = 18.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stageLine,
                color = Color.White,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = Color(0xFF0B1020),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(390.dp),
                    contentAlignment = Alignment.Center
                ) {
                    when {
                        showPreview && previewPlayer != null && !previewUrl.isNullOrBlank() -> {
                            AndroidView(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(390.dp)
                                    .clip(RoundedCornerShape(22.dp)),
                                factory = { viewContext ->
                                    PlayerView(viewContext).apply {
                                        player = previewPlayer
                                        useController = false
                                        resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                        setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                                        setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                                    }
                                },
                                update = { view ->
                                    view.player = previewPlayer
                                }
                            )
                        }

                        !previewUrl.isNullOrBlank() -> {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(
                                    text = "Preview is ready to load when you want it.",
                                    color = Color.White,
                                    fontWeight = FontWeight.Medium,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 20.dp)
                                )
                                Button(
                                    onClick = { showPreview = true },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color(0xFF111111))
                                ) {
                                    Text("Load Preview")
                                }
                            }
                        }

                        !item.thumbnailUrl.isNullOrBlank() -> {
                            AsyncImage(
                                model = item.thumbnailUrl,
                                contentDescription = item.title,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(390.dp)
                                    .clip(RoundedCornerShape(22.dp))
                            )
                        }

                        else -> {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text("▶", color = Color.White, fontSize = 30.sp)
                                Text(
                                    text = item.title,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 20.dp)
                                )
                            }
                        }
                    }

                }
            }
        }
    }
}
@Composable
private fun FeedCreatorCard(
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
            Text(
                text = member.displayName,
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = listOf(member.role, member.subtitle).filter { it.isNotBlank() }.joinToString(" • "),
                color = ParagonMuted,
                style = MaterialTheme.typography.bodySmall
            )
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
private fun FeedMeetUpRequestCard(
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
                text = "${request.areaIcon} ${request.areaTitle} • ${feedMealModeLabel(request.mealMode)} • ${feedExperienceLabel(request.experienceLevel)}",
                color = ParagonMuted,
                style = MaterialTheme.typography.bodySmall
            )
            Text(
                text = "${request.directionLabel} • ${request.status.replaceFirstChar { it.uppercase() }}",
                color = Color.White.copy(alpha = 0.72f),
                style = MaterialTheme.typography.bodySmall
            )
            OutlinedButton(onClick = onOpen) {
                Text(feedMeetUpActionLabel(request))
            }
        }
    }
}

@Composable
private fun FeedMemberRow(
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
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
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

private fun feedMeetUpActionLabel(request: WatchMeetUpRequest): String {
    return when {
        request.status.equals("accepted", ignoreCase = true) -> "Meet-Up"
        request.status.equals("pending", ignoreCase = true) && request.directionLabel == "Received request" -> "Open Request"
        request.status.equals("pending", ignoreCase = true) -> "View Pending"
        else -> "View Request"
    }
}

private fun feedMealModeLabel(mode: String): String {
    return when (mode.lowercase()) {
        "lunch" -> "Lunch"
        "breakfast" -> "Breakfast"
        else -> "Dinner"
    }
}

private fun feedExperienceLabel(level: String): String {
    return when (level.lowercase()) {
        "premium" -> "Premium Experience"
        "exclusive" -> "Exclusive Experience"
        "vip" -> "VIP Experience"
        "legendary" -> "Legendary Experience"
        else -> "Standard Experience"
    }
}

@Composable
private fun EmptyFeedState(
    summary: String,
    errorMessage: String?,
    onRefresh: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .navigationBarsPadding()
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Image(
                painter = painterResource(id = R.drawable.paragon_logo),
                contentDescription = "Paragon Planet logo",
                modifier = Modifier
                    .size(88.dp)
                    .clip(RoundedCornerShape(18.dp))
            )
            if (errorMessage != null) {
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1A1A1A))) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("Could not load feed yet", color = Color.White, fontWeight = FontWeight.Bold)
                        Button(onClick = onRefresh) {
                            Text("Refresh feed")
                        }
                    }

                }
            }
        }
    }
}

private fun Throwable.toSupportActionMessage(): String {
    val raw = message.orEmpty()
    val jsonError = Regex("\"error\"\\s*:\\s*\"([^\"]+)\"").find(raw)?.groupValues?.getOrNull(1)
    return when {
        !jsonError.isNullOrBlank() -> jsonError
        raw.contains("Request failed", ignoreCase = true) -> "This support action could not be completed."
        raw.isNotBlank() -> raw
        else -> "Could not complete this action right now"
    }
}

private fun shouldRedirectSupportErrorToWallet(message: String): Boolean {
    val text = message.lowercase()
    return listOf("insufficient", "wallet", "deposit", "parag", "gbazilo", "balance")
        .any { text.contains(it) }
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












