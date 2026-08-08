package com.app.natureswayproduction.nativeapp.data.api

data class MobileUser(
    val uid: String,
    val email: String?,
    val role: String?
)

data class MobileProfile(
    val uid: String,
    val role: String,
    val displayName: String,
    val email: String?,
    val headline: String,
    val status: String?,
    val stageName: String? = null,
    val realName: String? = null,
    val age: String? = null,
    val gender: String? = null,
    val maritalStatus: String? = null,
    val phone: String? = null,
    val country: String? = null,
    val state: String? = null,
    val tribe: String? = null,
    val residence: String? = null,
    val profession: String? = null,
    val employmentStatus: String? = null,
    val employmentType: String? = null,
    val businessName: String? = null,
    val placeOfEmployment: String? = null,
    val serviceLabels: List<String> = emptyList(),
    val totalGoodWorksSupports: Int = 0,
    val goodWorksCounts: Map<String, Int> = emptyMap(),
    val totalTestimonials: Int = 0,
    val verifiedSupporters: Int = 0,
    val totalComplaints: Int = 0,
    val resolvedComplaints: Int = 0,
    val pendingComplaints: Int = 0,
    val trustScore: Int = 100,
    val positiveTestimonyCounts: Map<String, Int> = emptyMap(),
    val talents: List<String> = emptyList(),
    val totalVideos: Int = 0,
    val totalProducts: Int = 0,
    val recentVideos: List<ProfileVideoItem> = emptyList(),
    val recentProducts: List<ProfileProductItem> = emptyList(),
    val brandName: String? = null,
    val declaredCapacity: String? = null,
    val promoterTypes: List<String> = emptyList(),
    val invitedCitizens: List<InvitedCitizenItem> = emptyList(),
    val accountType: String? = null,
    val sponsorType: String? = null,
    val investorType: String? = null,
    val stateCity: String? = null,
    val websiteLink: String? = null,
    val talentFields: List<String> = emptyList(),
    val sponsorInterests: List<String> = emptyList(),
    val sponsorBudgetRange: String? = null,
    val sponsorBenefits: List<String> = emptyList(),
    val investorInterests: List<String> = emptyList(),
    val investmentCapacity: String? = null,
    val riskLevel: String? = null,
    val returnTypes: List<String> = emptyList(),
)

data class AccountRoleItem(
    val key: String,
    val label: String,
)

data class InvitedCitizenItem(
    val id: String,
    val displayName: String,
    val realName: String? = null,
    val talents: List<String> = emptyList(),
    val country: String? = null,
    val state: String? = null,
    val registrationType: String? = null,
)

data class AmbassadorContactItem(
    val id: String,
    val displayName: String,
    val subtitle: String,
    val extra: String,
    val email: String? = null,
    val phone: String? = null,
)

data class ProfileVideoItem(
    val id: String,
    val title: String,
    val category: String,
    val status: String?,
)

data class ProfileProductItem(
    val id: String,
    val title: String,
    val priceLabel: String,
    val status: String?,
)

data class BackerChallengeQuestion(
    val id: String,
    val ownerId: String,
    val ownerName: String,
    val ownerRole: String,
    val questionText: String,
    val options: List<String>,
    val correctAnswerIndex: Int?,
    val timeLimitValue: Int,
    val timeLimitUnit: String,
    val timeLimitSeconds: Int,
    val rewardAmount: Int,
    val rewardUnit: String,
    val rewardParagEquivalent: Int,
    val status: String,
    val answeredCorrectly: Boolean,
    val answeredBy: String?,
    val answeredByName: String?,
    val attemptsCount: Int,
    val createdAtMillis: Long,
)

data class BackerChallengeAttempt(
    val id: String,
    val ownerName: String,
    val questionText: String,
    val selectedAnswer: String?,
    val isCorrect: Boolean,
    val didTimeout: Boolean,
    val rewardAmount: Int,
    val rewardUnit: String,
    val rewardParagEquivalent: Int,
    val createdAtMillis: Long,
)

data class BackerLeaderboardEntry(
    val responderId: String,
    val responderName: String,
    val totalCorrect: Int,
    val totalScore: Int,
    val totalParagEquivalent: Int,
)

data class BackerChallengeStats(
    val correctAnswers: Int = 0,
    val failedAttempts: Int = 0,
    val totalRewardWon: Int = 0,
    val currentRank: Int? = null,
)

data class BackerChallengeBundle(
    val myQuestions: List<BackerChallengeQuestion> = emptyList(),
    val openQuestions: List<BackerChallengeQuestion> = emptyList(),
    val attempts: List<BackerChallengeAttempt> = emptyList(),
    val leaderboard: List<BackerLeaderboardEntry> = emptyList(),
    val stats: BackerChallengeStats = BackerChallengeStats(),
)

data class VideoSummary(
    val id: String,
    val creatorUid: String?,
    val title: String,
    val category: String,
    val performerName: String,
    val description: String,
    val supportCount: Int,
    val commentCount: Int,
    val viewCount: Int,
    val pourCount: Int,
    val sprayCount: Int,
    val bottleCount: Int,
    val thumbnailUrl: String? = null,
    val streamUrl: String? = null,
    val mobileUrl: String? = null,
    val desktopUrl: String? = null,
    val originalUrl: String? = null,
    val fileUrl: String? = null,
    val objectPath: String? = null,
    val visibility: String = "",
    val uploadPurpose: String = "",
    val source: String = "",
)

data class WalletBalance(
    val parag: Int,
    val gbazilo: Int,
)

data class WalletProduct(
    val productId: String,
    val displayName: String,
    val parag: Int,
    val gbazilo: Int,
    val priceLabel: String = "",
    val description: String = "",
)

data class WalletVerifyResult(
    val ok: Boolean,
    val alreadyProcessed: Boolean,
    val creditedParag: Int,
    val creditedGbazilo: Int,
)

data class UploadRequestPayload(
    val title: String,
    val description: String,
    val category: String,
    val fileName: String,
    val fileType: String,
    val fileSize: Long,
    val durationSeconds: Int,
    val uploadPurpose: String = "home_video",
)

data class UploadTicket(
    val uploadUrl: String,
    val objectPath: String,
    val fileUrl: String,
    val videoId: String,
)

data class WalletBankOption(
    val code: String,
    val name: String,
)

data class WalletBankResolveResult(
    val accountName: String,
)

data class WalletDepositInitResult(
    val authorizationUrl: String,
)

data class WalletDepositVerifyResult(
    val alreadyProcessed: Boolean,
    val creditedParag: Int,
)

data class WalletWithdrawalResult(
    val ok: Boolean,
)

data class MarketplaceNotification(
    val id: String = "",
    val type: String = "",
    val title: String = "",
    val body: String = "",
    val orderId: String = "",
    val read: Boolean = false,
)
