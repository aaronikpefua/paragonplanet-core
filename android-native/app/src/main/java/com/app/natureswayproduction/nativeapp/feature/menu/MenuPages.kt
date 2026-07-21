package com.app.natureswayproduction.nativeapp.feature.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

private data class SimpleProfile(
    val uid: String,
    val name: String,
    val subtitle: String,
    val extra: String,
    val score: Int,
)

private val citizenCategories = listOf(
    Triple("Dancer", "Dancers", "💃"),
    Triple("Instrumentalist", "Instrumentalists", "🎹"),
    Triple("Model", "Models", "👗"),
    Triple("Nutritionist", "Foodies", "🍔"),
    Triple("Stunt Performer", "Stuntpersons", "🤸"),
    Triple("Singer", "Singers", "🎤"),
    Triple("Debater", "Debaters", "🧠"),
    Triple("Comedian", "Comedians", "😂"),
    Triple("Artist & Designer", "Artists", "🎨"),
    Triple("Actor", "Dramatizers", "🎭"),
    Triple("Special Ability", "Abilities (Disability)", "♿"),
    Triple("Cultural Performer", "Cultural Performers", "🌍"),
)

private val serviceFields = listOf(
    "Health", "Environment", "Education", "Enterprise", "Entertainment", "Finance",
    "Security", "Media", "Law", "Technology", "Governance", "Religion"
)

private val ambassadorTalents = listOf(
    "Cultural Performer", "Special Talent", "Dancer", "Instrumentalist", "Model", "Foodier",
    "Stunt Performer", "Singer", "Debater", "Comedian", "Artist & Designer", "Actor"
)

private val citizenExpectations = listOf(
    "Upload and showcase their talents and creative abilities",
    "Build followers, visibility, and audience engagement through their respective Ambassadors",
    "Receive votes, rewards, and fan support from viewers and supporters",
    "Rise through different contest levels based on performance, creativity, consistency, and participation",
    "Develop their influence, recognition, and standing within the ecosystem",
    "Participate in contests, challenges, and promotional activities",
    "Work toward qualifying to enter the Planet as Official Citizens of Paragon Planet",
)

private val citizenFruits = listOf(
    "One Hundred and Twenty Edible Fruits supervised under the Virtue Superbosses",
    "One Hundred and Twenty Inedible Fruits supervised under the Vice Superbosses",
)

private val serviceFieldCards = listOf(
    "Health" to "🏥",
    "Environment" to "🌱",
    "Education" to "📚",
    "Enterprise" to "🏢",
    "Entertainment" to "🎬",
    "Finance" to "💰",
    "Security" to "🛡️",
    "Media" to "📺",
    "Law" to "⚖️",
    "Technology" to "💻",
    "Governance" to "🏛️",
    "Religion" to "🙏",
)

private val superbossAssessmentPoints = listOf(
    "Knowledge and professional understanding",
    "Communication and reasoning abilities",
    "Ethical standards and discipline",
    "Leadership and decision-making capacity",
    "Social influence and mentorship impact",
    "Wisdom, coordination, and conflict-management abilities",
)

private val backerQualificationPoints = listOf(
    "Knowledge and understanding",
    "Reasoning and analytical ability",
    "Capacity to create quality questions",
    "Ability to provide accurate, technical, and meaningful answers to other Backer Contestants",
    "Leadership, communication, and guidance abilities within their respective fields",
)

private val ambassadorMissionPoints = listOf(
    "Invite talented Citizens to join Paragon Planet",
    "Discover and promote Stars across different talent categories",
    "Build and grow your own network of Citizens",
    "Support the visibility, branding, and development of your invited Stars",
    "Help talents gain recognition, votes, followers, and opportunities",
    "Promote engagement and participation within the ecosystem",
    "Earn rewards from the success and activities of your Citizens",
)

private val userAllowances = listOf(
    "Create and manage personal accounts",
    "Explore activities within the Planet ecosystem",
    "Watch and engage with talent contents",
    "Follow contestants and creators",
    "Vote for Citizens and participants",
    "Support talents and projects",
    "Participate in discussions and interactions",
    "Purchase approved digital products and services",
    "Connect with communities and supporters",
    "Earn rewards and engagement opportunities within the Platform",
)

private val userRolePaths = listOf(
    "Citizens",
    "Superbosses",
    "Ambassadors",
    "Backers",
    "Merchants",
    "Sponsors",
    "Investors",
)

