package com.app.natureswayproduction.nativeapp.feature.feed

import android.content.Context
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import java.io.File

enum class HomeFeedPlaybackState {
    IDLE,
    BUFFERING,
    READY,
    PLAYING,
    ENDED,
    ERROR,
}

data class HomeFeedActivePlayback(
    val videoId: String?,
    val player: ExoPlayer?,
    val state: HomeFeedPlaybackState,
    val errorMessage: String?,
)

@OptIn(UnstableApi::class)
class HomeFeedPlaybackController(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val mediaSourceFactory = DefaultMediaSourceFactory(
        CacheDataSource.Factory()
            .setCache(HomeFeedMediaCache.get(appContext))
            .setUpstreamDataSourceFactory(DefaultDataSource.Factory(appContext))
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    )
    private var currentSlot = PlayerSlot(player = createPlayer())
    private var nextSlot = PlayerSlot(player = createPlayer())
    private var activeSinceMs = 0L
    private var released = false

    var activePlayback by mutableStateOf(
        HomeFeedActivePlayback(
            videoId = null,
            player = null,
            state = HomeFeedPlaybackState.IDLE,
            errorMessage = null,
        )
    )
        private set

    init {
        log("controller created")
    }

    fun sync(items: List<FeedCard>, currentPage: Int) {
        if (released) return
        val currentItem = items.getOrNull(currentPage)
        val currentUrl = currentItem?.preferredPlaybackUrl()
        log("page changed page=$currentPage video=${currentItem?.id.orEmpty()}")

        if (currentItem == null || currentUrl.isNullOrBlank()) {
            pauseCurrent()
            activePlayback = HomeFeedActivePlayback(null, null, HomeFeedPlaybackState.IDLE, null)
            preloadNext(items.getOrNull(currentPage + 1))
            return
        }

        activeSinceMs = SystemClock.elapsedRealtime()
        if (nextSlot.matches(currentItem.id, currentUrl) && nextSlot.isPrepared) {
            promoteNextToCurrent(currentItem.id)
        } else {
            assignCurrent(currentItem.id, currentUrl)
        }

        playCurrent(currentItem.id)
        preloadNext(items.getOrNull(currentPage + 1))
    }

    fun retry(items: List<FeedCard>, currentPage: Int) {
        val item = items.getOrNull(currentPage) ?: return
        val url = item.preferredPlaybackUrl() ?: return
        log("retry video=${item.id}")
        currentSlot.assignedVideoId = null
        currentSlot.assignedUrl = null
        assignCurrent(item.id, url)
        playCurrent(item.id)
        preloadNext(items.getOrNull(currentPage + 1))
    }

    fun release() {
        if (released) return
        released = true
        currentSlot.release()
        nextSlot.release()
        activePlayback = HomeFeedActivePlayback(null, null, HomeFeedPlaybackState.IDLE, null)
        log("controller released")
    }

    private fun createPlayer(): ExoPlayer {
        return ExoPlayer.Builder(appContext)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()
            .apply {
                repeatMode = ExoPlayer.REPEAT_MODE_ONE
                playWhenReady = false
                volume = 0f
                addListener(PlayerDiagnostics(this))
            }
    }

    private fun assignCurrent(videoId: String, url: String) {
        if (currentSlot.matches(videoId, url) && currentSlot.isPrepared) {
            log("prepare skipped slot=CURRENT video=$videoId")
            return
        }
        currentSlot.assign(videoId, url)
        log("CURRENT media assigned video=$videoId")
    }

    private fun preloadNext(item: FeedCard?) {
        val videoId = item?.id
        val url = item?.preferredPlaybackUrl()
        if (videoId.isNullOrBlank() || url.isNullOrBlank()) {
            nextSlot.clearAssignment()
            return
        }
        if (nextSlot.matches(videoId, url) && nextSlot.isPrepared) {
            log("prepare skipped slot=NEXT video=$videoId")
            return
        }
        nextSlot.assign(videoId, url)
        log("NEXT media assigned video=$videoId")
        log("NEXT preload start video=$videoId")
    }

    private fun promoteNextToCurrent(videoId: String) {
        log("preloaded NEXT promoted to CURRENT video=$videoId")
        val oldCurrent = currentSlot
        currentSlot = nextSlot
        nextSlot = oldCurrent
        nextSlot.player.volume = 0f
        nextSlot.player.playWhenReady = false
        nextSlot.player.pause()
        log("old CURRENT recycled")
    }

    private fun playCurrent(videoId: String) {
        currentSlot.player.volume = 1f
        currentSlot.player.playWhenReady = true
        currentSlot.player.play()
        nextSlot.player.volume = 0f
        nextSlot.player.playWhenReady = false
        activePlayback = HomeFeedActivePlayback(
            videoId = videoId,
            player = currentSlot.player,
            state = playbackStateOf(currentSlot.player),
            errorMessage = null,
        )
    }

    private fun pauseCurrent() {
        currentSlot.player.volume = 0f
        currentSlot.player.playWhenReady = false
        currentSlot.player.pause()
        nextSlot.player.volume = 0f
        nextSlot.player.playWhenReady = false
    }

    private fun playbackStateOf(player: Player): HomeFeedPlaybackState {
        return when {
            player.playerError != null -> HomeFeedPlaybackState.ERROR
            player.isPlaying -> HomeFeedPlaybackState.PLAYING
            player.playbackState == Player.STATE_BUFFERING -> HomeFeedPlaybackState.BUFFERING
            player.playbackState == Player.STATE_READY -> HomeFeedPlaybackState.READY
            player.playbackState == Player.STATE_ENDED -> HomeFeedPlaybackState.ENDED
            else -> HomeFeedPlaybackState.IDLE
        }
    }

    private inner class PlayerDiagnostics(
        private val observedPlayer: ExoPlayer,
    ) : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            val slot = findSlot(observedPlayer)
            val slotName = slotName(slot)
            val videoId = slot?.assignedVideoId.orEmpty()
            when (playbackState) {
                Player.STATE_BUFFERING -> log("STATE_BUFFERING slot=$slotName video=$videoId")
                Player.STATE_READY -> {
                    val elapsed = slot?.preloadStartedAtMs
                        ?.takeIf { it > 0L }
                        ?.let { SystemClock.elapsedRealtime() - it }
                    if (slotName == "NEXT") {
                        log("NEXT READY video=$videoId elapsedMs=${elapsed ?: -1}")
                    } else {
                        log("STATE_READY slot=$slotName video=$videoId")
                    }
                    slot?.isPrepared = true
                }
                Player.STATE_ENDED -> log("STATE_ENDED slot=$slotName video=$videoId")
                Player.STATE_IDLE -> log("STATE_IDLE slot=$slotName video=$videoId")
            }
            if (slot?.player === currentSlot.player) {
                activePlayback = activePlayback.copy(
                    state = playbackStateOf(currentSlot.player),
                    errorMessage = null,
                )
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            val slot = findSlot(observedPlayer)
            if (slot?.player === currentSlot.player) {
                activePlayback = activePlayback.copy(
                    state = playbackStateOf(currentSlot.player),
                    errorMessage = null,
                )
            }
        }

        override fun onRenderedFirstFrame() {
            val slot = findSlot(observedPlayer)
            val slotName = slotName(slot)
            val elapsed = if (activeSinceMs > 0L) {
                SystemClock.elapsedRealtime() - activeSinceMs
            } else {
                -1L
            }
            log("first frame rendered slot=$slotName elapsedMs=$elapsed")
            if (slot?.player === currentSlot.player) {
                activePlayback = activePlayback.copy(
                    state = HomeFeedPlaybackState.PLAYING,
                    errorMessage = null,
                )
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            val slot = findSlot(observedPlayer)
            val slotName = slotName(slot)
            val videoId = slot?.assignedVideoId.orEmpty()
            log("playback error slot=$slotName video=$videoId type=${error.errorCodeName}")
            if (slot?.player === currentSlot.player) {
                activePlayback = activePlayback.copy(
                    state = HomeFeedPlaybackState.ERROR,
                    errorMessage = error.errorCodeName,
                )
            }
        }

        override fun onVideoSizeChanged(videoSize: VideoSize) = Unit
    }

    private fun findSlot(player: ExoPlayer): PlayerSlot? {
        return when (player) {
            currentSlot.player -> currentSlot
            nextSlot.player -> nextSlot
            else -> null
        }
    }

    private fun slotName(slot: PlayerSlot?): String {
        return when (slot?.player) {
            currentSlot.player -> "CURRENT"
            nextSlot.player -> "NEXT"
            else -> "UNKNOWN"
        }
    }

    private inner class PlayerSlot(
        val player: ExoPlayer,
        var assignedVideoId: String? = null,
        var assignedUrl: String? = null,
        var isPrepared: Boolean = false,
        var preloadStartedAtMs: Long = 0L,
    ) {
        fun matches(videoId: String, url: String): Boolean {
            return assignedVideoId == videoId && assignedUrl == url
        }

        fun assign(videoId: String, url: String) {
            if (matches(videoId, url) && isPrepared) {
                log("prepare skipped video=$videoId")
                return
            }
            assignedVideoId = videoId
            assignedUrl = url
            isPrepared = false
            preloadStartedAtMs = SystemClock.elapsedRealtime()
            player.volume = if (player === currentSlot.player) 1f else 0f
            player.playWhenReady = false
            player.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
            player.prepare()
        }

        fun clearAssignment() {
            assignedVideoId = null
            assignedUrl = null
            isPrepared = false
            preloadStartedAtMs = 0L
            player.volume = 0f
            player.playWhenReady = false
            player.pause()
        }

        fun release() {
            player.volume = 0f
            player.playWhenReady = false
            player.release()
        }
    }

    private fun log(message: String) {
        Log.d(LOG_TAG, message)
    }

    private companion object {
        const val LOG_TAG = "HomeFeedPlayer"
    }
}

@OptIn(UnstableApi::class)
private object HomeFeedMediaCache {
    private const val MAX_CACHE_BYTES = 128L * 1024L * 1024L

    @Volatile
    private var cache: SimpleCache? = null

    fun get(context: Context): SimpleCache {
        return cache ?: synchronized(this) {
            cache ?: SimpleCache(
                File(context.cacheDir, "home-feed-media"),
                LeastRecentlyUsedCacheEvictor(MAX_CACHE_BYTES),
                StandaloneDatabaseProvider(context),
            ).also { cache = it }
        }
    }
}
