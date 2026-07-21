package com.app.natureswayproduction.nativeapp.feature.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import kotlinx.coroutines.launch

private val citizenTalents = listOf(
    "Cultural Performer",
    "Special Body Styles",
    "Dancer",
    "Instrumentalist",
    "Model",
    "Foodier",
    "Stunt Performer",
    "Singer",
    "Debater",
    "Comedian",
    "Artist & Designer",
    "Actor",
)

@Composable
fun CitizenOnboardingScreen(
    repository: RoleOnboardingRepository,
    onBack: () -> Unit,
    onCompleted: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var showAbout by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var successNote by remember { mutableStateOf<String?>(null) }

    var stageName by remember { mutableStateOf("") }
    var realName by remember { mutableStateOf("") }
    var age by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var maritalStatus by remember { mutableStateOf("") }
    var profession by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var tribe by remember { mutableStateOf("") }
    var residence by remember { mutableStateOf("") }
    val talents = remember { mutableStateListOf<String>() }

    fun toggleTalent(talent: String) {
        if (talents.contains(talent)) talents.remove(talent) else talents.add(talent)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Button(
            onClick = onBack,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF1F2933),
                contentColor = Color.White
            )
        ) {
            Text("Go Back", fontWeight = FontWeight.Bold)
        }

        Text(
            text = "Citizen Registration",
            style = MaterialTheme.typography.headlineSmall,
            color = Color(0xFF111111),
            fontWeight = FontWeight.ExtraBold
        )

        Button(
            onClick = { showAbout = !showAbout },
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF1F2933),
                contentColor = Color.White
            )
        ) {
            Text(
                if (showAbout) "Hide About Citizen Contestants" else "About Citizen Contestants",
                fontWeight = FontWeight.Bold
            )
        }

        if (showAbout) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFFDF8), RoundedCornerShape(12.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Paragon Planet transforms talented individuals into recognized Stars through visibility, growth, competition, creativity, promotion, audience support, discipline, and recognition.",
                    color = Color(0xFF26384D),
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = "As contestants gain votes, recognition, performance scores, and public support, they unlock greater visibility, stronger rankings, unique identity colors, rewards, higher influence, and greater positions within the Planet.",
                    color = Color(0xFF26384D),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        Text(
            text = "Basic Information",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF111111),
            fontWeight = FontWeight.Bold
        )

        RegistrationField(stageName, { stageName = it }, "Stage / Display Name")
        RegistrationField(realName, { realName = it }, "Real Full Name")
        RegistrationField(age, { age = it }, "Age (18+)")
        RegistrationField(gender, { gender = it }, "Select Gender")
        RegistrationField(maritalStatus, { maritalStatus = it }, "Marital Status")
        RegistrationField(profession, { profession = it }, "Profession")
        RegistrationField(phone, { phone = it }, "Phone Number")
        RegistrationField(country, { country = it }, "Country")
        RegistrationField(state, { state = it }, "State")
        RegistrationField(tribe, { tribe = it }, "Tribe")
        RegistrationField(residence, { residence = it }, "Present Residence")

        Text(
            text = "Talents",
            style = MaterialTheme.typography.titleMedium,
            color = Color(0xFF111111),
            fontWeight = FontWeight.Bold
        )

        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            citizenTalents.chunked(2).forEach { chunk ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    chunk.forEach { talent ->
                        val selected = talents.contains(talent)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .background(
                                    if (selected) ParagonGold.copy(alpha = 0.22f) else Color.White,
                                    RoundedCornerShape(10.dp)
                                )
                                .clickable { toggleTalent(talent) }
                                .padding(horizontal = 12.dp, vertical = 12.dp)
                        ) {
                            Text(
                                text = talent,
                                color = Color(0xFF111111),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                    if (chunk.size == 1) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        error?.let {
            Text(
                text = it,
                color = Color(0xFFB00020),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold
            )
        }

        successNote?.let {
            Text(
                text = it,
                color = Color(0xFF215732),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold
            )
        }

        Button(
            onClick = {
                isSaving = true
                error = null
                successNote = null
                scope.launch {
                    runCatching {
                        repository.saveCitizenProfile(
                            CitizenRegistrationForm(
                                stageName = stageName,
                                realName = realName,
                                age = age,
                                gender = gender,
                                maritalStatus = maritalStatus,
                                profession = profession,
                                phone = phone,
                                country = country,
                                state = state,
                                tribe = tribe,
                                residence = residence,
                                talents = talents.toList(),
                            )
                        )
                    }.onSuccess { note ->
                        successNote = note
                        isSaving = false
                        onCompleted()
                    }.onFailure { throwable ->
                        error = throwable.message ?: "Failed to save profile"
                        isSaving = false
                    }
                }
            },
            enabled = !isSaving,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF111111),
                contentColor = Color.White
            )
        ) {
            if (isSaving) {
                CircularProgressIndicator(
                    color = ParagonGold,
                    modifier = Modifier.heightIn(max = 18.dp)
                )
            } else {
                Text("Continue", fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun RegistrationField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder) },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = Color(0xFF111111),
            unfocusedTextColor = Color(0xFF111111),
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
    )
}

