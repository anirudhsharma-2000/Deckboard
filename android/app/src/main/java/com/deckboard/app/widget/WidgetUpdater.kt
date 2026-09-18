package com.deckboard.app.widget

import android.content.Context
import androidx.glance.appwidget.updateAll

object WidgetUpdater {
    suspend fun refreshAll(context: Context) {
        DeckBoardWidget().updateAll(context)
    }
}
