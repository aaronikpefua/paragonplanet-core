package com.app.natureswayproduction.nativeapp.feature.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.app.natureswayproduction.R
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeAttempt
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeBundle
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeQuestion
import com.app.natureswayproduction.nativeapp.data.api.BackerLeaderboardEntry
import com.app.natureswayproduction.nativeapp.data.api.AccountRoleItem
import com.app.natureswayproduction.nativeapp.data.api.AmbassadorContactItem
import com.app.natureswayproduction.nativeapp.data.api.InvitedCitizenItem
import com.app.natureswayproduction.nativeapp.data.api.MobileProfile
import com.app.natureswayproduction.nativeapp.data.api.ProfileProductItem
import com.app.natureswayproduction.nativeapp.data.api.ProfileVideoItem
import com.app.natureswayproduction.nativeapp.feature.auth.AuthViewModel
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(
    authViewModel: AuthViewModel,
    profileViewModel: ProfileViewModel,
    currentEmail: String?,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onOpenMarketplace: () -> Unit,
    onOpenMerchantAbout: () -> Unit,
    onOpenEditProfile: () -> Unit,
    onContinueAsUser: suspend () -> Unit,
    onOpenEarnRoles: () -> Unit,
    onOpenMenu: () -> Unit,
    onSignOut: () -> Unit,
) {
    val authState by authViewModel.uiState.collectAsState()
    val profileState by profileViewModel.uiState.collectAsState()

    LaunchedEffect(authState.uid, authState.isSignedIn) {
        if (authState.isSignedIn) {
            profileViewModel.refresh()
        } else {
            profileViewModel.clear()
        }
    }

    if (!authState.isSignedIn) {
        SignedOutProfileScreen(
            currentEmail = currentEmail,
            email = authState.emailInput,
            password = authState.passwordInput,
            isLoading = authState.isLoading,
            note = authState.note,
            errorMessage = authState.errorMessage,
            onOpenUpload = onOpenUpload,
            onOpenProfile = onOpenProfile,
            onOpenSignIn = onOpenSignIn,
            onOpenMenu = onOpenMenu,
            onSignOut = onSignOut,
            onEmailChange = authViewModel::updateEmail,
            onPasswordChange = authViewModel::updatePassword,
            onSignIn = authViewModel::signIn,
            onSignUp = authViewModel::signUp,
        )
        return
    }

    val profile = profileState.profile
    val isUserLikeProfile = profile?.role.isUserLikeRole()
    val isCitizenProfile = profile?.role.isCitizenRole()
    val isPromoterProfile = profile?.role.isPromoterRole()
    val isSponsorInvestorProfile = profile?.role.isSponsorInvestorRole()
    val isBackerProfile = profile?.role.equals("BACKER", ignoreCase = true)
    val isSuperbossProfile = profile?.role.equals("SUPERNAL", ignoreCase = true)
    val backerChallenges = profileState.backerChallenges
    val profileScope = rememberCoroutineScope()
    var deletingVideoId by remember { mutableStateOf<String?>(null) }
    var deleteVideoError by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            TopIdentityBar(
                currentEmail = currentEmail,
                onOpenUpload = onOpenUpload,
                onOpenProfile = onOpenProfile,
                onOpenSignIn = onOpenSignIn,
                onOpenMenu = onOpenMenu,
                onSignOut = onSignOut,
            )
        }

        item {
            if (profileState.availableRoles.size > 1) {
                NativeRoleSwitcherCard(
                    roles = profileState.availableRoles,
                    activeRoleKey = profileState.activeRoleKey,
                    onSelectRole = profileViewModel::switchActiveRole,
                )
            }
        }

        item {
            profile?.let {
                if (isUserLikeProfile) {
                    AboutRoleButton(role = "USER")
                    UserProfileActionsCard(
                        profile = it,
                        inboxUnreadCount = profileState.inboxUnreadCount,
                        onOpenWallet = onOpenWallet,
                        onOpenMeetUp = onOpenMeetUp,
                        onOpenEditProfile = onOpenEditProfile,
                        onOpenEarnRoles = onOpenEarnRoles,
                    )
                } else {
                    if (isCitizenProfile) {
                        AboutRoleButton(role = profile?.role ?: "CITIZEN")
                        CitizenProfileHero(
                            profile = it,
                            profileViewModel = profileViewModel,
                            inboxUnreadCount = profileState.inboxUnreadCount,
                            onOpenEditProfile = onOpenEditProfile,
                            onOpenWallet = onOpenWallet,
                            onOpenMeetUp = onOpenMeetUp,
                            onOpenEarnRoles = onOpenEarnRoles,
                        )
                    } else if (isSponsorInvestorProfile) {
                        ProfileHero(
                            profile = it,
                            onOpenEditProfile = onOpenEditProfile,
                            onOpenWallet = onOpenWallet,
                            onOpenMeetUp = onOpenMeetUp,
                            onOpenMarketplace = onOpenMarketplace,
                            onOpenMerchantAbout = onOpenMerchantAbout,
                            onOpenEarnRoles = onOpenEarnRoles,
                            inboxUnreadCount = profileState.inboxUnreadCount,
                            onOpenInbox = { profileViewModel.refreshInboxUnreadCount(force = true) },
                            onRefresh = {
                                authViewModel.refresh()
                                profileViewModel.refresh()
                            },
                        )
                    } else if (isBackerProfile) {
                        BackerProfileHero(
                            profile = it,
                            profileViewModel = profileViewModel,
                            inboxUnreadCount = profileState.inboxUnreadCount,
                            onOpenEditProfile = onOpenEditProfile,
                            onOpenWallet = onOpenWallet,
                            onOpenEarnRoles = onOpenEarnRoles,
                        )
                    } else if (isPromoterProfile) {
                        AmbassadorProfileHero(
                            profile = it,
                            profileViewModel = profileViewModel,
                            inboxUnreadCount = profileState.inboxUnreadCount,
                            onOpenWallet = onOpenWallet,
                            onOpenEarnRoles = onOpenEarnRoles,
                        )
                    } else if (isSuperbossProfile) {
                        SuperbossProfileHero(
                            profile = it,
                            profileViewModel = profileViewModel,
                            inboxUnreadCount = profileState.inboxUnreadCount,
                            onOpenEditProfile = onOpenEditProfile,
                            onOpenWallet = onOpenWallet,
                            onOpenEarnRoles = onOpenEarnRoles,
                        )
                    } else {
                        AboutRoleButton(role = profile?.role ?: "USER")
                        ProfileHero(
                            profile = it,
                            onOpenEditProfile = onOpenEditProfile,
                            onOpenWallet = onOpenWallet,
                            onOpenMeetUp = onOpenMeetUp,
                            onOpenMarketplace = onOpenMarketplace,
                            onOpenMerchantAbout = onOpenMerchantAbout,
                            onOpenEarnRoles = onOpenEarnRoles,
                            inboxUnreadCount = profileState.inboxUnreadCount,
                            onOpenInbox = { profileViewModel.refreshInboxUnreadCount(force = true) },
                            onRefresh = {
                                authViewModel.refresh()
                                profileViewModel.refresh()
                            },
                        )
                    }
                }
            }
        }

        if (profileState.isLoading || authState.isLoading) {
            item {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        }

        profile?.let {
            if (isUserLikeProfile) {
                item {
                    UserInformationCard(
                        profile = it,
                        onDeleteAccount = authViewModel::deleteAccount,
                    )
                }
                item {
                    UserRoleChoiceCard(
                        onContinueAsUser = onContinueAsUser,
                        onOpenEarnRoles = onOpenEarnRoles,
                    )
                }
            } else {
                item {
                    if (isBackerProfile) {
                        BackerAboutCard()
                    } else if (isPromoterProfile) {
                        AmbassadorAboutCard()
                    } else if (isSuperbossProfile) {
                        SuperbossAboutCard()
                    }
                }

                item {
                    if (isBackerProfile) {
                        BackerDetailsCard(profile = it)
                    } else if (isPromoterProfile) {
                        AmbassadorDetailsCard(profile = it)
                    } else if (isSponsorInvestorProfile) {
                        SponsorInvestorDetailsCard(profile = it)
                    } else if (isSuperbossProfile) {
                        SuperbossDetailsCard(profile = it)
                    } else {
                        CitizenLikeDetailsCard(profile = it)
                    }
                }
            }

            profileState.errorMessage?.let { error ->
                item {
                    StatusPanel(
                        title = "Needs attention",
                        body = error,
                        accent = Color(0xFFB00020)
                    )
                }
            }

            if (!isUserLikeProfile) {
                if (it.role.isBackerRole()) {
                    item {
                        BackerGoodWorksCard(profile = it)
                    }
                    item {
                        BackerChallengeStudioSection(
                            profile = it,
                            bundle = backerChallenges,
                            profileViewModel = profileViewModel,
                        )
                    }
                } else if (it.role.isSuperbossRole()) {
                    item {
                        SuperbossChallengeStudioSection(
                            profile = it,
                            bundle = backerChallenges,
                            profileViewModel = profileViewModel,
                        )
                    }
                    item {
                        SuperbossReputationCard(profile = it)
                    }
                } else if (it.role.isMerchantRole()) {
                    item {
                        SectionHeading("My Products")
                    }

                    if (it.recentProducts.isEmpty()) {
                        item {
                            EmptyProductsCard()
                        }
                    } else {
                        items(it.recentProducts) { product ->
                            MerchantProductRow(product = product)
                        }
                    }
                } else if (it.role.isPromoterRole()) {
                    item {
                        AmbassadorInvitedCitizensCard(citizens = it.invitedCitizens)
                    }
                } else if (it.role.isCitizenRole()) {
                    item {
                        SectionHeading("My Videos")
                    }

                    if (!deleteVideoError.isNullOrBlank()) {
                        item {
                            Text(
                                text = deleteVideoError.orEmpty(),
                                color = Color(0xFFB00020),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(horizontal = 4.dp)
                            )
                        }
                    }

                    if (it.recentVideos.isEmpty()) {
                        item {
                            EmptyVideosCard()
                        }
                    } else {
                        items(it.recentVideos) { video ->
                            WebLikeVideoRow(
                                video = video,
                                canDelete = true,
                                isDeleting = deletingVideoId == video.id,
                                onDelete = {
                                    if (deletingVideoId != null) return@WebLikeVideoRow
                                    deleteVideoError = null
                                    deletingVideoId = video.id
                                    profileScope.launch {
                                        runCatching { profileViewModel.deleteOwnVideo(video.id) }
                                            .onSuccess {
                                                authViewModel.refresh()
                                                profileViewModel.refresh()
                                            }
                                            .onFailure {
                                                deleteVideoError = it.message ?: "Could not delete this video right now."
                                            }
                                        deletingVideoId = null
                                    }
                                }
                            )
                        }
                    }
                }

                item {
                    DeleteAccountFooter(
                        onDeleteAccount = authViewModel::deleteAccount,
                    )
                }
            }
        }
    }
}

