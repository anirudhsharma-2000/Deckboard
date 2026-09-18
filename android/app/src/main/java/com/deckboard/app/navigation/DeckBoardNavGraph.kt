package com.deckboard.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.deckboard.app.DeckBoardApp
import com.deckboard.app.ui.grid.ButtonGridScreen
import com.deckboard.app.ui.grid.ButtonGridViewModel
import com.deckboard.app.ui.grid.ButtonGridViewModelFactory
import com.deckboard.app.ui.pairing.ManualEntryScreen
import com.deckboard.app.ui.pairing.PairingEntryScreen
import com.deckboard.app.ui.pairing.PairingViewModel
import com.deckboard.app.ui.pairing.PairingViewModelFactory
import com.deckboard.app.ui.pairing.QrScannerScreen

private object Routes {
    const val PAIRING_ENTRY = "pairing_entry"
    const val QR_SCANNER = "qr_scanner"
    const val MANUAL_ENTRY = "manual_entry"
    const val BUTTON_GRID = "button_grid"
}

@Composable
fun DeckBoardNavGraph(navController: NavHostController = rememberNavController()) {
    val app = LocalContext.current.applicationContext as DeckBoardApp
    val pairingViewModel: PairingViewModel = viewModel(factory = PairingViewModelFactory(app.pairingRepository))

    NavHost(navController = navController, startDestination = Routes.PAIRING_ENTRY) {
        composable(Routes.PAIRING_ENTRY) {
            PairingEntryScreen(
                viewModel = pairingViewModel,
                onPaired = {
                    navController.navigate(Routes.BUTTON_GRID) {
                        popUpTo(Routes.PAIRING_ENTRY) { inclusive = true }
                    }
                },
                onScanQr = { navController.navigate(Routes.QR_SCANNER) },
                onManualEntry = { navController.navigate(Routes.MANUAL_ENTRY) },
            )
        }
        composable(Routes.QR_SCANNER) {
            QrScannerScreen(
                onCodeScanned = { raw ->
                    pairingViewModel.onQrScanned(raw)
                    navController.popBackStack(Routes.PAIRING_ENTRY, inclusive = false)
                },
                onCancel = { navController.popBackStack() },
            )
        }
        composable(Routes.MANUAL_ENTRY) {
            ManualEntryScreen(
                onSubmit = { host, port, pin ->
                    pairingViewModel.onManualEntry(host, port, pin)
                    navController.popBackStack(Routes.PAIRING_ENTRY, inclusive = false)
                },
            )
        }
        composable(Routes.BUTTON_GRID) {
            val gridViewModel: ButtonGridViewModel = viewModel(
                factory = ButtonGridViewModelFactory(app.socketClient, app.pairingRepository),
            )
            ButtonGridScreen(
                viewModel = gridViewModel,
                onDisconnected = {
                    pairingViewModel.resetToNeedsPairing()
                    navController.navigate(Routes.PAIRING_ENTRY) {
                        popUpTo(Routes.BUTTON_GRID) { inclusive = true }
                    }
                },
            )
        }
    }
}