private val userExpectations = listOf(
    "Maintain respectful and ethical behavior",
    "Support positive engagement within the ecosystem",
    "Avoid fraudulent, abusive, or harmful activities",
    "Respect the rules, systems, and structures of the Platform",
    "Promote creativity, fairness, and healthy interactions",
    "Contribute positively to the growth of the Planet community",
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

private val privacyCollectedData = listOf(
    "Account details such as name, email address, phone number, role, country, state, and profile information.",
    "Content you upload, including videos, images, product listings, comments, messages, and other activity inside the platform.",
    "Marketplace and wallet activity, including product purchases, payment status, transaction references, and reward records.",
    "Device and usage information such as pages viewed, app interactions, security logs, and approximate technical information needed to protect the platform.",
)

private val privacyDataUses = listOf(
    "Create and manage user accounts and role profiles.",
    "Show talent videos, marketplace products, meet-up requests, messages, rankings, votes, and other platform features.",
    "Process purchases, wallet records, rewards, subscriptions, product delivery, and payment verification.",
    "Protect users, prevent fraud, enforce platform rules, investigate abuse, and improve security.",
    "Improve Paragon Planet features, performance, content discovery, and user experience.",
    "Comply with legal, payment, security, and platform review requirements.",
)

private val privacySharingRules = listOf(
    "We do not sell personal information.",
    "We may share required information with trusted service providers that help operate the platform, including Firebase, Google Cloud, Cloudflare, payment processors, analytics, crash reporting, and security tools.",
    "We may share information when required by law, payment verification, safety investigations, fraud prevention, or platform policy enforcement.",
    "Public profile names, roles, public videos, marketplace listings, scores, and approved public activity may be visible to other users according to the platform feature being used.",
)

private val privacyUserChoices = listOf(
    "You may update your profile information through your account pages.",
    "You may request account deletion or data review by contacting Paragon Planet support.",
    "You may choose what content to upload and what profile information to provide, subject to required account and role fields.",
    "You may manage payment methods through the relevant payment provider, such as Google Play or other authorized billing systems.",
)

@Composable
fun CitizenContestantsScreen(
    onBack: () -> Unit,
    onOpenCategory: (String) -> Unit,
    onJoin: () -> Unit,
) {
    var showAbout by remember { mutableStateOf(false) }
    MenuPageFrame(onBack = onBack, dark = true) {
        item {
            Text("The Citizen Contestants", style = MaterialTheme.typography.headlineMedium, color = Color.White, fontWeight = FontWeight.ExtraBold)
        }
        item {
            OutlinedButton(onClick = { showAbout = !showAbout }, shape = RoundedCornerShape(8.dp)) {
                Text(if (showAbout) "Hide About Citizen Contestants" else "About Citizen Contestants")
            }
        }
        if (showAbout) {
            item {
                CitizenAboutPanel(onJoin = onJoin)
            }
        }
        item {
            Text(
                "Select a field of Talent to see Citizen Contestants in that field and watch their Performs.",
                color = Color.White,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        }
        items(citizenCategories.chunked(3)) { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                rowItems.forEach { (categoryKey, label, emoji) ->
                    CitizenCategoryCard(
                        modifier = Modifier.weight(1f),
                        emoji = emoji,
                        label = label,
                        onClick = { onOpenCategory(categoryKey) }
                    )
                }
                repeat(3 - rowItems.size) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
fun SuperbossDirectoryScreen(
    onBack: () -> Unit,
    onJoin: () -> Unit,
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    var showAbout by remember { mutableStateOf(false) }
    var selectedField by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var profiles by remember { mutableStateOf<List<SimpleProfile>>(emptyList()) }

    LaunchedEffect(selectedField) {
        if (selectedField.isNullOrBlank()) {
            profiles = emptyList()
            return@LaunchedEffect
        }
        loading = true
        profiles = runCatching {
            firestore.collection("supernal_profiles").get().await().documents
                .filter { doc ->
                    collectServiceFields(doc.data.orEmpty()).any { it.equals(selectedField, ignoreCase = true) }
                }
                .map { doc ->
                    val data = doc.data.orEmpty()
                    SimpleProfile(
                        uid = doc.id,
                        name = firstNonBlank(
                            data["stageName"]?.toString(),
                            data["realName"]?.toString(),
                            data["brandName"]?.toString(),
                            data["fullName"]?.toString(),
                            data["companyName"]?.toString(),
                            data["name"]?.toString(),
                            data["email"]?.toString(),
                            "Superboss"
                        ),
                        subtitle = firstNonBlank(
                            data["profession"]?.toString(),
                            data["businessName"]?.toString(),
                            data["country"]?.toString(),
                            "Superboss"
                        ),
                        extra = collectServiceFields(data).joinToString(", ").ifBlank { "Field not listed" },
                        score = extractInt(data, "trustScore", "score", "superbossScore")
                    )
                }
                .sortedByDescending { it.score }
        }.getOrDefault(emptyList())
        loading = false
    }

    MenuPageFrame(onBack = onBack, dark = true) {
        item { Text("The Mentors", color = Color(0xFFC9B48A), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold) }
        item {
            Text("The Mentors for Superbosses", style = MaterialTheme.typography.headlineMedium, color = Color.White, fontWeight = FontWeight.ExtraBold)
        }
        item {
            Text(
                "Select a field of Discipline to see Superbosses in that field and their trust scores.",
                color = Color(0xFFD9D4CA),
                style = MaterialTheme.typography.bodyLarge
            )
        }
        item {
            OutlinedButton(onClick = { showAbout = !showAbout }, shape = RoundedCornerShape(8.dp)) {
                Text(if (showAbout) "Hide About Superbosses" else "About Superbosses")
            }
        }
        if (showAbout) {
            item {
                SuperbossAboutPanel(onJoin = onJoin)
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF080808)), shape = RoundedCornerShape(14.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("Fields of Discipline", color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    serviceFieldCards.chunked(2).forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowItems.forEach { (field, emoji) ->
                                CitizenCategoryCard(
                                    modifier = Modifier.weight(1f),
                                    emoji = emoji,
                                    label = field,
                                    onClick = { selectedField = field }
                                )
                            }
                        }
                    }
                }
            }
        }
        selectedField?.let { field ->
            item {
                Text("Superbosses in $field", color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            if (loading) {
                item { LoadingBlock(dark = true) }
            } else if (profiles.isEmpty()) {
                item { EmptyCard("No Superbosses found in this field yet.", dark = true) }
            } else {
                itemsIndexed(profiles) { index, profile ->
                    ScoreCard(
                        rank = index + 1,
                        title = profile.name,
                        subtitle = profile.subtitle,
                        detail = profile.extra,
                        scoreLabel = "Score",
                        score = profile.score,
                        dark = true
                    )
                }
            }
        }
    }
}

@Composable
fun BackerDirectoryScreen(
    onBack: () -> Unit,
    onJoin: () -> Unit,
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    var showAbout by remember { mutableStateOf(false) }
    var selectedField by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var profiles by remember { mutableStateOf<List<SimpleProfile>>(emptyList()) }

    LaunchedEffect(selectedField) {
        if (selectedField.isNullOrBlank()) {
            profiles = emptyList()
            return@LaunchedEffect
        }
        loading = true
        profiles = runCatching {
            firestore.collection("backer_profiles").get().await().documents
                .filter { doc ->
                    collectServiceFields(doc.data.orEmpty()).any { it.equals(selectedField, ignoreCase = true) }
                }
                .map { doc ->
                    val data = doc.data.orEmpty()
                    SimpleProfile(
                        uid = doc.id,
                        name = firstNonBlank(
                            data["stageName"]?.toString(),
                            data["realName"]?.toString(),
                            data["brandName"]?.toString(),
                            data["fullName"]?.toString(),
                            data["companyName"]?.toString(),
                            data["name"]?.toString(),
                            data["email"]?.toString(),
                            "Backer Contestant"
                        ),
                        subtitle = firstNonBlank(
                            data["profession"]?.toString(),
                            data["businessName"]?.toString(),
                            data["country"]?.toString(),
                            "Backer Contestant"
                        ),
                        extra = collectServiceFields(data).joinToString(", ").ifBlank { "Field not listed" },
                        score = extractInt(data, "score", "backerScore", "supportScore")
                    )
                }
                .sortedByDescending { it.score }
        }.getOrDefault(emptyList())
        loading = false
    }

    MenuPageFrame(onBack = onBack, dark = true) {
        item {
            Text("The Backer Contestants", style = MaterialTheme.typography.headlineMedium, color = Color.White, fontWeight = FontWeight.ExtraBold)
        }
        item {
            OutlinedButton(onClick = { showAbout = !showAbout }, shape = RoundedCornerShape(8.dp)) {
                Text(if (showAbout) "Hide About Backer Contestants" else "About Backer Contestants")
            }
        }
        if (showAbout) {
            item {
                BackerAboutPanel(onJoin = onJoin)
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF080808)), shape = RoundedCornerShape(14.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        "Select a field of service to see Backer Contestants in that field and their scores.",
                        color = Color.White,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    serviceFieldCards.chunked(2).forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowItems.forEach { (field, emoji) ->
                                CitizenCategoryCard(
                                    modifier = Modifier.weight(1f),
                                    emoji = emoji,
                                    label = field,
                                    onClick = { selectedField = field }
                                )
                            }
                        }
                    }
                }
            }
        }
        selectedField?.let { field ->
            item {
                Text("Backer Contestants in $field", color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            if (loading) {
                item { LoadingBlock(dark = true) }
            } else if (profiles.isEmpty()) {
                item { EmptyCard("No Backer Contestants found in this field yet.", dark = true) }
            } else {
                itemsIndexed(profiles) { index, profile ->
                    ScoreCard(
                        rank = index + 1,
                        title = profile.name,
                        subtitle = profile.subtitle,
                        detail = profile.extra,
                        scoreLabel = "Score",
                        score = profile.score,
                        dark = true
                    )
                }
            }
        }
    }
}

@Composable
fun AmbassadorDirectoryScreen(
    onBack: () -> Unit,
    onJoin: () -> Unit,
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    var showAbout by remember { mutableStateOf(false) }
    var selectedTalent by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var profiles by remember { mutableStateOf<List<SimpleProfile>>(emptyList()) }

    LaunchedEffect(selectedTalent) {
        if (selectedTalent.isNullOrBlank()) {
            profiles = emptyList()
            return@LaunchedEffect
        }
        loading = true
        profiles = runCatching {
            val ambassadorSnapshot = firestore.collection("promoter_profiles").get().await()
            val citizenSnapshot = firestore.collection("citizen_profiles").get().await()
            val citizenCounts = mutableMapOf<String, Int>()
            citizenSnapshot.documents.forEach { doc ->
                val data = doc.data.orEmpty()
                listOf("primaryPromoterId", "invitedByPromoterId", "promoterId").forEach { key ->
                    val id = data[key]?.toString().orEmpty()
                    if (id.isNotBlank()) citizenCounts[id] = (citizenCounts[id] ?: 0) + 1
                }
            }
            ambassadorSnapshot.documents
                .filter { doc ->
                    val data = doc.data.orEmpty()
                    val categories = ((data["talentCategories"] as? List<*>) ?: emptyList<Any?>()) +
                        ((data["promoterTypes"] as? List<*>) ?: emptyList<Any?>())
                    categories.any { it?.toString()?.equals(selectedTalent, ignoreCase = true) == true }
                }
                .map { doc ->
                    val data = doc.data.orEmpty()
                    SimpleProfile(
                        uid = doc.id,
                        name = firstNonBlank(
                            data["brandName"]?.toString(),
                            data["stageName"]?.toString(),
                            data["realName"]?.toString(),
                            data["email"]?.toString(),
                            "Ambassador"
                        ),
                        subtitle = ((data["talentCategories"] as? List<*>) ?: (data["promoterTypes"] as? List<*>) ?: emptyList<Any>())
                            .joinToString(", ") { it.toString() }
                            .ifBlank { "Talent category not listed" },
                        extra = ((data["promotionMediums"] as? List<*>) ?: (data["subFields"] as? List<*>) ?: emptyList<Any>())
                            .joinToString(", ") { it.toString() }
                            .ifBlank { "Promotion mediums not listed" },
                        score = citizenCounts[doc.id] ?: 0
                    )
                }
                .sortedByDescending { it.score }
        }.getOrDefault(emptyList())
        loading = false
    }

    MenuPageFrame(onBack = onBack, dark = true) {
        item { Text("Paragon Ambassadors", color = Color(0xFFC9B48A), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold) }
        item {
            Text("Paragon Ambassadors", style = MaterialTheme.typography.headlineMedium, color = Color.White, fontWeight = FontWeight.ExtraBold)
        }
        item {
            Text("The Talent Ambassadors", color = Color(0xFFF3EFE6), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        item {
            Text(
                "Choose a talent category to see Ambassadors on that line and how many citizens came through each Ambassador.",
                color = Color(0xFFD9D4CA),
                style = MaterialTheme.typography.bodyLarge
            )
        }
        item {
            OutlinedButton(onClick = { showAbout = !showAbout }, shape = RoundedCornerShape(8.dp)) {
                Text(if (showAbout) "Hide About Ambassadors" else "About Ambassadors")
            }
        }
        if (showAbout) {
            item {
                AmbassadorAboutPanel(onJoin = onJoin)
            }
        }
        item {
            Text("Ambassador Talent Categories", color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        items(ambassadorTalents.chunked(2)) { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                rowItems.forEach { talent ->
                    CitizenCategoryCard(
                        modifier = Modifier.weight(1f),
                        emoji = talentEmoji(talent),
                        label = talent,
                        onClick = { selectedTalent = talent }
                    )
                }
                repeat(2 - rowItems.size) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
        selectedTalent?.let { talent ->
            item {
                Text("Ambassadors in $talent", color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            if (loading) {
                item { LoadingBlock(dark = true) }
            } else if (profiles.isEmpty()) {
                item { EmptyCard("No Ambassadors found in this talent category yet.", dark = true) }
            } else {
                itemsIndexed(profiles) { index, profile ->
                    ScoreCard(
                        rank = index + 1,
                        title = profile.name,
                        subtitle = profile.subtitle,
                        detail = profile.extra,
                        scoreLabel = "Citizens",
                        score = profile.score,
                        dark = true
                    )
                }
            }
        }
    }
}

@Composable
fun SponsorInvestorAboutScreen(
    onBack: () -> Unit,
    onJoin: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F3EA))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") } }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("About Sponsors / Investors", style = MaterialTheme.typography.headlineMedium, color = Color(0xFF111827), fontWeight = FontWeight.ExtraBold)
                    Text(
                        "Paragon Planet Sponsors and Investors are individuals, organizations, companies, institutions, brands, and strategic partners who support, finance, promote, invest in, or collaborate with activities, talents, contests, projects, and opportunities within the Paragon Planet ecosystem.",
                        color = Color(0xFF233142)
                    )
                    Text(
                        "Sponsors and Investors play a major role in the growth, visibility, development, empowerment, and expansion of the Planet by supporting Citizens, Superbosses, Ambassadors, Backers, Merchants, events, competitions, digital products, and ecosystem activities.",
                        color = Color(0xFF233142)
                    )

                    Text("Sponsors and Investors may operate within the Platform for purposes such as:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    sponsorInvestorPurposes.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text("Sponsors may support talents, contests, or ecosystem activities in exchange for:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    sponsorExchangeBenefits.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text("Investors may participate in funding opportunities connected to:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    investorFundingAreas.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text("Sponsors and Investors may collaborate directly with:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    sponsorInvestorCollaborators.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text(
                        "The Sponsor and Investor system is designed to create opportunities for financial empowerment, strategic partnerships, business visibility, ecosystem expansion, and sustainable growth within Paragon Planet.",
                        color = Color(0xFF233142)
                    )

                    Text("Sponsors and Investors are expected to:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    sponsorInvestorExpectations.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text(
                        "As Sponsors and Investors participate within the ecosystem, they gain access to broader visibility, strategic influence, partnership opportunities, audience reach, marketplace exposure, promotional advantages, and long-term collaborative benefits within Paragon Planet.",
                        color = Color(0xFF233142)
                    )

                    Button(
                        onClick = onJoin,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Join as Sponsor / Investor")
                    }
                }
            }
        }
    }
}

@Composable
fun AboutParagonPlanetScreen(
    onBack: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F3EA))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") } }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("About Paragon Planet app", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.ExtraBold)
                    Text("A gateway for Stars, creativity, and reasoning.", style = MaterialTheme.typography.headlineMedium, color = Color(0xFF111827), fontWeight = FontWeight.ExtraBold)
                    Text(
                        "The Paragon Planet app serves as a gateway for talented individuals to showcase their skills, participate in creative competitions, engage with audiences, and earn rewards through voting, trading, and digital products.",
                        color = Color(0xFF233142)
                    )
                    Text(
                        "The platform is designed to discover, promote, and develop emerging stars, helping them build the required qualities, visibility, performance strength, and number of Stars needed for the coming of Paragon Planet as it prepares to visit Planet Earth.",
                        color = Color(0xFF233142)
                    )
                }
            }
        }
        item {
            InfoCard(
                title = "ALL STARS GBAZILO",
                paragraphs = listOf(
                    "Paragon Planet is a distinctive realm within the entertainment industry, designed as a creative environment for selected talents, creators, and entertainers to engage in the game known as ALL STARS GBAZILO, meaning ALL STARS COMPETE FOR REASONING.",
                    "The concept emphasizes creativity, reasoning, performance, interaction, talent development, and entertainment excellence."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "The Three Systems",
                paragraphs = listOf(
                    "The platform is structured into three systems: the Citizens, the Backers, and the Superbosses with their respective ambassadors.",
                    "Each of the three systems is organized into twelve categories of participants, with each category representing different talents, skills, professions, and creative abilities. Participants can progress from Single-Talent Holders as Level One Participants to Twelve-Talent Holders, the highest level within the ecosystem, based on their performance, audience engagement, creativity, consistency, discipline, and overall impact within the Paragon Planet ecosystem.",
                    "The top three participants shall automatically be designated as the Royal Figures of the three sectors of the Game: the Paragon Planet Citizens Sector, the Paragon Planet Backers Sector, and the Paragon Planet Superbosses Sector."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "The Ambassadors",
                paragraphs = listOf(
                    "Ambassadors discover, invite, promote, and support talented Citizens across different talent categories while helping them build visibility, followers, recognition, votes, and opportunities within the Planet."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "The Three Feeders",
                paragraphs = listOf(
                    "The Citizens are the Internal Feeders who shall live together within a unique Camp under the Game. The Backers are the External Feeders who shall be assigned to guide, support, and direct their respective Citizens inside the Camp while operating from their designated zones outside the Camp. The Superbosses are the Positional Feeders who shall operate through positions of authority to oversee, supervise, and coordinate the relationship between the Backers and the Citizens from their respective zones outside the Camp."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "The Camp",
                paragraphs = listOf(
                    "The Camp features three Kingdoms corresponding to three Tribes, a religion known as Ethical Talents Show (ETS), various cultures, a governing structure, social activities, and abundant mineral resources across different areas of the Planet, all supported by a unique currency."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "Paragon Citizens",
                paragraphs = listOf(
                    "Citizens are the internal talent contestants of the Planet, competing through creativity, performance, visibility, audience support, discipline, and recognition across multiple talent categories."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "Paragon Planet Backers",
                paragraphs = listOf(
                    "Backers are the external supporters and knowledge-based participants who guide, support, and influence Citizens through reasoning, service fields, questions and answers, and strategic engagement."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "Paragon Planet Superbosses",
                paragraphs = listOf(
                    "Superbosses are the supervisory and positional leaders who coordinate discipline, oversight, strategic control, reasoning standards, and authority structures across the ecosystem."
                ),
                dark = false
            )
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("The ALL STARS GBAZILO GAME", color = Color(0xFF111827), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                    Text(
                        "The ALL STARS GBAZILO GAME operates through a symbolic system of two hundred and forty Fruits, consisting of:",
                        color = Color(0xFF233142)
                    )
                    BulletText("One hundred and twenty edible Fruits", dark = false)
                    BulletText("One hundred and twenty inedible Fruits", dark = false)
                    Text(
                        "These Fruits represent behavioural traits, ethical choices, attitudes, actions, and consequences within Paragon Planet. The entire system is governed through the mathematical relationship structure:",
                        color = Color(0xFF233142)
                    )
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF3EFE6)), shape = RoundedCornerShape(12.dp)) {
                        Text(
                            "(SPECIFIC FORMULA)",
                            color = Color(0xFF101828),
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                    Text("Within this structure:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    BulletText("Virtue Superbosses supervise positive activities, ethical conduct, discipline, growth, wisdom, and constructive influence through the one hundred and twenty edible Fruits.", dark = false)
                    BulletText("Vice Superbosses supervise negative activities, unethical conduct, temptation, conflict, disorder, and destructive influence through the one hundred and twenty inedible Fruits.", dark = false)
                    Text(
                        "Together, both sets of Fruits form one hundred and twenty opposing pairs, arranged sequentially across the one hundred and twenty-day visits of Paragon Planet on Planet Earth. Each opposing pair represents a specific topic, challenge, behaviour, or moral decision assigned to a particular day of the Game.",
                        color = Color(0xFF233142)
                    )
                    Text(
                        "Whenever a Citizen performs an action within the Planet, that action is symbolically connected to one of the Fruits under the authority of the corresponding Superboss for that day.",
                        color = Color(0xFF233142)
                    )
                    BulletText("Ethical actions are regarded as symbolic acts of consuming the edible Fruits under the Virtue Superbosses. These actions positively increase the Citizen's life span, status, rewards, influence, and standing within the Planet.", dark = false)
                    BulletText("Unethical actions are regarded as symbolic acts of consuming the inedible Fruits under the Vice Superbosses. These actions negatively reduce the Citizen's life span, privileges, rankings, rewards, and overall standing within the Planet.", dark = false)
                    Text(
                        "Through this symbolic structure, the ALL STARS GBAZILO GAME is designed to promote discipline, accountability, wisdom, competition, self-control, leadership, and moral decision-making among all participants within the Paragon Planet ecosystem.",
                        color = Color(0xFF233142)
                    )
                }
            }
        }
    }
}

@Composable
fun PrivacyPolicyScreen(
    onBack: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F3EA))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") } }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Privacy Policy", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.ExtraBold)
                    Text("Paragon Planet Privacy Policy", style = MaterialTheme.typography.headlineMedium, color = Color(0xFF111827), fontWeight = FontWeight.ExtraBold)
                    Text(
                        "This Privacy Policy explains how Paragon Planet collects, uses, protects, and shares information when people use our website, app, marketplace, messaging, video, meet-up, wallet, and role registration features.",
                        color = Color(0xFF233142)
                    )
                    Text("Effective date: May 23, 2026", color = Color(0xFF6B5F4B), fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Information We Collect", color = Color(0xFF111827), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                    privacyCollectedData.forEach { item ->
                        BulletText(item, dark = false)
                    }
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("How We Use Information", color = Color(0xFF111827), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                    privacyDataUses.forEach { item ->
                        BulletText(item, dark = false)
                    }
                }
            }
        }
        item {
            InfoCard(
                title = "Payments And Purchases",
                paragraphs = listOf(
                    "Paragon Planet may support payments through approved providers such as Google Billing, Paystack, and other authorized payment systems. Payment providers may collect and process information needed to complete transactions, prevent fraud, verify purchases, manage refunds, and comply with financial rules. Paragon Planet stores only the information needed to verify purchases, unlock products, record wallet activity, and maintain transaction history."
                ),
                dark = false
            )
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("How Information Is Shared", color = Color(0xFF111827), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                    privacySharingRules.forEach { item ->
                        BulletText(item, dark = false)
                    }
                }
            }
        }
        item {
            InfoCard(
                title = "Messages And Public Content",
                paragraphs = listOf(
                    "Some activity on Paragon Planet is public or visible to selected users, including public videos, public profile names, marketplace listings, role information, scores, comments, meet-up request status, and other content you choose to share. Direct messages are intended for the selected conversation participants, but they may be reviewed when needed for safety, abuse reports, fraud prevention, legal compliance, or platform rule enforcement."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "Security",
                paragraphs = listOf(
                    "We use technical and administrative measures to help protect user information, including authentication, database rules, secure backend services, cloud storage controls, and access restrictions. No internet platform can guarantee perfect security, so users should keep login details private and report suspicious activity quickly."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "Children And Young Users",
                paragraphs = listOf(
                    "Paragon Planet is intended for users who meet the required age and consent rules in their country. Where parental or guardian consent is required by law, the user must obtain that consent before using the platform."
                ),
                dark = false
            )
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Your Choices", color = Color(0xFF111827), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                    privacyUserChoices.forEach { item ->
                        BulletText(item, dark = false)
                    }
                }
            }
        }
        item {
            InfoCard(
                title = "Data Retention",
                paragraphs = listOf(
                    "We keep information for as long as needed to provide the service, maintain records, protect users, resolve disputes, enforce rules, verify payments, and comply with legal obligations. Some records may remain after account deletion when required for security, payment, anti-fraud, or legal reasons."
                ),
                dark = false
            )
        }
        item {
            InfoCard(
                title = "Contact",
                paragraphs = listOf(
                    "For privacy questions, data requests, or account support, contact Paragon Planet at natureswaypro2@gmail.com."
                ),
                dark = false
            )
        }
    }
}

