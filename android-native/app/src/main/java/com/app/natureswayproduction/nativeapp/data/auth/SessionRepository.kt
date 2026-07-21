package com.app.natureswayproduction.nativeapp.data.auth

import android.app.Activity
import com.app.natureswayproduction.nativeapp.data.api.MobileUser
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.OAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class SessionRepository(
    private val firebaseAuth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val apiService: ParagonApiService = ParagonApiService(),
) {
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
        val provider = OAuthProvider.newBuilder("google.com").apply {
            addCustomParameter("prompt", "select_account")
        }

        val pendingResult = firebaseAuth.pendingAuthResult
        if (pendingResult != null) {
            pendingResult.await()
        } else {
            firebaseAuth.startActivityForSignInWithProvider(activity, provider.build()).await()
        }

        return loadSessionSummary().copy(
            note = "Google account connected successfully."
        )
    }

    suspend fun signInWithFacebook(activity: Activity): SessionSummary {
        val provider = OAuthProvider.newBuilder("facebook.com").apply {
            addCustomParameter("auth_type", "reauthenticate")
            addCustomParameter("prompt", "select_account")
        }

        val pendingResult = firebaseAuth.pendingAuthResult
        if (pendingResult != null) {
            pendingResult.await()
        } else {
            firebaseAuth.startActivityForSignInWithProvider(activity, provider.build()).await()
        }

        return loadSessionSummary().copy(
            note = "Facebook account connected successfully."
        )
    }

    suspend fun signInWithX(activity: Activity): SessionSummary {
        val provider = OAuthProvider.newBuilder("twitter.com").apply {
            addCustomParameter("force_login", "true")
        }

        val pendingResult = firebaseAuth.pendingAuthResult
        if (pendingResult != null) {
            pendingResult.await()
        } else {
            firebaseAuth.startActivityForSignInWithProvider(activity, provider.build()).await()
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

data class SessionSummary(
    val isSignedIn: Boolean,
    val email: String?,
    val role: String?,
    val uid: String?,
    val note: String,
)
