package com.app.natureswayproduction.nativeapp.feature.onboarding

import androidx.compose.foundation.layout.height
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import androidx.compose.runtime.DisposableEffect

@Composable
fun MerchantMarketplaceScreen(
    onBack: () -> Unit,
    onOpenMerchantCenter: () -> Unit,
) {
    val repository = remember { MerchantMarketplaceRepository() }
    val scope = rememberCoroutineScope()
    var products by remember { mutableStateOf(emptyList<MarketplaceProductItem>()) }
    var orderMessages by remember { mutableStateOf(emptyList<MarketplaceOrderMessageItem>()) }
    var selectedProduct by remember { mutableStateOf<MarketplaceProductItem?>(null) }
    var activeOrder by remember { mutableStateOf<MarketplaceOrderItem?>(null) }
    var dealMessage by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }
    var isDealLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf<String?>(null) }
    var showMerchantAbout by remember { mutableStateOf(false) }
    var showBuyerInbox by remember { mutableStateOf(false) }
    var buyerOrders by remember { mutableStateOf(emptyList<MarketplaceOrderItem>()) }
    var selectedBuyerOrder by remember { mutableStateOf<MarketplaceOrderItem?>(null) }
    var buyerOrderMessages by remember { mutableStateOf(emptyList<MarketplaceOrderMessageItem>()) }
    var expandedPreviewProductId by remember { mutableStateOf<String?>(null) }
    var actionLoading by remember { mutableStateOf(false) }
    suspend fun reload() {
        isLoading = true
        error = null
        runCatching { repository.loadProducts() }
            .onSuccess {
                products = it.products
                buyerOrders = repository.loadBuyerOrders()
                if (selectedBuyerOrder != null) {
                    selectedBuyerOrder = buyerOrders.firstOrNull { order -> order.id == selectedBuyerOrder?.id }
                    buyerOrderMessages = selectedBuyerOrder?.let { order -> repository.loadOrderMessages(order) } ?: emptyList()
                }
            }
            .onFailure { error = it.message ?: "Marketplace could not load." }
        isLoading = false
    }

    LaunchedEffect(Unit) { reload() }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") }
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Paragon marketplace", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    Text("Digital Products", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = onOpenMerchantCenter,
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF176B4D), contentColor = Color.White)
                        ) {
                            Text("Sell Product")
                        }
                        Button(
                            onClick = {
                                showBuyerInbox = !showBuyerInbox
                                showMerchantAbout = false
                            },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                        ) {
                            Text("Buyer Inbox")
                        }
                    }
                }
            }
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            showMerchantAbout = !showMerchantAbout
                            if (showMerchantAbout) showBuyerInbox = false
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                    ) {
                        Text(if (showMerchantAbout) "Hide About The Merchants" else "About The Merchants")
                    }
                    if (showMerchantAbout) {
                        MerchantMarketplaceAboutContent()
                    }
                }
            }
        }

        if (isLoading) {
            item { CircularProgressIndicator(color = Color(0xFFD3A62E)) }
        }

        error?.let { message ->
            item { Text(message, color = Color(0xFFB00020), fontWeight = FontWeight.Bold) }
        }
        note?.let { message ->
            item { Text(message, color = Color(0xFF176B4D), fontWeight = FontWeight.Bold) }
        }

        if (showBuyerInbox) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("Buyer Inbox", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                        if (buyerOrders.isEmpty()) {
                            Text("No buyer inbox messages yet.", color = Color(0xFF5A534A))
                        } else {
                            buyerOrders.forEach { order ->
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = if (selectedBuyerOrder?.id == order.id) Color(0xFFFFF7E3) else Color(0xFFF9F5EE)),
                                    shape = RoundedCornerShape(14.dp)
                                ) {
                                    Button(
                                        onClick = {
                                            selectedBuyerOrder = order
                                            scope.launch {
                                                buyerOrderMessages = repository.loadOrderMessages(order)
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, contentColor = Color(0xFF111111))
                                    ) {
                                        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Text(order.productName, fontWeight = FontWeight.ExtraBold)
                                            Text(order.merchantName)
                                            Text("${order.amount.toInt()} ${order.currency}")
                                        }
                                    }
                                }
                            }
                        }

                        selectedBuyerOrder?.let { order ->
                            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF9F5EE)), shape = RoundedCornerShape(14.dp)) {
                                Column(
                                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Text(order.productName, fontWeight = FontWeight.ExtraBold)
                                    Text("Merchant: ${order.merchantName}", color = Color(0xFF5A534A))
                                    Text(
                                        marketplaceStatusLabel(order.status),
                                        color = marketplaceStatusColor(order.status),
                                        fontWeight = FontWeight.Bold
                                    )
                                    if (buyerOrderMessages.isEmpty()) {
                                        Text("No messages yet.", color = Color(0xFF5A534A))
                                    } else {
                                        buyerOrderMessages.forEach { message ->
                                            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(12.dp)) {
                                                Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Text(message.senderName, fontWeight = FontWeight.Bold)
                                                    Text(message.text)
                                                }
                                            }
                                        }
                                    }
                                    if (order.status == "final_offer_sent") {
                                        Card(
                                            colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                                Text("Final Offer: ${order.amount.toInt()} ${order.currency}", fontWeight = FontWeight.ExtraBold)
                                                Text("Accept to pay from your Paragon Planet Wallet.", color = Color(0xFF5A534A))
                                                Button(
                                                    onClick = {
                                                        scope.launch {
                                                            actionLoading = true
                                                            note = null
                                                            runCatching { repository.settleOrder(order) }
                                                                .onSuccess { ok ->
                                                                    if (ok) {
                                                                        selectedBuyerOrder = order.copy(status = "paid")
                                                                        buyerOrders = buyerOrders.map { o -> if (o.id == order.id) o.copy(status = "paid") else o }
                                                                        note = "Payment successful! Awaiting delivery."
                                                                    } else {
                                                                        note = "Payment failed. Check your wallet balance."
                                                                    }
                                                                }
                                                                .onFailure { err -> note = err.message ?: "Payment failed." }
                                                            actionLoading = false
                                                        }
                                                    },
                                                    enabled = !actionLoading,
                                                    shape = RoundedCornerShape(8.dp),
                                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF176B4D), contentColor = Color.White)
                                                ) {
                                                    Text(if (actionLoading) "Processing…" else "Pay ${order.amount.toInt()} ${order.currency} from Wallet")
                                                }
                                            }
                                        }
                                    }
                                    if (order.status == "delivering" || order.status == "delivered") {
                                        Button(
                                            onClick = {
                                                scope.launch {
                                                    actionLoading = true
                                                    note = null
                                                    runCatching { repository.confirmDelivery(order) }
                                                        .onSuccess {
                                                            selectedBuyerOrder = order.copy(status = "completed")
                                                            buyerOrders = buyerOrders.map { o -> if (o.id == order.id) o.copy(status = "completed") else o }
                                                            note = "Transaction completed. Thank you!"
                                                        }
                                                        .onFailure { err -> note = err.message ?: "Could not confirm delivery." }
                                                    actionLoading = false
                                                }
                                            },
                                            enabled = !actionLoading,
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(8.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF176B4D), contentColor = Color.White)
                                        ) {
                                            Text(if (actionLoading) "Confirming…" else "Confirm Delivery — Complete Transaction")
                                        }
                                    }
                                    if (order.status == "completed") {
                                        Text("✅ Transaction completed.", color = Color(0xFF176B4D), fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!isLoading && products.isEmpty()) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                    Text("No merchant products yet.", modifier = Modifier.padding(18.dp), color = Color(0xFF5A534A))
                }
            }
        }

        items(products) { product ->
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            expandedPreviewProductId = if (expandedPreviewProductId == product.id) null else product.id
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                    ) {
                        Text(if (expandedPreviewProductId == product.id) "Hide Preview" else "Load Preview")
                    }
                    if (expandedPreviewProductId == product.id) {
                        MarketplaceProductMediaPreview(product = product)
                    }
                    Text(product.merchantName, color = Color(0xFF6B5F4B), fontWeight = FontWeight.Bold)
                    Text(product.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
                    if (product.description.isNotBlank()) Text(product.description, color = Color(0xFF232323))
                    if (product.materials.isNotBlank()) Text("Materials: ${product.materials}", color = Color(0xFF5A534A))
                    Text("${product.priceText} ${product.currency}", fontWeight = FontWeight.ExtraBold)
                    Button(
                        onClick = {
                            scope.launch {
                                isDealLoading = true
                                runCatching { repository.openDealPanel(product) }
                                    .onSuccess { dealState ->
                                        selectedProduct = product
                                        activeOrder = dealState.order
                                        orderMessages = dealState.messages
                                    }
                                    .onFailure { error = it.message ?: "Could not open private deal." }
                                isDealLoading = false
                            }
                        },
                        enabled = !product.isOwnProduct,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = if (product.isOwnProduct) Color(0xFFB9B2A8) else Color(0xFF176B4D), contentColor = Color.White)
                    ) {
                        Text(if (product.isOwnProduct) "Your Product" else "Chat / Agree Deal")
                    }

                    Text(
                        "Questions and price negotiation stay inside the private deal inbox.",
                        color = Color(0xFF111111),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        selectedProduct?.let { product ->
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MarketplaceProductMediaPreview(product = product)
                        Text("Private buyer and merchant space", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        Text(product.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                        if (product.description.isNotBlank()) Text(product.description, color = Color(0xFF232323))
                        if (product.materials.isNotBlank()) Text("Materials: ${product.materials}", color = Color(0xFF5A534A))
                        Text("${product.priceText} ${product.currency}", fontWeight = FontWeight.ExtraBold)

                        if (isDealLoading) {
                            CircularProgressIndicator(color = Color(0xFFD3A62E))
                        } else if (orderMessages.isEmpty()) {
                            Text(
                                "Start the conversation with the merchant. Discuss quantity, delivery, pickup, and final agreement here.",
                                color = Color(0xFF5A534A)
                            )
                        } else {
                            orderMessages.forEach { message ->
                                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF9F5EE)), shape = RoundedCornerShape(12.dp)) {
                                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(message.senderName, fontWeight = FontWeight.Bold)
                                        Text(message.text)
                                    }
                                }
                            }
                        }

                        OutlinedTextField(
                            value = dealMessage,
                            onValueChange = { dealMessage = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Message the merchant privately") },
                            colors = websiteFieldColors(),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Button(
                                onClick = {
                                    val order = activeOrder ?: return@Button
                                    scope.launch {
                                        runCatching {
                                            repository.sendDealMessage(order, product, dealMessage)
                                        }.onSuccess {
                                            dealMessage = ""
                                            orderMessages = repository.loadOrderMessages(order)
                                        }.onFailure { error = it.message ?: "Message could not be sent." }
                                    }
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                            ) {
                                Text("Send")
                            }
                            Button(
                                onClick = {
                                    note = "${product.currency} payment should continue from this deal."
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF176B4D), contentColor = Color.White)
                            ) {
                                Text("Start Payment")
                            }
                        }
                    }
                }
            }
        }
    }
}

