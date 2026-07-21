package com.app.natureswayproduction.nativeapp.feature.wallet

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.app.natureswayproduction.nativeapp.data.api.WalletBankOption
import com.app.natureswayproduction.nativeapp.data.api.WalletProduct

@Composable
fun WalletScreen(walletViewModel: WalletViewModel) {
    val state by walletViewModel.uiState.collectAsState()
    val activity = LocalContext.current.findActivity()
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(state.pendingExternalUrl) {
        state.pendingExternalUrl?.let { url ->
            uriHandler.openUri(url)
            walletViewModel.consumePendingExternalUrl()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF3EEE3))
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            item {
                WalletBalanceCard(
                    parag = state.balance.parag,
                    gbazilo = state.balance.gbazilo
                )
            }

            item {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    WalletActionButton(
                        label = "Convert PARAG \u2192 GBAZILO",
                        enabled = !state.isConverting,
                        onClick = walletViewModel::convertParagToGbazilo
                    )
                    WalletActionButton(
                        label = "Convert GBAZILO \u2192 PARAG",
                        enabled = !state.isConverting,
                        onClick = walletViewModel::convertGbaziloToParag
                    )
                    WalletActionButton(
                        label = "Deposit to Fund Your Wallet",
                        onClick = walletViewModel::openDeposit
                    )
                    WalletActionButton(
                        label = "Withdraw",
                        onClick = walletViewModel::openWithdraw
                    )
                }
            }

            item {
                Text(
                    text = "Transaction History",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
            }

            if (state.transactions.isEmpty() && !state.isLoading) {
                item {
                    WalletInfoCard("No transactions yet.")
                }
            } else {
                items(state.transactions, key = { it.id }) { tx ->
                    TransactionRow(tx)
                }
            }

            state.message?.takeIf { it.isNotBlank() }?.let { message ->
                item {
                    WalletInfoCard(message)
                }
            }
        }

        if (state.isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center),
                color = Color(0xFFD3A62D)
            )
        }
    }

    if (state.showDeposit) {
        DepositDialog(
            state = state,
            activity = activity,
            onAmountChange = walletViewModel::updateDepositAmount,
            onGoogleBuy = { productId ->
                if (activity != null) {
                    walletViewModel.purchase(activity, productId)
                }
            },
            onProceedPaystack = walletViewModel::handleDepositPaystack,
            onClose = walletViewModel::closeDeposit
        )
    }

    if (state.showWithdraw) {
        WithdrawDialog(
            state = state,
            onSelectBank = walletViewModel::updateSelectedBank,
            onAccountNumberChange = walletViewModel::updateAccountNumber,
            onWithdrawAmountChange = walletViewModel::updateWithdrawAmount,
            onVerify = walletViewModel::verifyAccount,
            onSubmit = walletViewModel::handleWithdraw,
            onClose = walletViewModel::closeWithdraw
        )
    }
}

@Composable
private fun WalletBalanceCard(
    parag: Int,
    gbazilo: Int,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF111111)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Wallet Balance",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = "$parag PARAG",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = "$gbazilo GBAZILO",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun WalletActionButton(
    label: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
    ) {
        Text(label, color = Color.White)
    }
}

@Composable
private fun TransactionRow(tx: WalletTransactionItem) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(tx.direction, fontWeight = FontWeight.Bold, color = Color.Black)
                Text(tx.currency, color = Color(0xFF5E5E5E))
                if (tx.createdAtText.isNotBlank()) {
                    Text(tx.createdAtText, color = Color(0xFF7A7A7A), style = MaterialTheme.typography.bodySmall)
                }
            }
            Text(
                text = "${if (tx.direction.equals("credit", true)) "+" else "-"}${tx.amount}",
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
        }
    }
}

@Composable
private fun WalletInfoCard(text: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(10.dp)
    ) {
        Text(
            text = text,
            color = Color.Black,
            modifier = Modifier.padding(14.dp)
        )
    }
}

