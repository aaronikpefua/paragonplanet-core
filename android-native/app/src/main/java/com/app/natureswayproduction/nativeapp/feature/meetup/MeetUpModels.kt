package com.app.natureswayproduction.nativeapp.feature.meetup

data class MeetUpMember(
    val uid: String,
    val role: String,
    val displayName: String,
    val subtitle: String,
)

data class MeetUpVideoPreview(
    val id: String,
    val title: String,
    val mealMode: String,
    val areaTitle: String,
    val thumbnailUrl: String?,
    val mobileUrl: String?,
    val streamUrl: String?,
    val desktopUrl: String?,
    val originalUrl: String?,
    val fileUrl: String?,
)

data class MeetUpRequestRecord(
    val id: String,
    val requesterId: String,
    val requesterName: String,
    val starId: String,
    val starName: String,
    val starRole: String,
    val type: String,
    val status: String,
    val note: String,
    val requestKind: String,
    val mealMode: String,
    val experienceLevel: String,
    val areaTitle: String,
    val areaIcon: String,
    val areaPitch: String,
    val videoTitle: String,
    val createdAtMillis: Long,
)

data class MeetUpArea(
    val icon: String,
    val title: String,
    val pitch: String,
)

data class MeetUpExperienceLevel(
    val key: String,
    val badge: String,
    val title: String,
    val blurb: String,
    val notes: List<String>,
)

data class MeetUpCallType(
    val key: String,
    val icon: String,
    val title: String,
    val blurb: String,
)

val DINNER_AREAS = listOf(
    MeetUpArea(icon = "🌆", title = "Rooftop Dinner", pitch = "Dine above the city lights with your star"),
    MeetUpArea(icon = "🍴", title = "Fine Dining Restaurant", pitch = "Enjoy a luxury dinner experience"),
    MeetUpArea(icon = "🏡", title = "Private Dining Suite", pitch = "An exclusive, intimate dinner setting"),
    MeetUpArea(icon = "🕯️", title = "Candlelight Dinner", pitch = "A warm, elegant evening atmosphere"),
    MeetUpArea(icon = "🚢", title = "Waterfront Dinner", pitch = "Dine by the water with scenic views"),
    MeetUpArea(icon = "🏨", title = "Hotel Luxury Dining", pitch = "Premium dinner in a high-end hotel"),
    MeetUpArea(icon = "🎷", title = "Live Music Dinner", pitch = "Dinner with live band or performance"),
    MeetUpArea(icon = "🌿", title = "Garden Dinner", pitch = "Outdoor dinner in a peaceful setting"),
    MeetUpArea(icon = "🍷", title = "Wine & Dine Experience", pitch = "A classy dinner with wine pairing"),
    MeetUpArea(icon = "🎉", title = "Event Dinner Experience", pitch = "Dinner during a special show or event"),
)

val LUNCH_AREAS = listOf(
    MeetUpArea(icon = "☕", title = "Cafe Lunch", pitch = "Relaxed and friendly lunch meet-up"),
    MeetUpArea(icon = "🍔", title = "Casual Restaurant", pitch = "Easy-going meal with your star"),
    MeetUpArea(icon = "🏙️", title = "Rooftop Lunch", pitch = "Light dining with a city view"),
    MeetUpArea(icon = "🌿", title = "Outdoor Garden Lunch", pitch = "Fresh air and natural environment"),
    MeetUpArea(icon = "🏨", title = "Hotel Lounge Lunch", pitch = "Comfortable and premium midday dining"),
    MeetUpArea(icon = "🛍️", title = "Mall Food Court Meet-Up", pitch = "Public, lively, and accessible"),
    MeetUpArea(icon = "🍱", title = "Buffet Lunch Experience", pitch = "Enjoy a variety of meals together"),
    MeetUpArea(icon = "🎤", title = "Studio Lunch Break", pitch = "Lunch during a creative session"),
    MeetUpArea(icon = "🎉", title = "Event Lunch Access", pitch = "Lunch during a live event"),
    MeetUpArea(icon = "🚗", title = "City Spot Lunch", pitch = "Quick bite at a trendy city location"),
)

val BREAKFAST_AREAS = listOf(
    MeetUpArea(icon = "☕", title = "Morning Cafe Meet-Up", pitch = "Start the day with coffee and conversation"),
    MeetUpArea(icon = "🍳", title = "Brunch Spot", pitch = "Trendy and social breakfast vibe"),
    MeetUpArea(icon = "🌅", title = "Sunrise Breakfast View", pitch = "Beautiful morning experience with your star"),
    MeetUpArea(icon = "🏨", title = "Hotel Breakfast Lounge", pitch = "Calm and premium morning setting"),
    MeetUpArea(icon = "🧇", title = "Casual Breakfast Spot", pitch = "Simple and relaxed meal"),
    MeetUpArea(icon = "🌿", title = "Garden Breakfast", pitch = "Fresh and peaceful outdoor morning"),
    MeetUpArea(icon = "🥐", title = "Bakery Meet-Up", pitch = "Coffee and pastries with your star"),
    MeetUpArea(icon = "🏋️", title = "Post-Workout Breakfast", pitch = "Healthy meal after training"),
    MeetUpArea(icon = "🎬", title = "Behind-the-Scenes Breakfast", pitch = "Morning during content prep"),
    MeetUpArea(icon = "🚗", title = "Drive-In Breakfast Meet", pitch = "Quick and flexible morning hangout"),
)

val EXPERIENCE_LEVELS = listOf(
    MeetUpExperienceLevel("standard", "🟢", "Standard Experience", "Entry-level, easy access", listOf("Affordable", "High availability")),
    MeetUpExperienceLevel("premium", "🟡", "Premium Experience", "Better quality, more exclusive", listOf("Higher engagement", "Stronger fan connection")),
    MeetUpExperienceLevel("exclusive", "🔴", "Exclusive Experience", "Limited, high-value meet-ups", listOf("VIP feel", "Limited slots")),
    MeetUpExperienceLevel("vip", "👑", "VIP Experience", "Elite access to your star", listOf("Priority booking", "Special treatment")),
    MeetUpExperienceLevel("legendary", "💎", "Legendary Experience", "Top-tier, rare moments", listOf("Very limited", "Maximum impact & status")),
)

val CALL_TYPES = listOf(
    MeetUpCallType("voice", "📞", "Voice Call", "Simple audio call request so both sides can talk before meeting."),
    MeetUpCallType("video", "🎥", "Video Call", "Face-to-face call request for a stronger first connection."),
)

fun mealModeLabel(mode: String): String =
    when (mode.lowercase()) {
        "lunch" -> "Lunch"
        "breakfast" -> "Breakfast"
        else -> "Dinner"
    }

fun experienceLabel(key: String): String =
    EXPERIENCE_LEVELS.firstOrNull { it.key == key }?.title ?: EXPERIENCE_LEVELS.first().title

fun requestTypeLabel(type: String): String =
    if (type.equals("video", ignoreCase = true)) "Video Call" else "Voice Call"

fun formatMeetUpLabel(request: MeetUpRequestRecord): String {
    return "${request.areaIcon} ${request.areaTitle.ifBlank { "Meet-Up Area" }} • ${mealModeLabel(request.mealMode)} • ${experienceLabel(request.experienceLevel)}"
}