@Composable
private fun NativeRoleSwitcherCard(
    roles: List<AccountRoleItem>,
    activeRoleKey: String,
    onSelectRole: (String) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("Working role", color = Color(0xFF111111), fontWeight = FontWeight.Bold)
            Text(
                "Actions and profile data are limited to the selected role.",
                color = Color(0xFF5A534A),
                style = MaterialTheme.typography.bodySmall
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                roles.forEach { role ->
                    val isActive = role.key.equals(activeRoleKey, ignoreCase = true)
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isActive) Color(0xFF176B4D) else Color(0xFF111111),
                        modifier = Modifier.clickable { onSelectRole(role.key) }
                    ) {
                        Text(
                            text = if (isActive) "Active: ${role.label}" else role.label,
                            color = Color.White,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp)
                        )
                    }
                }
            }
        }
    }
}

private fun String?.isUserLikeRole(): Boolean {
    return equals("USER", ignoreCase = true) || equals("UNASSIGNED", ignoreCase = true)
}

private fun String?.isMerchantRole(): Boolean {
    return equals("MERCHANT", ignoreCase = true)
}

private fun String?.isCitizenRole(): Boolean {
    return equals("CITIZEN", ignoreCase = true)
}

private fun String?.isPromoterRole(): Boolean {
    return equals("PROMOTER", ignoreCase = true)
}

private fun String?.isSponsorInvestorRole(): Boolean {
    val value = this?.uppercase() ?: return false
    return value == "INVESTOR" || value == "SPONSOR" || value == "SPONSOR / INVESTOR" || value == "SPONSOR_INVESTOR"
}

private fun String?.isBackerRole(): Boolean {
    return equals("BACKER", ignoreCase = true)
}

private fun String?.isSuperbossRole(): Boolean {
    return equals("SUPERNAL", ignoreCase = true)
}

@Composable
private fun SignedOutProfileScreen(
    currentEmail: String?,
    email: String,
    password: String,
    isLoading: Boolean,
    note: String,
    errorMessage: String?,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenMenu: () -> Unit,
    onSignOut: () -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSignIn: () -> Unit,
    onSignUp: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            TopIdentityBar(
            currentEmail = currentEmail,
            onOpenUpload = onOpenUpload,
            onOpenProfile = onOpenProfile,
            onOpenSignIn = onOpenSignIn,
            onOpenMenu = onOpenMenu,
            onSignOut = onSignOut,
        )
        }
        item {
            StatusPanel(
                title = "Sign in required",
                body = note,
                accent = Color(0xFF161616)
            )
        }
        errorMessage?.let { error ->
            item {
                StatusPanel(
                    title = "Needs attention",
                    body = error,
                    accent = Color(0xFFB00020)
                )
            }
        }
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Profile access",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFF151515),
                        fontWeight = FontWeight.SemiBold
                    )
                    OutlinedTextField(
                        value = email,
                        onValueChange = onEmailChange,
                        label = { Text("Email") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = websiteFieldColors()
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = onPasswordChange,
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = websiteFieldColors()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(onClick = onSignIn, enabled = !isLoading) {
                            Text("Sign in")
                        }
                        OutlinedButton(onClick = onSignUp, enabled = !isLoading) {
                            Text("Create account")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TopIdentityBar(
    currentEmail: String?,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenMenu: () -> Unit,
    onSignOut: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1B1B1B)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
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
                    modifier = Modifier.size(34.dp)
                )
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "Paragon Planet",
                        color = Color.White,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HeaderIconButton(
                    symbol = "⬆️",
                    onClick = onOpenUpload,
                )
                HeaderIconButton(
                    symbol = "👤",
                    onClick = onOpenProfile,
                )
                HeaderIconButton(
                    symbol = if (currentEmail.isNullOrBlank()) "🔑" else "🚪",
                    onClick = if (currentEmail.isNullOrBlank()) onOpenSignIn else onSignOut,
                )
                HeaderIconButton(
                    symbol = "☰",
                    onClick = onOpenMenu,
                )
            }
        }
    }
}

@Composable
private fun HeaderIconButton(
    symbol: String,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.size(30.dp),
        shape = RoundedCornerShape(7.dp),
        color = Color.Black.copy(alpha = 0.34f),
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
    ) {
        IconButton(onClick = onClick) {
            Text(
                text = symbol,
                color = if (symbol == "🔑") ParagonGold else Color.White,
                style = MaterialTheme.typography.labelMedium
            )
        }
    }
}

@Composable
private fun AboutRoleButton(role: String) {
    val label = when (role.uppercase()) {
        "USER", "UNASSIGNED" -> "About Paragon User"
        "CITIZEN" -> "About Citizen Contestants"
        "PROMOTER" -> "About Ambassadors"
        "MERCHANT" -> "About The Merchants"
        "BACKER" -> "About Backer Contestants"
        "SUPERNAL" -> "About Superbosses"
        else -> "About Paragon Members"
    }

    Box(
        modifier = Modifier
            .background(Color.White, RoundedCornerShape(20.dp))
            .padding(12.dp)
    ) {
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = Color(0xFF111111)
        ) {
            Text(
                text = label,
                color = Color.White,
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
            )
        }
    }
}

@Composable
private fun ProfileActions(
    isLoading: Boolean,
    onSignOut: () -> Unit,
    onRefresh: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        OutlinedButton(
            onClick = onSignOut,
            enabled = !isLoading,
            modifier = Modifier.weight(1f)
        ) {
            Text("Sign out")
        }
        Button(
            onClick = onRefresh,
            enabled = !isLoading,
            modifier = Modifier.weight(1f)
        ) {
            Text("Refresh profile")
        }
    }
}

@Composable
private fun ProfileHero(
    profile: MobileProfile,
    onOpenEditProfile: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onOpenMarketplace: () -> Unit,
    onOpenMerchantAbout: () -> Unit,
    onOpenEarnRoles: () -> Unit,
    inboxUnreadCount: Int,
    onOpenInbox: () -> Unit,
    onRefresh: () -> Unit,
) {
    val context = LocalContext.current
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "${profile.role.uppercase()} Profile",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = profile.realName ?: profile.displayName,
                color = Color(0xFF666666),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            ProfileQuickActions(
                role = profile.role,
                onOpenEditProfile = onOpenEditProfile,
                onOpenWallet = onOpenWallet,
                onOpenMeetUp = onOpenMeetUp,
                onOpenMarketplace = onOpenMarketplace,
                onOpenMerchantAbout = onOpenMerchantAbout,
                onOpenEarnRoles = onOpenEarnRoles,
                inboxUnreadCount = inboxUnreadCount,
                onOpenInbox = onRefresh,
                onRefresh = onRefresh,
            )
        }
    }
}

@Composable
private fun CitizenProfileHero(
    profile: MobileProfile,
    profileViewModel: ProfileViewModel,
    inboxUnreadCount: Int,
    onOpenEditProfile: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onOpenEarnRoles: () -> Unit,
) {
    var ambassadors by remember { mutableStateOf<List<AmbassadorContactItem>>(emptyList()) }
    var isLoadingAmbassadors by remember { mutableStateOf(false) }
    var showAmbassadors by remember { mutableStateOf(false) }
    var ambassadorError by remember { mutableStateOf<String?>(null) }
    var selectedAmbassador by remember { mutableStateOf<AmbassadorContactItem?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Citizen Contestants Profile",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = profile.stageName ?: profile.displayName,
                color = Color(0xFF666666),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ProfileActionChip("Edit Profile", onClick = onOpenEditProfile)
                ProfileActionChip(
                    label = if (isLoadingAmbassadors) "Loading..." else "List Ambassadors",
                    onClick = {
                        showAmbassadors = true
                        if (ambassadors.isNotEmpty() || isLoadingAmbassadors) return@ProfileActionChip
                        isLoadingAmbassadors = true
                        ambassadorError = null
                        scope.launch {
                            runCatching { profileViewModel.loadAmbassadorContacts() }
                                .onSuccess { ambassadors = it }
                                .onFailure { ambassadorError = it.message ?: "Ambassador accounts could not load." }
                            isLoadingAmbassadors = false
                        }
                    }
                )
                ProfileActionChip("Invite", onClick = {
                    context.shareText(buildPlayStoreInviteMessage())
                })
                ProfileActionChip("Inbox", unreadCount = inboxUnreadCount)
                ProfileActionChip("Wallet", onClick = onOpenWallet)
                ProfileActionChip("Meet-Up", onClick = onOpenMeetUp)
                ProfileActionChip("Add Role", onClick = onOpenEarnRoles)
            }
        }
    }

    if (showAmbassadors) {
        AmbassadorListDialog(
            ambassadors = ambassadors,
            isLoading = isLoadingAmbassadors,
            errorMessage = ambassadorError,
            onClose = { showAmbassadors = false },
            onMessage = { ambassador ->
                showAmbassadors = false
                selectedAmbassador = ambassador
            }
        )
    }

    selectedAmbassador?.let { ambassador ->
        AmbassadorDirectMessageDialog(
            ambassador = ambassador,
            profile = profile,
            profileViewModel = profileViewModel,
            onClose = { selectedAmbassador = null },
        )
    }
}

