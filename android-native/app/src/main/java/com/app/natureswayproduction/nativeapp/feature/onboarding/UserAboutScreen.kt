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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun UserAboutScreen(
    onBack: () -> Unit,
) {
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
                text = "About Paragon User",
                style = MaterialTheme.typography.headlineSmall,
                color = Color(0xFF111111),
                fontWeight = FontWeight.ExtraBold
            )
        }

        item {
            UserAboutCard(
                "Paragon Planet Users are the general participants, viewers, supporters, followers, buyers, explorers, and community members within the ecosystem."
            )
        }

        item {
            UserAboutCard(
                "Users can create and manage personal accounts, watch and engage with talents, support projects, vote, connect with communities, and grow into higher roles such as Citizen, Ambassador, Merchant, Backer, Superboss, Sponsor, or Investor."
            )
        }

        item {
            UserAboutCard(
                "Users are expected to maintain respectful behavior, avoid harmful activities, support positive engagement, and help the Planet community grow in a healthy way."
            )
        }
    }
}

@Composable
private fun UserAboutCard(
    body: String,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            text = body,
            style = MaterialTheme.typography.bodyLarge,
            color = Color(0xFF2E2A25),
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        )
    }
}