@Composable
private fun DepositDialog(
    state: WalletUiState,
    activity: Activity?,
    onAmountChange: (String) -> Unit,
    onGoogleBuy: (String) -> Unit,
    onProceedPaystack: () -> Unit,
    onClose: () -> Unit,
) {
    Dialog(onDismissRequest = onClose) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Buy Package To Fund Your Account", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

                if (state.googleBillingMessage.isNotBlank()) {
                    Text(state.googleBillingMessage, color = Color(0xFF5E5E5E))
                }

                if (state.products.isNotEmpty()) {
                    Text("Parag and Gbazilo Packages", fontWeight = FontWeight.Bold)
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        state.products.forEach { product ->
                            GooglePackCard(
                                product = product,
                                busy = state.purchaseInFlightProductId == product.productId,
                                enabled = activity != null,
                                onBuy = { onGoogleBuy(product.productId) }
                            )
                        }
                    }
                }

                Text("Paystack", fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = state.depositAmount,
                    onValueChange = onAmountChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Enter amount") }
                )

                if (state.depositMessage.isNotBlank()) {
                    Text(state.depositMessage, color = Color(0xFF6B4F00))
                }

                Button(
                    onClick = onProceedPaystack,
                    enabled = !state.isProcessing,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                ) {
                    Text(if (state.isProcessing) "Processing..." else "Proceed to Paystack", color = Color.White)
                }

                Surface(
                    color = Color(0xFFD0D0D0),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.clickable(onClick = onClose)
                ) {
                    Text(
                        text = "Cancel",
                        color = Color.Black,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun GooglePackCard(
    product: WalletProduct,
    busy: Boolean,
    enabled: Boolean,
    onBuy: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF7F7F7)),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text("${product.parag} PARAG / ${product.gbazilo} GBAZILO", fontWeight = FontWeight.Bold)
            Text(product.displayName, color = Color.Black)
            if (product.priceLabel.isNotBlank()) {
                Text(product.priceLabel, color = Color(0xFF6B4F00))
            }
            Button(
                onClick = onBuy,
                enabled = enabled && !busy,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
            ) {
                Text(if (busy) "Processing..." else "Buy with Google Billing", color = Color.White)
            }
        }
    }
}

@Composable
private fun WithdrawDialog(
    state: WalletUiState,
    onSelectBank: (String) -> Unit,
    onAccountNumberChange: (String) -> Unit,
    onWithdrawAmountChange: (String) -> Unit,
    onVerify: () -> Unit,
    onSubmit: () -> Unit,
    onClose: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedBankName = state.banks.firstOrNull { it.code == state.selectedBankCode }?.name ?: "Select Bank"

    Dialog(onDismissRequest = onClose) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Withdraw Funds", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

                Box {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color.White,
                        tonalElevation = 1.dp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { expanded = true }
                    ) {
                        Text(
                            text = selectedBankName,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
                            color = Color.Black
                        )
                    }
                    DropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        state.banks.forEach { bank ->
                            DropdownMenuItem(
                                text = { Text(bank.name) },
                                onClick = {
                                    expanded = false
                                    onSelectBank(bank.code)
                                }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = state.accountNumber,
                    onValueChange = onAccountNumberChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Account Number") }
                )

                Button(
                    onClick = onVerify,
                    enabled = !state.isVerifyingAccount,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                ) {
                    Text(if (state.isVerifyingAccount) "Verifying..." else "Verify Account", color = Color.White)
                }

                if (state.accountName.isNotBlank()) {
                    WalletInfoCard("Account Name: ${state.accountName}")
                    OutlinedTextField(
                        value = state.withdrawAmount,
                        onValueChange = onWithdrawAmountChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Enter amount") }
                    )
                    Button(
                        onClick = onSubmit,
                        enabled = !state.isProcessing,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                    ) {
                        Text(if (state.isProcessing) "Submitting..." else "Submit Withdrawal", color = Color.White)
                    }
                }

                Surface(
                    color = Color(0xFFD0D0D0),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.clickable(onClick = onClose)
                ) {
                    Text(
                        text = "Cancel",
                        color = Color.Black,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp)
                    )
                }
            }
        }
    }
}

private tailrec fun Context.findActivity(): Activity? {
    return when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
}