@Composable
private fun AmbassadorProfileHero(
    profile: MobileProfile,
    profileViewModel: ProfileViewModel,
    inboxUnreadCount: Int,
    onOpenWallet: () -> Unit,
    onOpenEarnRoles: () -> Unit,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    var inviteLink by remember { mutableStateOf<String?>(null) }
    var inviteError by remember { mutableStateOf<String?>(null) }
    var isCreatingInvite by remember { mutableStateOf(false) }

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Paragon Ambassadors",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = profile.brandName ?: profile.displayName,
                color = Color(0xFF666666),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ProfileActionChip(
                    label = if (isCreatingInvite) "Preparing..." else "Invite Citizen",
                    onClick = {
                        if (isCreatingInvite) return@ProfileActionChip
                        isCreatingInvite = true
                        inviteError = null
                        scope.launch {
                            runCatching { profileViewModel.createCitizenInviteLink() }
                                .onSuccess { inviteLink = it }
                                .onFailure { inviteError = it.message ?: "Could not create invite link." }
                            isCreatingInvite = false
                        }
                    }
                )
                ProfileActionChip("Invite", onClick = {
                    context.shareText(buildPlayStoreInviteMessage())
                })
                ProfileActionChip("Add Role", onClick = onOpenEarnRoles)
                ProfileActionChip("Inbox", unreadCount = inboxUnreadCount)
                ProfileActionChip("Wallet", onClick = onOpenWallet)
            }
            inviteError?.let {
                Text(
                    text = it,
                    color = Color(0xFFB00020),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }

    if (!inviteLink.isNullOrBlank()) {
        InviteSupportDialog(
            title = "Invite citizens",
            subtitle = "Share your citizen invitation link",
            helperText = "Use Share Invite to send this link through WhatsApp, Email, SMS, or any social app.",
            link = inviteLink.orEmpty(),
            clipboard = clipboard,
            onClose = { inviteLink = null },
            onOpenWhatsApp = { context.openExternal("https://wa.me/?text=${Uri.encode(buildInviteMessage(inviteLink.orEmpty()))}") },
            onOpenEmail = {
                context.openEmailInvite(
                    subject = "Paragon Planet Invite",
                    body = buildInviteMessage(inviteLink.orEmpty())
                )
            },
            onOpenSms = { context.openSmsInvite(buildInviteMessage(inviteLink.orEmpty())) },
            onCopyLink = { clipboard.setText(AnnotatedString(inviteLink.orEmpty())) },
            onOpenOtherApps = { context.shareText(buildInviteMessage(inviteLink.orEmpty())) }
        )
    }
}

@Composable
private fun AmbassadorListDialog(
    ambassadors: List<AmbassadorContactItem>,
    isLoading: Boolean,
    errorMessage: String?,
    onClose: () -> Unit,
    onMessage: (AmbassadorContactItem) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onClose,
        confirmButton = {
            TextButton(onClick = onClose) {
                Text("Close")
            }
        },
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Ambassador Message Accounts", fontWeight = FontWeight.Bold)
                Text("Choose an ambassador to contact", style = MaterialTheme.typography.titleMedium)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when {
                    isLoading -> Text("Loading ambassadors...", color = Color(0xFF5A534A))
                    !errorMessage.isNullOrBlank() -> Text(errorMessage, color = Color(0xFFB00020))
                    ambassadors.isEmpty() -> Text("No ambassador message accounts available right now.", color = Color(0xFF5A534A))
                    else -> {
                        ambassadors.forEach { ambassador ->
                            Surface(shape = RoundedCornerShape(14.dp), color = Color(0xFFFFFDF8)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(
                                        modifier = Modifier.weight(1f),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text(ambassador.displayName, color = Color(0xFF111111), fontWeight = FontWeight.Bold)
                                        Text(ambassador.subtitle, color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
                                        if (ambassador.extra.isNotBlank()) {
                                            Text(ambassador.extra, color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                    ProfileActionChip("Message", onClick = { onMessage(ambassador) })
                                }
                            }
                        }
                    }
                }
            }
        }
    )
}

@Composable
private fun AmbassadorDirectMessageDialog(
    ambassador: AmbassadorContactItem,
    profile: MobileProfile,
    profileViewModel: ProfileViewModel,
    onClose: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var message by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onClose,
        confirmButton = {
            TextButton(
                enabled = !sending && message.isNotBlank(),
                onClick = {
                    sending = true
                    error = null
                    scope.launch {
                        runCatching {
                            profileViewModel.sendDirectMessageToAmbassador(
                                ambassador = ambassador,
                                text = message,
                                senderName = profile.stageName ?: profile.realName ?: profile.displayName,
                            )
                        }.onSuccess {
                            message = ""
                            onClose()
                        }.onFailure {
                            error = it.message ?: "Message could not be sent."
                        }
                        sending = false
                    }
                }
            ) {
                Text(if (sending) "Sending..." else "Send")
            }
        },
        dismissButton = {
            TextButton(onClick = onClose, enabled = !sending) {
                Text("Close")
            }
        },
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(ambassador.displayName, fontWeight = FontWeight.Bold)
                Text("Message Ambassador", style = MaterialTheme.typography.titleMedium)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    minLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Write your message") },
                    colors = websiteFieldColors(),
                )
                error?.let {
                    Text(it, color = Color(0xFFB00020), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    )
}

@Composable
private fun AmbassadorContactDialog(
    ambassador: AmbassadorContactItem,
    onClose: () -> Unit,
    onOpenEmail: () -> Unit,
    onOpenWhatsApp: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onClose,
        confirmButton = {
            TextButton(onClick = onClose) {
                Text("Close")
            }
        },
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(ambassador.displayName, fontWeight = FontWeight.Bold)
                Text("Choose how to contact this ambassador", style = MaterialTheme.typography.titleMedium)
            }
        },
        text = {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (!ambassador.email.isNullOrBlank()) {
                    ProfileActionChip("Email", onClick = onOpenEmail)
                }
                if (!ambassador.phone.isNullOrBlank()) {
                    ProfileActionChip("WhatsApp", onClick = onOpenWhatsApp)
                }
            }
        }
    )
}

@Composable
private fun BackerProfileHero(
    profile: MobileProfile,
    profileViewModel: ProfileViewModel,
    inboxUnreadCount: Int,
    onOpenEditProfile: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenEarnRoles: () -> Unit,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    var inviteLink by remember { mutableStateOf<String?>(null) }
    var isCreatingInvite by remember { mutableStateOf(false) }
    var inviteError by remember { mutableStateOf<String?>(null) }

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Backer Contestant Profile",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = profile.realName ?: profile.displayName,
                color = Color(0xFF666666),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            BackerProfileQuickActions(
                onOpenEditProfile = onOpenEditProfile,
                onOpenWallet = onOpenWallet,
                onOpenEarnRoles = onOpenEarnRoles,
                inboxUnreadCount = inboxUnreadCount,
                isCreatingInvite = isCreatingInvite,
                onInviteSupporters = {
                    if (isCreatingInvite) return@BackerProfileQuickActions
                    isCreatingInvite = true
                    inviteError = null
                    scope.launch {
                        runCatching {
                            profileViewModel.createSupportInviteLink(
                                role = profile.role,
                                targetName = profile.realName ?: profile.displayName
                            )
                        }.onSuccess { inviteLink = it }
                            .onFailure { inviteError = it.message ?: "Could not create invite link." }
                        isCreatingInvite = false
                    }
                }
            )
            inviteError?.let {
                Text(
                    text = it,
                    color = Color(0xFFB00020),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }

    if (!inviteLink.isNullOrBlank()) {
        InviteSupportDialog(
            link = inviteLink.orEmpty(),
            clipboard = clipboard,
            onClose = { inviteLink = null },
            onOpenWhatsApp = { context.openExternal("https://wa.me/?text=${Uri.encode(buildInviteMessage(inviteLink.orEmpty()))}") },
            onOpenEmail = {
                context.openEmailInvite(
                    subject = "Paragon Planet Invite",
                    body = buildInviteMessage(inviteLink.orEmpty())
                )
            },
            onOpenSms = { context.openSmsInvite(buildInviteMessage(inviteLink.orEmpty())) },
            onCopyLink = { clipboard.setText(AnnotatedString(inviteLink.orEmpty())) },
            onOpenOtherApps = { context.shareText(buildInviteMessage(inviteLink.orEmpty())) }
        )
    }
}

@Composable
private fun SuperbossProfileHero(
    profile: MobileProfile,
    profileViewModel: ProfileViewModel,
    inboxUnreadCount: Int,
    onOpenEditProfile: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenEarnRoles: () -> Unit,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    var inviteLink by remember { mutableStateOf<String?>(null) }
    var isCreatingInvite by remember { mutableStateOf(false) }
    var inviteError by remember { mutableStateOf<String?>(null) }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Superbosses Profile",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = profile.realName ?: profile.displayName,
                color = Color(0xFF666666),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            BackerProfileQuickActions(
                onOpenEditProfile = onOpenEditProfile,
                onOpenWallet = onOpenWallet,
                onOpenEarnRoles = onOpenEarnRoles,
                inboxUnreadCount = inboxUnreadCount,
                isCreatingInvite = isCreatingInvite,
                onInviteSupporters = {
                    if (isCreatingInvite) return@BackerProfileQuickActions
                    isCreatingInvite = true
                    inviteError = null
                    scope.launch {
                        runCatching {
                            profileViewModel.createSupportInviteLink(
                                role = profile.role,
                                targetName = profile.realName ?: profile.displayName
                            )
                        }.onSuccess { inviteLink = it }
                            .onFailure { inviteError = it.message ?: "Could not create invite link." }
                        isCreatingInvite = false
                    }
                }
            )
            inviteError?.let {
                Text(it, color = Color(0xFFB00020), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            }
        }
    }

    if (!inviteLink.isNullOrBlank()) {
        InviteSupportDialog(
            link = inviteLink.orEmpty(),
            clipboard = clipboard,
            onClose = { inviteLink = null },
            onOpenWhatsApp = { context.openExternal("https://wa.me/?text=${Uri.encode(buildInviteMessage(inviteLink.orEmpty()))}") },
            onOpenEmail = {
                context.openEmailInvite(
                    subject = "Paragon Planet Invite",
                    body = buildInviteMessage(inviteLink.orEmpty())
                )
            },
            onOpenSms = { context.openSmsInvite(buildInviteMessage(inviteLink.orEmpty())) },
            onCopyLink = { clipboard.setText(AnnotatedString(inviteLink.orEmpty())) },
            onOpenOtherApps = { context.shareText(buildInviteMessage(inviteLink.orEmpty())) }
        )
    }
}

