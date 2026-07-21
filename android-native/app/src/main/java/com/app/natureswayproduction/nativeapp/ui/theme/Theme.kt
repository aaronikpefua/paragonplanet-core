package com.app.natureswayproduction.nativeapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val ParagonColorScheme = darkColorScheme(
    primary = ParagonGold,
    background = ParagonBlack,
    surface = ParagonSurface,
)

@Composable
fun ParagonPlanetTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ParagonColorScheme,
        content = content,
    )
}
