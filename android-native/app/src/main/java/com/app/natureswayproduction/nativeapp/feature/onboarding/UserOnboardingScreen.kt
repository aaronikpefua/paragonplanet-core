package com.app.natureswayproduction.nativeapp.feature.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import kotlinx.coroutines.launch

@Composable
fun UserOnboardingScreen(
    repository: RoleOnboardingRepository,
    onBack: () -> Unit,
    onCompleted: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var realName by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("Nigeria") }
    var state by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) {
                Text("Go Back")
            }
        }

        item {
            Text(
                text = "User Registration",
                style = MaterialTheme.typography.headlineSmall,
                color = Color(0xFF111111),
                fontWeight = FontWeight.ExtraBold
            )
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFDF8)),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "About Paragon User",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Paragon Users are viewers, supporters, followers, buyers, explorers, and community members within the Paragon Planet ecosystem.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF3E3A35)
                    )
                }
            }
        }

        item {
            FormField("Real name", realName) { realName = it }
        }
        item {
            FormField("Gender", gender) { gender = it }
        }
        item {
            FormField("Phone (optional)", phone) { phone = it }
        }
        item {
            FormField("Email", email) { email = it }
        }
        item {
            FormField("Country", country) { country = it }
        }
        item {
            FormField("State", state) { state = it }
        }

        errorMessage?.let { message ->
            item {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFB00020)
                )
            }
        }

        item {
            Button(
                onClick = {
                    if (isSaving) return@Button
                    isSaving = true
                    errorMessage = null
                    scope.launch {
                        runCatching {
                            repository.saveUserProfile(
                                UserRegistrationForm(
                                    realName = realName,
                                    gender = gender,
                                    phone = phone,
                                    email = email,
                                    country = country,
                                    state = state,
                                )
                            )
                        }.onSuccess {
                            onCompleted()
                        }.onFailure {
                            errorMessage = it.message ?: "Could not save user profile."
                        }
                        isSaving = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isSaving) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text("Save Profile")
                }
            }
        }
    }
}

@Composable
private fun FormField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = label != "Phone (optional)",
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color(0xFF111111),
            unfocusedTextColor = Color(0xFF111111),
            focusedBorderColor = ParagonGold,
            unfocusedBorderColor = Color(0xFFD0D5DD),
            cursorColor = Color(0xFF111111),
            focusedLabelColor = Color(0xFF4C453D),
            unfocusedLabelColor = Color(0xFF4C453D),
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
        )
    )
}

