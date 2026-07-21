package com.app.natureswayproduction.nativeapp.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.app.natureswayproduction.nativeapp.data.api.AmbassadorContactItem
import com.app.natureswayproduction.nativeapp.data.api.AccountRoleItem
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeBundle
import com.app.natureswayproduction.nativeapp.data.api.BackerChallengeQuestion
import com.app.natureswayproduction.nativeapp.data.api.MobileProfile
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ProfileViewModel(
    private val repository: ProfileRepository = ProfileRepository(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()
    private var cachedInboxUnreadCount: Int? = null
    private var cachedInboxUnreadCountAtMillis: Long = 0L


    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching {
                coroutineScope {
                    val profileDeferred = async { repository.loadProfile() }
                    val rolesDeferred = async { repository.loadAvailableAccountRoles() }

                    val profile = profileDeferred.await()
                    val roles = rolesDeferred.await()
                    val backerChallenges = if (
                        profile?.role.equals("BACKER", ignoreCase = true) ||
                        profile?.role.equals("SUPERNAL", ignoreCase = true)
                    ) {
                        repository.loadBackerChallengeBundle(profile?.role ?: "BACKER")
                    } else {
                        BackerChallengeBundle()
                    }

                    ProfileRefreshResult(
                        profile = profile,
                        roles = roles,
                        inboxUnreadCount = cachedInboxUnreadCount ?: _uiState.value.inboxUnreadCount,
                        backerChallenges = backerChallenges,
                    )
                }
            }
                .onSuccess { result ->
                    _uiState.value = ProfileUiState(
                        isLoading = false,
                        profile = result.profile,
                        availableRoles = result.roles,
                        activeRoleKey = normalizeRoleKey(result.profile?.role.orEmpty()),
                        inboxUnreadCount = result.inboxUnreadCount,
                        backerChallenges = result.backerChallenges,
                        message = if (result.profile == null) {
                            "Sign in to sync your native profile."
                        } else {
                            "Native profile synced from the live Firebase data used by the website."
                        }
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Profile needs attention.",
                        errorMessage = error.message ?: "Could not load profile",
                    )
                }
        }
    }

    fun refreshInboxUnreadCount(force: Boolean = false) {
        val now = System.currentTimeMillis()
        val isStale = now - cachedInboxUnreadCountAtMillis > INBOX_CACHE_TTL_MILLIS
        if (!force && cachedInboxUnreadCount != null && !isStale) {
            _uiState.value = _uiState.value.copy(inboxUnreadCount = cachedInboxUnreadCount!!)
            return
        }

        viewModelScope.launch {
            val inboxUnreadCount = runCatching { repository.loadInboxUnreadCount() }
                .getOrDefault(cachedInboxUnreadCount ?: 0)
            cachedInboxUnreadCount = inboxUnreadCount
            cachedInboxUnreadCountAtMillis = System.currentTimeMillis()
            _uiState.value = _uiState.value.copy(inboxUnreadCount = inboxUnreadCount)
        }
    }

    fun clear() {
        cachedInboxUnreadCount = null
        cachedInboxUnreadCountAtMillis = 0L
        _uiState.value = ProfileUiState(
            message = "Sign in to sync your native profile."
        )
    }

    suspend fun deleteOwnVideo(videoId: String) {
        repository.deleteOwnVideo(videoId)
    }

    suspend fun createSupportInviteLink(role: String, targetName: String): String {
        return repository.createSupportInviteLink(role = role, targetName = targetName)
    }

    suspend fun createCitizenInviteLink(): String {
        return repository.createCitizenInviteLink()
    }

    suspend fun loadAmbassadorContacts(): List<AmbassadorContactItem> {
        return repository.loadAmbassadorContacts()
    }

    suspend fun sendDirectMessageToAmbassador(
        ambassador: AmbassadorContactItem,
        text: String,
        senderName: String,
    ) {
        repository.sendDirectMessageToAmbassador(ambassador, text, senderName)
    }

    fun switchActiveRole(roleKey: String) {
        repository.setActiveRole(roleKey)
        refresh()
    }

    fun reloadBackerChallenges() {
        val role = _uiState.value.profile?.role ?: return
        if (!role.equals("BACKER", ignoreCase = true) && !role.equals("SUPERNAL", ignoreCase = true)) return
        viewModelScope.launch {
            val bundle = runCatching { repository.loadBackerChallengeBundle(role) }.getOrDefault(BackerChallengeBundle())
            _uiState.value = _uiState.value.copy(backerChallenges = bundle)
        }
    }

    suspend fun publishBackerQuestions(
        role: String,
        ownerName: String,
        drafts: List<BackerChallengeDraftPayload>,
    ) {
        repository.publishBackerQuestions(role = role, ownerName = ownerName, drafts = drafts)
    }

    suspend fun answerBackerQuestion(
        role: String,
        question: BackerChallengeQuestion,
        selectedIndex: Int,
        responderName: String,
    ): Boolean {
        return repository.answerBackerQuestion(
            role = role,
            question = question,
            selectedIndex = selectedIndex,
            responderName = responderName,
        )
    }

    suspend fun recordBackerTimeout(
        role: String,
        question: BackerChallengeQuestion,
        responderName: String,
    ) {
        repository.recordBackerTimeout(role = role, question = question, responderName = responderName)
    }

    companion object {
        const val INBOX_CACHE_TTL_MILLIS = 60_000L

        fun factory(repository: ProfileRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return ProfileViewModel(repository) as T
                }
            }
    }
}

data class ProfileUiState(
    val isLoading: Boolean = false,
    val profile: MobileProfile? = null,
    val availableRoles: List<AccountRoleItem> = emptyList(),
    val activeRoleKey: String = "",
    val inboxUnreadCount: Int = 0,
    val backerChallenges: BackerChallengeBundle = BackerChallengeBundle(),
    val message: String = "Preparing native profile…",
    val errorMessage: String? = null,
)

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

private data class ProfileRefreshResult(
    val profile: MobileProfile?,
    val roles: List<AccountRoleItem>,
    val inboxUnreadCount: Int,
    val backerChallenges: BackerChallengeBundle,
)