private class MerchantMarketplaceRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val apiService: ParagonApiService = ParagonApiService(),
) {
    suspend fun loadProducts(): MarketplaceLoadResult = withContext(Dispatchers.IO) {
        val currentUid = auth.currentUser?.uid
        val products = firestore.collection("merchant_products")
            .whereEqualTo("status", "active")
            .get()
            .await()
            .documents
            .map { doc ->
                val data = doc.data.orEmpty()
                val priceValue = when (val raw = data["price"]) {
                    is Number -> raw.toDouble()
                    is String -> raw.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                MarketplaceProductItem(
                    id = doc.id,
                    merchantId = data["merchantId"] as? String ?: "",
                    merchantName = data["merchantName"] as? String ?: "Merchant",
                    name = data["name"] as? String ?: data["title"] as? String ?: "Untitled product",
                    description = data["description"] as? String ?: "",
                    materials = data["materials"] as? String ?: "",
                    priceValue = priceValue,
                    priceText = priceValue.toInt().toString(),
                    currency = data["currency"] as? String ?: "PARAG",
                    mediaUrl = data["mediaUrl"] as? String ?: "",
                    streamUrl = data["streamUrl"] as? String ?: "",
                    originalUrl = data["originalUrl"] as? String ?: "",
                    mediaType = data["mediaType"] as? String ?: "",
                    isOwnProduct = currentUid != null && currentUid == (data["merchantId"] as? String ?: "")
                )
            }
            .sortedByDescending { it.id }

        MarketplaceLoadResult(products)
    }

    suspend fun openDealPanel(product: MarketplaceProductItem): MarketplaceDealState = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Login first.")
        if (product.merchantId == user.uid) {
            throw IllegalStateException("You cannot buy your own product.")
        }

        val existing = firestore.collection("merchant_orders")
            .whereEqualTo("productId", product.id)
            .whereEqualTo("buyerId", user.uid)
            .get()
            .await()
            .documents
            .firstOrNull()

        val order = if (existing == null) {
            val orderRef = firestore.collection("merchant_orders").document()
            orderRef.set(
                mapOf(
                    "productId" to product.id,
                    "productName" to product.name,
                    "buyerId" to user.uid,
                    "buyerName" to (user.displayName ?: user.email ?: "Buyer"),
                    "merchantId" to product.merchantId,
                    "merchantName" to product.merchantName,
                    "amount" to product.priceValue,
                    "currency" to product.currency,
                    "paymentMethod" to product.currency.lowercase(),
                    "paymentStatus" to "not_started",
                    "productMediaUrl" to product.mediaUrl,
                    "productStreamUrl" to product.streamUrl,
                    "productOriginalUrl" to product.originalUrl,
                    "productMediaType" to product.mediaType,
                    "status" to "chat_open",
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
            MarketplaceOrderItem(
                id = orderRef.id,
                productId = product.id,
                productName = product.name,
                buyerId = user.uid,
                buyerName = user.displayName ?: user.email ?: "Buyer",
                merchantId = product.merchantId,
                merchantName = product.merchantName,
                amount = product.priceValue,
                currency = product.currency,
            )
        } else {
            val data = existing.data.orEmpty()
            MarketplaceOrderItem(
                id = existing.id,
                productId = data["productId"] as? String ?: product.id,
                productName = data["productName"] as? String ?: product.name,
                buyerId = data["buyerId"] as? String ?: user.uid,
                buyerName = data["buyerName"] as? String ?: user.email ?: "Buyer",
                merchantId = data["merchantId"] as? String ?: product.merchantId,
                merchantName = data["merchantName"] as? String ?: product.merchantName,
                amount = (data["amount"] as? Number)?.toDouble() ?: product.priceValue,
                currency = data["currency"] as? String ?: product.currency,
            )
        }

        MarketplaceDealState(order, loadOrderMessages(order))
    }

    suspend fun loadOrderMessages(order: MarketplaceOrderItem): List<MarketplaceOrderMessageItem> = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Login first.")
        firestore.collection("merchant_order_messages")
            .whereEqualTo("orderId", order.id)
            .whereEqualTo("buyerId", user.uid)
            .get()
            .await()
            .documents
            .map { doc ->
                val data = doc.data.orEmpty()
                MarketplaceOrderMessageItem(
                    id = doc.id,
                    senderName = data["senderName"] as? String ?: "Member",
                    text = data["text"] as? String ?: "",
                    createdAtMillis = (data["createdAt"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
                )
            }
            .sortedBy { it.createdAtMillis }
    }

    suspend fun loadBuyerOrders(): List<MarketplaceOrderItem> = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext emptyList()
        firestore.collection("merchant_orders")
            .whereEqualTo("buyerId", user.uid)
            .get()
            .await()
            .documents
            .map { doc ->
                val data = doc.data.orEmpty()
                MarketplaceOrderItem(
                    id = doc.id,
                    productId = data["productId"] as? String ?: "",
                    productName = data["productName"] as? String ?: "Product request",
                    buyerId = data["buyerId"] as? String ?: user.uid,
                    buyerName = data["buyerName"] as? String ?: user.email ?: "Buyer",
                    merchantId = data["merchantId"] as? String ?: "",
                    merchantName = data["merchantName"] as? String ?: "Merchant",
                    amount = (data["amount"] as? Number)?.toDouble() ?: 0.0,
                    currency = data["currency"] as? String ?: "PARAG",
                    status = data["status"] as? String ?: "chat_open",
                    productMediaUrl = data["productMediaUrl"] as? String ?: "",
                    productStreamUrl = data["productStreamUrl"] as? String ?: "",
                    productOriginalUrl = data["productOriginalUrl"] as? String ?: "",
                    productMediaType = data["productMediaType"] as? String ?: "",
                )
            }
            .sortedByDescending { it.id }
    }

    suspend fun sendDealMessage(order: MarketplaceOrderItem, product: MarketplaceProductItem, text: String) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Login first.")
        val trimmed = text.trim()
        if (trimmed.isBlank()) return@withContext
        firestore.collection("merchant_order_messages").add(
            mapOf(
                "orderId" to order.id,
                "productId" to order.productId,
                "productName" to order.productName,
                "buyerId" to order.buyerId,
                "buyerName" to order.buyerName,
                "merchantId" to order.merchantId,
                "merchantName" to order.merchantName,
                "amount" to order.amount,
                "currency" to order.currency,
                "productMediaUrl" to product.mediaUrl,
                "productStreamUrl" to product.streamUrl,
                "productOriginalUrl" to product.originalUrl,
                "productMediaType" to product.mediaType,
                "senderId" to user.uid,
                "senderName" to (user.displayName ?: user.email ?: "Buyer"),
                "text" to trimmed,
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }
    suspend fun settleOrder(order: MarketplaceOrderItem): Boolean = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Login first.")
        val idToken = user.getIdToken(false).await().token
            ?: throw IllegalStateException("Could not obtain auth token.")
        apiService.settleMarketplaceOrder(idToken = idToken, orderId = order.id)
    }

    suspend fun confirmDelivery(order: MarketplaceOrderItem) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Login first.")
        val orderId = order.id.ifBlank { return@withContext }

        firestore.collection("merchant_orders").document(orderId).update(
            mapOf(
                "status" to "completed",
                "completedAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            )
        ).await()

        firestore.collection("merchant_order_messages").add(
            mapOf(
                "orderId" to orderId,
                "productId" to order.productId,
                "productName" to order.productName,
                "buyerId" to order.buyerId,
                "buyerName" to order.buyerName,
                "merchantId" to order.merchantId,
                "merchantName" to order.merchantName,
                "senderId" to user.uid,
                "senderName" to (user.displayName ?: user.email ?: "Buyer"),
                "text" to "✅ Delivery confirmed. Transaction completed.",
                "type" to "delivery_confirmation",
                "readBy" to listOf(user.uid),
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }
}


    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("About The Merchants", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
        Text(
            "Paragon Planet Merchants are users within the Paragon Planet ecosystem who are authorized to upload, showcase, promote, negotiate, and sell digital products and software-based services to buyers across the Planet.",
            color = Color(0xFF232323)
        )
        Text(
            "Any user within the ecosystem may qualify to operate as a Merchant by creating and listing approved digital products through their respective Merchant spaces within the Platform.",
            color = Color(0xFF232323)
        )
        Text(
            "Merchants are expected to upload their digital products together with their respective prices, descriptions, previews, and delivery information for interested buyers to view, negotiate, bargain, and agree upon the actual purchase price.",
            color = Color(0xFF232323)
        )
        Text(
            "The Merchant system allows direct interaction between sellers and buyers through communication, negotiations, offers, and agreements within the Paragon Planet marketplace environment.",
            color = Color(0xFF232323)
        )
        Text("The categories of products that may be sold by Merchants include:", fontWeight = FontWeight.Bold)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            merchantProductTypes.forEach { item ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF9F5EE)), shape = RoundedCornerShape(10.dp)) {
                    Text(item, modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp), color = Color(0xFF5A534A))
                }
            }
        }
        Text(
            "Payments for approved digital products may be processed through supported digital billing systems, including Google Billing and other authorized payment systems integrated into the Platform.",
            color = Color(0xFF232323)
        )
        Text("Merchants are expected to:", fontWeight = FontWeight.Bold)
        listOf(
            "Upload authentic and approved digital products",
            "Maintain fair pricing and honest negotiations",
            "Deliver quality digital services and products",
            "Respect intellectual property rights",
            "Avoid fraudulent, illegal, or prohibited materials",
            "Build trusted relationships with buyers",
            "Maintain positive ratings, reviews, and marketplace reputation",
        ).forEach { item ->
            Text("• $item", color = Color(0xFF232323))
        }
        Text(
            "As Merchants gain sales, visibility, customer trust, ratings, and audience engagement, they unlock greater marketplace exposure, promotional advantages, rewards, rankings, and business opportunities within the Planet.",
            color = Color(0xFF232323)
        )
    }
}

