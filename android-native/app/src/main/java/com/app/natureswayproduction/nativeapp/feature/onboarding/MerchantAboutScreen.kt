package com.app.natureswayproduction.nativeapp.feature.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
fun MerchantAboutScreen(
    onBack: () -> Unit,
) {
    val paragraphs = listOf(
        "Paragon Planet Merchants are users within the Paragon Planet ecosystem who are authorized to upload, showcase, promote, negotiate, and sell digital products and software-based services to buyers across the Planet.",
        "Any user within the ecosystem may qualify to operate as a Merchant by creating and listing approved digital products through their respective Merchant spaces within the Platform.",
        "Merchants are expected to upload their digital products together with their respective prices, descriptions, previews, and delivery information for interested buyers to view, negotiate, bargain, and agree upon the actual purchase price.",
        "The Merchant system allows direct interaction between sellers and buyers through communication, negotiations, offers, and agreements within the Paragon Planet marketplace environment.",
        "Payments for approved digital products may be processed through supported digital billing systems, including Google Billing and other authorized payment systems integrated into the Platform.",
        "As Merchants gain sales, visibility, customer trust, ratings, and audience engagement, they unlock greater marketplace exposure, promotional advantages, rewards, rankings, and business opportunities within the Planet."
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") }
        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("About The Merchants", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                paragraphs.forEach { paragraph ->
                    Text(paragraph, color = Color(0xFF232323))
                }
                Text("Merchant product categories", fontWeight = FontWeight.ExtraBold)
                merchantProductTypes.forEach { item ->
                    Text("• $item", color = Color(0xFF5A534A))
                }
            }
        }
    }
}
