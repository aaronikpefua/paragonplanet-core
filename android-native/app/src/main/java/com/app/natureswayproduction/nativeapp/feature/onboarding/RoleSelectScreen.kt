package com.app.natureswayproduction.nativeapp.feature.onboarding
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun RoleSelectScreen(
    isEarnStep: Boolean,
    onOpenAboutUser: () -> Unit,
    onOpenUserProfile: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenMeetUp: () -> Unit,
    onContinueAsUser: suspend () -> Unit,
    onNext: () -> Unit,
    onCitizenSelected: () -> Unit,
    onPromoterSelected: () -> Unit,
    onMerchantSelected: () -> Unit,
    onBackerSelected: () -> Unit,
    onSupernalSelected: () -> Unit,
    onSponsorInvestorSelected: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var isSavingUser by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val earnRoles = listOf(
        "Citizen" to onCitizenSelected,
        "Ambassador" to onPromoterSelected,
        "Merchant" to onMerchantSelected,
        "Backer" to onBackerSelected,
        "Superboss" to onSupernalSelected,
        "Sponsor / Investor" to onSponsorInvestorSelected,
    )

    if (isEarnStep) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFF4EEE7))
                .padding(horizontal = 20.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Text(
                text = "Select Your Role To Earn",
                style = MaterialTheme.typography.headlineSmall,
                color = Color(0xFF111111),
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = "On The Way To Become Paragon Star In:",
                style = MaterialTheme.typography.bodyLarge,
                color = Color(0xFF5A534A)
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                earnRoles.chunked(2).forEach { rowItems ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        rowItems.forEach { (label, action) ->
                            Button(
                                onClick = action,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF111111),
                                    contentColor = Color.White
                                )
                            ) {
                                Text(text = label, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (rowItems.size == 1) {
                            Row(modifier = Modifier.weight(1f)) {}
                        }
                    }
                }
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            Button(
                onClick = onOpenAboutUser,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF111111),
                    contentColor = Color.White
                )
            ) {
                Text("About Paragon User", fontWeight = FontWeight.Bold)
            }
        }

        item {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                tonalElevation = 0.dp,
                shadowElevation = 0.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "User Profile",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color(0xFF111111),
                        fontWeight = FontWeight.ExtraBold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MiniActionButton("Wallet", onOpenWallet, Modifier.weight(1f))
                        MiniActionButton("Meet-Up", onOpenMeetUp, Modifier.weight(1f))
                        MiniActionButton("Edit Profile", onOpenUserProfile, Modifier.weight(1f))
                    }
                }
            }
        }

        item {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                tonalElevation = 0.dp,
                shadowElevation = 0.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "Select Your Role To Earn",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color(0xFF111111),
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = "Continue as a User or pick a role to earn on the way to Paragon Planet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF5A534A)
                    )

                    errorMessage?.let { message ->
                        Text(
                            text = message,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFB00020)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                if (isSavingUser) return@Button
                                isSavingUser = true
                                errorMessage = null
                                scope.launch {
                                    runCatching { onContinueAsUser() }
                                        .onFailure { errorMessage = it.message ?: "Could not continue as a user right now." }
                                    isSavingUser = false
                                }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = !isSavingUser,
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF111111),
                                contentColor = Color.White
                            )
                        ) {
                            if (isSavingUser) {
                                CircularProgressIndicator(
                                    modifier = Modifier.padding(vertical = 2.dp),
                                    color = Color.White,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text("Continue as User", fontWeight = FontWeight.Bold)
                            }
                        }

                        Button(
                            onClick = onNext,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF111111),
                                contentColor = Color.White
                            )
                        ) {
                            Text("Next", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MiniActionButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = Color(0xFF111111)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                color = Color.White,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