@Composable
private fun BackerProfileQuickActions(
    onOpenEditProfile: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenEarnRoles: () -> Unit,
    inboxUnreadCount: Int,
    isCreatingInvite: Boolean,
    onInviteSupporters: () -> Unit,
) {
    val context = LocalContext.current
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ProfileActionChip("Edit Profile", onClick = onOpenEditProfile)
        ProfileActionChip(
            label = if (isCreatingInvite) "Preparing..." else "Invite Supporters",
            onClick = onInviteSupporters
        )
        ProfileActionChip("Invite", onClick = {
            context.shareText(buildPlayStoreInviteMessage())
        })
        ProfileActionChip("Inbox", unreadCount = inboxUnreadCount)
        ProfileActionChip("Wallet", onClick = onOpenWallet)
        ProfileActionChip("Add Role", onClick = onOpenEarnRoles)
    }
}

@Composable
private fun InviteSupportDialog(
    title: String = "Invite supporters",
    subtitle: String = "Share your invitation link",
    helperText: String = "Use Share Invite to send this link through WhatsApp, Email, SMS, or any social app.",
    link: String,
    clipboard: androidx.compose.ui.platform.ClipboardManager,
    onClose: () -> Unit,
    onOpenWhatsApp: () -> Unit,
    onOpenEmail: () -> Unit,
    onOpenSms: () -> Unit,
    onCopyLink: () -> Unit,
    onOpenOtherApps: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onClose,
        confirmButton = {
            TextButton(onClick = onClose) {
                Text("Close")
            }
        },
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, fontWeight = FontWeight.Bold)
                Text(subtitle, style = MaterialTheme.typography.titleMedium)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    helperText,
                    color = Color(0xFF5A534A)
                )
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFF3EFE6)
                ) {
                    Text(
                        text = link,
                        modifier = Modifier.padding(12.dp),
                        color = Color(0xFF111111)
                    )
                }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ProfileActionChip("Share Invite", onClick = onOpenOtherApps)
                    ProfileActionChip("Copy Link", onClick = {
                        onCopyLink()
                    })
                }
            }
        }
    )
}

@Composable
private fun AmbassadorAboutCard() {
    var showAbout by remember { mutableStateOf(false) }

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ProfileActionChip(
                label = if (showAbout) "Hide About Ambassadors" else "About Ambassadors",
                onClick = { showAbout = !showAbout }
            )
            if (showAbout) {
                Surface(shape = RoundedCornerShape(16.dp), color = Color(0xFF171717)) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("About Ambassadors", color = Color.White, fontWeight = FontWeight.Bold)
                        BackerAboutParagraph("Paragon Planet Ambassadors are promotional Stars, talent scouts, artist managers, MCs, presenters, media personalities, entertainment promoters, influencers, and talent representatives who discover, invite, support, and promote talented Stars into the Paragon Planet ecosystem through their unique invitation links.")
                        BackerAboutParagraph("Ambassadors serve as important promotional forces within the Planet by helping talented individuals gain visibility, audience engagement, recognition, and opportunities within the ecosystem.")
                        Text("As an Ambassador, Your Mission Is To:", color = Color.White, fontWeight = FontWeight.Bold)
                        listOf(
                            "Invite talented Citizens to join Paragon Planet",
                            "Discover and promote Stars across different talent categories",
                            "Build and grow your own network of Citizens",
                            "Support the visibility, branding, and development of your invited Stars",
                            "Help talents gain recognition, votes, followers, and opportunities",
                            "Promote engagement and participation within the ecosystem",
                            "Earn rewards from the success and activities of your Citizens",
                        ).forEach { item ->
                            BackerAboutBullet(item)
                        }
                        Surface(shape = RoundedCornerShape(14.dp), color = Color(0xFFF3EFE6)) {
                            Text(
                                "When a Citizen joins through an Ambassador's invitation link, the Ambassador becomes connected to that Citizen within the platform's promotional structure. Based on the platform's reward system, Ambassadors earn commission rewards from the votes and engagement activities generated by their invited Citizens.",
                                modifier = Modifier.padding(14.dp),
                                color = Color(0xFF101828),
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                        BackerAboutParagraph("Ambassadors play a major role in expanding the Planet by connecting hidden talents to contests, promotions, audience visibility, sponsorship opportunities, entertainment exposure, and recognition within the Paragon Planet ecosystem.")
                        BackerAboutParagraph("Outstanding Ambassadors who successfully build, manage, and promote high-performing Citizens across multiple categories may qualify for higher Planet Levels, special recognition statuses, exclusive rewards, and leadership opportunities within the Game of ALL STARS GBAZILO.")
                    }
                }
            }
        }
    }
}

@Composable
private fun BackerAboutCard() {
    var showAbout by remember { mutableStateOf(false) }

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ProfileActionChip(
                label = if (showAbout) "Hide About Backer Contestants" else "About Backer Contestants",
                onClick = { showAbout = !showAbout }
            )
            if (showAbout) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    BackerAboutParagraph("Paragon Planet Backers")
                    BackerAboutParagraph("Contestants for Paragon Planet Backers are selected from individuals, professionals, and service providers operating within sectors such as Health, Environment, Education, Enterprise, Entertainment, Finance, Security, Media, Law, Technology, Governance, and Religion.")
                    BackerAboutParagraph("These contestants compete to earn scores, rewards, and qualification marks through Questions & Answers, reasoning activities, analytical challenges, engagement tasks, and knowledge-based participation across the twelve service fields in order to become Official Backers of Paragon Planet.")
                }
            }
        }
    }
}

@Composable
private fun AmbassadorDetailsCard(profile: MobileProfile) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            DetailLine("Brand Name", profile.brandName ?: profile.displayName)
            DetailLine("Real Name", profile.realName)
            DetailLine("Phone", profile.phone)
            DetailLine("Country", profile.country)
            DetailLine("State", profile.state)
            DetailLine("Capacity", profile.declaredCapacity)
            DetailLine("Types", profile.promoterTypes.joinToString(", ").ifBlank { null })
            AmbassadorStatusPanel(status = profile.status)
        }
    }
}

