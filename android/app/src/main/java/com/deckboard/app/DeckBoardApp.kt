package com.deckboard.app

import android.app.Application
import androidx.lifecycle.ProcessLifecycleOwner
import com.deckboard.app.data.pairing.PairingRepository
import com.deckboard.app.data.settings.AppPreferences
import com.deckboard.app.data.socket.DeckSocketClient

/** Holds app-scoped singletons so the WebSocket connection survives screen
 * navigation and backgrounding. No DI framework — three objects is simple
 * enough to wire up by hand. */
class DeckBoardApp : Application() {

    lateinit var preferences: AppPreferences
        private set
    lateinit var socketClient: DeckSocketClient
        private set
    lateinit var pairingRepository: PairingRepository
        private set

    override fun onCreate() {
        super.onCreate()
        preferences = AppPreferences(this)
        socketClient = DeckSocketClient(applicationContext)
        pairingRepository = PairingRepository(applicationContext, socketClient, preferences)
        ProcessLifecycleOwner.get().lifecycle.addObserver(socketClient)
    }
}
