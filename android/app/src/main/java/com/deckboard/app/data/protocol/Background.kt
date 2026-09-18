package com.deckboard.app.data.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Mirrors shared/src/background.ts — see docs/protocol.md. Keep BackgroundPresets
// in sync with BACKGROUND_PRESETS by hand whenever presets change.
@Serializable
sealed class BackgroundConfig {
    @Serializable
    @SerialName("none")
    data object None : BackgroundConfig()

    @Serializable
    @SerialName("preset")
    data class Preset(val presetId: String) : BackgroundConfig()

    @Serializable
    @SerialName("custom")
    data class Custom(val url: String) : BackgroundConfig()
}

data class BackgroundPreset(val id: String, val name: String, val colors: Pair<Long, Long>)

object BackgroundPresets {
    val all: List<BackgroundPreset> = listOf(
        BackgroundPreset("midnight", "Midnight", 0xFF0F172A to 0xFF1E293B),
        BackgroundPreset("sunset", "Sunset", 0xFFF97316 to 0xFFEC4899),
        BackgroundPreset("ocean", "Ocean", 0xFF0EA5E9 to 0xFF0F172A),
        BackgroundPreset("forest", "Forest", 0xFF065F46 to 0xFF022C22),
        BackgroundPreset("violet", "Violet", 0xFF7C3AED to 0xFF1E1B4B),
        BackgroundPreset("graphite", "Graphite", 0xFF27272A to 0xFF09090B),
    )

    fun find(id: String): BackgroundPreset? = all.firstOrNull { it.id == id }
}
