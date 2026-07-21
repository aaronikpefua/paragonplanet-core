package com.app.natureswayproduction.nativeapp.feature.upload

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class UploadViewModel(
    private val repository: UploadRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(UploadUiState())
    val uiState: StateFlow<UploadUiState> = _uiState.asStateFlow()

    fun updateTitle(value: String) {
        _uiState.value = _uiState.value.copy(
            title = value,
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun updateDescription(value: String) {
        _uiState.value = _uiState.value.copy(
            description = value,
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun updateCategory(value: String) {
        _uiState.value = _uiState.value.copy(
            categories = listOf(value),
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun updateCategories(values: List<String>) {
        _uiState.value = _uiState.value.copy(
            categories = listOf(values.firstOrNull().orEmpty().ifBlank { "Cultural Performer" }),
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun updateSource(value: UploadSource) {
        _uiState.value = _uiState.value.copy(
            source = value,
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun updateLinkUrl(value: String) {
        _uiState.value = _uiState.value.copy(
            linkUrl = value,
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun setPickedVideo(uri: Uri?) {
        _uiState.value = _uiState.value.copy(
            videoUri = uri,
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun resetForAnotherUpload() {
        _uiState.value = _uiState.value.copy(
            title = "",
            description = "",
            categories = listOf("Cultural Performer"),
            source = UploadSource.FILE,
            linkUrl = "",
            videoUri = null,
            isUploading = false,
            progress = 0,
            message = "Choose a new performance and send it into the native upload flow.",
            errorMessage = null,
            uploadedVideoId = null,
        )
    }

    fun upload() {
        val state = _uiState.value
        if (state.title.isBlank()) {
            _uiState.value = state.copy(errorMessage = "Title is required.")
            return
        }
        if (state.categories.isEmpty()) {
            _uiState.value = state.copy(errorMessage = "Choose at least one talent category.")
            return
        }

        if (state.source == UploadSource.LINK) {
            _uiState.value = state.copy(
                errorMessage = "Paste-link upload is being prepared next. Use Camera / Video or File for now."
            )
            return
        }

        val uri = state.videoUri ?: run {
            _uiState.value = state.copy(errorMessage = "Choose a video file first.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isUploading = true,
                errorMessage = null,
                message = "Preparing upload…",
            )
            runCatching {
                repository.uploadVideo(
                    uri = uri,
                    title = state.title,
                    description = state.description,
                    category = state.categories.joinToString(", "),
                ) { progress, status ->
                    _uiState.value = _uiState.value.copy(
                        progress = progress,
                        message = status,
                    )
                }
            }.onSuccess { videoId ->
                _uiState.value = _uiState.value.copy(
                    isUploading = false,
                    progress = 100,
                    message = "Upload queued successfully for processing.",
                    uploadedVideoId = videoId,
                )
            }.onFailure { error ->
                val friendlyMessage = when {
                    error.message?.contains("App Check token required", ignoreCase = true) == true ->
                        "Upload is blocked by the server trust check for this account. Android file access is fine, but App Check / Play Integrity is still rejecting this upload."
                    error.message?.contains("Invalid App Check token", ignoreCase = true) == true ->
                        "Upload is blocked because the server did not accept this device's App Check / Play Integrity token yet."
                    else -> error.message ?: "Upload failed"
                }
                _uiState.value = _uiState.value.copy(
                    isUploading = false,
                    message = "Upload needs attention.",
                    errorMessage = friendlyMessage,
                )
            }
        }
    }

    companion object {
        fun factory(repository: UploadRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return UploadViewModel(repository) as T
                }
            }
    }
}

data class UploadUiState(
    val title: String = "",
    val description: String = "",
    val categories: List<String> = listOf("Cultural Performer"),
    val source: UploadSource = UploadSource.FILE,
    val linkUrl: String = "",
    val videoUri: Uri? = null,
    val isUploading: Boolean = false,
    val progress: Int = 0,
    val message: String = "Choose a video and upload it through the native flow.",
    val errorMessage: String? = null,
    val uploadedVideoId: String? = null,
)

enum class UploadSource {
    CAMERA,
    FILE,
    LINK,
}
