package com.app.natureswayproduction.nativeapp.feature.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import kotlinx.coroutines.launch

private val promotionMediumDescriptions = mapOf(
    "Social Media Promotion" to "Using platforms like TikTok, Instagram, Facebook, X, Snapchat, and YouTube.",
    "Live Events & Concerts" to "Promoting stars through concerts, festivals, shows, and stage appearances.",
    "Radio Promotion" to "Using FM stations, interviews, jingles, and radio shout-outs.",
    "Television Promotion" to "Featuring stars on TV programs, entertainment shows, and advertisements.",
    "Campus Tours" to "Promoting stars in universities, polytechnics, and secondary school events.",
    "Street Campaigns" to "Using banners, flyers, posters, branded vehicles, and hype teams.",
    "Digital Advertising" to "Running online ads through Google, Meta, YouTube, and entertainment websites.",
    "Livestream & Virtual Shows" to "Using live streaming, webinars, online concerts, and virtual fan interactions.",
    "Influencer Collaborations" to "Partnering with influencers, bloggers, and creators to push visibility.",
    "Press, Media & Streaming Coverage" to "Using blogs, magazines, newspapers, interviews, entertainment news platforms, Spotify, Audiomack, Apple Music, Boomplay, Twitch, and streaming platforms to increase visibility and audience reach.",
    "Fanbase & Community Promotion" to "Building fan clubs, WhatsApp groups, Telegram channels, Discord servers, churches, mosques, community programs, and social gatherings to grow loyal supporters and audience engagement.",
    "Brand Partnership Campaigns" to "Promoting stars through company sponsorships, ambassador deals, endorsements, and co-branding campaigns.",
)

@Composable
fun PromoterOnboardingScreen(
    repository: RoleOnboardingRepository,
    onBack: () -> Unit,
    onCompleted: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var showAbout by remember { mutableStateOf(false) }
    var brandName by remember { mutableStateOf("") }
    var realName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var capacity by remember { mutableStateOf("") }
    var citizenStars by remember { mutableStateOf("") }
    val selectedTypes = remember { mutableStateListOf<String>() }
    val selectedMediums = remember { mutableStateListOf<String>() }
    var isSaving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun toggle(list: MutableList<String>, value: String) {
        if (list.contains(value)) list.remove(value) else list.add(value)
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
        ) { Text("Go Back", fontWeight = FontWeight.Bold) }

        Text(
            "Ambassador Registration",
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
                if (showAbout) "Hide About Ambassadors" else "About Ambassadors",
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
                    "Paragon Planet Ambassadors are promotional Stars, talent scouts, artist managers, MCs, presenters, media personalities, entertainment promoters, influencers, and talent representatives who discover, invite, support, and promote talented Stars into the Paragon Planet ecosystem through their unique invitation links.",
                    color = Color(0xFF26384D),
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    "Ambassadors serve as important promotional forces within the Planet by helping talented individuals gain visibility, audience engagement, recognition, and opportunities within the ecosystem.",
                    color = Color(0xFF26384D),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        Text("Identity", fontWeight = FontWeight.Bold, color = Color(0xFF111111))

        OnboardingField(brandName, { brandName = it }, "Stage / Brand Name")
        OnboardingField(realName, { realName = it }, "Real Name (optional)")
        OnboardingField(phone, { phone = it }, "Phone Number")
        OnboardingField(country, { country = it }, "Country")
        OnboardingField(state, { state = it }, "State")

        Text("How many stars do have to start for Citizen", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
        OnboardingField(capacity, { capacity = it }, "Minimum 5 citizens")
        Text("Minimum: 5 citizens", color = Color(0xFF6B7280), style = MaterialTheme.typography.bodySmall)
        OnboardingField(citizenStars, { citizenStars = it }, "Citizen Stars for Capacity (optional)")

        Text("Select the Talent Categories You Promote", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            promoterTypes.forEach { type ->
                TogglePill(
                    label = type,
                    selected = selectedTypes.contains(type),
                    onClick = { toggle(selectedTypes, type) }
                )
            }
        }

        Text("Select the mediums you use to promote your stars.", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
        promotionMediums.forEach { medium ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (selectedMediums.contains(medium)) ParagonGold.copy(alpha = 0.18f) else Color.White, RoundedCornerShape(10.dp))
                    .clickable { toggle(selectedMediums, medium) }
                    .padding(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(medium, color = Color(0xFF111111), fontWeight = if (selectedMediums.contains(medium)) FontWeight.Bold else FontWeight.Medium)
                    promotionMediumDescriptions[medium]?.let { description ->
                        Text(description, color = Color(0xFF6B7280), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        error?.let { Text(it, color = Color(0xFFB00020)) }

        Button(
            onClick = {
                isSaving = true
                error = null
                scope.launch {
                    runCatching {
                        repository.savePromoterProfile(
                            PromoterRegistrationForm(
                                brandName = brandName,
                                realName = realName,
                                phone = phone,
                                country = country,
                                state = state,
                                capacity = capacity,
                                citizenStars = citizenStars,
                                promoterTypes = selectedTypes.toList(),
                                promotionMediums = selectedMediums.toList(),
                            )
                        )
                    }.onSuccess { onCompleted() }
                        .onFailure { error = it.message ?: "Registration failed" }
                    isSaving = false
                }
            },
            enabled = !isSaving,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
        ) {
            if (isSaving) CircularProgressIndicator(color = ParagonGold) else Text("Submit for Review", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
internal fun OnboardingField(value: String, onValueChange: (String) -> Unit, placeholder: String) {
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
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
        )
    )
}

@Composable
internal fun TogglePill(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(if (selected) Color(0xFF111111) else Color.White, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Text(label, color = if (selected) Color.White else Color(0xFF111111), fontWeight = FontWeight.Bold)
    }
}
