package com.app.natureswayproduction.nativeapp.feature.live.broadcast

enum class LiveBroadcastState {
    IDLE,
    PREVIEW,
    CREATING_SESSION,
    PREPARING_ENCODER,
    CONNECTING,
    LIVE,
    RECONNECTING,
    STOPPING,
    ENDED,
    ERROR,
}
