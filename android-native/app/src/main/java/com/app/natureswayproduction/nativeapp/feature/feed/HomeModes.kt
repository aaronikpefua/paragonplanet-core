package com.app.natureswayproduction.nativeapp.feature.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold

enum class HomeMode(val label: String, val icon: String) {
    SPOTLIGHT("Spotlight", "⌂"),
    EXPLORE("Explore", "🧭"),
    GRID("Grid", "▦"),
    DISCOVER("Discover", "✦"),
}

private val browseModes = listOf(HomeMode.EXPLORE, HomeMode.GRID, HomeMode.DISCOVER)

private enum class RankingMode(val label: String) {
    LATEST("Latest"),
    TRENDING("Trending"),
    HIGHEST_VOTES("Highest Votes"),
    HOT("Hot"),
}

private val talentFilters = listOf(
    "Dancers",
    "Instrumentalists",
    "Models",
    "Foodies",
    "Stuntpersons",
    "Singers",
    "Debaters",
    "Comedians",
    "Artists",
    "Dramatizers",
    "Special Abilities",
    "Cultural Performers",
)

@Composable
fun HomeModeSelector(
    selectedMode: HomeMode,
    onModeSelected: (HomeMode) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 6.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        browseModes.forEach { mode ->
            val selected = mode == selectedMode
            Surface(
                color = if (selected) ParagonGold else Color.Transparent,
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier.clickable { onModeSelected(mode) }
            ) {
                Text(
                    text = "${mode.icon} ${mode.label}",
                    color = if (selected) Color.Black else Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp)
                )
            }
        }
    }
}

@Composable
fun HomeModeContent(
    mode: HomeMode,
    items: List<FeedCard>,
    onOpenInSpotlight: (FeedCard) -> Unit,
    modifier: Modifier = Modifier,
) {
    when (mode) {
        HomeMode.EXPLORE -> ExploreHome(items, onOpenInSpotlight, modifier)
        HomeMode.GRID -> GridHome(items, onOpenInSpotlight, modifier)
        HomeMode.DISCOVER -> DiscoverHome(items, onOpenInSpotlight, modifier)
        HomeMode.SPOTLIGHT -> Unit
    }
}

@Composable
private fun ExploreHome(
    items: List<FeedCard>,
    onOpenInSpotlight: (FeedCard) -> Unit,
    modifier: Modifier = Modifier,
) {
    var selectedTalent by remember { mutableStateOf(talentFilters.first()) }
    val talentItems = remember(items, selectedTalent) {
        items.filterByTalent(selectedTalent).distinctBy { it.id }
    }
    LazyColumn(
        modifier = modifier
            .background(Color.Black)
            .padding(top = 116.dp),
        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            TalentCategorySelector(
                selectedTalent = selectedTalent,
                talents = talentFilters,
                includeAll = false,
                onTalentSelected = { selectedTalent = it }
            )
        }
        item {
            Text(
                text = selectedTalent,
                color = Color.White,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold
            )
        }
        RankingMode.entries.forEach { ranking ->
            item {
                RankingSection(
                    title = ranking.label,
                    items = talentItems.rankFor(ranking).take(6),
                    onOpenInSpotlight = onOpenInSpotlight
                )
            }
        }
    }
}

@Composable
private fun GridHome(
    items: List<FeedCard>,
    onOpenInSpotlight: (FeedCard) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = modifier
            .background(Color.Black)
            .padding(top = 116.dp),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 92.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(items.distinctBy { it.id }, key = { it.id }) { item ->
            VideoDiscoveryCard(
                item = item,
                compact = false,
                onClick = { onOpenInSpotlight(item) }
            )
        }
    }
}

@Composable
private fun DiscoverHome(
    items: List<FeedCard>,
    onOpenInSpotlight: (FeedCard) -> Unit,
    modifier: Modifier = Modifier,
) {
    var ranking by remember { mutableStateOf(RankingMode.LATEST) }
    var selectedTalent by remember { mutableStateOf("All") }
    val filteredItems = remember(items, selectedTalent, ranking) {
        val source = if (selectedTalent == "All") items else items.filterByTalent(selectedTalent)
        source.distinctBy { it.id }.rankFor(ranking)
    }
    Column(
        modifier = modifier
            .background(Color.Black)
            .padding(top = 116.dp)
    ) {
        RankingTabs(selectedRanking = ranking, onRankingSelected = { ranking = it })
        TalentCategorySelector(
            selectedTalent = selectedTalent,
            talents = talentFilters,
            includeAll = true,
            onTalentSelected = { selectedTalent = it }
        )
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 10.dp, end = 10.dp, top = 12.dp, bottom = 92.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(filteredItems, key = { it.id }) { item ->
                VideoDiscoveryCard(
                    item = item,
                    compact = true,
                    onClick = { onOpenInSpotlight(item) }
                )
            }
        }
    }
}

