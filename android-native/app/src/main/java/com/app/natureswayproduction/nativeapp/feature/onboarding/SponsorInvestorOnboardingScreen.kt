package com.app.natureswayproduction.nativeapp.feature.onboarding

import android.content.Context
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.launch

private data class SponsorInvestorChoice(
    val label: String,
    val description: String,
)

private data class DescribedOption(
    val label: String,
    val description: String,
)

private val sponsorInvestorPurposes = listOf(
    "Talent Sponsorship",
    "Contest Sponsorship",
    "Brand Promotion",
    "Event Partnerships",
    "Product Advertising",
    "Marketplace Promotion",
    "Creator Development",
    "Platform Expansion",
    "Sector-Based Investments",
    "Revenue Sharing Partnerships",
    "Strategic Collaborations",
    "Audience Engagement Campaigns",
)

private val sponsorExchangeBenefits = listOf(
    "Brand visibility",
    "Promotional opportunities",
    "Advertisement placements",
    "Audience engagement",
    "Product awareness",
    "Partnership recognition",
    "Event branding rights",
    "Campaign exposure within the Planet ecosystem",
)

private val investorFundingAreas = listOf(
    "Talent growth and development",
    "Digital products and businesses",
    "Entertainment activities",
    "Technology systems",
    "Educational projects",
    "Media productions",
    "Marketplace systems",
    "Infrastructure expansion",
    "Ecosystem innovations",
    "Revenue-generating activities within the Platform",
)

private val sponsorInvestorCollaborators = listOf(
    "Citizens",
    "Superbosses",
    "Ambassadors",
    "Backers",
    "Merchants",
    "Contest organizers",
    "Platform administrators",
    "Creative teams and project developers",
)

private val sponsorInvestorExpectations = listOf(
    "Maintain ethical and professional relationships",
    "Respect the rules and standards of the Platform",
    "Support legitimate talents, projects, and opportunities",
    "Avoid fraudulent or exploitative activities",
    "Promote positive development within the ecosystem",
    "Encourage creativity, innovation, and healthy competition",
)

private val sponsorChoices = listOf(
    DescribedOption("Contest", "Sponsor a competition and gain full branding rights"),
    DescribedOption("Creator / Talent", "Partner with individual creators to promote your brand"),
    DescribedOption("Category", "Own visibility in a specific talent category"),
    DescribedOption("Event", "Sponsor live or virtual events on the platform"),
    DescribedOption("Advertisement", "Promote your brand through ads and sponsored posts"),
    DescribedOption("Platform Partnership", "Long-term strategic collaboration with the platform"),
)

private val investorChoices = listOf(
    DescribedOption("Creator / Talent Funding", "Fund individual creators and earn from their performance"),
    DescribedOption("Contest Funding", "Fund competitions and earn from contest engagement"),
    DescribedOption("Platform Growth", "Invest in platform expansion and earn long-term returns"),
    DescribedOption("Category Investment", "Invest in a full talent category and earn from all creators"),
    DescribedOption("Revenue Share Partnership", "Enter a flexible agreement for shared platform revenue"),
)