@Composable
fun UserAboutDetailScreen(
    onBack: () -> Unit,
    onJoin: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F3EA))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") } }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("About Users", style = MaterialTheme.typography.headlineMedium, color = Color(0xFF111827), fontWeight = FontWeight.ExtraBold)
                    Text(
                        "Paragon Planet Users are the general participants, viewers, supporters, followers, voters, buyers, explorers, and community members within the Paragon Planet ecosystem.",
                        color = Color(0xFF233142)
                    )
                    Text(
                        "Users represent the foundation of the Planet and may participate in different activities, interactions, engagements, and opportunities across the Platform before choosing to evolve into specialized roles such as Citizens, Superbosses, Ambassadors, Backers, Merchants, Sponsors, or Investors.",
                        color = Color(0xFF233142)
                    )

                    Text("Users are allowed to:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    userAllowances.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text("Users may grow into higher levels by qualifying or registering as:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    userRolePaths.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text(
                        "Within the Planet ecosystem, Users contribute to the visibility, growth, engagement, popularity, and expansion of talents, competitions, digital marketplaces, leadership systems, and community activities.",
                        color = Color(0xFF233142)
                    )

                    Text("Users are expected to:", color = Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    userExpectations.forEach { item ->
                        BulletText(text = item, dark = false)
                    }

                    Text(
                        "Through participation, interaction, support, and engagement, Users become part of the evolving digital civilization of Paragon Planet where talents, leadership, knowledge, creativity, business, entertainment, and community systems operate together within one ecosystem.",
                        color = Color(0xFF233142)
                    )
                    Text(
                        "As Users grow within the Platform, they unlock greater visibility, opportunities, rewards, influence, participation levels, and access to broader activities within the Planet ecosystem.",
                        color = Color(0xFF233142)
                    )

                    Button(
                        onClick = onJoin,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Join Users")
                    }
                }
            }
        }
    }
}

