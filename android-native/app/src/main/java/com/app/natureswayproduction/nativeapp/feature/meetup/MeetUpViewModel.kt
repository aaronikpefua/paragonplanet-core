package com.app.natureswayproduction.nativeapp.feature.meetup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MeetUpViewModel(
    private val repository: MeetUpRepository = MeetUpRepository(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(MeetUpUiState())
    val uiState: StateFlow<MeetUpUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { repository.loadDashboard() }
                .onSuccess { dashboard ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        dashboard = dashboard,
                        statusMessage = dashboard.message,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Could not load native meet-up data.",
                    )
                }
        }
    }

    fun submitAreaRequest(
        member: MeetUpMember,
        area: MeetUpArea,
        mealMode: String,
        experienceLevel: String,
        callType: String,
        selectedVideo: MeetUpVideoPreview?,
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmittingArea = true, errorMessage = null)
            runCatching {
                repository.submitAreaRequest(
                    member = member,
                    area = area,
                    mealMode = mealMode,
                    experienceLevel = experienceLevel,
                    callType = callType,
                    selectedVideo = selectedVideo,
                )
            }.onSuccess { message ->
                _uiState.value = _uiState.value.copy(
                    isSubmittingArea = false,
                    statusMessage = message,
                    areaRequestSuccessCount = _uiState.value.areaRequestSuccessCount + 1,
                )
                refresh()
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isSubmittingArea = false,
                    errorMessage = error.message ?: "Could not send meet-up request.",
                )
            }
        }
    }

    fun submitCallRequest(
        member: MeetUpMember,
        mealMode: String,
        experienceLevel: String,
        callType: String,
        note: String,
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmittingCall = true, errorMessage = null)
            runCatching {
                repository.submitCallRequest(
                    member = member,
                    mealMode = mealMode,
                    experienceLevel = experienceLevel,
                    callType = callType,
                    note = note,
                )
            }.onSuccess { message ->
                _uiState.value = _uiState.value.copy(
                    isSubmittingCall = false,
                    statusMessage = message,
                )
                refresh()
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isSubmittingCall = false,
                    errorMessage = error.message ?: "Could not send call request.",
                )
            }
        }
    }

    fun updateRequestStatus(requestId: String, status: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(activeRequestUpdateId = requestId, errorMessage = null)
            runCatching { repository.updateRequestStatus(requestId, status) }
                .onSuccess { message ->
                    _uiState.value = _uiState.value.copy(
                        activeRequestUpdateId = null,
                        statusMessage = message,
                    )
                    refresh()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        activeRequestUpdateId = null,
                        errorMessage = error.message ?: "Could not update this request.",
                    )
                }
        }
    }

    companion object {
        fun factory(repository: MeetUpRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return MeetUpViewModel(repository) as T
                }
            }
    }
}

data class MeetUpUiState(
    val isLoading: Boolean = false,
    val dashboard: MeetUpDashboard = MeetUpDashboard(),
    val statusMessage: String = "Preparing native Meet-Up...",
    val errorMessage: String? = null,
    val isSubmittingArea: Boolean = false,
    val isSubmittingCall: Boolean = false,
    val activeRequestUpdateId: String? = null,
    val areaRequestSuccessCount: Int = 0,
)