@Composable
private fun AmbassadorStatusPanel(status: String?) {
    val normalized = status?.uppercase().orEmpty()
    val body = when (normalized) {
        "APPROVED" -> "Your ambassador account is approved and ready to invite citizens."
        "PENDING_REVIEW" -> "Your application is under admin review. Please wait for approval."
        "REJECTED" -> "Your application was rejected. Update your details and submit again."
        else -> "Your ambassador status will appear here once it is available."
    }
    val accent = when (normalized) {
        "APPROVED" -> Color(0xFF176B4D)
        "REJECTED" -> Color(0xFFB42318)
        else -> Color(0xFF7A5C00)
    }
    Surface(shape = RoundedCornerShape(16.dp), color = accent.copy(alpha = 0.10f)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text("Review Status: ${status ?: "Pending"}", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text(body, color = Color(0xFF52616B), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun AmbassadorInvitedCitizensCard(citizens: List<InvitedCitizenItem>) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Citizens From Your Invitations", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Text("Citizens who registered through your invite link.", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
                }
                Surface(shape = RoundedCornerShape(999.dp), color = Color(0xFFEAF7F0)) {
                    Text(
                        text = "${citizens.size} citizens",
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        color = Color(0xFF176B4D),
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            if (citizens.isEmpty()) {
                Text("No citizens have registered through your invite link yet.", color = Color(0xFF5A534A))
            } else {
                citizens.forEach { citizen ->
                    Surface(shape = RoundedCornerShape(16.dp), color = Color(0xFFFFFDF8)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(citizen.displayName, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                                Text(
                                    listOf(citizen.realName, citizen.talents.joinToString(", ").takeIf { it.isNotBlank() })
                                        .filterNotNull()
                                        .joinToString(" • ")
                                        .ifBlank { "Citizen" },
                                    color = Color(0xFF5A534A),
                                    style = MaterialTheme.typography.bodySmall
                                )
                                Text(
                                    listOf(citizen.country, citizen.state).filterNotNull().joinToString(", ").ifBlank { "-" },
                                    color = Color(0xFF5A534A),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            Surface(shape = RoundedCornerShape(999.dp), color = Color(0xFFF1F1F1)) {
                                Text(
                                    text = citizen.registrationType ?: "INVITED",
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    color = Color(0xFF111111),
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Medium
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
private fun SuperbossAboutCard() {
    var showAbout by remember { mutableStateOf(false) }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ProfileActionChip(
                label = if (showAbout) "Hide About Superbosses" else "About Superbosses",
                onClick = { showAbout = !showAbout }
            )
            if (showAbout) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    BackerAboutParagraph("Paragon Planet Superbosses")
                    BackerAboutParagraph("Candidates for Paragon Planet Superbosses are selected from recommended Teachers, Tutors, Lecturers, Trainers, Mentors, and Instructors by their students, tutees, trainees, and followers across various fields of study and sectors of society, including Health, Environment, Education, Enterprise, Entertainment, Finance, Security, Media, Law, Technology, Governance, and Religion.")
                    BackerAboutParagraph("The recommendation process is based on their outstanding works, reasoning capacity, professional knowledge, wisdom, leadership ability, discipline, mentorship qualities, and positive social impact on those they have trained, guided, and mentored within their respective sectors.")
                    BackerAboutParagraph("Superbosses compete to earn scores, recognition, influence, authority, and rewards through verified Questions & Answers systems, strategic activities, reasoning exercises, and leadership evaluations.")
                }
            }
        }
    }
}

@Composable
private fun BackerAboutParagraph(text: String) {
    Text(
        text = text,
        color = Color(0xFF26384D),
        style = MaterialTheme.typography.bodyMedium
    )
}

@Composable
private fun BackerAboutBullet(text: String) {
    Text(
        text = "• $text",
        color = Color(0xFF26384D),
        style = MaterialTheme.typography.bodyMedium
    )
}

@Composable
private fun BackerDetailsCard(profile: MobileProfile) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DetailLine("Real Name", profile.realName ?: profile.displayName)
            DetailLine("Age", profile.age)
            DetailLine("Gender", profile.gender)
            DetailLine("Marital Status", profile.maritalStatus)
            DetailLine("Profession", profile.profession)
            DetailLine("Phone", profile.phone)
            DetailLine("Country", profile.country)
            DetailLine("State", profile.state)
            DetailLine("Tribe", profile.tribe)
            DetailLine("Employment Status", profile.employmentStatus?.replace("_", " "))
            DetailLine("Employment Type", profile.employmentType?.replace("_", " "))
            DetailLine("Business Name", profile.businessName ?: profile.placeOfEmployment)
            DetailLine(
                "Fields of Service",
                profile.serviceLabels.takeIf { it.isNotEmpty() }?.joinToString(", ")
            )
        }
    }
}

@Composable
private fun SuperbossDetailsCard(profile: MobileProfile) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DetailLine("Real Name", profile.realName ?: profile.displayName)
            DetailLine("Age", profile.age)
            DetailLine("Gender", profile.gender)
            DetailLine("Marital Status", profile.maritalStatus)
            DetailLine("Profession", profile.profession)
            DetailLine("Phone", profile.phone)
            DetailLine("Country", profile.country)
            DetailLine("State", profile.state)
            DetailLine("Tribe", profile.tribe)
            DetailLine("Employment Status", profile.employmentStatus?.replace("_", " "))
            DetailLine("Employment Type", profile.employmentType?.replace("_", " "))
            DetailLine("Business Name", profile.businessName ?: profile.placeOfEmployment)
            DetailLine(
                "Fields of Discipline",
                profile.serviceLabels.takeIf { it.isNotEmpty() }?.joinToString(", ")
            )
        }
    }
}

@Composable
private fun BackerGoodWorksCard(profile: MobileProfile) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("Good Works Testimony", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text(
                "${profile.totalGoodWorksSupports} public supports",
                color = Color(0xFF176B4D),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                "Positive testimony can come from people who benefited from this Backer's work.",
                color = Color(0xFF5A534A),
                style = MaterialTheme.typography.bodySmall
            )
            backerGoodWorkGroups.forEach { (key, label) ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(label, color = Color(0xFF232323))
                    Text(
                        profile.goodWorksCounts[key]?.toString() ?: "0",
                        color = Color(0xFF111111),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun BackerChallengeStudioSection(
    profile: MobileProfile,
    bundle: BackerChallengeBundle,
    profileViewModel: ProfileViewModel,
) {
    ChallengeStudioSection(
        profile = profile,
        bundle = bundle,
        profileViewModel = profileViewModel,
        roleLabel = "Backer",
        studioTitle = "Backer Challenge Studio",
        studioDescription = "Create up to 5 timed challenge cards. Each card needs 4 answer choices, a hidden correct answer, a visible timer, and a visible reward weight.",
        publishedTitle = "Published Challenges",
        publishedEmpty = "You have not published any challenge cards yet.",
        openTitle = "Open Backer Challenges",
        openEmpty = "There are no open challenge cards from other backers right now.",
        statsTitle = "My Backer Stats",
        historyTitle = "My Attempt History",
        historyEmpty = "Your completed challenge attempts will appear here.",
        leaderboardTitle = "Backer Leaderboard",
    )
}

@Composable
private fun SuperbossChallengeStudioSection(
    profile: MobileProfile,
    bundle: BackerChallengeBundle,
    profileViewModel: ProfileViewModel,
) {
    ChallengeStudioSection(
        profile = profile,
        bundle = bundle,
        profileViewModel = profileViewModel,
        roleLabel = "Superboss",
        studioTitle = "Superbosses Challenge Studio",
        studioDescription = "After the recommendation process, Superbosses can challenge one another with timed questions, visible rewards, and hidden answers to test knowledge, strategy, and discipline.",
        publishedTitle = "Published Superboss Challenges",
        publishedEmpty = "You have not published any Superboss challenge cards yet.",
        openTitle = "Open Superboss Challenges",
        openEmpty = "There are no open challenge cards from other Superbosses right now.",
        statsTitle = "My Superboss Challenge Stats",
        historyTitle = "My Superboss Challenge History",
        historyEmpty = "Your completed Superboss challenge attempts will appear here.",
        leaderboardTitle = "Superboss Challenge Leaderboard",
    )
}

@Composable
private fun ChallengeStudioSection(
    profile: MobileProfile,
    bundle: BackerChallengeBundle,
    profileViewModel: ProfileViewModel,
    roleLabel: String,
    studioTitle: String,
    studioDescription: String,
    publishedTitle: String,
    publishedEmpty: String,
    openTitle: String,
    openEmpty: String,
    statsTitle: String,
    historyTitle: String,
    historyEmpty: String,
    leaderboardTitle: String,
) {
    val scope = rememberCoroutineScope()
    var drafts by remember(bundle.myQuestions.size, roleLabel) { mutableStateOf(listOf(createEmptyBackerDraft())) }
    var saving by remember(roleLabel) { mutableStateOf(false) }
    var answeringQuestionId by remember(roleLabel) { mutableStateOf<String?>(null) }
    var openedQuestionId by remember(roleLabel) { mutableStateOf<String?>(null) }
    var openedQuestionExpiresAt by remember(roleLabel) { mutableStateOf<Long?>(null) }
    var openedQuestionSecondsLeft by remember(roleLabel) { mutableStateOf<Int?>(null) }
    var studioError by remember(roleLabel) { mutableStateOf<String?>(null) }
    var studioMessage by remember(roleLabel) { mutableStateOf<String?>(null) }
    var failedQuestionIds by remember(roleLabel) { mutableStateOf(setOf<String>()) }

    val activeOpenedQuestion = bundle.openQuestions.firstOrNull { it.id == openedQuestionId }

    LaunchedEffect(openedQuestionId, openedQuestionExpiresAt, activeOpenedQuestion?.id, roleLabel) {
        if (openedQuestionId == null || openedQuestionExpiresAt == null) return@LaunchedEffect
        while (openedQuestionId != null && openedQuestionExpiresAt != null) {
            val seconds = ((openedQuestionExpiresAt!! - System.currentTimeMillis()) / 1000.0).toInt().coerceAtLeast(0)
            openedQuestionSecondsLeft = seconds
            if (seconds <= 0) {
                val timedOut = activeOpenedQuestion
                val questionId = openedQuestionId
                openedQuestionId = null
                openedQuestionExpiresAt = null
                openedQuestionSecondsLeft = null
                questionId?.let { failedQuestionIds = failedQuestionIds + it }
                if (timedOut != null) {
                    runCatching {
                        profileViewModel.recordBackerTimeout(
                            role = profile.role,
                            question = timedOut,
                            responderName = profile.realName ?: profile.displayName
                        )
                    }
                    profileViewModel.reloadBackerChallenges()
                }
                break
            }
            kotlinx.coroutines.delay(1000)
        }
    }

    studioError?.let { StatusPanel(title = "Needs attention", body = it, accent = Color(0xFFB00020)) }
    studioMessage?.let { StatusPanel(title = "$roleLabel update", body = it, accent = Color(0xFF176B4D)) }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(studioTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text(studioDescription, color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)

            drafts.forEachIndexed { index, draft ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)), shape = RoundedCornerShape(16.dp)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Challenge ${index + 1}", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                        OutlinedTextField(
                            value = draft.questionText,
                            onValueChange = { value -> drafts = drafts.updated(index) { copy(questionText = value) } },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Enter your question") },
                            colors = websiteFieldColors()
                        )
                        draft.options.forEachIndexed { optionIndex, option ->
                            OutlinedTextField(
                                value = option,
                                onValueChange = { value ->
                                    drafts = drafts.updated(index) {
                                        copy(options = options.toMutableList().also { list -> list[optionIndex] = value })
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("Answer option ${optionIndex + 1}") },
                                colors = websiteFieldColors()
                            )
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Select the correct answer",
                                color = Color(0xFF7A6F62),
                                style = MaterialTheme.typography.bodySmall
                            )
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                listOf("A", "B", "C", "D").forEach { choice ->
                                    val selected = draft.correctAnswerIndex.equals(choice, ignoreCase = true)
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (selected) ParagonGold else Color.White,
                                        modifier = Modifier.clickable {
                                            drafts = drafts.updated(index) { copy(correctAnswerIndex = choice) }
                                        }
                                    ) {
                                        Text(
                                            text = choice,
                                            modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp),
                                            color = if (selected) Color(0xFF111111) else Color(0xFF111111),
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = draft.timeLimitValue,
                                onValueChange = { value -> drafts = drafts.updated(index) { copy(timeLimitValue = value) } },
                                modifier = Modifier.weight(1f),
                                label = { Text("Time limit") },
                                colors = websiteFieldColors()
                            )
                            OutlinedTextField(
                                value = draft.timeLimitUnit,
                                onValueChange = { value -> drafts = drafts.updated(index) { copy(timeLimitUnit = value) } },
                                modifier = Modifier.weight(1f),
                                label = { Text("seconds/minutes") },
                                colors = websiteFieldColors()
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = draft.rewardAmount,
                                onValueChange = { value -> drafts = drafts.updated(index) { copy(rewardAmount = value) } },
                                modifier = Modifier.weight(1f),
                                label = { Text("Price / reward") },
                                colors = websiteFieldColors()
                            )
                            var rewardExpanded by remember(index) { mutableStateOf(false) }
                            Box(modifier = Modifier.weight(1f)) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color.White,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { rewardExpanded = true }
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 12.dp, vertical = 10.dp),
                                        verticalArrangement = Arrangement.spacedBy(2.dp)
                                    ) {
                                        Text(
                                            text = "PARAG/GBAZILO",
                                            color = Color(0xFF7A6F62),
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                        Text(
                                            text = draft.rewardUnit.ifBlank { "PARAG" },
                                            color = Color(0xFF111111),
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.Medium
                                        )
                                    }
                                }
                                DropdownMenu(
                                    expanded = rewardExpanded,
                                    onDismissRequest = { rewardExpanded = false }
                                ) {
                                    listOf("PARAG", "GBAZILO").forEach { unit ->
                                        DropdownMenuItem(
                                            text = { Text(unit) },
                                            onClick = {
                                                drafts = drafts.updated(index) { copy(rewardUnit = unit) }
                                                rewardExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                        Text(
                            "Visible reward: ${formatRewardPreview(draft.rewardAmount, draft.rewardUnit)}. 1 PARAG = N100. 1 GBAZILO = N1000.",
                            color = Color(0xFF5A534A),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = {
                        if (bundle.myQuestions.size + drafts.size >= 5) {
                            studioError = "You can only set up 5 ${roleLabel.lowercase()} challenges."
                        } else {
                            drafts = drafts + createEmptyBackerDraft()
                        }
                    }
                ) { Text("Add Another Question") }
                Button(
                    onClick = {
                        saving = true
                        studioError = null
                        studioMessage = null
                        scope.launch {
                            val validDrafts = drafts.mapNotNull { it.toPayloadOrNull() }
                            if (bundle.myQuestions.size + validDrafts.size > 5) {
                                studioError = "You can only publish up to 5 questions."
                                saving = false
                                return@launch
                            }
                            runCatching {
                                profileViewModel.publishBackerQuestions(
                                    role = profile.role,
                                    ownerName = profile.realName ?: profile.displayName,
                                    drafts = validDrafts
                                )
                            }.onSuccess {
                                drafts = listOf(createEmptyBackerDraft())
                                profileViewModel.reloadBackerChallenges()
                                studioMessage = "$roleLabel challenges published successfully."
                            }.onFailure {
                                studioError = it.message ?: "$roleLabel challenge publish failed."
                            }
                            saving = false
                        }
                    },
                    enabled = !saving
                ) {
                    if (saving) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp) else Text("Publish Questions")
                }
            }
        }
    }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(publishedTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            if (bundle.myQuestions.isEmpty()) {
                Text(publishedEmpty, color = Color(0xFF5A534A))
            }
            bundle.myQuestions.forEachIndexed { index, question ->
                ChallengeQuestionCard(index = index + 1, question = question, roleLabel = roleLabel)
            }
        }
    }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(openTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            if (bundle.openQuestions.isEmpty()) {
                Text(openEmpty, color = Color(0xFF5A534A))
            }
            bundle.openQuestions.forEach { question ->
                OpenChallengeCard(
                    question = question,
                    roleLabel = roleLabel,
                    isOpen = activeOpenedQuestion?.id == question.id,
                    countdown = if (activeOpenedQuestion?.id == question.id) openedQuestionSecondsLeft else null,
                    failed = failedQuestionIds.contains(question.id),
                    answering = answeringQuestionId == question.id,
                    onStart = {
                        if (openedQuestionId != null && openedQuestionId != question.id) {
                            studioError = "Finish the currently opened timed question first."
                        } else {
                            openedQuestionId = question.id
                            openedQuestionExpiresAt = System.currentTimeMillis() + question.timeLimitSeconds * 1000L
                            openedQuestionSecondsLeft = question.timeLimitSeconds
                            failedQuestionIds = failedQuestionIds - question.id
                        }
                    },
                    onAnswer = { selectedIndex ->
                        answeringQuestionId = question.id
                        studioError = null
                        studioMessage = null
                        scope.launch {
                            runCatching {
                                profileViewModel.answerBackerQuestion(
                                    role = profile.role,
                                    question = question,
                                    selectedIndex = selectedIndex,
                                    responderName = profile.realName ?: profile.displayName
                                )
                            }.onSuccess { isCorrect ->
                                openedQuestionId = null
                                openedQuestionExpiresAt = null
                                openedQuestionSecondsLeft = null
                                profileViewModel.reloadBackerChallenges()
                                studioMessage = if (isCorrect) {
                                    "Correct answer. This question is now closed."
                                } else {
                                    "That answer is not correct. The question remains open."
                                }
                            }.onFailure {
                                studioError = it.message ?: "Could not submit answer."
                            }
                            answeringQuestionId = null
                        }
                    }
                )
            }
        }
    }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(statsTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            StatsLine("Correct Answers", bundle.stats.correctAnswers.toString())
            StatsLine("Failed Attempts", bundle.stats.failedAttempts.toString())
            StatsLine("Total Reward Won", "${bundle.stats.totalRewardWon} PARAG")
            StatsLine("Current Rank", bundle.stats.currentRank?.toString() ?: "-")
        }
    }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(historyTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            if (bundle.attempts.isEmpty()) {
                Text(historyEmpty, color = Color(0xFF5A534A))
            }
            bundle.attempts.forEach { attempt ->
                AttemptHistoryCard(attempt = attempt, roleLabel = roleLabel)
            }
        }
    }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(leaderboardTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text("Ranked by completed wins and reward-weight score.", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            if (bundle.leaderboard.isEmpty()) {
                Text("No solved $roleLabel challenge cards have been recorded yet.", color = Color(0xFF5A534A))
            }
            bundle.leaderboard.forEachIndexed { index, entry ->
                LeaderboardCard(index = index + 1, entry = entry)
            }
        }
    }
}

