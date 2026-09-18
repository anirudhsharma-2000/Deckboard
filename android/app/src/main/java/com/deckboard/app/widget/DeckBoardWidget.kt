package com.deckboard.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.deckboard.app.data.settings.AppPreferences
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

private val SMALL = DpSize(140.dp, 70.dp)
private val MEDIUM = DpSize(200.dp, 110.dp)
private val LARGE = DpSize(280.dp, 150.dp)

private const val ICON_FETCH_TIMEOUT_MS = 4000L
private const val MAX_WIDGET_BUTTONS = 8

private data class WidgetButtonData(
    val id: String,
    val label: String,
    val icon: String,
    val bitmap: Bitmap?,
)

class DeckBoardWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val preferences = AppPreferences(context)
        val saved = preferences.getSavedPairing()
        val pages = preferences.getLastLayout()
        val buttons = pages?.firstOrNull()?.buttons?.take(MAX_WIDGET_BUTTONS).orEmpty()

        val buttonData = buttons.map { button ->
            val bitmap = if (saved != null && button.icon.startsWith("/api/icons/")) {
                fetchIconBitmap("http://${saved.host}:${saved.port}${button.icon}")
            } else {
                null
            }
            WidgetButtonData(button.id, button.label, button.icon, bitmap)
        }

        provideContent {
            GlanceTheme {
                WidgetContent(paired = saved != null, buttons = buttonData)
            }
        }
    }
}

@Composable
private fun WidgetContent(paired: Boolean, buttons: List<WidgetButtonData>) {
    val size = LocalSize.current
    val columns = when {
        size.width >= LARGE.width -> 4
        size.width >= MEDIUM.width -> 3
        else -> 2
    }
    val rows = if (size.height >= MEDIUM.height) 2 else 1
    val visible = buttons.take(columns * rows)

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.background)
            .padding(8.dp),
    ) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "DeckBoard",
                style = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp, color = GlanceTheme.colors.onBackground),
                modifier = GlanceModifier.defaultWeight(),
            )
            Text(
                text = "⟳",
                style = TextStyle(fontSize = 14.sp, color = GlanceTheme.colors.onBackground),
                modifier = GlanceModifier.clickable(actionRunCallback<RefreshLayoutAction>()),
            )
        }
        Spacer(modifier = GlanceModifier.height(6.dp))

        when {
            !paired -> Text(
                text = "Open the app and pair first",
                style = TextStyle(fontSize = 11.sp, color = GlanceTheme.colors.onBackground),
            )
            visible.isEmpty() -> Text(
                text = "No buttons yet — tap ⟳ to refresh",
                style = TextStyle(fontSize = 11.sp, color = GlanceTheme.colors.onBackground),
            )
            else -> {
                visible.chunked(columns).forEachIndexed { index, rowButtons ->
                    if (index > 0) Spacer(modifier = GlanceModifier.height(6.dp))
                    Row(modifier = GlanceModifier.fillMaxWidth()) {
                        rowButtons.forEachIndexed { i, button ->
                            if (i > 0) Spacer(modifier = GlanceModifier.width(6.dp))
                            WidgetButton(button, modifier = GlanceModifier.defaultWeight())
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WidgetButton(data: WidgetButtonData, modifier: GlanceModifier = GlanceModifier) {
    Box(
        modifier = modifier
            .height(56.dp)
            .background(GlanceTheme.colors.surfaceVariant)
            .cornerRadius(12.dp)
            .clickable(
                actionRunCallback<PressButtonAction>(
                    actionParametersOf(BUTTON_ID_KEY to data.id, BUTTON_LABEL_KEY to data.label),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        when {
            data.bitmap != null -> Image(
                provider = ImageProvider(data.bitmap),
                contentDescription = data.label,
                modifier = GlanceModifier.width(32.dp).height(32.dp),
                contentScale = ContentScale.Fit,
            )
            data.icon.isNotEmpty() && !data.icon.startsWith("/api/icons/") -> Text(
                text = data.icon,
                style = TextStyle(fontSize = 18.sp),
            )
            data.label.isNotEmpty() -> Text(
                text = data.label,
                style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color.White)),
                maxLines = 2,
            )
            else -> Text(text = "•", style = TextStyle(fontSize = 18.sp, color = ColorProvider(Color.White)))
        }
    }
}

/** Fetched directly (not via Coil — Glance images need a decoded Bitmap up
 * front in provideGlance, not an async-loading composable). */
private suspend fun fetchIconBitmap(url: String): Bitmap? = withContext(Dispatchers.IO) {
    try {
        val client = OkHttpClient.Builder()
            .connectTimeout(ICON_FETCH_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .readTimeout(ICON_FETCH_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .build()
        val request = Request.Builder().url(url).build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext null
            val bytes = response.body?.bytes() ?: return@withContext null
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }
    } catch (e: Exception) {
        null
    }
}