@Composable
fun SponsorInvestorOnboardingScreen(
    repository: RoleOnboardingRepository,
    onBack: () -> Unit,
    onCompleted: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var accountType by remember { mutableStateOf("SPONSOR") }
    var showAbout by remember { mutableStateOf(false) }
    var sponsorType by remember { mutableStateOf("") }
    var investorType by remember { mutableStateOf("") }
    var realName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser?.email.orEmpty()) }
    var phone by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("") }
    var stateCity by remember { mutableStateOf("") }
    var brandName by remember { mutableStateOf("") }
    var websiteLink by remember { mutableStateOf("") }
    val talentFields = remember { mutableStateListOf<String>() }
    val sponsorInterestValues = remember { mutableStateListOf<String>() }
    var sponsorBudgetRange by remember { mutableStateOf("") }
    val sponsorBenefitValues = remember { mutableStateListOf<String>() }
    val investorInterestValues = remember { mutableStateListOf<String>() }
    var investmentCapacity by remember { mutableStateOf("") }
    var riskLevel by remember { mutableStateOf("") }
    val returnTypeValues = remember { mutableStateListOf<String>() }
    val sponsorDocuments = remember { mutableStateListOf<String>() }
    val investorDocuments = remember { mutableStateListOf<String>() }
    var isSaving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val currentTitle = if (accountType == "SPONSOR") "Sponsor Registration" else "Investor Registration"

    val sponsorPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        sponsorDocuments.clear()
        sponsorDocuments.addAll(uris.map { context.fileNameFor(it) })
    }
    val investorPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        investorDocuments.clear()
        investorDocuments.addAll(uris.map { context.fileNameFor(it) })
    }

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
        ) {
            Text("Go Back", fontWeight = FontWeight.Bold)
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(18.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = { showAbout = !showAbout },
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1F2933),
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        if (showAbout) "Hide About Sponsors / Investors" else "About Sponsors / Investors",
                        fontWeight = FontWeight.Bold
                    )
                }

                if (showAbout) {
                    SponsorInvestorAboutCard()
                }
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(18.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Join as Sponsor / Investor",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFF6B5F4B),
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = currentTitle,
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color(0xFF111111),
                    fontWeight = FontWeight.ExtraBold
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SponsorInvestorTypeCard(
                        modifier = Modifier.weight(1f),
                        choice = SponsorInvestorChoice(
                            label = "Sponsor",
                            description = "Promote your brand, sponsor contests, reach talents and voters."
                        ),
                        selected = accountType == "SPONSOR",
                        onClick = { accountType = "SPONSOR" }
                    )
                    SponsorInvestorTypeCard(
                        modifier = Modifier.weight(1f),
                        choice = SponsorInvestorChoice(
                            label = "Investor",
                            description = "Fund creators, contests, or platform growth and earn returns."
                        ),
                        selected = accountType == "INVESTOR",
                        onClick = { accountType = "INVESTOR" }
                    )
                }
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(18.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Basic Information", fontWeight = FontWeight.ExtraBold, color = Color(0xFF111111))

                if (accountType == "SPONSOR") {
                    Text("Sponsor Type", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        sponsorTypes.forEach { option ->
                            TogglePill(option, sponsorType == option) { sponsorType = option }
                        }
                    }
                } else {
                    Text("Investor Type", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        investorTypes.forEach { option ->
                            TogglePill(option, investorType == option) { investorType = option }
                        }
                    }
                }

                OnboardingField(realName, { realName = it }, "Full Name / Company Name")
                OnboardingField(email, { email = it }, "Email")
                OnboardingField(phone, { phone = it }, "Phone Number")
                OnboardingField(country, { country = it }, "Country")
                OnboardingField(stateCity, { stateCity = it }, "State / City")
            }
        }

        if (accountType == "SPONSOR") {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Brand Information", fontWeight = FontWeight.ExtraBold, color = Color(0xFF111111))
                    OnboardingField(brandName, { brandName = it }, "Brand / Organization Name")
                    OnboardingField(websiteLink, { websiteLink = it }, "Website or Social Media Link")

                    Text("Talent Field of Interest", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        promoterTypes.forEach { option ->
                            TogglePill(option, talentFields.contains(option)) { toggle(talentFields, option) }
                        }
                    }

                    Text("Sponsorship Interest", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Text(
                        "What do you want to sponsor? (Select all that apply)",
                        color = Color(0xFF6B7280),
                        style = MaterialTheme.typography.bodySmall
                    )
                    sponsorChoices.forEach { option ->
                        SelectableDetailCard(
                            title = option.label,
                            description = option.description,
                            selected = sponsorInterestValues.contains(option.label),
                            onClick = { toggle(sponsorInterestValues, option.label) }
                        )
                    }

                    Text("Budget Range", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        sponsorBudgets.forEach { option ->
                            TogglePill(option, sponsorBudgetRange == option) { sponsorBudgetRange = option }
                        }
                    }

                    Text("Benefit Expected", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        sponsorBenefits.forEach { option ->
                            TogglePill(option, sponsorBenefitValues.contains(option)) {
                                toggle(sponsorBenefitValues, option)
                            }
                        }
                    }
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Verification", fontWeight = FontWeight.ExtraBold, color = Color(0xFF111111))
                    Text("CAC / Business Document Upload (optional)", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Button(
                        onClick = { sponsorPicker.launch(arrayOf("*/*")) },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF111111),
                            contentColor = Color.White
                        )
                    ) {
                        Text("Choose Documents", fontWeight = FontWeight.Bold)
                    }
                    Text("ID Upload (optional)", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Text(
                        if (sponsorDocuments.isEmpty()) "No files chosen yet." else "Files: ${sponsorDocuments.joinToString(", ")}",
                        color = Color(0xFF6B7280),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        } else {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Investment Interest", fontWeight = FontWeight.ExtraBold, color = Color(0xFF111111))
                    Text("What do you want to invest in?", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    investorChoices.forEach { option ->
                        SelectableDetailCard(
                            title = option.label,
                            description = option.description,
                            selected = investorInterestValues.contains(option.label),
                            onClick = { toggle(investorInterestValues, option.label) }
                        )
                    }

                    Text("Preferred Talents", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        promoterTypes.forEach { option ->
                            TogglePill(option, talentFields.contains(option)) { toggle(talentFields, option) }
                        }
                    }

                    Text("Investment Capacity", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        investmentCapacities.forEach { option ->
                            TogglePill(option, investmentCapacity == option) { investmentCapacity = option }
                        }
                    }

                    Text("Risk Level", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        riskLevels.forEach { option ->
                            TogglePill(option, riskLevel == option) { riskLevel = option }
                        }
                    }

                    Text("Expected Return Type", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        returnTypes.forEach { option ->
                            TogglePill(option, returnTypeValues.contains(option)) {
                                toggle(returnTypeValues, option)
                            }
                        }
                    }
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Verification", fontWeight = FontWeight.ExtraBold, color = Color(0xFF111111))
                    Text("ID Upload", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Button(
                        onClick = { investorPicker.launch(arrayOf("*/*")) },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF111111),
                            contentColor = Color.White
                        )
                    ) {
                        Text("Choose Documents", fontWeight = FontWeight.Bold)
                    }
                    Text("Proof of Funds (optional)", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Text("Company Document (optional)", fontWeight = FontWeight.Bold, color = Color(0xFF111111))
                    Text(
                        if (investorDocuments.isEmpty()) "No files chosen yet." else "Files: ${investorDocuments.joinToString(", ")}",
                        color = Color(0xFF6B7280),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }

        error?.let { Text(it, color = Color(0xFFB00020), fontWeight = FontWeight.SemiBold) }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Button(
                onClick = {
                    isSaving = true
                    error = null
                    scope.launch {
                        runCatching {
                            repository.saveSponsorInvestorProfile(
                                SponsorInvestorRegistrationForm(
                                    accountType = accountType,
                                    sponsorType = sponsorType,
                                    investorType = investorType,
                                    realName = realName,
                                    email = email,
                                    phone = phone,
                                    country = country,
                                    stateCity = stateCity,
                                    brandName = brandName,
                                    websiteLink = websiteLink,
                                    talentFields = talentFields.toList(),
                                    sponsorInterests = sponsorInterestValues.toList(),
                                    sponsorBudgetRange = sponsorBudgetRange,
                                    sponsorBenefits = sponsorBenefitValues.toList(),
                                    investorInterests = investorInterestValues.toList(),
                                    investmentCapacity = investmentCapacity,
                                    riskLevel = riskLevel,
                                    returnTypes = returnTypeValues.toList(),
                                    sponsorDocuments = sponsorDocuments.toList(),
                                    investorDocuments = investorDocuments.toList(),
                                )
                            )
                        }.onSuccess {
                            onCompleted()
                        }.onFailure {
                            error = it.message ?: "Profile could not be saved."
                        }
                        isSaving = false
                    }
                },
                enabled = !isSaving,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF111111),
                    contentColor = Color.White
                )
            ) {
                if (isSaving) {
                    CircularProgressIndicator(color = ParagonGold)
                } else {
                    Text(
                        if (accountType == "SPONSOR") "Submit Sponsor Profile" else "Submit Investor Profile",
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun SponsorInvestorAboutCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFFFFDF8), RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            "About Sponsors / Investors",
            color = Color(0xFF111111),
            fontWeight = FontWeight.ExtraBold,
            style = MaterialTheme.typography.titleMedium
        )
        AboutParagraph("Paragon Planet Sponsors and Investors are individuals, organizations, companies, institutions, brands, and strategic partners who support, finance, promote, invest in, or collaborate with activities, talents, contests, projects, and opportunities within the Paragon Planet ecosystem.")
        AboutParagraph("Sponsors and Investors play a major role in the growth, visibility, development, empowerment, and expansion of the Planet by supporting Citizens, Superbosses, Ambassadors, Backers, Merchants, events, competitions, digital products, and ecosystem activities.")
        AboutParagraph("Sponsors and Investors may operate within the Platform for purposes such as:")
        sponsorInvestorPurposes.forEach { AboutBullet(it) }
        AboutParagraph("Sponsors may support talents, contests, or ecosystem activities in exchange for:")
        sponsorExchangeBenefits.forEach { AboutBullet(it) }
        AboutParagraph("Investors may participate in funding opportunities connected to:")
        investorFundingAreas.forEach { AboutBullet(it) }
        AboutParagraph("Sponsors and Investors may collaborate directly with:")
        sponsorInvestorCollaborators.forEach { AboutBullet(it) }
        AboutParagraph("The Sponsor and Investor system is designed to create opportunities for financial empowerment, strategic partnerships, business visibility, ecosystem expansion, and sustainable growth within Paragon Planet.")
        AboutParagraph("Sponsors and Investors are expected to:")
        sponsorInvestorExpectations.forEach { AboutBullet(it) }
        AboutParagraph("As Sponsors and Investors participate within the ecosystem, they gain access to broader visibility, strategic influence, partnership opportunities, audience reach, marketplace exposure, promotional advantages, and long-term collaborative benefits within Paragon Planet.")
    }
}

@Composable
private fun SponsorInvestorTypeCard(
    modifier: Modifier = Modifier,
    choice: SponsorInvestorChoice,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier = modifier
            .background(
                if (selected) Color(0xFF111827) else Color(0xFFFFFDF8),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            choice.label,
            color = if (selected) Color.White else Color(0xFF111827),
            fontWeight = FontWeight.ExtraBold
        )
        Text(
            choice.description,
            color = if (selected) Color.White else Color(0xFF374151),
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun SelectableDetailCard(
    title: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (selected) Color(0xFF111827) else Color(0xFFFFFDF8),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            title,
            color = if (selected) Color.White else Color(0xFF111827),
            fontWeight = FontWeight.ExtraBold
        )
        Text(
            description,
            color = if (selected) Color.White else Color(0xFF52616B),
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun AboutParagraph(text: String) {
    Text(text, color = Color(0xFF26384D), style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun AboutBullet(text: String) {
    Text("• $text", color = Color(0xFF26384D), style = MaterialTheme.typography.bodyMedium)
}

private fun Context.fileNameFor(uri: android.net.Uri): String {
    contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (nameIndex >= 0 && cursor.moveToFirst()) {
            return cursor.getString(nameIndex).orEmpty()
        }
    }
    return uri.lastPathSegment?.substringAfterLast('/') ?: "Selected file"
}