@Composable
private fun SuperbossReputationCard(profile: MobileProfile) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Superboss Reputation System", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text(
                "This record balances public praise for good service with reviewed complaint signals, so the profile reflects both impact and accountability.",
                color = Color(0xFF5A534A),
                style = MaterialTheme.typography.bodySmall
            )
            StatsLine("Public Testimonials", profile.totalTestimonials.toString())
            StatsLine("Verified Supporters", profile.verifiedSupporters.toString())
            StatsLine("Public Complaints", profile.totalComplaints.toString())
            StatsLine("Resolved Complaints", profile.resolvedComplaints.toString())
            StatsLine("Pending Complaints", profile.pendingComplaints.toString())
            StatsLine("Trust Score", "${profile.trustScore}%")

            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)), shape = RoundedCornerShape(16.dp)) {
                Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Public Testimonials", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Text(
                        "${profile.totalTestimonials} Testimonials",
                        color = Color(0xFF176B4D),
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "Positive testimonies may be submitted by students, tutees, trainees, mentees, followers, beneficiaries, and members of the public who have benefited from this Superboss's knowledge, mentorship, instruction, leadership, and service across various fields of discipline.",
                        color = Color(0xFF5A534A),
                        style = MaterialTheme.typography.bodySmall
                    )
                    supernalPositiveGroups.forEach { (key, label) ->
                        StatsLine(label, (profile.positiveTestimonyCounts[key] ?: 0).toString())
                    }
                }
            }

            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF5F5)), shape = RoundedCornerShape(16.dp)) {
                Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Public Complaint", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Text("${profile.totalComplaints} complaints", color = Color(0xFFB42318), fontWeight = FontWeight.Bold)
                    Text(
                        "Complaints are meant for alleged misconduct, abuse of office, oppression, or misuse of influence. They should go through review before affecting trust.",
                        color = Color(0xFF5A534A),
                        style = MaterialTheme.typography.bodySmall
                    )
                    StatsLine("Pending Review", profile.pendingComplaints.toString())
                    StatsLine("Resolved", profile.resolvedComplaints.toString())
                    Text("Verified account required", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.bodySmall)
                    Text("Evidence recommended", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.bodySmall)
                    Text("Right of reply protected", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun ChallengeQuestionCard(index: Int, question: BackerChallengeQuestion, roleLabel: String = "Backer") {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Challenge $index", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text(question.questionText, color = Color(0xFF232323), fontWeight = FontWeight.SemiBold)
            question.options.forEach { Text("• $it", color = Color(0xFF232323)) }
            Text("Timer: ${formatTimeLimit(question.timeLimitValue, question.timeLimitUnit)}", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            Text("Reward: ${formatRewardPreview(question.rewardAmount.toString(), question.rewardUnit)}", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            Text(if (question.answeredCorrectly) "Closed" else "Open", color = if (question.answeredCorrectly) Color(0xFF176B4D) else Color(0xFF6B5F4B), fontWeight = FontWeight.Bold)
            if (question.answeredCorrectly) {
                Text("Solved By: ${question.answeredByName ?: question.answeredBy ?: "-"}", color = Color(0xFF232323))
            } else {
                Text("The correct answer stays hidden until another ${roleLabel.lowercase()} solves this challenge.", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun OpenChallengeCard(
    question: BackerChallengeQuestion,
    roleLabel: String = "Backer",
    isOpen: Boolean,
    countdown: Int?,
    failed: Boolean,
    answering: Boolean,
    onStart: () -> Unit,
    onAnswer: (Int) -> Unit,
) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(question.ownerName.ifBlank { roleLabel }, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text("Timer: ${formatTimeLimit(question.timeLimitValue, question.timeLimitUnit)}", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            Text("Reward: ${formatRewardPreview(question.rewardAmount.toString(), question.rewardUnit)}", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            when {
                failed -> Text("You missed this challenge because the timer ended before you submitted the right answer.", color = Color(0xFFB42318), fontWeight = FontWeight.SemiBold)
                isOpen -> {
                    Text(question.questionText, color = Color(0xFF232323), fontWeight = FontWeight.SemiBold)
                    Text("Countdown: ${formatCountdown(countdown ?: 0)}", color = Color(0xFFB42318), fontWeight = FontWeight.Bold)
                    question.options.forEachIndexed { index, option ->
                        ProfileActionChip("${('A' + index)}. $option", onClick = { if (!answering) onAnswer(index) })
                    }
                }
                else -> Button(onClick = onStart) { Text("Start Challenge") }
            }
        }
    }
}

@Composable
private fun StatsLine(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Color(0xFF232323))
        Text(value, color = Color(0xFF111111), fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun AttemptHistoryCard(attempt: BackerChallengeAttempt, roleLabel: String = "Backer") {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(attempt.questionText, color = Color(0xFF232323), fontWeight = FontWeight.SemiBold)
            Text("Host: ${attempt.ownerName.ifBlank { roleLabel }}", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            Text("Reward: ${formatRewardPreview(attempt.rewardAmount.toString(), attempt.rewardUnit)}", color = Color(0xFF5A534A), style = MaterialTheme.typography.bodySmall)
            Text("Your Answer: ${attempt.selectedAnswer ?: "-"}", color = Color(0xFF232323))
            Text(
                "Outcome: ${if (attempt.didTimeout) "Failed by timeout" else if (attempt.isCorrect) "Correct" else "Wrong answer"}",
                color = if (attempt.isCorrect) Color(0xFF176B4D) else Color(0xFFB42318),
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun LeaderboardCard(index: Int, entry: BackerLeaderboardEntry) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("$index. ${entry.responderName}", color = Color(0xFF111111), fontWeight = FontWeight.Bold)
            Text("Correct Answers: ${entry.totalCorrect}", color = Color(0xFF232323), style = MaterialTheme.typography.bodySmall)
            Text("Score: ${entry.totalScore}", color = Color(0xFF232323), style = MaterialTheme.typography.bodySmall)
            Text("Total Reward: ${entry.totalParagEquivalent} PARAG", color = Color(0xFF232323), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun UserProfileHero(profile: MobileProfile) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "USER Profile",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = profile.realName ?: profile.displayName,
                color = Color(0xFF666666),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun UserProfileActionsCard(
    profile: MobileProfile,
    inboxUnreadCount: Int,
    onOpenWallet: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onOpenEditProfile: () -> Unit,
    onOpenEarnRoles: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "User Profile",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            DetailLine("User Name", profile.realName ?: profile.displayName)
            DetailLine("Email", profile.email)
            val context = LocalContext.current
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ProfileActionChip("Wallet", onClick = onOpenWallet)
                ProfileActionChip("Meet-Up", onClick = onOpenMeetUp)
                ProfileActionChip("Edit Profile", onClick = onOpenEditProfile)
                ProfileActionChip("Inbox", unreadCount = inboxUnreadCount)
                ProfileActionChip("Invite", onClick = {
                    context.shareText(buildPlayStoreInviteMessage())
                })
            }
        }
    }
}

@Composable
private fun UserInformationCard(
    profile: MobileProfile,
    onDeleteAccount: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DetailLine("Email", profile.email)
            DetailLine("Real Name", profile.realName ?: profile.displayName)
            DetailLine("Gender", profile.gender)
            DetailLine("Phone", profile.phone)
            DetailLine("Country", profile.country)
            DetailLine("State", profile.state)
            DetailLine("Status", profile.status)
            Spacer(modifier = Modifier.size(2.dp))
            DeleteAccountFooter(onDeleteAccount = onDeleteAccount)
        }
    }
}

@Composable
private fun UserRoleChoiceCard(
    onContinueAsUser: suspend () -> Unit,
    onOpenEarnRoles: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var isSavingUser by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Select Your Role To Earn",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Continue as a User or pick a role to earn on the way to Paragon Planet.",
                color = Color(0xFF4C4C4C),
                style = MaterialTheme.typography.bodyMedium
            )
            errorMessage?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFB00020)
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = {
                        if (isSavingUser) return@Button
                        isSavingUser = true
                        errorMessage = null
                        scope.launch {
                            runCatching { onContinueAsUser() }
                                .onFailure { errorMessage = it.message ?: "Could not continue as a user right now." }
                            isSavingUser = false
                        }
                    },
                    modifier = Modifier.weight(1f),
                    enabled = !isSavingUser
                ) {
                    if (isSavingUser) {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(vertical = 2.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Continue as User")
                    }
                }
                Button(
                    onClick = onOpenEarnRoles,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Next")
                }
            }
        }
    }
}

@Composable
private fun ProfileQuickActions(
    role: String,
    onOpenEditProfile: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onOpenMarketplace: () -> Unit,
    onOpenMerchantAbout: () -> Unit,
    onOpenEarnRoles: () -> Unit,
    inboxUnreadCount: Int,
    onOpenInbox: () -> Unit,
    onRefresh: () -> Unit,
) {
    val context = LocalContext.current
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (role.isMerchantRole()) {
            ProfileActionChip("Merchant Center", onClick = onOpenEditProfile)
            ProfileActionChip("Marketplace", onClick = onOpenMarketplace)
            ProfileActionChip("About The Merchants", onClick = onOpenMerchantAbout)
            ProfileActionChip("Inbox", unreadCount = inboxUnreadCount, onClick = onOpenInbox)
            ProfileActionChip("Wallet", onClick = onOpenWallet)
            ProfileActionChip("Invite", onClick = {
                context.shareText(buildPlayStoreInviteMessage())
            })
            ProfileActionChip("Add Role", onClick = onOpenEarnRoles)
        } else if (role.isSponsorInvestorRole()) {
            ProfileActionChip("Edit Profile", onClick = onOpenEditProfile)
            ProfileActionChip("Inbox", unreadCount = inboxUnreadCount, onClick = onOpenInbox)
            ProfileActionChip("Wallet", onClick = onOpenWallet)
            ProfileActionChip("Invite", onClick = {
                context.shareText(buildPlayStoreInviteMessage())
            })
            ProfileActionChip("Add Role", onClick = onOpenEarnRoles)
        } else {
            ProfileActionChip("Edit Profile", onClick = onOpenEditProfile)
            ProfileActionChip("Inbox", unreadCount = inboxUnreadCount, onClick = onOpenInbox)
            ProfileActionChip("Wallet", onClick = onOpenWallet)
            ProfileActionChip("Meet-Up", onClick = onOpenMeetUp)
            ProfileActionChip("Invite", onClick = {
                context.shareText(buildPlayStoreInviteMessage())
            })
            ProfileActionChip("Add Role", onClick = onOpenEarnRoles)
            ProfileActionChip("Refresh", onClick = onRefresh)
        }
    }
}

@Composable
private fun ProfileActionChip(
    label: String,
    unreadCount: Int = 0,
    onClick: () -> Unit = {},
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = Color(0xFF111111),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                color = Color.White,
                style = MaterialTheme.typography.labelMedium,
            )
            if (unreadCount > 0) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Color(0xFFE11919)
                ) {
                    Text(
                        text = unreadCount.coerceAtMost(99).toString(),
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun CitizenLikeDetailsCard(profile: MobileProfile) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DetailLine("Stage Name", profile.stageName ?: profile.displayName)
            DetailLine("Real Name", profile.realName ?: profile.displayName)
            DetailLine("Age", profile.age)
            DetailLine("Gender", profile.gender)
            DetailLine("Marital Status", profile.maritalStatus)
            DetailLine("Phone", profile.phone)
            DetailLine("Country", profile.country)
            DetailLine("State", profile.state)
            DetailLine("Tribe", profile.tribe)
            DetailLine("Residence", profile.residence)
            DetailLine("Profession", profile.profession)
            DetailLine(
                "Talents",
                profile.talents.takeIf { it.isNotEmpty() }?.joinToString(", ")
            )
            if (!profile.headline.isNullOrBlank()) {
                Spacer(modifier = Modifier.size(2.dp))
                Text(
                    text = profile.headline,
                    color = Color(0xFF555555),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun SponsorInvestorDetailsCard(profile: MobileProfile) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DetailLine("Account Type", profile.accountType)
            DetailLine(
                if (profile.accountType.equals("INVESTOR", ignoreCase = true)) "Investor Type" else "Sponsor Type",
                if (profile.accountType.equals("INVESTOR", ignoreCase = true)) profile.investorType else profile.sponsorType
            )
            DetailLine("Real Name", profile.realName ?: profile.displayName)
            DetailLine("Phone", profile.phone)
            DetailLine("Email", profile.email)
            DetailLine("Country", profile.country)
            DetailLine("State / City", profile.stateCity ?: profile.state)
            DetailLine("Brand / Organization Name", profile.brandName)
            DetailLine("Website / Social Link", profile.websiteLink)
            DetailLine("Talent Field of Interest", profile.talentFields.takeIf { it.isNotEmpty() }?.joinToString(", "))
            DetailLine(
                if (profile.accountType.equals("INVESTOR", ignoreCase = true)) "Investment Interest" else "Sponsorship Interest",
                if (profile.accountType.equals("INVESTOR", ignoreCase = true)) {
                    profile.investorInterests.takeIf { it.isNotEmpty() }?.joinToString(", ")
                } else {
                    profile.sponsorInterests.takeIf { it.isNotEmpty() }?.joinToString(", ")
                }
            )
            DetailLine("Budget Range", profile.sponsorBudgetRange)
            DetailLine("Benefit Expected", profile.sponsorBenefits.takeIf { it.isNotEmpty() }?.joinToString(", "))
            DetailLine("Investment Capacity", profile.investmentCapacity)
            DetailLine("Risk Level", profile.riskLevel)
            DetailLine("Expected Return Type", profile.returnTypes.takeIf { it.isNotEmpty() }?.joinToString(", "))
            DetailLine("Status", profile.status)
        }
    }
}

@Composable
private fun DetailLine(label: String, value: String?) {
    if (value.isNullOrBlank()) return
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = "$label:",
            color = Color(0xFF111111),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = value,
            color = Color(0xFF232323),
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun SectionHeading(title: String) {
    Text(
        text = title,
        color = Color(0xFF111111),
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(horizontal = 2.dp)
    )
}

@Composable
private fun WebLikeVideoRow(
    video: ProfileVideoItem,
    canDelete: Boolean = false,
    isDeleting: Boolean = false,
    onDelete: () -> Unit = {},
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = video.title,
                    color = Color(0xFF151515),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = video.category,
                    color = Color(0xFF6A6A6A),
                    style = MaterialTheme.typography.bodySmall
                )
            }
            if (canDelete) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFFFF4D4F),
                    modifier = Modifier.clickable(enabled = !isDeleting, onClick = onDelete)
                ) {
                    Text(
                        text = if (isDeleting) "Deleting..." else "Delete",
                        color = Color.White,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyVideosCard() {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            text = "No videos uploaded yet.",
            modifier = Modifier.padding(16.dp),
            color = Color(0xFF333333)
        )
    }
}

