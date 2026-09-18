package com.deckboard.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.deckboard.app.data.socket.ConnectionState

@Composable
fun ConnectionStatusBar(state: ConnectionState, modifier: Modifier = Modifier) {
    val (color, label) = when (state) {
        is ConnectionState.Paired -> Color(0xFF10B981) to "Connected"
        ConnectionState.Connecting -> Color(0xFFF59E0B) to "Connecting…"
        ConnectionState.AwaitingPairing -> Color(0xFFF59E0B) to "Pairing…"
        ConnectionState.Disconnected -> Color(0xFFEF4444) to "Reconnecting…"
        is ConnectionState.Error -> Color(0xFFEF4444) to "Error: ${state.message}"
    }
    val animatedColor by animateColorAsState(targetValue = color, label = "connectionStatusColor")

    Row(
        modifier = modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(animatedColor.copy(alpha = 0.14f))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(animatedColor),
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = label, style = MaterialTheme.typography.labelMedium, color = animatedColor)
        }
    }
}