@Composable
private fun ServiceDirectoryScreen(
    onBack: () -> Unit,
    onJoin: () -> Unit,
    title: String,
    eyebrow: String,
    aboutTitle: String,
    aboutParagraphs: List<String>,
    collectionName: String,
    fieldPrompt: String,
    roleLabel: String,
    filterFields: (Map<String, Any?>) -> List<String>,
    scoreValue: (Map<String, Any?>) -> Int,
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    var selectedField by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var profiles by remember { mutableStateOf<List<SimpleProfile>>(emptyList()) }

    LaunchedEffect(selectedField) {
        if (selectedField.isNullOrBlank()) {
            profiles = emptyList()
            return@LaunchedEffect
        }
        loading = true
        profiles = runCatching {
            firestore.collection(collectionName).get().await().documents
                .filter { doc ->
                    filterFields(doc.data.orEmpty()).any { it.equals(selectedField, ignoreCase = true) }
                }
                .map { doc ->
                    val data = doc.data.orEmpty()
                    SimpleProfile(
                        uid = doc.id,
                        name = firstNonBlank(
                            data["stageName"]?.toString(),
                            data["realName"]?.toString(),
                            data["brandName"]?.toString(),
                            data["fullName"]?.toString(),
                            data["companyName"]?.toString(),
                            data["name"]?.toString(),
                            data["email"]?.toString(),
                            roleLabel
                        ),
                        subtitle = firstNonBlank(
                            data["profession"]?.toString(),
                            data["businessName"]?.toString(),
                            data["country"]?.toString(),
                            roleLabel
                        ),
                        extra = filterFields(data).joinToString(", ").ifBlank { "Field not listed" },
                        score = scoreValue(data)
                    )
                }
                .sortedByDescending { it.score }
        }.getOrDefault(emptyList())
        loading = false
    }

    MenuPageFrame(onBack = onBack, dark = true) {
        if (eyebrow.isNotBlank()) {
            item { Text(eyebrow, color = Color(0xFFC9B48A), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold) }
        }
        item {
            Text(title, style = MaterialTheme.typography.headlineMedium, color = Color.White, fontWeight = FontWeight.ExtraBold)
        }
        item {
            InfoCard(
                aboutTitle,
                aboutParagraphs,
                dark = true,
                actionLabel = "Join ${roleLabel}s",
                onAction = onJoin
            )
        }
        item {
            Text(fieldPrompt, color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        items(serviceFields) { field ->
            SelectCard(title = field, subtitle = "Open $roleLabel results in this field", dark = true) {
                selectedField = field
            }
        }
        selectedField?.let { field ->
            item {
                Text("$roleLabel${if (profiles.size == 1) "" else "s"} in $field", color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            if (loading) {
                item { LoadingBlock(dark = true) }
            } else if (profiles.isEmpty()) {
                item { EmptyCard("No $roleLabel found in this field yet.", dark = true) }
            } else {
                itemsIndexed(profiles) { index, profile ->
                    ScoreCard(
                        rank = index + 1,
                        title = profile.name,
                        subtitle = profile.subtitle,
                        detail = profile.extra,
                        scoreLabel = "Score",
                        score = profile.score,
                        dark = true
                    )
                }
            }
        }
    }
}

@Composable
private fun CitizenAboutPanel(
    onJoin: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF161616)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Paragon Citizens", color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
            Text(
                "Contestants for Paragon Citizens are talented individuals with one or multiple entertainment talents and creative abilities competing across various categories, including Cultural Performance, Special Talent, Dance, Instrumental Performance, Modeling, Culinary Arts, Stunt Performance, Singing, Debating, Comedy, Art & Design, and Drama.",
                color = Color(0xFFD9D4CA)
            )
            Text("Contestants Are Expected To:", color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            citizenExpectations.forEach { item ->
                BulletText(text = item, dark = true)
            }
            Text(
                "Contestants who actively perform within a single verified talent category may qualify for Level One Status and receive a unique Planet Identity Colour. Participants may progress from Single Talent (Level 1) to Double Talents (Level 2), Triple Talents (Level 3), and ultimately to Multiple Talents across higher Planet Levels.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Qualified contestants earn the opportunity to participate in the ALL STARS GBAZILO GAME as the Official Citizens of the Planet.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "The first three contestants who successfully perform across all twelve verified talent categories and receive the highest verified votes shall automatically qualify for the Royal Positions of Kings or Queens upon officially entering the Planet.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "These Citizens are known as the Internal Feeders of the Planet and operate under the symbolic system of Two Hundred and Forty Fruits consisting of:",
                color = Color(0xFFD9D4CA)
            )
            citizenFruits.forEach { item ->
                BulletText(text = item, dark = true)
            }
            Text(
                "Within the Game, the actions, behaviors, attitudes, performances, decisions, and activities of Citizens are symbolically connected to these Fruits, which influence their rankings, rewards, privileges, reputation, life span, discipline level, and overall standing within the Paragon Planet ecosystem.",
                color = Color(0xFFD9D4CA)
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3EFE6)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    "Paragon Planet transforms talented individuals into recognized Stars through visibility, growth, competition, creativity, promotion, audience support, discipline, and recognition.",
                    color = Color(0xFF101828),
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(16.dp)
                )
            }
            Text(
                "As contestants gain votes, recognition, performance scores, and public support, they unlock greater visibility, stronger rankings, unique identity colors, rewards, higher influence, and greater positions within the Planet.",
                color = Color(0xFFD9D4CA)
            )
            Button(
                onClick = onJoin,
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Join The Citizen Contestants")
            }
        }
    }
}

