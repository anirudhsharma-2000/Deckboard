package com.deckboard.app.data.protocol

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Mirrors shared/src/layout.ts — see docs/protocol.md.
@Serializable
sealed class ActionConfig {
    @Serializable
    @SerialName("none")
    data object None : ActionConfig()

    @Serializable
    @SerialName("open_url")
    data class OpenUrl(val url: String) : ActionConfig()

    @Serializable
    @SerialName("hotkey")
    data class Hotkey(val keys: List<String>) : ActionConfig()

    @Serializable
    @SerialName("obs_scene")
    data class ObsScene(val sceneName: String) : ActionConfig()

    @Serializable
    @SerialName("launch_app")
    data class LaunchApp(val appPath: String, val appName: String) : ActionConfig()

    @Serializable
    @SerialName("system")
    data class System(val command: String) : ActionConfig()
}

@Serializable
data class ButtonConfig(
    val id: String,
    val label: String,
    val icon: String,
    val action: ActionConfig,
)

@Serializable
data class PageConfig(
    val id: String,
    val name: String,
    // Defaults guard against decoding an older server's payload (or a
    // widget's stale cached layout from before pages had a size) that
    // doesn't include these fields.
    val rows: Int = 3,
    val columns: Int = 3,
    val buttons: List<ButtonConfig>,
)
