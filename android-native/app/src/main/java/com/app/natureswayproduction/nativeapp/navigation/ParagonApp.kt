package com.app.natureswayproduction.nativeapp.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.app.natureswayproduction.nativeapp.feature.auth.AuthScreen
import com.app.natureswayproduction.nativeapp.feature.auth.AuthCompletedAction
import com.app.natureswayproduction.nativeapp.feature.auth.AuthViewModel
import com.app.natureswayproduction.nativeapp.feature.admin.AdminScreen
import com.app.natureswayproduction.nativeapp.feature.feed.FeedScreen
import com.app.natureswayproduction.nativeapp.feature.feed.FeedViewModel
import com.app.natureswayproduction.nativeapp.feature.meetup.MeetUpScreen
import com.app.natureswayproduction.nativeapp.feature.meetup.MeetUpViewModel
import com.app.natureswayproduction.nativeapp.feature.onboarding.CitizenOnboardingScreen
import com.app.natureswayproduction.nativeapp.feature.menu.AboutParagonPlanetScreen
import com.app.natureswayproduction.nativeapp.feature.menu.AmbassadorDirectoryScreen
import com.app.natureswayproduction.nativeapp.feature.menu.BackerDirectoryScreen
import com.app.natureswayproduction.nativeapp.feature.menu.CitizenContestantsScreen
import com.app.natureswayproduction.nativeapp.feature.menu.PrivacyPolicyScreen
import com.app.natureswayproduction.nativeapp.feature.menu.SponsorInvestorAboutScreen
import com.app.natureswayproduction.nativeapp.feature.menu.SuperbossDirectoryScreen
import com.app.natureswayproduction.nativeapp.feature.menu.UserAboutDetailScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.KnowledgeRoleOnboardingScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.MerchantAboutScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.MerchantMarketplaceScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.MerchantOnboardingScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.PromoterOnboardingScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.RoleOnboardingRepository
import com.app.natureswayproduction.nativeapp.feature.onboarding.RoleSelectScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.SponsorInvestorOnboardingScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.UserAboutScreen
import com.app.natureswayproduction.nativeapp.feature.onboarding.UserOnboardingScreen
import com.app.natureswayproduction.nativeapp.feature.profile.ProfileScreen
import com.app.natureswayproduction.nativeapp.feature.profile.ProfileViewModel
import com.app.natureswayproduction.nativeapp.feature.upload.UploadScreen
import com.app.natureswayproduction.nativeapp.feature.upload.UploadViewModel
import com.app.natureswayproduction.nativeapp.feature.wallet.WalletScreen
import com.app.natureswayproduction.nativeapp.feature.wallet.WalletViewModel
import com.app.natureswayproduction.nativeapp.feature.watch.WatchScreen