@Composable
private fun DeleteAccountFooter(
    onDeleteAccount: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start
    ) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = Color(0xFFFF1F1F),
            modifier = Modifier.clickable(onClick = onDeleteAccount)
        ) {
            Text(
                text = "Delete Account",
                color = Color.White,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
            )
        }
    }
}

@Composable
private fun StatusPanel(
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
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = title,
                color = accent,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = body,
                color = Color(0xFF333333),
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun MerchantDetailsCard(profile: MobileProfile) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            DetailLine("Real Name", profile.realName ?: profile.displayName)
            DetailLine("Gender", profile.gender)
            DetailLine("Phone", profile.phone)
            DetailLine("Email", profile.email)
            DetailLine("Country", profile.country)
            DetailLine("State", profile.state)
            DetailLine("Status", profile.status)
        }
    }
}

@Composable
private fun EmptyProductsCard() {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Text(
            text = "No products uploaded yet.",
            modifier = Modifier.padding(18.dp),
            color = Color(0xFF5A534A)
        )
    }
}

@Composable
private fun MerchantProductRow(product: ProfileProductItem) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(product.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            Text(product.priceLabel, style = MaterialTheme.typography.bodyMedium, color = Color(0xFF232323), fontWeight = FontWeight.SemiBold)
            product.status?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFF6B5F4B))
            }
        }
    }
}

