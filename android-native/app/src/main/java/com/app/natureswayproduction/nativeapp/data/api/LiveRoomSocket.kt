package com.app.natureswayproduction.nativeapp.data.api

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.min
import kotlin.random.Random
import kotlinx.coroutines.launch

class LiveRoomSocket(
    private val tokenProvider: suspend () -> LiveRoomTokenResponse,
    private val onEvent: (JSONObject) -> Unit,
    private val onState: (String) -> Unit,
    private val onReconnect: () -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient.Builder().pingInterval(25, TimeUnit.SECONDS).build()
    private var socket: WebSocket? = null
    private var stopped = false
    private var attempt = 0
    private var reconnectScheduled = false
    private val heartbeat = object : Runnable {
        override fun run() {
            if (!stopped) {
                socket?.send("{\"type\":\"presence.ping\"}")
                handler.postDelayed(this, 25_000L)
            }
        }
    }

    suspend fun connect(reconnecting: Boolean = false) {
        if (stopped) return
        val room = tokenProvider()
        val url = room.wsUrl ?: run { postState("unavailable"); return }
        socket = client.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                socket = webSocket
                attempt = 0
                reconnectScheduled = false
                handler.removeCallbacks(heartbeat)
                handler.postDelayed(heartbeat, 25_000L)
                postState("connected")
                if (reconnecting) handler.post(onReconnect)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching { JSONObject(text) }.getOrNull()?.let { event -> handler.post { onEvent(event) } }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                handler.removeCallbacks(heartbeat)
                postState(if (code == 4000) "closed" else "disconnected")
                if (!stopped && code != 4000) scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                handler.removeCallbacks(heartbeat)
                postState("reconnecting")
                if (!stopped) scheduleReconnect()
            }
        })
    }

    fun close() {
        stopped = true
        handler.removeCallbacksAndMessages(null)
        socket?.close(1000, "Viewer left room")
        client.dispatcher.executorService.shutdown()
    }

    private fun scheduleReconnect() {
        if (stopped || reconnectScheduled) return
        reconnectScheduled = true
        val delayMs = min(15_000L, 750L * (1L shl min(attempt, 5))) + Random.nextLong(300)
        attempt += 1
        handler.postDelayed({
            reconnectScheduled = false
            if (stopped) return@postDelayed
            kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
                runCatching { connect(true) }.onFailure { scheduleReconnect() }
            }
        }, delayMs)
    }

    private fun postState(state: String) = handler.post { onState(state) }
}
