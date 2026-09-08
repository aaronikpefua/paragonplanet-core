package com.app.natureswayproduction.nativeapp.data.auth

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import com.app.natureswayproduction.BuildConfig
import androidx.browser.customtabs.CustomTabsIntent
import androidx.browser.customtabs.CustomTabsService
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.app.natureswayproduction.R
import com.app.natureswayproduction.nativeapp.data.api.MobileUser
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.facebook.AccessToken
import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FacebookAuthProvider
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.OAuthProvider
import com.google.firebase.auth.AuthCredential
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.auth.TwitterAuthProvider
import com.google.firebase.FirebaseException
import com.google.firebase.firestore.FirebaseFirestore
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class SessionRepository(
    private val firebaseAuth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val apiService: ParagonApiService = ParagonApiService(),
) {
    private val appCheckRepository = AppCheckRepository()
    private var pendingFacebookCredential: AuthCredential? = null
    private var pendingXCredential: AuthCredential? = null

    suspend fun loadSessionSummary(): SessionSummary {
        val user = firebaseAuth.currentUser
            ?: return SessionSummary(
                isSignedIn = false,
                email = null,
                role = null,
                uid = null,
                note = "Signed out. Use your Paragon Planet account to load native mobile data."
            )

        val backendUser = fetchBackendUser(user.uid)
        return SessionSummary(
            isSignedIn = true,
            email = backendUser?.email ?: user.email,
            role = backendUser?.role,
            uid = backendUser?.uid ?: user.uid,
            note = if (backendUser != null) {
                "Session verified against /api/auth/me."
            } else {
                "Firebase session is active, but backend verification is still pending."
            }
        )
    }

    suspend fun signIn(email: String, password: String): SessionSummary {
        firebaseAuth.signInWithEmailAndPassword(email, password).await()
        return loadSessionSummary()
    }

    suspend fun signUp(email: String, password: String): SessionSummary {
        firebaseAuth.createUserWithEmailAndPassword(email, password).await()
        return loadSessionSummary().copy(
            note = "Account created. Continue to choose your role and complete registration."
        )
    }

    suspend fun signInWithGoogle(activity: Activity): SessionSummary {
        val googleIdOption = GetGoogleIdOption.Builder()
            .setServerClientId(activity.getString(R.string.default_web_client_id))
            .setFilterByAuthorizedAccounts(false)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()
        val credential = CredentialManager.create(activity)
            .getCredential(activity, request)
            .credential

        check(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "Google Credential Manager returned an unexpected credential type: ${credential.type}"
        }
        val idToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
        firebaseAuth.signInWithCredential(GoogleAuthProvider.getCredential(idToken, null)).await()

        return loadSessionSummary().copy(
            note = "Google account connected successfully."
        )
    }

    suspend fun signInWithFacebook(activity: Activity): SessionSummary {
        val accessToken = FacebookLoginCoordinator.signIn(activity)
        val facebookCredential = FacebookAuthProvider.getCredential(accessToken.token)
        val signedInUser = firebaseAuth.currentUser

        if (signedInUser != null) {
            signedInUser.linkWithCredential(facebookCredential).await()
            return loadSessionSummary().copy(
                note = "Facebook account linked successfully. You can now sign in with Google or Facebook."
            )
        }

        try {
            firebaseAuth.signInWithCredential(facebookCredential).await()
        } catch (error: FirebaseAuthUserCollisionException) {
            if (error.errorCode != "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL") throw error

            pendingFacebookCredential = facebookCredential
            val signInMethods = error.email
                ?.takeIf { it.isNotBlank() }
                ?.let { email ->
                    runCatching {
                        firebaseAuth.fetchSignInMethodsForEmail(email).await().signInMethods.orEmpty()
                    }.getOrDefault(emptyList())
                }
                .orEmpty()
            throw ExistingAccountRequiresFacebookLinkException(signInMethods)
        }

        return loadSessionSummary().copy(
            note = "Facebook account connected successfully."
        )
    }

    suspend fun linkPendingFacebookCredential(): SessionSummary? {
        val facebookCredential = pendingFacebookCredential ?: return null
        val signedInUser = firebaseAuth.currentUser ?: return null

        signedInUser.linkWithCredential(facebookCredential).await()
        pendingFacebookCredential = null
        return loadSessionSummary().copy(
            note = "Facebook account linked successfully. You can now sign in with Google or Facebook."
        )
    }

    suspend fun signInForM1Staging(): SessionSummary {
        check(BuildConfig.M1_TEST_LOGIN_ENABLED) {
            "M1 staging test login is not available in this build."
        }
        check(FirebaseApp.getInstance().options.projectId == "paragonplanet-live-stg") {
            "M1 test login refused outside the isolated staging Firebase project."
        }
        val appCheckToken = appCheckRepository.getToken(forceRefresh = true)
        check(!appCheckToken.isNullOrBlank()) { "Staging App Check authorization is unavailable." }
        val customToken = apiService.fetchM1StagingCustomToken(appCheckToken)
        firebaseAuth.signInWithCustomToken(customToken).await()
        check(firebaseAuth.currentUser?.getIdToken(false)?.await()?.token?.isNotBlank() == true) {
            "Staging Firebase did not issue an ID token."
        }
        return loadSessionSummary().copy(note = "Authenticated with the isolated M1 staging test account.")
    }

    suspend fun completePendingProviderSignIn(): SessionSummary? {
        val pendingResult = firebaseAuth.pendingAuthResult ?: return null
        pendingResult.await()
        return loadSessionSummary().copy(
            note = "Provider sign-in completed successfully."
        )
    }

    suspend fun signInWithX(activity: Activity): SessionSummary {
        Log.d("X_SIGN_IN_RUNTIME", "entering signInWithX()")

        val start = apiService.startNativeXAuth()
        check(start.authUrl.isNotBlank()) { "X sign-in did not return an authorization URL." }

        launchTrustedCustomTab(activity, Uri.parse(start.authUrl))
        val callback = NativeXAuthCoordinator.awaitCallback(start.state)
        val credential = TwitterAuthProvider.getCredential(callback.token, callback.secret)
        val signedInUser = firebaseAuth.currentUser

        if (signedInUser != null) {
            signedInUser.linkWithCredential(credential).await()
            return loadSessionSummary().copy(
                note = "X account linked successfully. You can now sign in with X."
            )
        }

        try {
            firebaseAuth.signInWithCredential(credential).await()
        } catch (error: FirebaseAuthUserCollisionException) {
            if (error.errorCode != "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL") throw error

            pendingXCredential = credential
            val signInMethods = error.email
                ?.takeIf { it.isNotBlank() }
                ?.let { email ->
                    runCatching {
                        firebaseAuth.fetchSignInMethodsForEmail(email).await().signInMethods.orEmpty()
                    }.getOrDefault(emptyList())
                }
                .orEmpty()
            throw ExistingAccountRequiresXLinkException(signInMethods)
        }

        return loadSessionSummary().copy(
            note = "X account connected successfully."
        )
    }

    suspend fun linkPendingXCredential(): SessionSummary? {
        val xCredential = pendingXCredential ?: return null
        val signedInUser = firebaseAuth.currentUser ?: return null

        signedInUser.linkWithCredential(xCredential).await()
        pendingXCredential = null
        return loadSessionSummary().copy(
            note = "X account linked successfully. You can now sign in with X."
        )
    }

    suspend fun signInWithApple(activity: Activity): SessionSummary {
        val provider = OAuthProvider.newBuilder("apple.com").apply {
            scopes = listOf("email", "name")
        }

        val pendingResult = firebaseAuth.pendingAuthResult
        if (pendingResult != null) {
            pendingResult.await()
        } else {
            firebaseAuth.startActivityForSignInWithProvider(activity, provider.build()).await()
        }

        return loadSessionSummary().copy(
            note = "Apple account connected successfully."
        )
    }

    suspend fun sendPhoneOtp(activity: Activity, phoneNumber: String): String =
        suspendCancellableCoroutine { continuation ->
            val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    if (!continuation.isActive) return

                    firebaseAuth.signInWithCredential(credential)
                        .addOnSuccessListener {
                            continuation.resume(AUTO_VERIFIED_PHONE_SESSION)
                        }
                        .addOnFailureListener { error ->
                            continuation.resumeWithException(error)
                        }
                }

                override fun onVerificationFailed(error: FirebaseException) {
                    if (continuation.isActive) {
                        continuation.resumeWithException(error)
                    }
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken,
                ) {
                    if (continuation.isActive) {
                        continuation.resume(verificationId)
                    }
                }
            }

            val options = PhoneAuthOptions.newBuilder(firebaseAuth)
                .setPhoneNumber(phoneNumber.trim())
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(callbacks)
                .build()

            PhoneAuthProvider.verifyPhoneNumber(options)
        }

    suspend fun verifyPhoneOtp(verificationId: String, otp: String): SessionSummary {
        if (verificationId == AUTO_VERIFIED_PHONE_SESSION) {
            return loadSessionSummary().copy(
                note = "Phone number verified successfully."
            )
        }

        val credential = PhoneAuthProvider.getCredential(verificationId, otp.trim())
        firebaseAuth.signInWithCredential(credential).await()
        return loadSessionSummary().copy(
            note = "Phone number verified successfully."
        )
    }

    suspend fun sendPasswordReset(email: String): String {
        firebaseAuth.sendPasswordResetEmail(email.trim()).await()
        return "Password reset email sent. Check your inbox and spam folder."
    }

    fun signOut() {
        pendingFacebookCredential = null
        firebaseAuth.signOut()
    }

    suspend fun deleteCurrentUserAccount() {
        val user = firebaseAuth.currentUser ?: return
        val uid = user.uid

        listOf(
            "user_profiles",
            "public_profiles",
            "citizen_profiles",
            "promoter_profiles",
            "merchant_profiles",
            "backer_profiles",
            "supernal_profiles",
            "sponsor_investor_profiles",
            "sponsor_profiles"
        ).forEach { collection ->
            runCatching { firestore.collection(collection).document(uid).delete().await() }
        }

        runCatching {
            firestore.collection("videos")
                .whereEqualTo("uid", uid)
                .get()
                .await()
                .documents
                .forEach { doc -> runCatching { doc.reference.delete().await() } }
        }

        runCatching {
            firestore.collection("merchant_products")
                .whereEqualTo("merchantId", uid)
                .get()
                .await()
                .documents
                .forEach { doc -> runCatching { doc.reference.delete().await() } }
        }

        user.delete().await()
        firebaseAuth.signOut()
    }

    suspend fun getFreshIdToken(): String? {
        return firebaseAuth.currentUser?.getIdToken(true)?.await()?.token
    }

    private suspend fun fetchBackendUser(fallbackUid: String): MobileUser? {
        val token = getFreshIdToken() ?: return null
        val backendUser = runCatching { apiService.fetchAuthenticatedUser(token) }.getOrNull() ?: return null
        return backendUser.copy(uid = backendUser.uid.ifBlank { fallbackUid })
    }

    private fun launchTrustedCustomTab(activity: Activity, uri: Uri) {
        val packageName = activity.packageManager.findTrustedCustomTabsPackage()
            ?: throw IllegalStateException("No trusted browser with Custom Tabs support is available for X sign-in.")

        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .apply {
                intent.setPackage(packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
                launchUrl(activity, uri)
            }
    }

    private fun PackageManager.findTrustedCustomTabsPackage(): String? {
        val serviceIntent = Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION)
        val packages = queryIntentServices(serviceIntent, 0)
            .mapNotNull { it.serviceInfo?.packageName }
            .distinct()

        val preferredPackages = listOf(
            "com.android.chrome",
            "com.chrome.beta",
            "com.chrome.dev",
            "com.chrome.canary",
            "com.brave.browser",
            "com.sec.android.app.sbrowser",
            "com.microsoft.emmx",
            "org.mozilla.firefox",
        )

        return preferredPackages.firstOrNull { it in packages }
    }
}