@Composable
private fun RankingTabs(
    selectedRanking: RankingMode,
    onRankingSelected: (RankingMode) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        RankingMode.entries.forEach { ranking ->
            FilterPill(
                label = ranking.label,
                selected = ranking == selectedRanking,
                onClick = { onRankingSelected(ranking) }
            )
        }
    }
}

@Composable
private fun TalentCategorySelector(
    selectedTalent: String,
    talents: List<String>,
    includeAll: Boolean,
    onTalentSelected: (String) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (includeAll) {
            FilterPill("All", selectedTalent == "All", onClick = { onTalentSelected("All") })
        }
        talents.forEach { talent ->
            FilterPill(talent, selectedTalent == talent, onClick = { onTalentSelected(talent) })
        }
    }
}

@Composable
private fun RankingSection(
    title: String,
    items: List<FeedCard>,
    onOpenInSpotlight: (FeedCard) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            text = title.uppercase(),
            color = ParagonGold,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.ExtraBold
        )
        if (items.isEmpty()) {
            EmptyDiscoveryMessage("No videos in this section yet.")
        } else {
            items.chunked(2).forEach { rowItems ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    rowItems.forEach { item ->
                        VideoDiscoveryCard(
                            item = item,
                            compact = false,
                            onClick = { onOpenInSpotlight(item) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    repeat(2 - rowItems.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun VideoDiscoveryCard(
    item: FeedCard,
    compact: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF101010)),
        shape = RoundedCornerShape(if (compact) 12.dp else 18.dp),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(if (compact) 132.dp else 188.dp)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF1F2937), Color(0xFF050505))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (!item.thumbnailUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = item.thumbnailUrl,
                        contentDescription = item.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(if (compact) 12.dp else 18.dp))
                    )
                } else {
                    Text("▶", color = Color.White, fontSize = if (compact) 22.sp else 30.sp)
                }
            }
            Column(
                modifier = Modifier.padding(if (compact) 7.dp else 10.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = item.title,
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = if (compact) 1 else 2,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = if (compact) 11.sp else 14.sp,
                )
                Text(
                    text = item.performer,
                    color = Color(0xFFE7D9BA),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = if (compact) 10.sp else 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = item.category,
                    color = Color(0xFFB8B8B8),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = if (compact) 9.sp else 11.sp,
                )
                Text(
                    text = "${item.supportCount} votes • ${item.viewCount} views",
                    color = ParagonGold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = if (compact) 9.sp else 11.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun FilterPill(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        color = if (selected) ParagonGold else Color(0xFF111827),
        shape = RoundedCornerShape(999.dp),
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Text(
            text = label,
            color = if (selected) Color.Black else Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}

@Composable
private fun EmptyDiscoveryMessage(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF101010), RoundedCornerShape(14.dp))
            .padding(18.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(message, color = Color(0xFFB8B8B8), fontWeight = FontWeight.Medium)
    }
}

private fun List<FeedCard>.filterByTalent(talent: String): List<FeedCard> {
    val normalizedTalent = normalizeTalent(talent)
    return filter { normalizeTalent(it.category) == normalizedTalent }
}

private fun List<FeedCard>.rankFor(mode: RankingMode): List<FeedCard> {
    return when (mode) {
        RankingMode.LATEST -> this
        RankingMode.TRENDING -> sortedWith(
            compareByDescending<FeedCard> { (it.supportCount * 5.0) + (it.commentCount * 2.0) + (it.viewCount * 0.2) + (supportActionCount(it) * 3.0) }
                .thenByDescending { it.supportCount }
        )
        RankingMode.HIGHEST_VOTES -> sortedWith(
            compareByDescending<FeedCard> { it.supportCount }
                .thenByDescending { it.viewCount }
        )
        RankingMode.HOT -> sortedWith(
            compareByDescending<FeedCard> { (it.supportCount * 8.0) + (it.commentCount * 3.0) + (it.viewCount * 0.3) + (supportActionCount(it) * 4.0) }
                .thenByDescending { it.commentCount }
        )
    }
}

private fun supportActionCount(item: FeedCard): Int {
    return item.pourCount + item.sprayCount + item.bottleCount
}

private fun normalizeTalent(value: String): String {
    return when (value.trim().lowercase()) {
        "dancers", "dancer" -> "dancer"
        "instrumentalists", "instrumentalist" -> "instrumentalist"
        "models", "model" -> "model"
        "foodies", "foodier", "nutritionist" -> "foodier"
        "stuntpersons", "stunt performer", "stuntperformers" -> "stunt performer"
        "singers", "singer" -> "singer"
        "debaters", "debater" -> "debater"
        "comedians", "comedian" -> "comedian"
        "artists", "artist", "artist & designer" -> "artist"
        "dramatizers", "dramatizer", "actor" -> "dramatizer"
        "special abilities", "special ability", "abilities (disability)" -> "special ability"
        "cultural performers", "cultural performer" -> "cultural performer"
        else -> value.trim().lowercase()
    }
}
