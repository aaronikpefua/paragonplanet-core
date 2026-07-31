package com.app.natureswayproduction.nativeapp.data.auth

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.app.natureswayproduction.R
import com.app.natureswayproduction.nativeapp.data.api.MobileUser
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.facebook.AccessToken
import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FacebookAuthProvider
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.OAuthProvider
import com.google.firebase.auth.AuthCredential
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.firestore.FirebaseFirestore
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class SessionRepository(
    private val firebaseAuth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val apiService: ParagonApiService = ParagonApiService(),
) {
    private var pendingFacebookCredential: AuthCredential? = null

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

    suspend fun signInWithX(activity: Activity): SessionSummary {
        Log.d("X_SIGN_IN_RUNTIME", "entering signInWithX()")

        val provider = OAuthProvider.newBuilder("twitter.com").apply {
            addCustomParameter("force_login", "true")
        }

        // DEBUG tracing for X sign-in runtime
        try {
            val pendingResult = firebaseAuth.pendingAuthResult
            Log.d("X_SIGN_IN_RUNTIME", "pendingAuthResult is null: ${pendingResult == null}")

            if (pendingResult != null) {
                Log.d("X_SIGN_IN_RUNTIME", "before awaiting pendingAuthResult")
                try {
                    pendingResult.await()
                    Log.d("X_SIGN_IN_RUNTIME", "after pendingAuthResult.await()")
                } catch (awaitEx: Exception) {
                    Log.e("X_SIGN_IN_RUNTIME", "pendingAuthResult.await() threw", awaitEx)
                    if (awaitEx is FirebaseAuthException) {
                        Log.d("X_SIGN_IN_RUNTIME", "FirebaseAuthException.errorCode: ${awaitEx.errorCode}")
                    }
                    throw awaitEx
                }
            } else {
                Log.d("X_SIGN_IN_RUNTIME", "before calling startActivityForSignInWithProvider()")
                try {
                    val task = firebaseAuth.startActivityForSignInWithProvider(activity, provider.build())
                    Log.d("X_SIGN_IN_RUNTIME", "immediately after startActivityForSignInWithProvider(), Task object: $task")
                    Log.d("X_SIGN_IN_RUNTIME", "before task.await()")
                    try {
                        task.await()
                        Log.d("X_SIGN_IN_RUNTIME", "after task.await()")
                    } catch (taskEx: Exception) {
                        Log.e("X_SIGN_IN_RUNTIME", "task.await() threw", taskEx)
                        if (taskEx is FirebaseAuthException) {
                            Log.d("X_SIGN_IN_RUNTIME", "FirebaseAuthException.errorCode: ${taskEx.errorCode}")
                        }
                        throw taskEx
                    }
                } catch (syncEx: Exception) {
                    Log.e("X_SIGN_IN_RUNTIME", "startActivityForSignInWithProvider threw synchronously", syncEx)
                    if (syncEx is FirebaseAuthException) {
                        Log.d("X_SIGN_IN_RUNTIME", "FirebaseAuthException.errorCode: ${syncEx.errorCode}")
                    }
                    throw syncEx
                }
            }
        } catch (outer: Exception) {
            // Keep behaviour unchanged: rethrow so callers handle it the same as before
            throw outer
        }

        return loadSessionSummary().copy(
            note = "X account connected successfully."
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
}

class ExistingAccountRequiresFacebookLinkException(
    val signInMethods: List<String>,
) : IllegalStateException("Sign in with the existing account before linking Facebook.")

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
