package com.app.natureswayproduction.nativeapp.feature.meetup

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class MeetUpRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    suspend fun loadDashboard(): MeetUpDashboard {
        val user = auth.currentUser
            ?: return MeetUpDashboard(
                message = "Sign in to browse members and request a meet-up."
            )

        val members = loadMembers(currentUid = user.uid)
        val incoming = firestore.collection("meetup_call_sessions")
            .whereEqualTo("starId", user.uid)
            .get()
            .await()
            .documents
            .mapNotNull { it.toMeetUpRequestRecord() }
            .sortedByDescending { it.createdAtMillis }
        val outgoing = firestore.collection("meetup_call_sessions")
            .whereEqualTo("requesterId", user.uid)
            .get()
            .await()
            .documents
            .mapNotNull { it.toMeetUpRequestRecord() }
            .sortedByDescending { it.createdAtMillis }
        val videos = firestore.collection("videos")
            .whereEqualTo("visibility", "meet_up")
            .get()
            .await()
            .documents
            .mapNotNull { doc ->
                val data = doc.data ?: return@mapNotNull null
                MeetUpVideoPreview(
                    id = doc.id,
                    title = data["title"]?.toString().orEmpty().ifBlank { "Meet-Up Preview" },
                    mealMode = data["mealMode"]?.toString().orEmpty().ifBlank { "dinner" },
                    areaTitle = data["areaTitle"]?.toString().orEmpty(),
                    thumbnailUrl = data["thumbnailUrl"]?.toString(),
                    mobileUrl = data["mobileUrl"]?.toString(),
                    streamUrl = data["streamUrl"]?.toString(),
                    desktopUrl = data["desktopUrl"]?.toString(),
                    originalUrl = data["originalUrl"]?.toString(),
                    fileUrl = data["fileUrl"]?.toString()
                )
            }
            .sortedBy { it.title }

        return MeetUpDashboard(
            members = members,
            incomingRequests = incoming,
            outgoingRequests = outgoing,
            videos = videos,
            message = "Native Meet-Up is now reading the same live Firebase collections as the website."
        )
    }

    suspend fun submitAreaRequest(
        member: MeetUpMember,
        area: MeetUpArea,
        mealMode: String,
        experienceLevel: String,
        callType: String,
        selectedVideo: MeetUpVideoPreview?,
    ): String {
        val user = auth.currentUser ?: error("Sign in to send a meet-up request.")
        if (member.uid == user.uid) error("You do not need to request a meet-up with yourself.")

        val requesterName = loadCurrentUserDisplayName(user.uid, user.email)
        firestore.collection("meetup_call_sessions").add(
            mapOf(
                "starId" to member.uid,
                "starName" to member.displayName,
                "starRole" to member.role,
                "requesterId" to user.uid,
                "requesterName" to requesterName,
                "type" to callType,
                "videoId" to (selectedVideo?.id ?: ""),
                "videoTitle" to (selectedVideo?.title ?: ""),
                "videoThumbnailUrl" to (selectedVideo?.thumbnailUrl ?: ""),
                "requestKind" to "area",
                "mealMode" to mealMode,
                "experienceLevel" to experienceLevel,
                "areaTitle" to area.title,
                "areaIcon" to area.icon,
                "areaPitch" to area.pitch,
                "note" to buildAreaMeetUpNote(area),
                "status" to "pending",
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            )
        ).await()
        return "${area.title} meet-up request sent."
    }

    suspend fun submitCallRequest(
        member: MeetUpMember,
        mealMode: String,
        experienceLevel: String,
        callType: String,
        note: String,
    ): String {
        val user = auth.currentUser ?: error("Sign in to send a call request.")
        if (member.uid == user.uid) error("You do not need to request a call with yourself.")

        val requesterName = loadCurrentUserDisplayName(user.uid, user.email)
        firestore.collection("meetup_call_sessions").add(
            mapOf(
                "starId" to member.uid,
                "starName" to member.displayName,
                "starRole" to member.role,
                "requesterId" to user.uid,
                "requesterName" to requesterName,
                "type" to callType,
                "requestKind" to "call",
                "mealMode" to mealMode,
                "experienceLevel" to experienceLevel,
                "note" to note.trim(),
                "status" to "pending",
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            )
        ).await()
        return "${requestTypeLabel(callType)} request sent."
    }

    suspend fun updateRequestStatus(requestId: String, status: String): String {
        val user = auth.currentUser ?: error("Sign in to update meet-up requests.")
        val requestRef = firestore.collection("meetup_call_sessions").document(requestId)
        val snapshot = requestRef.get().await()
        val data = snapshot.data ?: error("This meet-up request could not be found.")
        if (data["starId"]?.toString() != user.uid) {
            error("Only the invited member can update this request.")
        }

        requestRef.update(
            mapOf(
                "status" to status,
                "updatedAt" to FieldValue.serverTimestamp(),
                "decidedAt" to FieldValue.serverTimestamp(),
            )
        ).await()
        return if (status == "accepted") "Meet-up request accepted." else "Meet-up request declined."
    }

    private suspend fun loadMembers(currentUid: String): List<MeetUpMember> {
        val peopleMap = linkedMapOf<String, MeetUpMember>()
        PROFILE_SOURCES.forEach { source ->
            runCatching {
                firestore.collection(source.collectionName).get().await().documents.forEach { doc ->
                    if (doc.id == currentUid || peopleMap.containsKey(doc.id)) return@forEach
                    val data = doc.data.orEmpty()
                    val role = when (source.collectionName) {
                        "sponsor_investor_profiles" -> if (data["accountType"]?.toString() == "Investor") "Investor" else "Sponsor"
                        "public_profiles" -> resolvePublicRole(data)
                        else -> source.role
                    }
                    if (role.isBlank()) return@forEach
                    peopleMap[doc.id] = MeetUpMember(
                        uid = doc.id,
                        role = role,
                        displayName = getDisplayName(data),
                        subtitle = getSubtitle(data)
                    )
                }
            }
        }
        return peopleMap.values.sortedBy { it.displayName.lowercase() }
    }

    private suspend fun loadCurrentUserDisplayName(uid: String, email: String?): String {
        PROFILE_SOURCES.forEach { source ->
            val snapshot = runCatching {
                firestore.collection(source.collectionName).document(uid).get().await()
            }.getOrNull() ?: return@forEach
            if (snapshot.exists()) {
                return getDisplayName(snapshot.data.orEmpty())
            }
        }
        return email?.substringBefore("@")?.replaceFirstChar { it.uppercase() } ?: "Member"
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

    private fun getDisplayName(data: Map<String, Any?>): String {
        return listOf(
            data["stageName"],
            data["realName"],
            data["brandName"],
            data["fullName"],
            data["companyName"],
            data["name"],
            data["email"],
        ).firstOrNull { !it?.toString().isNullOrBlank() }?.toString() ?: "Member"
    }

    private fun getSubtitle(data: Map<String, Any?>): String {
        return listOf(
            data["profession"],
            data["businessName"],
            data["brandName"],
            data["country"],
        ).firstOrNull { !it?.toString().isNullOrBlank() }?.toString() ?: "Open meet-up request"
    }

    private fun buildAreaMeetUpNote(area: MeetUpArea): String {
        return "MEETUP_AREA_REQUEST|${area.icon}|${area.title}|${area.pitch}"
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toMeetUpRequestRecord(): MeetUpRequestRecord? {
        val data = data ?: return null
        val note = data["note"]?.toString().orEmpty()
        val requestKind = data["requestKind"]?.toString().orEmpty().ifBlank {
            if (note.startsWith("MEETUP_AREA_REQUEST|")) "area" else "call"
        }
        val normalized = if (requestKind == "area" && data["areaTitle"] == null) {
            val parts = note.split("|")
            Triple(
                parts.getOrNull(1).orEmpty(),
                parts.getOrNull(2).orEmpty(),
                parts.getOrNull(3).orEmpty()
            )
        } else {
            Triple(
                data["areaIcon"]?.toString().orEmpty(),
                data["areaTitle"]?.toString().orEmpty(),
                data["areaPitch"]?.toString().orEmpty()
            )
        }
        return MeetUpRequestRecord(
            id = id,
            requesterId = data["requesterId"]?.toString().orEmpty(),
            requesterName = safeDisplayName(data["requesterName"]?.toString()),
            starId = data["starId"]?.toString().orEmpty(),
            starName = safeDisplayName(data["starName"]?.toString()),
            starRole = data["starRole"]?.toString().orEmpty().ifBlank { "Member" },
            type = data["type"]?.toString().orEmpty().ifBlank { "voice" },
            status = data["status"]?.toString().orEmpty().ifBlank { "pending" },
            note = note,
            requestKind = requestKind,
            mealMode = data["mealMode"]?.toString().orEmpty().ifBlank { "dinner" },
            experienceLevel = data["experienceLevel"]?.toString().orEmpty().ifBlank { "standard" },
            areaTitle = normalized.second,
            areaIcon = normalized.first,
            areaPitch = normalized.third,
            videoTitle = data["videoTitle"]?.toString().orEmpty(),
            createdAtMillis = timestampToMillis(data["createdAt"])
        )
    }

    private fun safeDisplayName(name: String?): String {
        val value = name.orEmpty().trim()
        return if (value.isBlank() || value.contains("@")) "Member" else value
    }

    private fun timestampToMillis(raw: Any?): Long {
        val seconds = (raw as? com.google.firebase.Timestamp)?.seconds
        return seconds?.times(1000) ?: 0L
    }

    private data class ProfileSource(
        val collectionName: String,
        val role: String,
    )

    private companion object {
        val PROFILE_SOURCES = listOf(
            ProfileSource("citizen_profiles", "Citizen"),
            ProfileSource("promoter_profiles", "Ambassador"),
            ProfileSource("merchant_profiles", "Merchant"),
            ProfileSource("user_profiles", "User"),
            ProfileSource("backer_profiles", "Backer"),
            ProfileSource("supernal_profiles", "Superboss"),
            ProfileSource("sponsor_investor_profiles", "Sponsor / Investor"),
            ProfileSource("sponsor_profiles", "Sponsor / Investor"),
            ProfileSource("public_profiles", ""),
        )
    }
}

data class MeetUpDashboard(
    val members: List<MeetUpMember> = emptyList(),
    val incomingRequests: List<MeetUpRequestRecord> = emptyList(),
    val outgoingRequests: List<MeetUpRequestRecord> = emptyList(),
    val videos: List<MeetUpVideoPreview> = emptyList(),
    val message: String = "Preparing native Meet-Up...",
)
