package com.app.natureswayproduction.nativeapp.feature.profile

import com.app.natureswayproduction.nativeapp.data.api.MobileProfile
import com.app.natureswayproduction.nativeapp.data.api.AccountRoleItem
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeAttempt
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeBundle
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeQuestion
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeStats
import com.app.natureswayproduction.nativeapp.data.api.BackerLeaderboardEntry
import com.app.natureswayproduction.nativeapp.data.api.AmbassadorContactItem
import com.app.natureswayproduction.nativeapp.data.api.InvitedCitizenItem
import com.app.natureswayproduction.nativeapp.data.api.ProfileProductItem
import com.app.natureswayproduction.nativeapp.data.api.ProfileVideoItem
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await
import java.util.UUID

class ProfileRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    private data class RoleConfig(
        val key: String,
        val label: String,
        val collectionName: String,
        val profileRole: String = key,
    )

    private val roleConfigs = listOf(
        RoleConfig("USER", "User", "user_profiles"),
        RoleConfig("CITIZEN", "Citizen", "citizen_profiles"),
        RoleConfig("PROMOTER", "Ambassador", "promoter_profiles"),
        RoleConfig("MERCHANT", "Merchant", "merchant_profiles"),
        RoleConfig("BACKER", "Backer Contestant", "backer_profiles"),
        RoleConfig("SUPERNAL", "Superboss", "supernal_profiles"),
        RoleConfig("SPONSOR_INVESTOR", "Sponsor / Investor", "sponsor_investor_profiles", "SPONSOR / INVESTOR"),
        RoleConfig("SPONSOR_INVESTOR", "Sponsor / Investor", "sponsor_profiles", "SPONSOR / INVESTOR"),
    )

    suspend fun loadAvailableAccountRoles(): List<AccountRoleItem> {
        val user = auth.currentUser ?: return emptyList()
        val seen = mutableSetOf<String>()
        return roleConfigs.mapNotNull { config ->
            val exists = runCatching {
                firestore.collection(config.collectionName).document(user.uid).get().await().exists()
            }.getOrDefault(false)
            if (!exists || !seen.add(config.key)) null else AccountRoleItem(config.key, config.label)
        }
    }

    suspend fun loadInboxUnreadCount(): Int {
        val user = auth.currentUser ?: return 0
        val directUnread = runCatching {
            firestore.collection("direct_messages")
                .whereArrayContains("participantIds", user.uid)
                .get()
                .await()
                .documents
                .count { it.data.orEmpty().isUnreadFor(user.uid) }
        }.getOrDefault(0)

        val merchantRequestUnread = runCatching {
            firestore.collection("merchant_order_messages")
                .whereEqualTo("merchantId", user.uid)
                .get()
                .await()
                .documents
                .count { it.data.orEmpty().isUnreadFor(user.uid) }
        }.getOrDefault(0)

        val buyerRequestUnread = runCatching {
            firestore.collection("merchant_order_messages")
                .whereEqualTo("buyerId", user.uid)
                .get()
                .await()
                .documents
                .count { it.data.orEmpty().isUnreadFor(user.uid) }
        }.getOrDefault(0)

        return directUnread + merchantRequestUnread + buyerRequestUnread
    }

    fun setActiveRole(roleKey: String) {
        activeRoleKey = normalizeRoleKey(roleKey)
    }

    suspend fun loadProfile(): MobileProfile? {
        val user = auth.currentUser ?: return null
        val uid = user.uid

        suspend fun get(collection: String) =
            runCatching { firestore.collection(collection).document(uid).get().await() }.getOrNull()

        val selectedRole = activeRoleKey
        val selectedConfig = roleConfigs.firstOrNull { it.key == selectedRole }
        if (selectedConfig != null) {
            val selectedSnap = get(selectedConfig.collectionName)
            if (selectedSnap?.exists() == true) {
                val data = selectedSnap.data.orEmpty()
                return MobileProfile(
                    uid = uid,
                    role = selectedConfig.profileRole,
                    displayName = firstText(
                        data["storeName"],
                        data["businessName"],
                        data["brandName"],
                        data["stageName"],
                        data["realName"],
                        data["fullName"],
                        user.email,
                    ),
                    email = data["email"]?.toString() ?: user.email,
                    headline = data["about"]?.toString() ?: data["bio"]?.toString() ?: "${selectedConfig.label} profile",
                    status = data["status"]?.toString(),
                    stageName = data["stageName"]?.toString(),
                    realName = data["realName"]?.toString() ?: data["fullName"]?.toString(),
                    phone = data["phone"]?.toString(),
                    country = data["country"]?.toString(),
                    state = data["state"]?.toString() ?: data["stateCity"]?.toString(),
                    gender = data["gender"]?.toString(),
                    brandName = data["brandName"]?.toString(),
                    accountType = data["accountType"]?.toString(),
                    talents = (data["talents"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                    promoterTypes = (data["promoterTypes"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                    serviceLabels = collectServiceFields(data),
                )
            }
        }

        val promoter = get("promoter_profiles")
        if (promoter?.exists() == true) {
            val data = promoter.data.orEmpty()
            val invitedCitizens = firestore.collection("citizen_profiles")
                .whereEqualTo("primaryPromoterId", uid)
                .get()
                .await()
                .documents
                .map { doc ->
                    val citizen = doc.data.orEmpty()
                    InvitedCitizenItem(
                        id = doc.id,
                        displayName = citizen["stageName"]?.toString()
                            ?: citizen["realName"]?.toString()
                            ?: "Citizen",
                        realName = citizen["realName"]?.toString(),
                        talents = (citizen["talents"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        country = citizen["country"]?.toString(),
                        state = citizen["state"]?.toString(),
                        registrationType = citizen["registrationType"]?.toString(),
                    )
                }
                .sortedByDescending { it.id }
            return MobileProfile(
                uid = uid,
                role = "PROMOTER",
                displayName = data["brandName"] as? String ?: data["stageName"] as? String ?: data["fullName"] as? String ?: user.email.orEmpty(),
                email = user.email,
                headline = data["bio"] as? String ?: "Promoter profile",
                status = data["status"] as? String,
                realName = data["realName"] as? String ?: data["fullName"] as? String,
                phone = data["phone"] as? String,
                country = data["country"] as? String,
                state = data["state"] as? String,
                profession = data["profession"] as? String,
                brandName = data["brandName"] as? String,
                declaredCapacity = data["declaredCapacity"]?.toString(),
                promoterTypes = (data["promoterTypes"] as? List<*>)?.mapNotNull { it?.toString() }
                    ?: (data["talentCategories"] as? List<*>)?.mapNotNull { it?.toString() }
                    ?: emptyList(),
                invitedCitizens = invitedCitizens,
            )
        }

        val citizen = get("citizen_profiles")
        if (citizen?.exists() == true) {
            val data = citizen.data.orEmpty()
            val videoSnapshots = firestore.collection("videos")
                .whereEqualTo("uid", uid)
                .get()
                .await()
                .documents
            val homeVideos = videoSnapshots
                .mapNotNull { doc ->
                    val video = doc.data.orEmpty()
                    if (video["uploadPurpose"] == "meet_up_video" || video["visibility"] == "meet_up") {
                        null
                    } else {
                        ProfileVideoItem(
                            id = doc.id,
                            title = (video["title"] as? String).orEmpty().ifBlank { "Untitled video" },
                            category = (video["category"] as? String).orEmpty().ifBlank { "General" },
                            status = video["status"] as? String,
                        )
                    }
                }
                .sortedByDescending { it.id }
            return MobileProfile(
                uid = uid,
                role = "CITIZEN",
                displayName = data["stageName"] as? String
                    ?: data["realName"] as? String
                    ?: data["fullName"] as? String
                    ?: user.email.orEmpty(),
                email = user.email,
                headline = data["about"] as? String ?: data["bio"] as? String ?: "Citizen profile",
                status = data["status"] as? String,
                stageName = data["stageName"] as? String,
                realName = data["realName"] as? String ?: data["fullName"] as? String,
                age = data["age"]?.toString(),
                gender = data["gender"] as? String,
                maritalStatus = data["maritalStatus"] as? String,
                phone = data["phone"] as? String,
                country = data["country"] as? String,
                state = data["state"] as? String,
                tribe = data["tribe"] as? String,
                residence = data["residence"] as? String,
                profession = data["profession"] as? String,
                talents = (data["talents"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                totalVideos = homeVideos.size,
                recentVideos = homeVideos.take(5),
            )
        }

        val merchant = get("merchant_profiles")
        if (merchant?.exists() == true) {
            val data = merchant.data.orEmpty()
            val productSnapshots = firestore.collection("merchant_products")
                .whereEqualTo("merchantId", uid)
                .get()
                .await()
                .documents
            val products = productSnapshots.map { doc ->
                val product = doc.data.orEmpty()
                val price = when (val raw = product["price"]) {
                    is Number -> "N${raw.toLong()}"
                    is String -> raw
                    else -> "Price unavailable"
                }
                ProfileProductItem(
                    id = doc.id,
                    title = (product["name"] as? String ?: product["title"] as? String).orEmpty().ifBlank { "Untitled product" },
                    priceLabel = price,
                    status = product["status"] as? String,
                )
            }.sortedByDescending { it.id }
            return MobileProfile(
                uid = uid,
                role = "MERCHANT",
                displayName = data["storeName"] as? String ?: data["businessName"] as? String ?: data["realName"] as? String ?: user.email.orEmpty(),
                email = user.email,
                headline = data["description"] as? String ?: data["storeName"] as? String ?: "Merchant profile",
                status = data["status"] as? String,
                realName = data["realName"] as? String,
                phone = data["phone"] as? String,
                country = data["country"] as? String,
                state = data["state"] as? String ?: data["stateCity"] as? String,
                gender = data["gender"] as? String,
                totalProducts = products.size,
                recentProducts = products.take(5),
            )
        }

        val userProfile = get("user_profiles")
        if (userProfile?.exists() == true) {
            val data = userProfile.data.orEmpty()
            return MobileProfile(
                uid = uid,
                role = "USER",
                displayName = data["fullName"] as? String ?: user.email.orEmpty(),
                email = user.email,
                headline = data["about"] as? String ?: "User profile",
                status = data["status"] as? String,
                realName = data["realName"] as? String ?: data["fullName"] as? String,
                gender = data["gender"] as? String,
                phone = data["phone"] as? String,
                country = data["country"] as? String,
                state = data["state"] as? String,
            )
        }

        val backer = get("backer_profiles")
        if (backer?.exists() == true) {
            val data = backer.data.orEmpty()
            return MobileProfile(
                uid = uid,
                role = "BACKER",
                displayName = data["fullName"] as? String ?: user.email.orEmpty(),
                email = user.email,
                headline = data["about"] as? String ?: "Backer profile",
                status = data["status"] as? String,
                realName = data["realName"] as? String ?: data["fullName"] as? String,
                age = data["age"]?.toString(),
                gender = data["gender"] as? String,
                maritalStatus = data["maritalStatus"] as? String,
                phone = data["phone"] as? String,
                country = data["country"] as? String,
                state = data["state"] as? String,
                tribe = data["tribe"] as? String,
                profession = data["profession"] as? String,
                employmentStatus = data["employmentStatus"] as? String,
                employmentType = data["employmentType"] as? String,
                businessName = data["businessName"] as? String,
                placeOfEmployment = data["placeOfEmployment"] as? String,
                serviceLabels = collectServiceFields(data),
                totalGoodWorksSupports = totalGoodWorksSupports(data),
                goodWorksCounts = collectGoodWorksCounts(data),
            )
        }

        val supernal = get("supernal_profiles")
        if (supernal?.exists() == true) {
            val data = supernal.data.orEmpty()
            return MobileProfile(
                uid = uid,
                role = "SUPERNAL",
                displayName = data["stageName"] as? String ?: data["realName"] as? String ?: user.email.orEmpty(),
                email = user.email,
                headline = data["about"] as? String ?: "Superboss profile",
                status = data["status"] as? String,
                stageName = data["stageName"] as? String,
                realName = data["realName"] as? String,
                age = data["age"]?.toString(),
                gender = data["gender"] as? String,
                maritalStatus = data["maritalStatus"] as? String,
                phone = data["phone"] as? String,
                country = data["country"] as? String,
                state = data["state"] as? String,
                tribe = data["tribe"] as? String,
                profession = data["profession"] as? String,
                employmentStatus = data["employmentStatus"] as? String,
                employmentType = data["employmentType"] as? String,
                businessName = data["businessName"] as? String,
                placeOfEmployment = data["placeOfEmployment"] as? String,
                serviceLabels = collectServiceFields(data),
                totalTestimonials = totalSupernalTestimonials(data),
                verifiedSupporters = verifiedSupernalSupporters(data),
                totalComplaints = totalSupernalComplaints(data),
                resolvedComplaints = resolvedSupernalComplaints(data),
                pendingComplaints = pendingSupernalComplaints(data),
                trustScore = supernalTrustScore(data),
                positiveTestimonyCounts = collectSupernalPositiveCounts(data),
            )
        }

        val sponsorInvestor = get("sponsor_investor_profiles") ?: get("sponsor_profiles")
        if (sponsorInvestor?.exists() == true) {
            val data = sponsorInvestor.data.orEmpty()
            val accountType = data["accountType"]?.toString()
                ?: when (data["role"]?.toString()?.uppercase()) {
                    "INVESTOR" -> "INVESTOR"
                    "SPONSOR" -> "SPONSOR"
                    else -> "SPONSOR"
                }
            return MobileProfile(
                uid = uid,
                role = data["role"]?.toString() ?: "SPONSOR / INVESTOR",
                displayName = data["brandName"] as? String ?: data["realName"] as? String ?: user.email.orEmpty(),
                email = (data["email"] as? String) ?: user.email,
                headline = data["about"] as? String ?: "Sponsor / Investor profile",
                status = data["status"] as? String,
                realName = data["realName"] as? String,
                phone = data["phone"] as? String,
                country = data["country"] as? String,
                state = data["state"] as? String ?: data["stateCity"] as? String,
                brandName = data["brandName"] as? String,
                accountType = accountType,
                sponsorType = data["sponsorType"] as? String,
                investorType = data["investorType"] as? String,
                stateCity = data["stateCity"] as? String,
                websiteLink = data["websiteLink"] as? String,
                talentFields = (data["talentFields"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                sponsorInterests = (data["sponsorInterests"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                sponsorBudgetRange = data["sponsorBudgetRange"] as? String,
                sponsorBenefits = (data["sponsorBenefits"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                investorInterests = (data["investorInterests"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                investmentCapacity = data["investmentCapacity"] as? String,
                riskLevel = data["riskLevel"] as? String,
                returnTypes = (data["returnTypes"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
            )
        }

        return MobileProfile(
            uid = uid,
            role = "UNASSIGNED",
            displayName = user.email.orEmpty(),
            email = user.email,
            headline = "No mobile profile role found yet.",
            status = null,
        )
    }

    suspend fun deleteOwnVideo(videoId: String) {
        val user = auth.currentUser ?: throw IllegalStateException("Sign in first.")
        val snapshot = firestore.collection("videos").document(videoId).get().await()
        if (!snapshot.exists()) {
            throw IllegalStateException("Video no longer exists.")
        }
        val ownerUid = snapshot.getString("uid")
        if (ownerUid != user.uid) {
            throw IllegalStateException("You can only delete your own videos.")
        }
        snapshot.reference.delete().await()
    }

    suspend fun createSupportInviteLink(role: String, targetName: String): String {
        val user = auth.currentUser ?: error("User not authenticated")
        val code = UUID.randomUUID().toString().replace("-", "").take(10).uppercase()
        firestore.collection("invites").document(code).set(
            mapOf(
                "inviterId" to user.uid,
                "inviterRole" to role,
                "supportTargetId" to user.uid,
                "supportTargetRole" to if (role.equals("SUPERNAL", ignoreCase = true)) "Superboss" else "Backer",
                "supportTargetName" to targetName,
                "purpose" to "support_invite",
                "active" to true,
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
        return "https://www.paragonplanet.com/invite/$code"
    }

    suspend fun createCitizenInviteLink(): String {
        val user = auth.currentUser ?: error("User not authenticated")
        val code = UUID.randomUUID().toString().replace("-", "").take(10).uppercase()
        firestore.collection("invites").document(code).set(
            mapOf(
                "promoterId" to user.uid,
                "inviterId" to user.uid,
                "inviterRole" to "PROMOTER",
                "purpose" to "citizen_invite",
                "active" to true,
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
        return "https://www.paragonplanet.com/invite/$code"
    }

    suspend fun loadAmbassadorContacts(): List<AmbassadorContactItem> {
        return firestore.collection("promoter_profiles")
            .get()
            .await()
            .documents
            .map { doc ->
                val data = doc.data.orEmpty()
                AmbassadorContactItem(
                    id = doc.id,
                    displayName = listOf(
                        data["brandName"]?.toString(),
                        data["stageName"]?.toString(),
                        data["realName"]?.toString(),
                        data["email"]?.toString()
                    ).firstOrNull { !it.isNullOrBlank() } ?: "Ambassador",
                    subtitle = (((data["promoterTypes"] as? List<*>) ?: emptyList<Any?>())
                        .mapNotNull { it?.toString().takeIf { value -> !value.isNullOrBlank() } })
                        .joinToString(", ")
                        .ifBlank { "Ambassador account" },
                    extra = (((data["subFields"] as? List<*>) ?: emptyList<Any?>())
                        .mapNotNull { it?.toString().takeIf { value -> !value.isNullOrBlank() } })
                        .joinToString(", "),
                    email = data["email"]?.toString(),
                    phone = data["phone"]?.toString(),
                )
            }
            .sortedBy { it.displayName.lowercase() }
    }

    suspend fun sendDirectMessageToAmbassador(ambassador: AmbassadorContactItem, text: String, senderName: String) {
        val user = auth.currentUser ?: error("User not authenticated")
        if (text.isBlank()) return
        val chatId = listOf(user.uid, ambassador.id).sorted().joinToString("__")
        firestore.collection("direct_messages").add(
            mapOf(
                "chatId" to chatId,
                "participantIds" to listOf(user.uid, ambassador.id).sorted(),
                "senderId" to user.uid,
                "senderName" to senderName.ifBlank { user.email ?: "Citizen" },
                "senderRole" to "Citizen",
                "recipientId" to ambassador.id,
                "recipientName" to ambassador.displayName,
                "recipientRole" to "Ambassador",
                "text" to text.trim(),
                "readBy" to listOf(user.uid),
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }

    suspend fun loadBackerChallengeBundle(role: String): BackerChallengeBundle {
        val user = auth.currentUser ?: error("User not authenticated")
        val questionSnapshot = firestore.collection(getChallengeQuestionCollection(role))
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(100)
            .get()
            .await()

        val questionData = questionSnapshot.documents.mapNotNull { docSnap ->
            val data = docSnap.data.orEmpty()
            val options = (data["options"] as? List<*>)?.mapNotNull { it?.toString() }.orEmpty()
            val questionText = data["questionText"]?.toString().orEmpty()
            if (questionText.isBlank() || options.isEmpty()) {
                null
            } else {
                BackerChallengeQuestion(
                    id = docSnap.id,
                    ownerId = data["ownerId"]?.toString().orEmpty(),
                    ownerName = data["ownerName"]?.toString().orEmpty().ifBlank { getChallengeRoleLabel(role) },
                    ownerRole = data["ownerRole"]?.toString().orEmpty().ifBlank { getChallengeRoleLabel(role) },
                    questionText = questionText,
                    options = options,
                    correctAnswerIndex = (data["correctAnswerIndex"] as? Number)?.toInt()
                        ?: data["correctAnswerIndex"]?.toString()?.toIntOrNull(),
                    timeLimitValue = extractInt(data["timeLimitValue"], fallback = 0),
                    timeLimitUnit = data["timeLimitUnit"]?.toString().orEmpty().ifBlank { "seconds" },
                    timeLimitSeconds = extractInt(data["timeLimitSeconds"], fallback = 60).coerceAtLeast(1),
                    rewardAmount = extractInt(data["rewardAmount"], fallback = 0),
                    rewardUnit = data["rewardUnit"]?.toString().orEmpty().ifBlank { "PARAG" },
                    rewardParagEquivalent = extractInt(data["rewardParagEquivalent"], fallback = 0),
                    status = data["status"]?.toString().orEmpty().ifBlank { "OPEN" },
                    answeredCorrectly = data["answeredCorrectly"] as? Boolean ?: false,
                    answeredBy = data["answeredBy"]?.toString(),
                    answeredByName = data["answeredByName"]?.toString(),
                    attemptsCount = extractInt(data["attemptsCount"], fallback = 0),
                    createdAtMillis = timestampMillis(data["createdAt"], data["updatedAt"], data["answeredAt"]),
                )
            }
        }

        val myQuestions = questionData.filter { it.ownerId == user.uid }
        val openQuestions = questionData.filter {
            it.ownerId != user.uid &&
                (it.status.equals("PUBLISHED", true) || it.status.equals("OPEN", true) || it.status.isBlank()) &&
                !it.answeredCorrectly
        }

        val leaderboardMap = linkedMapOf<String, BackerLeaderboardEntry>()
        questionData.filter { it.answeredCorrectly && !it.answeredBy.isNullOrBlank() }.forEach { item ->
            val current = leaderboardMap[item.answeredBy] ?: BackerLeaderboardEntry(
                responderId = item.answeredBy.orEmpty(),
                responderName = item.answeredByName.orEmpty().ifBlank { getChallengeRoleLabel(role) },
                totalCorrect = 0,
                totalScore = 0,
                totalParagEquivalent = 0,
            )
            leaderboardMap[item.answeredBy.orEmpty()] = current.copy(
                totalCorrect = current.totalCorrect + 1,
                totalScore = current.totalScore + (item.rewardParagEquivalent.takeIf { it > 0 } ?: 1),
                totalParagEquivalent = current.totalParagEquivalent + item.rewardParagEquivalent,
            )
        }
        val leaderboard = leaderboardMap.values.sortedWith(
            compareByDescending<BackerLeaderboardEntry> { it.totalScore }.thenByDescending { it.totalCorrect }
        )

        val attemptSnapshot = firestore.collection(getChallengeAttemptCollection(role))
            .whereEqualTo("responderId", user.uid)
            .limit(100)
            .get()
            .await()
        val attempts = attemptSnapshot.documents.map { docSnap ->
            val data = docSnap.data.orEmpty()
            BackerChallengeAttempt(
                id = docSnap.id,
                ownerName = data["ownerName"]?.toString().orEmpty().ifBlank { getChallengeRoleLabel(role) },
                questionText = data["questionText"]?.toString().orEmpty(),
                selectedAnswer = data["selectedAnswer"]?.toString(),
                isCorrect = data["isCorrect"] as? Boolean ?: false,
                didTimeout = data["didTimeout"] as? Boolean ?: false,
                rewardAmount = extractInt(data["rewardAmount"], fallback = 0),
                rewardUnit = data["rewardUnit"]?.toString().orEmpty().ifBlank { "PARAG" },
                rewardParagEquivalent = extractInt(data["rewardParagEquivalent"], fallback = 0),
                createdAtMillis = timestampMillis(data["createdAt"]),
            )
        }.sortedByDescending { it.createdAtMillis }

        val stats = BackerChallengeStats(
            correctAnswers = attempts.count { it.isCorrect },
            failedAttempts = attempts.count { it.didTimeout || !it.isCorrect },
            totalRewardWon = attempts.filter { it.isCorrect }.sumOf { it.rewardParagEquivalent },
            currentRank = leaderboard.indexOfFirst { it.responderId == user.uid }.takeIf { it >= 0 }?.plus(1)
        )

        return BackerChallengeBundle(
            myQuestions = myQuestions,
            openQuestions = openQuestions,
            attempts = attempts,
            leaderboard = leaderboard,
            stats = stats,
        )
    }

    suspend fun publishBackerQuestions(
        role: String,
        ownerName: String,
        drafts: List<BackerChallengeDraftPayload>,
    ) {
        val user = auth.currentUser ?: error("User not authenticated")
        require(drafts.isNotEmpty()) { "Fill at least one complete challenge." }
        drafts.forEach { draft ->
            val rewardParagEquivalent = if (draft.rewardUnit == "GBAZILO") draft.rewardAmount * 10 else draft.rewardAmount
            firestore.collection(getChallengeQuestionCollection(role)).add(
                mapOf(
                    "ownerId" to user.uid,
                    "ownerName" to ownerName,
                    "ownerRole" to getChallengeRoleLabel(role),
                    "questionText" to draft.questionText.trim(),
                    "options" to draft.options.map { it.trim() },
                    "correctAnswerIndex" to draft.correctAnswerIndex,
                    "timeLimitValue" to draft.timeLimitValue,
                    "timeLimitUnit" to draft.timeLimitUnit,
                    "timeLimitSeconds" to draft.timeLimitSeconds,
                    "rewardAmount" to draft.rewardAmount,
                    "rewardUnit" to draft.rewardUnit,
                    "rewardParagEquivalent" to rewardParagEquivalent,
                    "status" to "PUBLISHED",
                    "answeredCorrectly" to false,
                    "answeredBy" to null,
                    "answeredByName" to null,
                    "answeredAt" to null,
                    "attemptsCount" to 0,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
        }
    }

    suspend fun answerBackerQuestion(
        role: String,
        question: BackerChallengeQuestion,
        selectedIndex: Int,
        responderName: String,
    ): Boolean {
        val user = auth.currentUser ?: error("User not authenticated")
        val isCorrect = question.correctAnswerIndex == selectedIndex
        firestore.collection(getChallengeAttemptCollection(role)).add(
            mapOf(
                "questionId" to question.id,
                "ownerId" to question.ownerId,
                "ownerName" to question.ownerName,
                "responderId" to user.uid,
                "responderName" to responderName,
                "questionText" to question.questionText,
                "selectedIndex" to selectedIndex,
                "selectedAnswer" to question.options.getOrNull(selectedIndex),
                "isCorrect" to isCorrect,
                "didTimeout" to false,
                "rewardAmount" to question.rewardAmount,
                "rewardUnit" to question.rewardUnit,
                "rewardParagEquivalent" to question.rewardParagEquivalent,
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()

        val update = mutableMapOf<String, Any>(
            "attemptsCount" to (question.attemptsCount + 1),
            "updatedAt" to FieldValue.serverTimestamp(),
        )
        if (isCorrect) {
            update["answeredCorrectly"] = true
            update["status"] = "ANSWERED"
            update["answeredBy"] = user.uid
            update["answeredByName"] = responderName
            update["answeredAt"] = FieldValue.serverTimestamp()
        }
        firestore.collection(getChallengeQuestionCollection(role)).document(question.id).update(update).await()
        return isCorrect
    }

    suspend fun recordBackerTimeout(
        role: String,
        question: BackerChallengeQuestion,
        responderName: String,
    ) {
        val user = auth.currentUser ?: error("User not authenticated")
        firestore.collection(getChallengeAttemptCollection(role)).add(
            mapOf(
                "questionId" to question.id,
                "ownerId" to question.ownerId,
                "ownerName" to question.ownerName,
                "responderId" to user.uid,
                "responderName" to responderName,
                "questionText" to question.questionText,
                "selectedIndex" to null,
                "selectedAnswer" to null,
                "isCorrect" to false,
                "didTimeout" to true,
                "rewardAmount" to question.rewardAmount,
                "rewardUnit" to question.rewardUnit,
                "rewardParagEquivalent" to question.rewardParagEquivalent,
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }
}

private var activeRoleKey: String = ""

private fun normalizeRoleKey(role: String): String {
    val value = role.trim().uppercase()
    return if (
        value == "SPONSOR" ||
        value == "INVESTOR" ||
        value == "SPONSOR / INVESTOR" ||
        value == "SPONSOR_INVESTOR"
    ) {
        "SPONSOR_INVESTOR"
    } else {
        value
    }
}

private fun firstText(vararg values: Any?): String {
    return values.firstNotNullOfOrNull { value ->
        value?.toString()?.takeIf { it.isNotBlank() }
    } ?: "Paragon Member"
}

private fun Map<String, Any>.isUnreadFor(uid: String): Boolean {
    val senderId = this["senderId"]?.toString().orEmpty()
    val readBy = (this["readBy"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
    return senderId.isNotBlank() && senderId != uid && !readBy.contains(uid)
}

data class BackerChallengeDraftPayload(
    val questionText: String,
    val options: List<String>,
    val correctAnswerIndex: Int,
    val timeLimitValue: Int,
    val timeLimitUnit: String,
    val timeLimitSeconds: Int,
    val rewardAmount: Int,
    val rewardUnit: String,
)

private fun getChallengeQuestionCollection(role: String): String {
    return if (role.equals("SUPERNAL", ignoreCase = true)) "superboss_challenges" else "backer_questions"
}

private fun getChallengeAttemptCollection(role: String): String {
    return if (role.equals("SUPERNAL", ignoreCase = true)) "superboss_challenge_attempts" else "backer_question_attempts"
}

private fun getChallengeRoleLabel(role: String): String {
    return if (role.equals("SUPERNAL", ignoreCase = true)) "Superboss" else "Backer"
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

private fun collectGoodWorksCounts(data: Map<String, Any?>): Map<String, Int> {
    val source = goodWorksBucket(data)
    val keys = listOf("fans", "students", "clients", "patients", "communityMembers", "beneficiaries", "followers")
    return keys.associateWith { key ->
        val raw = source[key] ?: source["${key}Votes"]
        when (raw) {
            is Number -> raw.toInt()
            is String -> raw.toIntOrNull() ?: 0
            else -> 0
        }
    }
}

private fun totalGoodWorksSupports(data: Map<String, Any?>): Int {
    val direct = firstNumeric(
        data["totalGoodWorksTestimonies"],
        data["totalPublicSupports"],
        data["positiveVoteTotal"],
        (data["publicTrustRecord"] as? Map<*, *>)?.get("totalGoodWorksTestimonies"),
        (data["publicTrustRecord"] as? Map<*, *>)?.get("totalPublicSupports"),
        (data["backerPublicTrust"] as? Map<*, *>)?.get("totalGoodWorksTestimonies"),
        (data["backerPublicTrust"] as? Map<*, *>)?.get("totalPublicSupports"),
    )
    if (direct > 0) return direct
    return collectGoodWorksCounts(data).values.sum()
}

private fun collectSupernalPositiveCounts(data: Map<String, Any?>): Map<String, Int> {
    val source = supernalVoteBucket(data, "positive")
    val keys = listOf("students", "tutees", "trainees", "mentees", "followers", "beneficiaries", "communityMembers")
    return keys.associateWith { key ->
        val raw = source[key] ?: source["${key}Votes"]
        when (raw) {
            is Number -> raw.toInt()
            is String -> raw.toIntOrNull() ?: 0
            else -> 0
        }
    }
}

private fun totalSupernalTestimonials(data: Map<String, Any?>): Int {
    val direct = firstNumeric(
        (data["publicTrustRecord"] as? Map<*, *>)?.get("totalGoodWorksTestimonies"),
        data["totalGoodWorksTestimonies"],
        data["goodWorksTestimonies"],
        data["goodWorksTestimony"],
        data["positiveVoteTotal"],
    )
    if (direct > 0) return direct
    return collectSupernalPositiveCounts(data).values.sum()
}

private fun verifiedSupernalSupporters(data: Map<String, Any?>): Int {
    return firstNumeric(
        (data["publicTrustRecord"] as? Map<*, *>)?.get("verifiedSupporters"),
        data["verifiedSupporters"],
        data["verifiedSupporterCount"],
    )
}

private fun totalSupernalComplaints(data: Map<String, Any?>): Int {
    return firstNumeric(
        (data["publicTrustRecord"] as? Map<*, *>)?.get("totalComplaints"),
        (data["publicTrustRecord"] as? Map<*, *>)?.get("publicComplaints"),
        data["totalComplaints"],
        data["publicComplaints"],
        data["complaintCount"],
        data["oppressionVoteTotal"],
    )
}

private fun resolvedSupernalComplaints(data: Map<String, Any?>): Int {
    return firstNumeric(
        (data["publicTrustRecord"] as? Map<*, *>)?.get("resolvedComplaints"),
        data["resolvedComplaints"],
        data["resolvedComplaintCount"],
    )
}

private fun pendingSupernalComplaints(data: Map<String, Any?>): Int {
    val direct = firstNumeric(
        (data["publicTrustRecord"] as? Map<*, *>)?.get("pendingComplaints"),
        data["pendingComplaints"],
        data["pendingComplaintCount"],
    )
    if (direct > 0) return direct
    return (totalSupernalComplaints(data) - resolvedSupernalComplaints(data)).coerceAtLeast(0)
}

private fun supernalTrustScore(data: Map<String, Any?>): Int {
    val direct = firstNumeric(
        (data["publicTrustRecord"] as? Map<*, *>)?.get("trustScore"),
        data["trustScore"],
    )
    if (direct in 0..100) return direct
    val positive = totalSupernalTestimonials(data) + verifiedSupernalSupporters(data)
    val complaints = totalSupernalComplaints(data)
    val total = positive + complaints
    if (total <= 0) return 100
    return ((positive.toDouble() / total.toDouble()) * 100.0).toInt().coerceIn(0, 100)
}

private fun supernalVoteBucket(data: Map<String, Any?>, bucket: String): Map<*, *> {
    val trustRecord = data["publicTrustRecord"] as? Map<*, *>
    val supernalPublicTrust = data["supernalPublicTrust"] as? Map<*, *>
    val directBucket =
        trustRecord?.get(bucket)
            ?: trustRecord?.get("${bucket}Votes")
            ?: supernalPublicTrust?.get(bucket)
            ?: supernalPublicTrust?.get("${bucket}Votes")
            ?: data[bucket]
            ?: data["${bucket}Votes"]
            ?: if (bucket == "positive") data["goodWorkVotes"] ?: data["testimonyVotes"] else data["oppressionVotes"] ?: data["complaintVotes"]
    return directBucket as? Map<*, *> ?: emptyMap<String, Any>()
}

private fun goodWorksBucket(data: Map<String, Any?>): Map<*, *> {
    val trustRecord = data["publicTrustRecord"] as? Map<*, *>
    val backerPublicTrust = data["backerPublicTrust"] as? Map<*, *>
    val bucket = trustRecord?.get("goodWorksTestimony")
        ?: trustRecord?.get("goodWorksTestimonies")
        ?: trustRecord?.get("publicSupports")
        ?: backerPublicTrust?.get("goodWorksTestimony")
        ?: backerPublicTrust?.get("goodWorksTestimonies")
        ?: backerPublicTrust?.get("publicSupports")
        ?: data["goodWorksTestimony"]
        ?: data["goodWorksTestimonies"]
        ?: data["publicSupports"]
        ?: data["goodWorkVotes"]
    return bucket as? Map<*, *> ?: emptyMap<String, Any>()
}

private fun firstNumeric(vararg values: Any?): Int {
    return values.firstNotNullOfOrNull {
        when (it) {
            is Number -> it.toInt()
            is String -> it.toIntOrNull()
            else -> null
        }
    } ?: 0
}

private fun extractInt(value: Any?, fallback: Int): Int {
    return when (value) {
        is Number -> value.toInt()
        is String -> value.toIntOrNull() ?: fallback
        else -> fallback
    }
}

private fun timestampMillis(vararg values: Any?): Long {
    return values.firstNotNullOfOrNull { value ->
        when (value) {
            is com.google.firebase.Timestamp -> value.toDate().time
            is Map<*, *> -> {
                val seconds = value["seconds"] as? Number
                seconds?.toLong()?.times(1000)
            }
            else -> null
        }
    } ?: 0L
}