@Composable
private fun SuperbossAboutPanel(
    onJoin: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF161616)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Paragon Planet Superbosses", color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
            Text(
                "Candidates for Paragon Planet Superbosses are selected from recommended Teachers, Tutors, Lecturers, Trainers, Mentors, and Instructors by their students, tutees, trainees, and followers across various fields of study and sectors of society, including Health, Environment, Education, Enterprise, Entertainment, Finance, Security, Media, Law, Technology, Governance, and Religion.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "The recommendation process is based on their outstanding works, reasoning capacity, professional knowledge, wisdom, leadership ability, discipline, mentorship qualities, and positive social impact on those they have trained, guided, and mentored within their respective sectors as a mark of appreciation, recognition, and honor from their students, tutees, trainees, and followers.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Superbosses compete to earn scores, recognition, influence, authority, and rewards through verified Questions & Answers systems, strategic activities, reasoning exercises, and leadership evaluations designed to examine their:",
                color = Color(0xFFD9D4CA)
            )
            superbossAssessmentPoints.forEach { item ->
                BulletText(text = item, dark = true)
            }
            Text(
                "The qualification process is designed to identify individuals who meet the required standards to become Official Superbosses of Paragon Planet.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Unlike ordinary contestants, Superbosses represent higher levels of authority, guidance, intelligence, discipline, supervision, strategic coordination, and excellence control within the Paragon Planet ecosystem.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Candidates who actively participate within a single verified field may qualify for Level One Status and receive a unique Planet Identity Colour. Participants may progress from Single Field (Level 1) to Double Fields (Level 2), Triple Fields (Level 3), and ultimately to Multiple Fields across higher Planet Levels based on their qualifications, activities, and verified performances.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "The first three candidates who successfully and actively participate across all twelve verified fields shall automatically qualify for the position of Superboss Generals of the Game and shall oversee the order, discipline, coordination, and strategic supervision of the Game.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Superbosses shall operate from their respective zones outside the Planet to supervise, guide, influence, and coordinate the activities of Citizens within the Planet. They also serve as strategic channels through which messages, instructions, support systems, disciplinary structures, and coordinated interactions from the Backers outside the Planet are directed into the activities of the Citizens during the ALL STARS GBAZILO GAME.",
                color = Color(0xFFD9D4CA)
            )
            Text("Virtue Superbosses and Vice Superbosses", color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "The Superbosses are divided into two symbolic governing structures known as the Virtue Superbosses and the Vice Superbosses.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "The Virtue Superbosses supervise positive activities, ethical conduct, discipline, wisdom, growth, responsibility, development, and constructive influence through the One Hundred and Twenty Edible Fruits.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "The Vice Superbosses supervise negative activities, unethical conduct, temptation, manipulation, conflict, disorder, corruption, and destructive influence through the One Hundred and Twenty Inedible Fruits.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "The ALL STARS GBAZILO GAME operates through a symbolic system of Two Hundred and Forty Fruits consisting of One Hundred and Twenty Edible Fruits and One Hundred and Twenty Inedible Fruits.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Together, both sets of Fruits form One Hundred and Twenty opposing pairs arranged sequentially across the One Hundred and Twenty-Day Visits of Paragon Planet on Planet Earth. Each pair of Fruits stands against one another on a specific topic, challenge, behavior, moral decision, or life situation assigned to a particular day within the Game.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "These Fruits symbolically represent behavioral traits, ethical choices, attitudes, actions, consequences, strengths, weaknesses, virtues, and vices within the Planet ecosystem. The system operates through the symbolic mathematical relationship structure:",
                color = Color(0xFFD9D4CA)
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3EFE6)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    "(SPECIFIC FORMULA)",
                    color = Color(0xFF101828),
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(16.dp)
                )
            }
            Text(
                "Whenever a Citizen acts within the Planet, such actions are symbolically connected to one of the Fruits operating under the authority and supervision of the corresponding Superbosses assigned for that particular day.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Ethical actions are regarded as symbolic acts of eating the Edible Fruits under the Virtue Superbosses, which positively increase the Citizen's life span, status, rewards, privileges, ranking, influence, and standing within the Planet.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Unethical actions are regarded as symbolic acts of eating the Inedible Fruits under the Vice Superbosses, which negatively reduce the Citizen's life span, privileges, rewards, ranking, reputation, influence, and standing within the Planet.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Through this symbolic structure, the ALL STARS GBAZILO GAME combines reasoning, morality, discipline, leadership, entertainment, strategy, and social behavior into a unified ecosystem designed to evaluate both talent and character within Paragon Planet.",
                color = Color(0xFFD9D4CA)
            )
            Button(
                onClick = onJoin,
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Join Superboss Candidates")
            }
        }
    }
}

