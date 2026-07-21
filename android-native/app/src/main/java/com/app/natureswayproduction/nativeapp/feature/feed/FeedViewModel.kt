package com.app.natureswayproduction.nativeapp.feature.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class FeedCard(
    val id: String,
    val creatorUid: String?,
    val title: String,
    val performer: String,
    val category: String,
    val description: String,
    val supportCount: Int,
    val commentCount: Int,
    val viewCount: Int,
    val pourCount: Int,
    val sprayCount: Int,
    val bottleCount: Int,
    val thumbnailUrl: String?,
    val streamUrl: String?,
    val mobileUrl: String?,
    val desktopUrl: String?,
    val originalUrl: String?,
    val fileUrl: String?,
    val objectPath: String?,
)

data class FeedUiState(
    val summary: String = "Connecting native feed to backend…",
    val categories: List<String> = emptyList(),
    val items: List<FeedCard> = emptyList(),
    val activeCategory: String? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class FeedViewModel(
    private val repository: FeedRepository = FeedRepository(),
) : ViewModel() {
    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()
    private val _selectedItem = MutableStateFlow<FeedCard?>(null)
    val selectedItem: StateFlow<FeedCard?> = _selectedItem.asStateFlow()
    private var allItems: List<FeedCard> = emptyList()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            runCatching { repository.loadFeed() }
                .onSuccess { payload ->
                    allItems = payload.items
                    val activeCategory = _uiState.value.activeCategory
                    val filteredItems = filterItems(activeCategory, payload.items)
                    val retainedSelection = filteredItems.firstOrNull { it.id == _selectedItem.value?.id }
                    _selectedItem.value = retainedSelection ?: filteredItems.firstOrNull()
                    _uiState.value = FeedUiState(
                        summary = payload.summary,
                        categories = payload.categories,
                        items = filteredItems,
                        activeCategory = activeCategory,
                        isLoading = false,
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Could not load feed",
                        summary = "Feed request failed."
                    )
                }
        }
    }

    fun selectItem(item: FeedCard) {
        _selectedItem.value = item
    }

    fun selectCategory(category: String?) {
        val filteredItems = filterItems(category, allItems)
        val next = filteredItems.firstOrNull()
        _selectedItem.value = next
        _uiState.value = _uiState.value.copy(
            activeCategory = category,
            items = filteredItems
        )
    }

    fun selectNextItem() {
        val items = _uiState.value.items
        val currentIndex = items.indexOfFirst { it.id == _selectedItem.value?.id }
        if (items.isNotEmpty() && currentIndex in items.indices) {
            _selectedItem.value = items[(currentIndex + 1).coerceAtMost(items.lastIndex)]
        }
    }

    fun selectPreviousItem() {
        val items = _uiState.value.items
        val currentIndex = items.indexOfFirst { it.id == _selectedItem.value?.id }
        if (items.isNotEmpty() && currentIndex in items.indices) {
            _selectedItem.value = items[(currentIndex - 1).coerceAtLeast(0)]
        }
    }

    fun currentPositionLabel(): String {
        val items = _uiState.value.items
        val currentIndex = items.indexOfFirst { it.id == _selectedItem.value?.id }
        return if (currentIndex >= 0) {
            "${currentIndex + 1} of ${items.size}"
        } else {
            "0 of ${items.size}"
        }
    }

    companion object {
        fun factory(repository: FeedRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return FeedViewModel(repository) as T
                }
            }
    }

    private fun filterItems(category: String?, source: List<FeedCard>): List<FeedCard> {
        if (category.isNullOrBlank()) return source
        val normalizedCategory = normalizeCategory(category)
        val filtered = source.filter { normalizeCategory(it.category) == normalizedCategory }
        return filtered.ifEmpty { source }
    }

    private fun normalizeCategory(value: String): String {
        val lowered = value.trim().lowercase()
        return when (lowered) {
            "dancers" -> "dancer"
            "instrumentalists" -> "instrumentalist"
            "models" -> "model"
            "foodies" -> "nutritionist"
            "stuntpersons" -> "stunt performer"
            "singers" -> "singer"
            "debater" -> "debater"
            "debaters" -> "debater"
            "comedians" -> "comedian"
            "artists" -> "artist & designer"
            "dramatizers" -> "actor"
            "abilities (disability)" -> "special ability"
            "cultural performers" -> "cultural performer"
            else -> lowered
        }
    }
}