@Composable
fun ParagonApp(
    authViewModel: AuthViewModel,
    feedViewModel: FeedViewModel,
    walletViewModel: WalletViewModel,
    profileViewModel: ProfileViewModel,
    meetUpViewModel: MeetUpViewModel,
    uploadViewModel: UploadViewModel,
) {
    val navController = rememberNavController()
    val onboardingRepository = RoleOnboardingRepository()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val goHome: () -> Unit = {
        navController.navigate(AppDestination.Feed.route) {
            popUpTo(navController.graph.findStartDestination().id) {
                saveState = false
            }
            launchSingleTop = true
            restoreState = false
        }
    }
    Box(modifier = Modifier) {
        NavHost(
            navController = navController,
            startDestination = AppDestination.Feed.route,
            modifier = Modifier
        ) {
            composable(AppDestination.Feed.route) {
                val authState by authViewModel.uiState.collectAsState()
                FeedScreen(
                    feedViewModel = feedViewModel,
                    isSignedIn = authState.isSignedIn,
                    currentUserUid = authState.uid,
                    isAdmin = authState.role.equals("admin", ignoreCase = true),
                    onOpenUpload = { navController.navigate(AppDestination.Upload.route) },
                    onOpenProfile = { navController.navigate(AppDestination.Profile.route) },
                    onOpenSignIn = { navController.navigate(AppDestination.Auth.route) },
                    onOpenWallet = { navController.navigate(AppDestination.Wallet.route) },
                    onOpenWalletFunding = {
                        walletViewModel.openDeposit()
                        navController.navigate(AppDestination.Wallet.route)
                    },
                    onOpenMeetUp = { navController.navigate(AppDestination.MeetUp.route) },
                    onOpenCitizenContestants = { navController.navigate(AppDestination.CitizenContestants.route) },
                    onOpenSuperbossDirectory = { navController.navigate(AppDestination.SuperbossDirectory.route) },
                    onOpenBackerDirectory = { navController.navigate(AppDestination.BackerDirectory.route) },
                    onOpenAmbassadorDirectory = { navController.navigate(AppDestination.AmbassadorDirectory.route) },
                    onOpenMerchantMarketplace = { navController.navigate(AppDestination.MerchantMarketplace.route) },
                    onOpenUserAbout = { navController.navigate(AppDestination.UserAbout.route) },
                    onOpenSponsorInvestorAbout = { navController.navigate(AppDestination.SponsorInvestorAbout.route) },
                    onOpenAboutPlanet = { navController.navigate(AppDestination.AboutPlanet.route) },
                    onOpenPrivacyPolicy = { navController.navigate(AppDestination.PrivacyPolicy.route) },
                    onOpenAdmin = { navController.navigate(AppDestination.Admin.route) },
                    onSignOut = authViewModel::signOut,
                ) {
                    feedViewModel.selectItem(it)
                    navController.navigate(AppDestination.Watch.route)
                }
            }
            composable(AppDestination.Watch.route) {
                val authState by authViewModel.uiState.collectAsState()
                val selected = feedViewModel.selectedItem.collectAsState().value
                WatchScreen(
                    selectedItem = selected,
                    positionLabel = feedViewModel.currentPositionLabel(),
                    isSignedIn = authState.isSignedIn,
                    currentUserUid = authState.uid,
                    onPrevious = feedViewModel::selectPreviousItem,
                    onNext = feedViewModel::selectNextItem,
                    onOpenHome = {
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = false
                            }
                            launchSingleTop = true
                            restoreState = false
                        }
                    },
                    onOpenMeetUp = { navController.navigate(AppDestination.MeetUp.route) },
                    onOpenUpload = { navController.navigate(AppDestination.Upload.route) },
                    onOpenWallet = { navController.navigate(AppDestination.Wallet.route) },
                    onOpenProfile = { navController.navigate(AppDestination.Profile.route) },
                    onOpenSignIn = { navController.navigate(AppDestination.Auth.route) },
                    onOpenCitizenContestants = { navController.navigate(AppDestination.CitizenContestants.route) },
                    onOpenSuperbossDirectory = { navController.navigate(AppDestination.SuperbossDirectory.route) },
                    onOpenBackerDirectory = { navController.navigate(AppDestination.BackerDirectory.route) },
                    onOpenAmbassadorDirectory = { navController.navigate(AppDestination.AmbassadorDirectory.route) },
                    onOpenMerchantMarketplace = { navController.navigate(AppDestination.MerchantMarketplace.route) },
                    onOpenUserAbout = { navController.navigate(AppDestination.UserAbout.route) },
                    onOpenSponsorInvestorAbout = { navController.navigate(AppDestination.SponsorInvestorAbout.route) },
                    onOpenAboutPlanet = { navController.navigate(AppDestination.AboutPlanet.route) },
                    onOpenPrivacyPolicy = { navController.navigate(AppDestination.PrivacyPolicy.route) },
                    onSignOut = authViewModel::signOut,
                )
            }
            composable(AppDestination.Upload.route) {
                val authState by authViewModel.uiState.collectAsState()
                UploadScreen(
                    uploadViewModel = uploadViewModel,
                    currentEmail = authState.currentEmail,
                    currentRole = authState.role,
                    onOpenUpload = { navController.navigate(AppDestination.Upload.route) },
                    onOpenProfile = { navController.navigate(AppDestination.Profile.route) },
                    onOpenSignIn = { navController.navigate(AppDestination.Auth.route) },
                    onOpenMenu = {
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onSignOut = authViewModel::signOut,
                    onUploadCompleted = {
                        uploadViewModel.resetForAnotherUpload()
                        feedViewModel.refresh()
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = false
                            }
                            launchSingleTop = true
                            restoreState = false
                        }
                    },
                )
            }
            composable(AppDestination.Wallet.route) {
                WalletScreen(walletViewModel = walletViewModel)
            }
            composable(AppDestination.Profile.route) {
                val authState by authViewModel.uiState.collectAsState()
                val profileUiState by profileViewModel.uiState.collectAsState()
                ProfileScreen(
                    authViewModel = authViewModel,
                    profileViewModel = profileViewModel,
                    currentEmail = authState.currentEmail,
                    onOpenUpload = { navController.navigate(AppDestination.Upload.route) },
                    onOpenProfile = { navController.navigate(AppDestination.Profile.route) },
                    onOpenSignIn = { navController.navigate(AppDestination.Auth.route) },
                    onOpenWallet = { navController.navigate(AppDestination.Wallet.route) },
                    onOpenMeetUp = { navController.navigate(AppDestination.MeetUp.route) },
                    onOpenMarketplace = { navController.navigate(AppDestination.MerchantMarketplace.route) },
                    onOpenMerchantAbout = { navController.navigate(AppDestination.MerchantAbout.route) },
                    onOpenEditProfile = {
                        navController.navigate(
                            when {
                                profileUiState.profile?.role.equals("MERCHANT", ignoreCase = true) ||
                                    authState.role.equals("MERCHANT", ignoreCase = true) -> AppDestination.MerchantOnboarding.route
                                profileUiState.profile?.role.equals("BACKER", ignoreCase = true) ||
                                    authState.role.equals("BACKER", ignoreCase = true) -> AppDestination.BackerOnboarding.route
                                profileUiState.profile?.role.equals("SUPERNAL", ignoreCase = true) ||
                                    authState.role.equals("SUPERNAL", ignoreCase = true) -> AppDestination.SupernalOnboarding.route
                                profileUiState.profile?.role.equals("PROMOTER", ignoreCase = true) ||
                                    authState.role.equals("PROMOTER", ignoreCase = true) -> AppDestination.PromoterOnboarding.route
                                profileUiState.profile?.role.equals("SPONSOR / INVESTOR", ignoreCase = true) ||
                                    profileUiState.profile?.role.equals("SPONSOR_INVESTOR", ignoreCase = true) ||
                                    profileUiState.profile?.role.equals("SPONSOR", ignoreCase = true) ||
                                    profileUiState.profile?.role.equals("INVESTOR", ignoreCase = true) ||
                                    authState.role.equals("SPONSOR / INVESTOR", ignoreCase = true) ||
                                    authState.role.equals("SPONSOR_INVESTOR", ignoreCase = true) ||
                                    authState.role.equals("SPONSOR", ignoreCase = true) ||
                                    authState.role.equals("INVESTOR", ignoreCase = true) -> AppDestination.SponsorInvestorOnboarding.route
                                profileStateForEdit(authState.role) -> AppDestination.CitizenOnboarding.route
                                else -> AppDestination.UserOnboarding.route
                            }
                        )
                    },
                    onContinueAsUser = suspend {
                        onboardingRepository.saveBasicUserProfile()
                        authViewModel.refresh()
                        profileViewModel.refresh()
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = false
                            }
                            launchSingleTop = true
                            restoreState = false
                        }
                    },
                    onOpenEarnRoles = { navController.navigate(AppDestination.EarnRoles.route) },
                    onOpenMenu = {
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onSignOut = authViewModel::signOut,
                )
            }
            composable(AppDestination.Admin.route) {
                AdminScreen(
                    onBackToFeed = {
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.Auth.route) {
                AuthScreen(
                    authViewModel = authViewModel,
                    onAuthFinished = { action ->
                        val destination = if (action == AuthCompletedAction.Signup) {
                            AppDestination.Roles.route
                        } else {
                            AppDestination.Feed.route
                        }
                        navController.navigate(destination) {
                            popUpTo(AppDestination.Auth.route) {
                                inclusive = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.Roles.route) {
                RoleSelectScreen(
                    isEarnStep = false,
                    onOpenAboutUser = { navController.navigate(AppDestination.UserAbout.route) },
                    onOpenUserProfile = { navController.navigate(AppDestination.UserOnboarding.route) },
                    onOpenWallet = { navController.navigate(AppDestination.Wallet.route) },
                    onOpenMeetUp = { navController.navigate(AppDestination.MeetUp.route) },
                    onContinueAsUser = suspend {
                        onboardingRepository.saveBasicUserProfile()
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = false
                            }
                            launchSingleTop = true
                            restoreState = false
                        }
                    },
                    onNext = { navController.navigate(AppDestination.EarnRoles.route) },
                    onCitizenSelected = { navController.navigate(AppDestination.CitizenOnboarding.route) },
                    onPromoterSelected = { navController.navigate(AppDestination.PromoterOnboarding.route) },
                    onMerchantSelected = { navController.navigate(AppDestination.MerchantOnboarding.route) },
                    onBackerSelected = { navController.navigate(AppDestination.BackerOnboarding.route) },
                    onSupernalSelected = { navController.navigate(AppDestination.SupernalOnboarding.route) },
                    onSponsorInvestorSelected = { navController.navigate(AppDestination.SponsorInvestorOnboarding.route) }
                )
            }
            composable(AppDestination.EarnRoles.route) {
                RoleSelectScreen(
                    isEarnStep = true,
                    onOpenAboutUser = { navController.navigate(AppDestination.UserAbout.route) },
                    onOpenUserProfile = { navController.navigate(AppDestination.UserOnboarding.route) },
                    onOpenWallet = { navController.navigate(AppDestination.Wallet.route) },
                    onOpenMeetUp = { navController.navigate(AppDestination.MeetUp.route) },
                    onContinueAsUser = suspend {
                        onboardingRepository.saveBasicUserProfile()
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = false
                            }
                            launchSingleTop = true
                            restoreState = false
                        }
                    },
                    onNext = { },
                    onCitizenSelected = { navController.navigate(AppDestination.CitizenOnboarding.route) },
                    onPromoterSelected = { navController.navigate(AppDestination.PromoterOnboarding.route) },
                    onMerchantSelected = { navController.navigate(AppDestination.MerchantOnboarding.route) },
                    onBackerSelected = { navController.navigate(AppDestination.BackerOnboarding.route) },
                    onSupernalSelected = { navController.navigate(AppDestination.SupernalOnboarding.route) },
                    onSponsorInvestorSelected = { navController.navigate(AppDestination.SponsorInvestorOnboarding.route) }
                )
            }
            composable(AppDestination.CitizenOnboarding.route) {
                CitizenOnboardingScreen(
                    repository = onboardingRepository,
                    onBack = { navController.popBackStack() },
                    onCompleted = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.PromoterOnboarding.route) {
                PromoterOnboardingScreen(
                    repository = onboardingRepository,
                    onBack = { navController.popBackStack() },
                    onCompleted = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.MerchantOnboarding.route) {
                MerchantOnboardingScreen(
                    repository = onboardingRepository,
                    onBack = { navController.popBackStack() },
                    onOpenMarketplace = { navController.navigate(AppDestination.MerchantMarketplace.route) },
                    onOpenMerchantAbout = { navController.navigate(AppDestination.MerchantAbout.route) },
                    onCompleted = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.MerchantMarketplace.route) {
                MerchantMarketplaceScreen(
                    onBack = { navController.popBackStack() },
                    onOpenMerchantCenter = { navController.navigate(AppDestination.MerchantOnboarding.route) },
                )
            }
            composable(AppDestination.MerchantAbout.route) {
                MerchantAboutScreen(onBack = { navController.popBackStack() })
            }
            composable(AppDestination.CitizenContestants.route) {
                CitizenContestantsScreen(
                    onBack = { navController.popBackStack() },
                    onOpenCategory = { category ->
                        feedViewModel.selectCategory(category)
                        navController.navigate(AppDestination.Feed.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = false
                            }
                            launchSingleTop = true
                            restoreState = false
                        }
                    },
                    onJoin = { navController.navigate(AppDestination.CitizenOnboarding.route) }
                )
            }
            composable(AppDestination.SuperbossDirectory.route) {
                SuperbossDirectoryScreen(
                    onBack = { navController.popBackStack() },
                    onJoin = { navController.navigate(AppDestination.SupernalOnboarding.route) }
                )
            }
            composable(AppDestination.BackerDirectory.route) {
                BackerDirectoryScreen(
                    onBack = { navController.popBackStack() },
                    onJoin = { navController.navigate(AppDestination.BackerOnboarding.route) }
                )
            }
            composable(AppDestination.AmbassadorDirectory.route) {
                AmbassadorDirectoryScreen(
                    onBack = { navController.popBackStack() },
                    onJoin = { navController.navigate(AppDestination.PromoterOnboarding.route) }
                )
            }
            composable(AppDestination.SponsorInvestorAbout.route) {
                SponsorInvestorAboutScreen(
                    onBack = { navController.popBackStack() },
                    onJoin = { navController.navigate(AppDestination.SponsorInvestorOnboarding.route) }
                )
            }
            composable(AppDestination.AboutPlanet.route) {
                AboutParagonPlanetScreen(onBack = { navController.popBackStack() })
            }
            composable(AppDestination.PrivacyPolicy.route) {
                PrivacyPolicyScreen(onBack = { navController.popBackStack() })
            }
            composable(AppDestination.BackerOnboarding.route) {
                KnowledgeRoleOnboardingScreen(
                    repository = onboardingRepository,
                    title = "Backer Contestant Registration",
                    collectionName = "backer_profiles",
                    roleValue = "BACKER",
                    onBack = { navController.popBackStack() },
                    onCompleted = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.SupernalOnboarding.route) {
                KnowledgeRoleOnboardingScreen(
                    repository = onboardingRepository,
                    title = "Superboss Registration",
                    collectionName = "supernal_profiles",
                    roleValue = "SUPERNAL",
                    onBack = { navController.popBackStack() },
                    onCompleted = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.SponsorInvestorOnboarding.route) {
                SponsorInvestorOnboardingScreen(
                    repository = onboardingRepository,
                    onBack = { navController.popBackStack() },
                    onCompleted = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.UserOnboarding.route) {
                UserOnboardingScreen(
                    repository = onboardingRepository,
                    onBack = { navController.popBackStack() },
                    onCompleted = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
            composable(AppDestination.UserAbout.route) {
                UserAboutDetailScreen(
                    onBack = { navController.popBackStack() },
                    onJoin = { navController.navigate(AppDestination.UserOnboarding.route) }
                )
            }
            composable(AppDestination.MeetUp.route) {
                MeetUpScreen(
                    meetUpViewModel = meetUpViewModel,
                    onBackToProfile = {
                        navController.navigate(AppDestination.Profile.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onOpenFeed = goHome,
                )
            }
        }

        val showUniversalHome = currentRoute != null &&
            currentRoute != AppDestination.Feed.route &&
            currentRoute != AppDestination.Auth.route

        if (showUniversalHome) {
            Surface(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 16.dp, end = 12.dp)
                    .clickable(onClick = goHome),
                color = Color(0xFF111111),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(999.dp)
            ) {
                Text(
                    text = "Home",
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                )
            }
        }
    }
}

private fun profileStateForEdit(role: String?): Boolean {
    return role.equals("CITIZEN", ignoreCase = true)
}