@Composable
private fun BackerAboutPanel(
    onJoin: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF161616)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Paragon Planet Backers", color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
            Text(
                "Contestants for Paragon Planet Backers are selected from individuals, professionals, and service providers operating within sectors such as Health, Environment, Education, Enterprise, Entertainment, Finance, Security, Media, Law, Technology, Governance, and Religion.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "These contestants compete to earn scores, rewards, and qualification marks through Questions & Answers, reasoning activities, analytical challenges, engagement tasks, and knowledge-based participation across the twelve service fields in order to become Official Backers of Paragon Planet.",
                color = Color(0xFFD9D4CA)
            )
            Text("The Qualification Process Is Based On:", color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            backerQualificationPoints.forEach { item ->
                BulletText(text = item, dark = true)
            }
            Text(
                "Contestants who actively participate in a single verified field may qualify for Level 1 Status and receive a unique Planet Identity Color. Participants may progress from Single Field (Level 1) to Double Fields (Level 2), Triple Fields (Level 3), and ultimately to Multiple Fields at higher Planet Levels based on their consistency, performance, engagement, and qualification scores.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Qualified contestants earn the opportunity to participate in the Game of ALL STARS GBAZILO as the External Feeders to the Planet, operating within their respective zones outside the Planet to guide, support, influence, and indirectly communicate with their respective Citizens inside the Camp.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "As External Feeders to the Planet, Official Backers help strengthen the activities, development, performance, visibility, and strategic growth of Contestants and Citizens participating in ALL STARS GBAZILO, while also earning rewards, recognition, and benefits through the platform's engagement structure.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "The first three contestants who successfully participate across all twelve verified service fields and achieve the highest qualification marks shall automatically qualify as the Royal Backers to the Kings or Queens at the commencement of the Game.",
                color = Color(0xFFD9D4CA)
            )
            Button(
                onClick = onJoin,
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Join The Backer Contestants")
            }
        }
    }
}