data class MarketplaceLoadResult(
    val products: List<MarketplaceProductItem>,
)

data class MarketplaceProductItem(
    val id: String,
    val merchantId: String,
    val merchantName: String,
    val name: String,
    val description: String,
    val materials: String,
    val priceValue: Double,
    val priceText: String,
    val currency: String,
    val mediaUrl: String,
    val streamUrl: String,
    val originalUrl: String,
    val mediaType: String,
    val isOwnProduct: Boolean,
)

data class MarketplaceOrderItem(
    val id: String,
    val productId: String,
    val productName: String,
    val buyerId: String,
    val buyerName: String,
    val merchantId: String,
    val merchantName: String,
    val amount: Double,
    val currency: String,
    val status: String = "chat_open",
    val productMediaUrl: String = "",
    val productStreamUrl: String = "",
    val productOriginalUrl: String = "",
    val productMediaType: String = "",
)

data class MarketplaceOrderMessageItem(
    val id: String,
    val senderName: String,
    val text: String,
    val createdAtMillis: Long,
)

data class MarketplaceDealState(
    val order: MarketplaceOrderItem,
    val messages: List<MarketplaceOrderMessageItem>,
)

@Composable
private fun MarketplaceProductMediaPreview(product: MarketplaceProductItem) {
    val previewUrl = product.streamUrl.ifBlank { product.mediaUrl.ifBlank { product.originalUrl } }
    if (previewUrl.isBlank()) return

    if (product.mediaType.equals("video", ignoreCase = true)) {
        val context = LocalContext.current
        val player = remember(previewUrl) {
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(previewUrl))
                prepare()
                playWhenReady = false
                volume = 0f
            }
        }
        DisposableEffect(player) {
            onDispose { player.release() }
        }
        AndroidView(
            factory = {
                PlayerView(it).apply {
                    this.player = player
                    useController = true
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(190.dp)
        )
    } else {
        AsyncImage(
            model = previewUrl,
            contentDescription = product.name,
            modifier = Modifier
                .fillMaxWidth()
                .height(190.dp)
        )
    }
}

