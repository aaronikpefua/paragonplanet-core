package com.app.natureswayproduction.nativeapp.feature.watch

import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import com.app.natureswayproduction.nativeapp.feature.feed.FeedCard
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

data class WatchMember(
    val uid: String,
    val role: String,
    val displayName: String,
    val email: String,
    val subtitle: String,
)

data class WatchMeetUpRequest(
    val id: String,
    val status: String,
    val otherUserId: String,
    val otherUserName: String,
    val directionLabel: String,
    val areaIcon: String,
    val areaTitle: String,
    val mealMode: String,
    val experienceLevel: String,
)

data class WatchPanelPayload(
    val members: List<WatchMember>,
    val requests: List<WatchMeetUpRequest>,
)

data class VideoCommentItem(
    val id: String,
    val userName: String,
    val text: String,
)

class WatchActionRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val sessionRepository: SessionRepository = SessionRepository(),
    private val apiService: ParagonApiService = ParagonApiService(),
    private val appCheckRepository: AppCheckRepository = AppCheckRepository(),
) {
    suspend fun isSaved(userUid: String, videoId: String): Boolean {
        return firestore.collection("saved_videos").document("${userUid}_$videoId").get().await().exists()
    }

    suspend fun toggleSaved(userUid: String, video: FeedCard): Boolean {
        val saveRef = firestore.collection("saved_videos").document("${userUid}_${video.id}")
        val existing = saveRef.get().await().exists()
        if (existing) {
            saveRef.delete().await()
            return false
        }

        saveRef.set(
            mapOf(
                "videoId" to video.id,
                "uid" to userUid,
                "creatorId" to (video.creatorUid ?: ""),
                "title" to video.title,
                "thumbnailUrl" to (video.thumbnailUrl ?: ""),
                "streamUrl" to (video.streamUrl ?: video.mobileUrl ?: video.desktopUrl ?: video.originalUrl ?: video.fileUrl ?: ""),
            )
        ).await()
        return true
    }

    suspend fun isFollowing(viewerUid: String, creatorUid: String): Boolean {
        return firestore.collection("creator_follows").document("${viewerUid}_$creatorUid").get().await().exists()
    }

    suspend fun toggleFollow(viewerUid: String, target: WatchMember): Boolean {
        val followRef = firestore.collection("creator_follows").document("${viewerUid}_${target.uid}")
        val existing = followRef.get().await().exists()
        if (existing) {
            followRef.delete().await()
            return false
        }

        followRef.set(
            mapOf(
                "creatorId" to target.uid,
                "creatorName" to target.displayName,
                "creatorRole" to target.role,
                "followerId" to viewerUid,
            )
        ).await()
        return true
    }

    suspend fun sendVote(video: FeedCard) {
        sendSupport(video.id, "vote")
    }

    suspend fun sendSpraySupport(video: FeedCard) {
        sendSupport(video.id, "pour_me_water")
    }

    suspend fun sendSprayMoney(video: FeedCard, customParagAmount: Int = 0, customGbaziloAmount: Int = 0) {
        sendSupport(video.id, "spray_money", customParagAmount, customGbaziloAmount)
    }

    suspend fun sendBottleSupport(video: FeedCard, actionKey: String) {
        sendSupport(video.id, actionKey)
    }

    suspend fun loadComments(videoId: String): List<VideoCommentItem> {
        return firestore.collection("video_comments")
            .whereEqualTo("videoId", videoId)
            .get()
            .await()
            .documents
            .map { docSnap ->
                val data = docSnap.data.orEmpty()
                VideoCommentItem(
                    id = docSnap.id,
                    userName = data["userName"]?.toString().orEmpty().ifBlank { "Paragon User" },
                    text = data["text"]?.toString().orEmpty()
                )
            }
    }

    suspend fun addComment(video: FeedCard, text: String) {
        val user = sessionRepository.loadSessionSummary()
        val userUid = user.uid ?: throw IllegalStateException("Login first")
        val userName = user.email?.substringBefore("@")?.takeIf { it.isNotBlank() } ?: "Paragon User"
        firestore.collection("video_comments").add(
            mapOf(
                "videoId" to video.id,
                "userId" to userUid,
                "userName" to userName,
                "text" to text.trim(),
            )
        ).await()
    }

    suspend fun loadPanel(currentUid: String?): WatchPanelPayload = coroutineScope {
        val membersDeferred = async { loadFollowDirectory(currentUid) }
        val requestsDeferred = async { loadMeetUpDirectory(currentUid) }
        WatchPanelPayload(
            members = membersDeferred.await(),
            requests = requestsDeferred.await()
        )
    }

    private suspend fun loadFollowDirectory(currentUid: String?): List<WatchMember> {
        val sources = listOf(
            "citizen_profiles" to "Citizen",
            "promoter_profiles" to "Ambassador",
            "merchant_profiles" to "Merchant",
            "user_profiles" to "User",
            "backer_profiles" to "Backer",
            "supernal_profiles" to "Superboss",
            "sponsor_investor_profiles" to "Sponsor / Investor",
            "sponsor_profiles" to "Sponsor / Investor",
            "public_profiles" to "",
        )

        val peopleMap = linkedMapOf<String, WatchMember>()
        sources.forEach { (collectionName, role) ->
            runCatching {
                firestore.collection(collectionName).get().await().documents.forEach { docSnap ->
                    if (docSnap.id == currentUid || peopleMap.containsKey(docSnap.id)) return@forEach
                    val data = docSnap.data.orEmpty()
                    val resolvedRole = when (collectionName) {
                        "sponsor_investor_profiles" -> when (data["accountType"]?.toString()?.trim()?.lowercase()) {
                            "investor" -> "Investor"
                            else -> "Sponsor"
                        }
                        "public_profiles" -> resolvePublicRole(data)
                        else -> role
                    }
                    if (resolvedRole.isBlank()) return@forEach
                    peopleMap[docSnap.id] = WatchMember(
                        uid = docSnap.id,
                        role = resolvedRole,
                        displayName = displayNameFor(data),
                        email = data["email"]?.toString().orEmpty(),
                        subtitle = listOf(
                            data["profession"]?.toString(),
                            data["businessName"]?.toString(),
                            data["brandName"]?.toString(),
                            data["country"]?.toString(),
                        ).firstOrNull { !it.isNullOrBlank() }.orEmpty()
                    )
                }
            }
        }

        return peopleMap.values.sortedBy { it.displayName.lowercase() }
    }

    private suspend fun loadMeetUpDirectory(currentUid: String?): List<WatchMeetUpRequest> {
        if (currentUid.isNullOrBlank()) return emptyList()

        val sessionsRef = firestore.collection("meetup_call_sessions")
        val sentSnap = sessionsRef.whereEqualTo("requesterId", currentUid).get().await()
        val receivedSnap = sessionsRef.whereEqualTo("starId", currentUid).get().await()
        val requestMap = linkedMapOf<String, WatchMeetUpRequest>()

        listOf(sentSnap, receivedSnap).forEach { snapshot ->
            snapshot.documents.forEach { docSnap ->
                val data = docSnap.data.orEmpty()
                if (!isMeetUpAreaRequest(data)) return@forEach
                val normalized = normalizeMeetUpAreaRequest(data)
                val sentByCurrentUser = normalized["requesterId"]?.toString() == currentUid
                requestMap[docSnap.id] = WatchMeetUpRequest(
                    id = docSnap.id,
                    status = normalized["status"]?.toString().orEmpty().ifBlank { "pending" },
                    otherUserId = if (sentByCurrentUser) {
                        normalized["starId"]?.toString().orEmpty()
                    } else {
                        normalized["requesterId"]?.toString().orEmpty()
                    },
                    otherUserName = safeMeetUpName(
                        if (sentByCurrentUser) normalized["starName"]?.toString()
                        else normalized["requesterName"]?.toString()
                    ),
                    directionLabel = if (sentByCurrentUser) "Sent request" else "Received request",
                    areaIcon = normalized["areaIcon"]?.toString().orEmpty(),
                    areaTitle = normalized["areaTitle"]?.toString().orEmpty().ifBlank { "Meet-Up Area" },
                    mealMode = normalized["mealMode"]?.toString().orEmpty().ifBlank { "dinner" },
                    experienceLevel = normalized["experienceLevel"]?.toString().orEmpty().ifBlank { "standard" },
                )
            }
        }

        return requestMap.values.sortedByDescending { meetUpSortValue(it) }
    }

    private fun resolvePublicRole(data: Map<String, Any?>): String {
        val raw = data["role"]?.toString().orEmpty().trim()
        if (raw.equals("sponsor / investor", ignoreCase = true)) {
            return if (data["accountType"]?.toString()?.trim()?.equals("investor", ignoreCase = true) == true) "Investor" else "Sponsor"
        }
        return when (raw.lowercase()) {
            "citizen" -> "Citizen"
            "ambassador" -> "Ambassador"
            "merchant" -> "Merchant"
            "user" -> "User"
            "backer", "backer contestant" -> "Backer"
            "superboss", "superboss candidate" -> "Superboss"
            "sponsor" -> "Sponsor"
            "investor" -> "Investor"
            else -> ""
        }
    }

    private fun displayNameFor(data: Map<String, Any?>): String {
        return listOf(
            data["stageName"]?.toString(),
            data["realName"]?.toString(),
            data["brandName"]?.toString(),
            data["fullName"]?.toString(),
            data["companyName"]?.toString(),
            data["name"]?.toString(),
            data["email"]?.toString(),
        ).firstOrNull { !it.isNullOrBlank() } ?: "Member"
    }

    private fun isMeetUpAreaRequest(data: Map<String, Any?>): Boolean {
        return data["requestKind"]?.toString() == "area" ||
            data["note"]?.toString()?.startsWith("MEETUP_AREA_REQUEST|") == true
    }

    private fun normalizeMeetUpAreaRequest(data: Map<String, Any?>): Map<String, Any?> {
        if (!data["areaTitle"]?.toString().isNullOrBlank()) return data
        val parts = data["note"]?.toString().orEmpty().split("|")
        return data + mapOf(
            "areaIcon" to parts.getOrElse(1) { "" },
            "areaTitle" to parts.getOrElse(2) { "Meet-Up Area" },
            "areaPitch" to parts.getOrElse(3) { "" },
        )
    }

    private fun safeMeetUpName(value: String?): String {
        val text = value?.trim().orEmpty()
        return if (text.isBlank() || text.contains("@")) "Member" else text
    }

    private fun meetUpSortValue(request: WatchMeetUpRequest): Int {
        val statusWeight = when (request.status.lowercase()) {
            "accepted" -> 3
            "pending" -> 2
            "declined" -> 1
            else -> 0
        }
        val directionWeight = if (request.directionLabel == "Received request") 1 else 0
        return statusWeight * 10 + directionWeight
    }

    private suspend fun sendSupport(
        videoId: String,
        actionKey: String,
        customParagAmount: Int? = null,
        customGbaziloAmount: Int? = null,
    ) {
        val idToken = sessionRepository.getFreshIdToken() ?: throw IllegalStateException("Login first")
        val appCheckToken = appCheckRepository.getToken(forceRefresh = false)
        apiService.sendSupportAction(
            idToken = idToken,
            appCheckToken = appCheckToken,
            videoId = videoId,
            actionKey = actionKey,
            customParagAmount = customParagAmount,
            customGbaziloAmount = customGbaziloAmount
        )
    }
}
