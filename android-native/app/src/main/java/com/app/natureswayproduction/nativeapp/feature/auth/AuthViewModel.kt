package com.app.natureswayproduction.nativeapp.feature.auth

import android.app.Activity
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.app.natureswayproduction.BuildConfig
import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val sessionRepository: SessionRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun updateEmail(value: String) {
        _uiState.value = _uiState.value.copy(emailInput = value)
    }

    fun updatePassword(value: String) {
        _uiState.value = _uiState.value.copy(passwordInput = value)
    }

    fun showLoginMode() {
        _uiState.value = _uiState.value.copy(
            mode = AuthMode.Login,
            errorMessage = null,
        )
    }

    fun showSignupMode() {
        _uiState.value = _uiState.value.copy(
            mode = AuthMode.Signup,
            errorMessage = null,
        )
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.loadSessionSummary() }
                .onSuccess { session ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSignedIn = session.isSignedIn,
                        currentEmail = session.email,
                        role = session.role,
                        uid = session.uid,
                        note = session.note,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Could not refresh session",
                    )
                }
        }
    }

    fun signIn() {
        val state = _uiState.value
        if (state.emailInput.isBlank() || state.passwordInput.isBlank()) {
            _uiState.value = state.copy(errorMessage = "Email and password are required.")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.signIn(state.emailInput.trim(), state.passwordInput) }
                .onSuccess { session ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSignedIn = true,
                        currentEmail = session.email,
                        role = session.role,
                        uid = session.uid,
                        note = session.note,
                        passwordInput = "",
                        lastCompletedAction = AuthCompletedAction.Login,
                    )
                }
                .onFailure { error ->
                    val shouldSwitchToSignup = error is FirebaseAuthInvalidUserException

                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        mode = if (shouldSwitchToSignup) AuthMode.Signup else _uiState.value.mode,
                        errorMessage = when {
                            shouldSwitchToSignup -> null
                            error is FirebaseAuthInvalidCredentialsException ->
                                "Wrong email or password. Try again or use Forgot password."
                            else -> error.message ?: "Sign-in failed"
                        },
                        note = if (shouldSwitchToSignup) {
                            "We couldn't log you in with those details. Create your account if you're new here."
                        } else {
                            "Sign in with your Paragon Planet account, or use Forgot password if you don't remember it."
                        }
                    )
                }
        }
    }

    fun signUp() {
        val state = _uiState.value
        if (state.emailInput.isBlank() || state.passwordInput.isBlank()) {
            _uiState.value = state.copy(errorMessage = "Email and password are required.")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.signUp(state.emailInput.trim(), state.passwordInput) }
                .onSuccess { session ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSignedIn = true,
                        currentEmail = session.email,
                        role = session.role,
                        uid = session.uid,
                        note = session.note,
                        passwordInput = "",
                        lastCompletedAction = AuthCompletedAction.Signup,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = when (error) {
                            is FirebaseAuthInvalidCredentialsException -> "Please enter a valid email and password."
                            else -> error.message ?: "Sign-up failed"
                        },
                    )
                }
        }
    }

    fun continueWithGoogle(activity: Activity) {
        val expectedAction = if (_uiState.value.mode == AuthMode.Signup) {
            AuthCompletedAction.Signup
        } else {
            AuthCompletedAction.Login
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.signInWithGoogle(activity) }
                .onSuccess { session ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSignedIn = true,
                        currentEmail = session.email,
                        role = session.role,
                        uid = session.uid,
                        note = session.note,
                        passwordInput = "",
                        lastCompletedAction = expectedAction,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = providerErrorMessage("Google", error),
                    )
                }
        }
    }

    fun continueWithFacebook(activity: Activity) {
        val expectedAction = if (_uiState.value.mode == AuthMode.Signup) {
            AuthCompletedAction.Signup
        } else {
            AuthCompletedAction.Login
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.signInWithFacebook(activity) }
                .onSuccess { session ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSignedIn = true,
                        currentEmail = session.email,
                        role = session.role,
                        uid = session.uid,
                        note = session.note,
                        passwordInput = "",
                        lastCompletedAction = expectedAction,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = providerErrorMessage("Facebook", error),
                    )
                }
        }
    }

    fun continueWithX(activity: Activity) {
        val expectedAction = if (_uiState.value.mode == AuthMode.Signup) {
            AuthCompletedAction.Signup
        } else {
            AuthCompletedAction.Login
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.signInWithX(activity) }
                .onSuccess { session ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSignedIn = true,
                        currentEmail = session.email,
                        role = session.role,
                        uid = session.uid,
                        note = session.note,
                        passwordInput = "",
                        lastCompletedAction = expectedAction,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = providerErrorMessage("X", error),
                    )
                }
        }
    }

    fun sendPasswordReset() {
        val email = _uiState.value.emailInput.trim()
        if (email.isBlank()) {
            _uiState.value = _uiState.value.copy(
                errorMessage = "Enter your email first, then tap Forgot password."
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.sendPasswordReset(email) }
                .onSuccess { note ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        note = note,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Could not send password reset email",
                    )
                }
        }
    }

    fun consumeCompletedAction() {
        _uiState.value = _uiState.value.copy(lastCompletedAction = null)
    }

    fun signOut() {
        sessionRepository.signOut()
        _uiState.value = AuthUiState(note = "Signed out locally.")
        refresh()
    }

    private fun providerErrorMessage(provider: String, error: Throwable): String {
        if (BuildConfig.DEBUG) {
            return buildDebugProviderErrorMessage(provider, error).also { details ->
                Log.e(AUTH_ERROR_LOG_TAG, details, error)
            }
        }

        return buildProviderErrorMessage(provider, error)
    }

    private fun buildDebugProviderErrorMessage(provider: String, error: Throwable): String {
        val exceptionChain = generateSequence(error) { it.cause }.take(16).toList()
        val firebaseException = exceptionChain.filterIsInstance<FirebaseAuthException>().firstOrNull()
        val apiException = exceptionChain.filterIsInstance<ApiException>().firstOrNull()
        val cause = error.cause

        return """
            $provider sign-in failed (debug diagnostics)
            Exception class: ${error.javaClass.name}
            Exception message: ${error.message ?: "<none>"}
            Firebase error code: ${firebaseException?.errorCode ?: "<unavailable>"}
            Provider status/error code: ${apiException?.statusCode?.toString() ?: "<unavailable>"}
            Cause class: ${cause?.javaClass?.name ?: "<none>"}
            Cause message: ${cause?.message ?: "<none>"}
        """.trimIndent()
    }

    private fun buildProviderErrorMessage(provider: String, error: Throwable): String {
        val raw = error.message.orEmpty().lowercase()
        return when {
            raw.contains("package certificate hash") ||
                raw.contains("key hash") ||
                raw.contains("sha-1") ||
                raw.contains("sha1") ->
                "$provider sign-in is blocked by provider setup. Add this app's package name and signing certificate hash (SHA-1 / key hash) in the $provider developer console, then try again."

            raw.contains("configuration") && raw.contains("provider") ->
                "$provider sign-in is not fully configured yet. Finish the provider setup in the $provider console and Firebase, then try again."

            raw.isNotBlank() -> error.message.orEmpty()

            else -> "$provider sign-in failed"
        }
    }

    fun deleteAccount() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { sessionRepository.deleteCurrentUserAccount() }
                .onSuccess {
                    _uiState.value = AuthUiState(note = "Account deleted.")
                    refresh()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Delete account failed. Please sign in again and retry.",
                    )
                }
        }
    }

    companion object {
        private const val AUTH_ERROR_LOG_TAG = "ParagonAuth"

        fun factory(sessionRepository: SessionRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return AuthViewModel(sessionRepository) as T
                }
            }
    }
}

data class AuthUiState(
    val isLoading: Boolean = false,
    val isSignedIn: Boolean = false,
    val emailInput: String = "",
    val passwordInput: String = "",
    val currentEmail: String? = null,
    val role: String? = null,
    val uid: String? = null,
    val mode: AuthMode = AuthMode.Login,
    val note: String = "Preparing real native auth/session…",
    val errorMessage: String? = null,
    val lastCompletedAction: AuthCompletedAction? = null,
)

enum class AuthMode {
    Login,
    Signup,
}

enum class AuthCompletedAction {
    Login,
    Signup,
}
