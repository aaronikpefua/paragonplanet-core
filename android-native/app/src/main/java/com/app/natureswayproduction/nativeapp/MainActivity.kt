package com.app.natureswayproduction.nativeapp

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.compose.setContent
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import com.app.natureswayproduction.nativeapp.data.auth.FacebookLoginCoordinator
import com.app.natureswayproduction.nativeapp.data.billing.BillingRepository
import com.app.natureswayproduction.nativeapp.feature.auth.AuthViewModel
import com.app.natureswayproduction.nativeapp.feature.feed.FeedRepository
import com.app.natureswayproduction.nativeapp.feature.feed.FeedViewModel
import com.app.natureswayproduction.nativeapp.feature.meetup.MeetUpRepository
import com.app.natureswayproduction.nativeapp.feature.meetup.MeetUpViewModel
import com.app.natureswayproduction.nativeapp.feature.profile.ProfileRepository
import com.app.natureswayproduction.nativeapp.feature.profile.ProfileViewModel
import com.app.natureswayproduction.nativeapp.feature.upload.UploadRepository
import com.app.natureswayproduction.nativeapp.feature.upload.UploadViewModel
import com.app.natureswayproduction.nativeapp.feature.wallet.WalletViewModel
import com.app.natureswayproduction.nativeapp.navigation.ParagonApp
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonPlanetTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        window.isNavigationBarContrastEnforced = false
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()
        setContent {
            ParagonPlanetTheme {
                val apiService = remember { ParagonApiService() }
                val sessionRepository = remember { SessionRepository(apiService = apiService) }
                val appCheckRepository = remember { AppCheckRepository() }
                val feedRepository = remember { FeedRepository(apiService = apiService, appCheckRepository = appCheckRepository) }
                val billingRepository = remember { BillingRepository(applicationContext) }
                val profileRepository = remember { ProfileRepository() }
                val meetUpRepository = remember { MeetUpRepository() }
                val uploadRepository = remember {
                    UploadRepository(
                        contentResolver = applicationContext.contentResolver,
                        apiService = apiService,
                        sessionRepository = sessionRepository,
                        appCheckRepository = appCheckRepository
                    )
                }
                val authViewModel: AuthViewModel = viewModel(factory = AuthViewModel.factory(sessionRepository))
                val feedViewModel: FeedViewModel = viewModel(factory = FeedViewModel.factory(feedRepository))
                val walletViewModel: WalletViewModel = viewModel(
                    factory = WalletViewModel.factory(
                        sessionRepository = sessionRepository,
                        apiService = apiService,
                        billingRepository = billingRepository,
                        appCheckRepository = appCheckRepository
                    )
                )
                val profileViewModel: ProfileViewModel = viewModel(factory = ProfileViewModel.factory(profileRepository))
                val meetUpViewModel: MeetUpViewModel = viewModel(factory = MeetUpViewModel.factory(meetUpRepository))
                val uploadViewModel: UploadViewModel = viewModel(factory = UploadViewModel.factory(uploadRepository))
                ParagonApp(
                    authViewModel = authViewModel,
                    feedViewModel = feedViewModel,
                    walletViewModel = walletViewModel,
                    profileViewModel = profileViewModel,
                    meetUpViewModel = meetUpViewModel,
                    uploadViewModel = uploadViewModel,
                )
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    @Deprecated("Required by the Facebook Android SDK callback flow")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        FacebookLoginCoordinator.onActivityResult(requestCode, resultCode, data)
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }
}