private val backerGoodWorkGroups = listOf(
    "fans" to "Fans",
    "students" to "Students",
    "clients" to "Clients",
    "patients" to "Patients",
    "communityMembers" to "Community Members",
    "beneficiaries" to "Beneficiaries",
    "followers" to "Followers",
)

private val supernalPositiveGroups = listOf(
    "students" to "Students",
    "tutees" to "Tutees",
    "trainees" to "Trainees",
    "mentees" to "Mentees",
    "followers" to "Followers",
    "beneficiaries" to "Beneficiaries",
    "communityMembers" to "Community Members",
)

private const val PLAY_STORE_APP_URL = "https://play.google.com/store/apps/details?id=com.app.natureswayproduction"

private fun buildInviteMessage(link: String): String {
    return "Join me on Paragon Planet with this invite link: $link"
}

private fun buildPlayStoreInviteMessage(): String {
    return "Join me on Paragon Planet on Google Play: $PLAY_STORE_APP_URL"
}

private fun buildInboxContactUrl(ambassador: AmbassadorContactItem): String {
    return "https://www.paragonplanet.com/inbox" +
        "?contactUid=${Uri.encode(ambassador.id)}" +
        "&contactName=${Uri.encode(ambassador.displayName)}" +
        "&contactRole=${Uri.encode("Ambassador")}" +
        "&contactSubtitle=${Uri.encode(ambassador.subtitle)}"
}

private fun android.content.Context.openExternal(url: String) {
    runCatching {
        startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }
}

private fun android.content.Context.openEmailInvite(
    subject: String,
    body: String,
    target: String = "",
) {
    val uri = Uri.parse(
        buildString {
            append("mailto:")
            append(target)
            if (subject.isNotBlank() || body.isNotBlank()) {
                append("?")
                if (subject.isNotBlank()) {
                    append("subject=${Uri.encode(subject)}")
                }
                if (body.isNotBlank()) {
                    if (subject.isNotBlank()) append("&")
                    append("body=${Uri.encode(body)}")
                }
            }
        }
    )
    runCatching {
        startActivity(Intent(Intent.ACTION_SENDTO, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

private fun android.content.Context.openSmsInvite(body: String) {
    val uri = Uri.parse("smsto:?body=${Uri.encode(body)}")
    runCatching {
        startActivity(Intent(Intent.ACTION_SENDTO, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

private fun android.content.Context.shareText(text: String) {
    runCatching {
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
                "Share invite"
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }
}

@Composable
private fun websiteFieldColors() = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color(0xFF111111),
    unfocusedTextColor = Color(0xFF111111),
    disabledTextColor = Color(0xFF3F3A33),
    focusedBorderColor = ParagonGold,
    unfocusedBorderColor = Color(0xFFD0D5DD),
    cursorColor = Color(0xFF111111),
    focusedLabelColor = Color(0xFF4C453D),
    unfocusedLabelColor = Color(0xFF4C453D),
    focusedPlaceholderColor = Color(0xFF6B5F4B),
    unfocusedPlaceholderColor = Color(0xFF6B5F4B),
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White,
)

private data class BackerChallengeDraftState(
    val questionText: String = "",
    val options: List<String> = listOf("", "", "", ""),
    val correctAnswerIndex: String = "",
    val timeLimitValue: String = "30",
    val timeLimitUnit: String = "seconds",
    val rewardAmount: String = "0",
    val rewardUnit: String = "PARAG",
)

private fun createEmptyBackerDraft(): BackerChallengeDraftState = BackerChallengeDraftState()

private fun BackerChallengeDraftState.toPayloadOrNull(): BackerChallengeDraftPayload? {
    val correctIndex = when (correctAnswerIndex.trim().uppercase()) {
        "A", "1" -> 0
        "B", "2" -> 1
        "C", "3" -> 2
        "D", "4" -> 3
        else -> null
    }
    val normalizedUnit = if (timeLimitUnit.equals("minutes", true)) "minutes" else "seconds"
    val timeValue = timeLimitValue.toIntOrNull() ?: return null
    val rewardValue = rewardAmount.toIntOrNull() ?: return null
    if (questionText.isBlank()) return null
    if (options.any { it.isBlank() }) return null
    if (correctIndex == null || correctIndex !in 0..3) return null
    val seconds = if (normalizedUnit == "minutes") timeValue * 60 else timeValue
    return BackerChallengeDraftPayload(
        questionText = questionText,
        options = options,
        correctAnswerIndex = correctIndex,
        timeLimitValue = timeValue,
        timeLimitUnit = normalizedUnit,
        timeLimitSeconds = seconds,
        rewardAmount = rewardValue,
        rewardUnit = rewardUnit.ifBlank { "PARAG" }.uppercase(),
    )
}

private fun List<BackerChallengeDraftState>.updated(
    index: Int,
    transform: BackerChallengeDraftState.() -> BackerChallengeDraftState,
): List<BackerChallengeDraftState> {
    return mapIndexed { currentIndex, item ->
        if (currentIndex == index) item.transform() else item
    }
}

private fun formatTimeLimit(value: Int, unit: String): String {
    if (value <= 0) return "No limit"
    return "$value $unit"
}

private fun formatCountdown(seconds: Int): String {
    val safe = seconds.coerceAtLeast(0)
    val minutes = safe / 60
    val remainingSeconds = safe % 60
    return "${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}"
}

private fun formatRewardPreview(amount: String, unit: String): String {
    val safeAmount = amount.toIntOrNull() ?: 0
    val safeUnit = unit.ifBlank { "PARAG" }.uppercase()
    val nairaValue = if (safeUnit == "GBAZILO") safeAmount * 1000 else safeAmount * 100
    return "$safeAmount $safeUnit (N${nairaValue})"
}