@Composable
private fun websiteFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color(0xFF111111),
    unfocusedTextColor = Color(0xFF111111),
    disabledTextColor = Color(0xFF3F3A33),
    focusedBorderColor = ParagonGold,
    unfocusedBorderColor = Color(0xFFD0D5DD),
    cursorColor = Color(0xFF111111),
    focusedLabelColor = Color(0xFF4C453D),
    unfocusedLabelColor = Color(0xFF4C453D),
    focusedPlaceholderColor = Color(0xFF6B5F4B),
    unfocusedPlaceholderColor = Color(0xFF6B5F4B),
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White,
)


private fun marketplaceStatusLabel(status: String): String = when (status) {
    "chat_open" -> "Chatting"
    "negotiating" -> "Negotiating"
    "final_offer_sent" -> "Final Offer Received"
    "paid" -> "Paid — Awaiting Delivery"
    "delivering" -> "Delivering"
    "delivered" -> "Delivered"
    "completed" -> "Completed"
    "cancelled" -> "Cancelled"
    else -> status.ifBlank { "—" }
}

private fun marketplaceStatusColor(status: String): Color = when (status) {
    "completed" -> Color(0xFF176B4D)
    "final_offer_sent" -> Color(0xFFB45309)
    "paid", "delivering", "delivered" -> Color(0xFF1D4ED8)
    "cancelled" -> Color(0xFFDC2626)
    else -> Color(0xFF52616B)
}