class ExistingAccountRequiresFacebookLinkException(
    val signInMethods: List<String>,
) : IllegalStateException("Sign in with the existing account before linking Facebook.")

class ExistingAccountRequiresXLinkException(
    val signInMethods: List<String>,
) : IllegalStateException("Sign in with the existing account before linking X.")

object FacebookLoginCoordinator {
    private val callbackManager: CallbackManager = CallbackManager.Factory.create()

    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        callbackManager.onActivityResult(requestCode, resultCode, data)
    }

    suspend fun signIn(activity: Activity): AccessToken = suspendCancellableCoroutine { continuation ->
        val loginManager = LoginManager.getInstance()
        loginManager.registerCallback(callbackManager, object : FacebookCallback<LoginResult> {
            override fun onSuccess(result: LoginResult) {
                loginManager.unregisterCallback(callbackManager)
                if (continuation.isActive) continuation.resume(result.accessToken)
            }

            override fun onCancel() {
                loginManager.unregisterCallback(callbackManager)
                if (continuation.isActive) {
                    continuation.resumeWithException(IllegalStateException("Facebook sign-in was cancelled."))
                }
            }

            override fun onError(error: FacebookException) {
                loginManager.unregisterCallback(callbackManager)
                if (continuation.isActive) continuation.resumeWithException(error)
            }
        })
        continuation.invokeOnCancellation {
            loginManager.unregisterCallback(callbackManager)
        }
        loginManager.logInWithReadPermissions(activity, listOf("public_profile", "email"))
    }
}

data class SessionSummary(
    val isSignedIn: Boolean,
    val email: String?,
    val role: String?,
    val uid: String?,
    val note: String,
)

private const val AUTO_VERIFIED_PHONE_SESSION = "__paragon_auto_verified_phone_session__"