@Composable
private fun AmbassadorAboutPanel(
    onJoin: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF161616)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("About Ambassadors", color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
            Text(
                "Paragon Planet Ambassadors are promotional Stars, talent scouts, artist managers, MCs, presenters, media personalities, entertainment promoters, influencers, and talent representatives who discover, invite, support, and promote talented Stars into the Paragon Planet ecosystem through their unique invitation links.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Ambassadors serve as important promotional forces within the Planet by helping talented individuals gain visibility, audience engagement, recognition, and opportunities within the ecosystem.",
                color = Color(0xFFD9D4CA)
            )
            Text("As an Ambassador, Your Mission Is To:", color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            ambassadorMissionPoints.forEach { item ->
                BulletText(text = item, dark = true)
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3EFE6)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    "When a Citizen joins through an Ambassador's invitation link, the Ambassador becomes connected to that Citizen within the platform's promotional structure. Based on the platform's reward system, Ambassadors earn commission rewards from the votes and engagement activities generated by their invited Citizens.",
                    color = Color(0xFF101828),
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(16.dp)
                )
            }
            Text(
                "Ambassadors play a major role in expanding the Planet by connecting hidden talents to contests, promotions, audience visibility, sponsorship opportunities, entertainment exposure, and recognition within the Paragon Planet ecosystem.",
                color = Color(0xFFD9D4CA)
            )
            Text(
                "Outstanding Ambassadors who successfully build, manage, and promote high-performing Citizens across multiple categories may qualify for higher Planet Levels, special recognition statuses, exclusive rewards, and leadership opportunities within the Game of ALL STARS GBAZILO.",
                color = Color(0xFFD9D4CA)
            )
            Button(
                onClick = onJoin,
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Join The Paragon Ambassadors")
            }
        }
    }
}

