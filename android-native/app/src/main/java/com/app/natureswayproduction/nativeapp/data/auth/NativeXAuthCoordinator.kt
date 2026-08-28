package com.app.natureswayproduction.nativeapp.data.auth

import android.net.Uri
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object NativeXAuthCoordinator {
    private var continuation: Continuation<NativeXCallbackResult>? = null
    private var expectedState: String = ""

    suspend fun awaitCallback(state: String): NativeXCallbackResult =
        suspendCancellableCoroutine { callbackContinuation ->
            continuation?.resumeWithException(IllegalStateException("Another X sign-in is already in progress."))
            expectedState = state
            continuation = callbackContinuation
            callbackContinuation.invokeOnCancellation {
                if (continuation === callbackContinuation) {
                    continuation = null
                    expectedState = ""
                }
            }
        }

    fun handleCallback(uri: Uri?): Boolean {
        if (uri == null || uri.scheme != "paragonplanet" || uri.host != "auth" || uri.path != "/x") {
            return false
        }

        val callbackContinuation = continuation ?: return true
        continuation = null

        val status = uri.getQueryParameter("status").orEmpty()
        val message = uri.getQueryParameter("message").orEmpty()
        val state = uri.getQueryParameter("state").orEmpty()
        val token = uri.getQueryParameter("token").orEmpty()
        val secret = uri.getQueryParameter("secret").orEmpty()

        when {
            status == "cancelled" -> {
                callbackContinuation.resumeWithException(IllegalStateException(message.ifBlank { "X sign-in was cancelled." }))
            }
            status != "success" -> {
                callbackContinuation.resumeWithException(IllegalStateException(message.ifBlank { "X sign-in failed." }))
            }
            expectedState.isNotBlank() && state != expectedState -> {
                callbackContinuation.resumeWithException(IllegalStateException("X sign-in callback state did not match."))
            }
            token.isBlank() || secret.isBlank() -> {
                callbackContinuation.resumeWithException(IllegalStateException("X sign-in did not return credentials."))
            }
            else -> {
                callbackContinuation.resume(NativeXCallbackResult(token = token, secret = secret))
            }
        }

        expectedState = ""
        return true
    }
}

data class NativeXCallbackResult(
    val token: String,
    val secret: String,
)
