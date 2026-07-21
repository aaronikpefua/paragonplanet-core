package com.app.natureswayproduction.nativeapp.feature.auth

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.app.natureswayproduction.R
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold

@Composable
fun AuthScreen(
    authViewModel: AuthViewModel,
    onAuthFinished: (AuthCompletedAction) -> Unit = {},
) {
    val state by authViewModel.uiState.collectAsState()
    val context = LocalContext.current
    val activity = context.findActivity()
    val providerButtonText = if (state.mode == AuthMode.Login) {
        "Use a provider to sign in"
    } else {
        "Use a provider to create your account"
    }

    LaunchedEffect(state.isSignedIn, state.lastCompletedAction) {
        val completedAction = state.lastCompletedAction
        if (state.isSignedIn && completedAction != null) {
            onAuthFinished(completedAction)
            authViewModel.consumeCompletedAction()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        AuthHeader()

        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFFF4EEE7)),
            shape = RoundedCornerShape(0.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = if (state.mode == AuthMode.Login) "Sign in" else "Create account",
                    color = Color(0xFF111111),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = providerButtonText,
                    color = Color(0xFF5F5A52),
                    style = MaterialTheme.typography.bodySmall
                )

                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF8EF)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = if (state.mode == AuthMode.Login) "Social sign-in" else "Social sign-up",
                            color = Color(0xFF111111),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold
                        )
                        SocialButtonStack(
                            loading = state.isLoading,
                            onGoogleClick = {
                                if (activity != null) {
                                    authViewModel.continueWithGoogle(activity)
                                } else {
                                    Toast.makeText(context, "Google sign-in needs an active screen.", Toast.LENGTH_SHORT).show()
                                }
                            },
                            onFacebookClick = {
                                if (activity != null) {
                                    authViewModel.continueWithFacebook(activity)
                                } else {
                                    Toast.makeText(context, "Facebook sign-in needs an active screen.", Toast.LENGTH_SHORT).show()
                                }
                            },
                            onXClick = {
                                if (activity != null) {
                                    authViewModel.continueWithX(activity)
                                } else {
                                    Toast.makeText(context, "X sign-in needs an active screen.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                }

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = state.emailInput,
                        onValueChange = authViewModel::updateEmail,
                        placeholder = { Text("Email") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = authFieldColors()
                    )

                    OutlinedTextField(
                        value = state.passwordInput,
                        onValueChange = authViewModel::updatePassword,
                        placeholder = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = authFieldColors()
                    )

                    if (state.mode == AuthMode.Login) {
                        Text(
                            text = "Forgot password?",
                            color = Color(0xFF7A5E12),
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable { authViewModel.sendPasswordReset() }
                        )
                    }

                    PrimaryAuthButton(
                        label = if (state.mode == AuthMode.Login) "Sign in" else "Create account",
                        enabled = !state.isLoading,
                        onClick = {
                            if (state.mode == AuthMode.Login) {
                                authViewModel.signIn()
                            } else {
                                authViewModel.signUp()
                            }
                        }
                    )
                }

                if (state.isLoading) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(color = ParagonGold)
                    }
                }

                state.errorMessage?.let {
                    Text(
                        text = it,
                        color = Color(0xFFB00020),
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                if (state.note.isNotBlank()) {
                    Text(
                        text = state.note,
                        color = Color(0xFF5F5A52),
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (state.mode == AuthMode.Login) {
                    Text(
                        text = "New here? Create account",
                        color = Color(0xFF111111),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.clickable { authViewModel.showSignupMode() }
                    )
                } else {
                    Text(
                        text = "Already have an account? Sign in",
                        color = Color(0xFF111111),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.clickable { authViewModel.showLoginMode() }
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthHeader() {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1B1B1B)),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.paragon_logo),
                    contentDescription = "Paragon Planet logo",
                    modifier = Modifier.size(28.dp)
                )
                Text(
                    text = "Paragon Planet",
                    color = Color.White,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = "🔑 Sign in",
                color = ParagonGold,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun PrimaryAuthButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF101828),
            contentColor = Color.White
        )
    ) {
        Text(
            text = label,
            fontWeight = FontWeight.ExtraBold
        )
    }
}

@Composable
private fun SocialButtonStack(
    loading: Boolean,
    onGoogleClick: () -> Unit,
    onFacebookClick: () -> Unit,
    onXClick: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        SocialActionButton(
            label = if (loading) "Connecting..." else "Continue with Google",
            containerColor = Color.White,
            contentColor = Color(0xFF101828),
            onClick = onGoogleClick
        )
        SocialActionButton(
            label = if (loading) "Connecting..." else "Continue with Facebook",
            containerColor = Color(0xFF1877F2),
            contentColor = Color.White,
            onClick = onFacebookClick
        )
        SocialActionButton(
            label = if (loading) "Connecting..." else "Continue with X",
            containerColor = Color(0xFF111111),
            contentColor = Color.White,
            onClick = onXClick
        )
    }
}

@Composable
private fun SocialActionButton(
    label: String,
    containerColor: Color,
    contentColor: Color,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = containerColor,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                color = contentColor,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.ExtraBold
            )
        }
    }
}

@Composable
private fun authFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color(0xFF111111),
    unfocusedTextColor = Color(0xFF111111),
    disabledTextColor = Color(0xFF3F3A33),
    focusedBorderColor = ParagonGold,
    unfocusedBorderColor = Color(0xFFD0D5DD),
    cursorColor = Color(0xFF111111),
    focusedPlaceholderColor = Color(0xFF6B5F4B),
    unfocusedPlaceholderColor = Color(0xFF6B5F4B),
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White,
)

private fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

