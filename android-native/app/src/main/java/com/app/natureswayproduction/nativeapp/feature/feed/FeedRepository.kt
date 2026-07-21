package com.app.natureswayproduction.nativeapp.feature.feed

import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FeedRepository(
    private val apiService: ParagonApiService = ParagonApiService(),
    private val appCheckRepository: AppCheckRepository = AppCheckRepository(),
) {
    suspend fun loadFeed(): FeedPayload = withContext(Dispatchers.IO) {
        val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
        val videos = apiService.fetchFeed(appCheckToken = appCheckToken)
            .filter { it.isCitizenHomeFeedVideo() }
        val categories = videos.map { it.category }.distinct().ifEmpty {
            listOf("Cultural Performers", "Singers", "Dancers", "Comedians", "MCs")
        }
        val cards = videos.map {
            FeedCard(
                id = it.id,
                creatorUid = it.creatorUid,
                title = it.title,
                performer = it.performerName,
                category = it.category,
                description = it.description,
                supportCount = it.supportCount,
                commentCount = it.commentCount,
                viewCount = it.viewCount,
                pourCount = it.pourCount,
                sprayCount = it.sprayCount,
                bottleCount = it.bottleCount,
                thumbnailUrl = it.thumbnailUrl,
                streamUrl = it.streamUrl,
                mobileUrl = it.mobileUrl,
                desktopUrl = it.desktopUrl,
                originalUrl = it.originalUrl,
                fileUrl = it.fileUrl,
                objectPath = it.objectPath,
            )
        }
        FeedPayload(
            summary = if (cards.isEmpty()) {
                "Feed API responded, but no active videos were returned yet."
            } else {
                "Loaded ${cards.size} live feed item(s) from /api/video/list."
            },
            categories = categories,
            items = cards,
        )
    }
}

private fun com.app.natureswayproduction.nativeapp.data.api.VideoSummary.isCitizenHomeFeedVideo(): Boolean {
    val productCategories = setOf(
        "ebooks",
        "notion_templates",
        "canva_templates",
        "printables",
        "mini_courses",
        "presets_filters",
        "swipe_files",
        "toolkits_bundles",
        "digital_wallpapers",
        "video_products",
        "audio_products",
    )
    val purpose = uploadPurpose.lowercase()
    val currentVisibility = visibility.lowercase()
    val currentSource = source.lowercase()
    val currentCategory = category.lowercase()
    val currentObjectPath = objectPath.orEmpty().lowercase()

    if (purpose == "meet_up_video" || purpose == "merchant_product") return false
    if (currentVisibility == "meet_up" || currentVisibility == "marketplace") return false
    if (currentSource == "admin_meetup_area_upload" || currentSource.contains("merchant")) return false
    if (productCategories.contains(currentCategory)) return false
    if (currentObjectPath.contains("merchant-")) return false
    return true
}

data class FeedPayload(
    val summary: String,
    val categories: List<String>,
    val items: List<FeedCard>,
)