@Composable
private fun CitizenCategoryCard(
    modifier: Modifier = Modifier,
    emoji: String,
    label: String,
    onClick: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF111111)),
        shape = RoundedCornerShape(12.dp),
        onClick = onClick,
        modifier = modifier.height(96.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(10.dp),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(emoji, style = MaterialTheme.typography.headlineSmall)
            Text(
                text = label,
                color = Color.White,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun ArticleScreen(
    onBack: () -> Unit,
    title: String,
    sections: List<String>,
    eyebrow: String = "",
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F3EA))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") } }
        if (eyebrow.isNotBlank()) {
            item { Text(eyebrow, color = Color(0xFF6B5F4B), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold) }
        }
        item { Text(title, style = MaterialTheme.typography.headlineMedium, color = Color(0xFF102033), fontWeight = FontWeight.ExtraBold) }
        items(sections) { paragraph ->
            InfoCard(title = null, paragraphs = listOf(paragraph), dark = false)
        }
        if (actionLabel != null && onAction != null) {
            item {
                Button(onClick = onAction, shape = RoundedCornerShape(999.dp)) { Text(actionLabel) }
            }
        }
    }
}

@Composable
private fun MenuPageFrame(
    onBack: () -> Unit,
    dark: Boolean,
    content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(if (dark) Color.Black else Color(0xFFF7F3EA))
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = {
            item { Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") } }
            content()
        }
    )
}

@Composable
private fun InfoCard(
    title: String?,
    paragraphs: List<String>,
    dark: Boolean,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = if (dark) Color(0xFF111111) else Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (!title.isNullOrBlank()) {
                Text(title, color = if (dark) Color.White else Color(0xFF111827), fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
            }
            paragraphs.forEach { paragraph ->
                Text(paragraph, color = if (dark) Color(0xFFD9D4CA) else Color(0xFF233142))
            }
            if (actionLabel != null && onAction != null) {
                OutlinedButton(onClick = onAction, shape = RoundedCornerShape(999.dp)) { Text(actionLabel) }
            }
        }
    }
}

@Composable
private fun SelectCard(
    title: String,
    subtitle: String,
    dark: Boolean,
    onClick: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = if (dark) Color(0xFF111111) else Color.White),
        shape = RoundedCornerShape(12.dp),
        onClick = onClick
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, color = if (dark) Color.White else Color(0xFF111827), fontWeight = FontWeight.Bold)
            Text(subtitle, color = if (dark) Color(0xFFD9D4CA) else Color(0xFF6B7280), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun ScoreCard(
    rank: Int,
    title: String,
    subtitle: String,
    detail: String,
    scoreLabel: String,
    score: Int,
    dark: Boolean,
) {
    Card(colors = CardDefaults.cardColors(containerColor = if (dark) Color(0xFF111111) else Color.White), shape = RoundedCornerShape(14.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("#$rank", color = if (dark) Color(0xFFC9B48A) else Color(0xFF6B5F4B), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                Text(title, color = if (dark) Color.White else Color(0xFF111827), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(subtitle, color = if (dark) Color(0xFFD9D4CA) else Color(0xFF6B7280), style = MaterialTheme.typography.bodyMedium)
                Text(detail, color = if (dark) Color(0xFFF3EFE6) else Color(0xFF233142), style = MaterialTheme.typography.bodySmall)
            }
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF3EFE6)), shape = RoundedCornerShape(12.dp)) {
                Column(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(scoreLabel, color = Color(0xFF101828), style = MaterialTheme.typography.labelSmall)
                    Text(score.toString(), color = Color(0xFF101828), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                }
            }
        }
    }
}

@Composable
private fun LoadingBlock(dark: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = if (dark) Color(0xFFC9B48A) else Color(0xFF111827))
    }
}

@Composable
private fun EmptyCard(text: String, dark: Boolean) {
    InfoCard(title = null, paragraphs = listOf(text), dark = dark)
}

@Composable
private fun BulletText(
    text: String,
    dark: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text("•", color = if (dark) Color(0xFFF3EFE6) else Color(0xFF233142))
        Text(
            text = text,
            color = if (dark) Color(0xFFF3EFE6) else Color(0xFF233142),
            modifier = Modifier.weight(1f)
        )
    }
}

private fun collectServiceFields(data: Map<String, Any?>): List<String> {
    val labels = mutableListOf<String>()
    (data["serviceCategoryLabels"] as? List<*>)?.forEach { if (!it.toString().isBlank()) labels += it.toString() }
    (data["serviceFields"] as? List<*>)?.forEach { if (!it.toString().isBlank()) labels += it.toString() }
    (data["knowledgeFields"] as? List<*>)?.forEach { if (!it.toString().isBlank()) labels += it.toString() }
    (data["serviceCategories"] as? List<*>)?.forEach { entry ->
        when (entry) {
            is String -> if (entry.isNotBlank()) labels += entry
            is Map<*, *> -> {
                val field = entry["field"]?.toString().orEmpty()
                val category = entry["category"]?.toString().orEmpty()
                if (field.isNotBlank()) labels += field
                if (category.isNotBlank()) labels += category
            }
        }
    }
    return labels.distinct()
}

private fun extractInt(data: Map<String, Any?>, vararg keys: String): Int {
    return keys.firstNotNullOfOrNull { key ->
        when (val value = data[key]) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
    } ?: 0
}

private fun firstNonBlank(vararg values: String?): String {
    return values.firstOrNull { !it.isNullOrBlank() } ?: ""
}

private fun talentEmoji(talent: String): String {
    return when (talent) {
        "Cultural Performer" -> "🌍"
        "Special Talent" -> "⭐"
        "Dancer" -> "💃"
        "Instrumentalist" -> "🎹"
        "Model" -> "👗"
        "Foodier" -> "🍔"
        "Stunt Performer" -> "🤸"
        "Singer" -> "🎤"
        "Debater" -> "🧠"
        "Comedian" -> "😂"
        "Artist & Designer" -> "🎨"
        "Actor" -> "🎭"
        else -> "⭐"
    }
}
