package com.app.natureswayproduction.nativeapp.feature.onboarding

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import java.util.Locale

@Composable
fun MerchantOnboardingScreen(
    repository: RoleOnboardingRepository,
    onBack: () -> Unit,
    onOpenMarketplace: () -> Unit,
    onOpenMerchantAbout: () -> Unit,
    onCompleted: () -> Unit,
) {
    val context = LocalContext.current
    val centerRepository = remember { MerchantCenterRepository(contentResolver = context.contentResolver) }
    val scope = rememberCoroutineScope()

    var storeName by remember { mutableStateOf("") }
    var realName by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    val productTypes = remember { mutableStateListOf<String>() }
    val paymentMethods = remember { mutableStateListOf("Parag coins") }

    var productName by remember { mutableStateOf("") }
    var productCategory by remember { mutableStateOf(merchantProductTypes.firstOrNull().orEmpty()) }
    var productPrice by remember { mutableStateOf("") }
    var productCurrency by remember { mutableStateOf("PARAG") }
    var productDescription by remember { mutableStateOf("") }
    var productMaterials by remember { mutableStateOf("") }
    var productMediaUrl by remember { mutableStateOf("") }
    var selectedMediaUri by remember { mutableStateOf<Uri?>(null) }
    var selectedMediaLabel by remember { mutableStateOf("") }
    var productTypeExpanded by remember { mutableStateOf(false) }
    var productCurrencyExpanded by remember { mutableStateOf(false) }

    var isLoading by remember { mutableStateOf(true) }
    var profileExists by remember { mutableStateOf(false) }
    var editingProfile by remember { mutableStateOf(true) }
    var isSavingProfile by remember { mutableStateOf(false) }
    var isUploadingProduct by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableStateOf(0) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    var orders by remember { mutableStateOf(emptyList<MerchantOrderItem>()) }
    var products by remember { mutableStateOf(emptyList<MerchantProductItem>()) }
    var selectedOrder by remember { mutableStateOf<MerchantOrderItem?>(null) }
    var orderMessages by remember { mutableStateOf(emptyList<MerchantOrderMessageItem>()) }
    var replyText by remember { mutableStateOf("") }
    var previewProductId by remember { mutableStateOf<String?>(null) }
    var buyerRequestsLoaded by remember { mutableStateOf(false) }

    fun toggle(list: MutableList<String>, value: String) {
        if (list.contains(value)) list.remove(value) else list.add(value)
    }

    fun applyProfile(profile: MerchantProfileData) {
        storeName = profile.storeName
        realName = profile.realName
        gender = profile.gender
        phone = profile.phone
        email = profile.email
        country = profile.country
        state = profile.state
        productTypes.clear()
        productTypes.addAll(profile.productTypes)
        paymentMethods.clear()
        paymentMethods.addAll(profile.paymentMethods.ifEmpty { listOf("Parag coins") })
    }

    suspend fun reloadCenter(selectOrderId: String? = selectedOrder?.id) {
        isLoading = true
        error = null
        runCatching { centerRepository.loadCenter() }
            .onSuccess { snapshot ->
                profileExists = snapshot.profileExists
                editingProfile = !snapshot.profileExists && !isSavingProfile
                applyProfile(snapshot.profile)
                products = snapshot.products
                if (buyerRequestsLoaded) {
                    orders = centerRepository.loadMerchantOrders()
                    selectedOrder = orders.firstOrNull { it.id == selectOrderId }
                    if (selectedOrder == null) {
                        orderMessages = emptyList()
                    }
                } else {
                    orders = emptyList()
                    selectedOrder = null
                    orderMessages = emptyList()
                }
            }
            .onFailure { error = it.message ?: "Merchant center could not load." }
        isLoading = false
    }

    LaunchedEffect(Unit) {
        reloadCenter()
    }

    val mediaPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        selectedMediaUri = uri
        selectedMediaLabel = uri?.lastPathSegment?.substringAfterLast('/') ?: "Selected product media"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Button(onClick = onBack, shape = RoundedCornerShape(8.dp)) { Text("Go Back") }

        if (profileExists && !editingProfile) {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onOpenMerchantAbout,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                    ) {
                        Text("About The Merchants")
                    }
                }
            }
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Paragon merchant", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                Text(
                    if (profileExists && !editingProfile) "Merchant Center" else if (profileExists) "Edit Merchant Profile" else "Merchant Registration",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color(0xFF111111)
                )
                Text(
                    if (profileExists && !editingProfile) {
                        "Manage digital products, buyer requests, and marketplace uploads."
                    } else {
                        "Register as a digital merchant and declare what you want to sell on Paragon Planet."
                    },
                    color = Color(0xFF111111),
                    fontWeight = FontWeight.SemiBold
                )
                if (profileExists) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = { editingProfile = true },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                        ) {
                            Text("Edit Profile")
                        }
                        Button(
                            onClick = onOpenMarketplace,
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                        ) {
                            Text("Marketplace")
                        }
                    }
                }
            }
        }

        if (isLoading) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                CircularProgressIndicator(color = ParagonGold)
            }
        }

        error?.let { Text(it, color = Color(0xFFB00020), fontWeight = FontWeight.Bold) }
        statusMessage?.let { Text(it, color = Color(0xFF176B4D), fontWeight = FontWeight.Bold) }

        if (editingProfile || !profileExists) {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("Identity", fontWeight = FontWeight.ExtraBold)
                    OnboardingField(storeName, { storeName = it }, "Store / Brand name")
                    OnboardingField(realName, { realName = it }, "Real name")
                    OnboardingField(gender, { gender = it }, "Gender")
                    OnboardingField(phone, { phone = it }, "Phone")
                    OnboardingField(email, { email = it }, "Email")
                    OnboardingField(country, { country = it }, "Country")
                    OnboardingField(state, { state = it }, "State")

                    Text("Digital Product Types", fontWeight = FontWeight.Bold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        merchantProductTypes.forEach { type ->
                            TogglePill(type, productTypes.contains(type)) { toggle(productTypes, type) }
                        }
                    }

                    Text("Payment Methods", fontWeight = FontWeight.Bold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        paymentOptions.forEach { option ->
                            TogglePill(option, paymentMethods.contains(option)) { toggle(paymentMethods, option) }
                        }
                    }

                    Button(
                        onClick = {
                            isSavingProfile = true
                            error = null
                            statusMessage = null
                            scope.launch {
                                runCatching {
                                    repository.saveMerchantProfile(
                                        MerchantRegistrationForm(
                                            storeName = storeName,
                                            realName = realName,
                                            gender = gender,
                                            phone = phone,
                                            email = email,
                                            country = country,
                                            state = state,
                                            productTypes = productTypes.toList(),
                                            paymentMethods = paymentMethods.toList(),
                                        )
                                    )
                                }.onSuccess {
                                    statusMessage = "Merchant profile saved."
                                    profileExists = true
                                    editingProfile = false
                                    reloadCenter()
                                }.onFailure {
                                    error = it.message ?: "Merchant profile could not be saved."
                                }
                                isSavingProfile = false
                            }
                        },
                        enabled = !isSavingProfile,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                    ) {
                        if (isSavingProfile) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = ParagonGold)
                        } else {
                            Text("Save Merchant Profile", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Digital marketplace", color = Color(0xFF111111), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                Text("Upload Product", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)

                OnboardingField(productName, { productName = it }, "Product name")
                MerchantProductTypeDropdown(
                    value = productCategory,
                    expanded = productTypeExpanded,
                    onExpandedChange = { productTypeExpanded = it },
                    onSelected = {
                        productCategory = it
                        productTypeExpanded = false
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = productPrice,
                        onValueChange = { productPrice = it },
                        modifier = Modifier.weight(1f),
                        label = { Text("Price") },
                        colors = merchantFieldColors(),
                    )
                    MerchantCurrencyDropdown(
                        value = productCurrency,
                        expanded = productCurrencyExpanded,
                        onExpandedChange = { productCurrencyExpanded = it },
                        onSelected = {
                            productCurrency = it
                            productCurrencyExpanded = false
                        },
                        modifier = Modifier.weight(0.75f)
                    )
                }

                OutlinedTextField(
                    value = productDescription,
                    onValueChange = { productDescription = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Description") },
                    minLines = 3,
                    colors = merchantFieldColors(),
                )
                OutlinedTextField(
                    value = productMaterials,
                    onValueChange = { productMaterials = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("What the buyer gets") },
                    minLines = 3,
                    colors = merchantFieldColors(),
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { mediaPicker.launch(arrayOf("image/*", "video/*")) },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                    ) {
                        Text("Choose Media")
                    }
                    if (selectedMediaLabel.isNotBlank()) {
                        Text(selectedMediaLabel, color = Color(0xFF111111), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp))
                    }
                }

                OutlinedTextField(
                    value = productMediaUrl,
                    onValueChange = { productMediaUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Or paste image/video URL") },
                    colors = merchantFieldColors(),
                )

                if (isUploadingProduct) {
                    Text("Uploading $uploadProgress%", color = Color(0xFF176B4D), fontWeight = FontWeight.Bold)
                }

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = {
                            isUploadingProduct = true
                            uploadProgress = 0
                            error = null
                            statusMessage = null
                            scope.launch {
                                runCatching {
                                    centerRepository.uploadProduct(
                                        draft = MerchantProductDraft(
                                            name = productName,
                                            category = productCategory,
                                            price = productPrice,
                                            currency = productCurrency,
                                            description = productDescription,
                                            materials = productMaterials,
                                            mediaUrl = productMediaUrl,
                                        ),
                                        mediaUri = selectedMediaUri,
                                    ) { progress, message ->
                                        uploadProgress = progress
                                        statusMessage = message
                                    }
                                }.onSuccess {
                                    productName = ""
                                    productCategory = merchantProductTypes.firstOrNull().orEmpty()
                                    productPrice = ""
                                    productCurrency = "PARAG"
                                    productDescription = ""
                                    productMaterials = ""
                                    productMediaUrl = ""
                                    selectedMediaUri = null
                                    selectedMediaLabel = ""
                                    statusMessage = "Product uploaded to the marketplace."
                                    reloadCenter()
                                }.onFailure {
                                    error = it.message ?: "Product upload failed."
                                }
                                isUploadingProduct = false
                            }
                        },
                        enabled = !isUploadingProduct,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = ParagonGold, contentColor = Color.Black)
                    ) {
                        Text(if (isUploadingProduct) "Uploading..." else "Upload Product", fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = {
                            scope.launch {
                                runCatching { centerRepository.deleteMerchantAccount() }
                                    .onSuccess {
                                        statusMessage = "Merchant account deleted."
                                        onCompleted()
                                    }
                                    .onFailure { error = it.message ?: "Merchant account could not be deleted." }
                            }
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB42318), contentColor = Color.White)
                    ) {
                        Text("Delete Account")
                    }
                }
            }
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Buyer Requests", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                    Button(
                        onClick = {
                            scope.launch {
                                buyerRequestsLoaded = true
                                orders = runCatching { centerRepository.loadMerchantOrders() }.getOrElse {
                                    error = it.message ?: "Could not load buyer requests."
                                    emptyList()
                                }
                            }
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                    ) {
                        Text(if (buyerRequestsLoaded) "Refresh Requests" else "Load Requests")
                    }
                }

                if (!buyerRequestsLoaded) {
                    Text("Buyer requests will load only when you tap the button.", color = Color(0xFF5A534A))
                } else if (orders.isEmpty()) {
                    Text("No buyer requests yet.", color = Color(0xFF5A534A))
                } else {
                    orders.forEach { order ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = if (selectedOrder?.id == order.id) Color(0xFFFFF7E3) else Color(0xFFF9F5EE))
                        ) {
                            Button(
                                onClick = {
                                    selectedOrder = order
                                    scope.launch {
                                        orderMessages = runCatching { centerRepository.loadOrderMessages(order.id) }.getOrElse {
                                            error = it.message ?: "Could not open buyer request."
                                            emptyList()
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, contentColor = Color(0xFF111111))
                            ) {
                                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(order.productName, fontWeight = FontWeight.ExtraBold)
                                    Text(order.buyerName)
                                    Text("${order.amount.toInt()} ${order.currency}")
                                    Text((order.escrowStatus.ifBlank { order.status }).replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() }, color = Color(0xFF6B5F4B))
                                }
                            }
                        }
                    }
                }

                selectedOrder?.let { order ->
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF9F5EE)), shape = RoundedCornerShape(14.dp)) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Private chat", color = Color(0xFF6B5F4B), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            Text(order.productName, fontWeight = FontWeight.ExtraBold)
                            Text("Buyer: ${order.buyerName}", color = Color(0xFF5A534A))
                            if (orderMessages.isEmpty()) {
                                Text("No messages yet.", color = Color(0xFF5A534A))
                            } else {
                                orderMessages.forEach { message ->
                                    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(12.dp)) {
                                        Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                            Text(message.senderName, fontWeight = FontWeight.Bold)
                                            if (message.productName.isNotBlank()) {
                                                Text(message.productName, color = Color(0xFF6B5F4B), style = MaterialTheme.typography.bodySmall)
                                            }
                                            Text(message.text)
                                        }
                                    }
                                }
                            }
                            OutlinedTextField(
                                value = replyText,
                                onValueChange = { replyText = it },
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("Reply to buyer") },
                                colors = merchantFieldColors(),
                            )
                            Button(
                                onClick = {
                                    val senderName = realName.ifBlank { email.ifBlank { "Merchant" } }
                                    scope.launch {
                                        runCatching {
                                            centerRepository.sendMerchantReply(order, senderName, replyText)
                                        }.onSuccess {
                                            replyText = ""
                                            orderMessages = centerRepository.loadOrderMessages(order.id)
                                        }.onFailure {
                                            error = it.message ?: "Reply could not be sent."
                                        }
                                    }
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                            ) {
                                Text("Send")
                            }
                        }
                    }
                }
            }
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Your Products", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                if (products.isEmpty()) {
                    Text("No products uploaded yet.", color = Color(0xFF5A534A))
                } else {
                    products.forEach { product ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFF9F5EE)), shape = RoundedCornerShape(14.dp)) {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Button(
                                    onClick = {
                                        previewProductId = if (previewProductId == product.id) null else product.id
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111), contentColor = Color.White)
                                ) {
                                    Text(if (previewProductId == product.id) "Hide Preview" else "Load Preview")
                                }
                                if (previewProductId == product.id) {
                                    MerchantProductMediaPreview(product = product)
                                }
                                Text(product.name, fontWeight = FontWeight.ExtraBold)
                                Text(
                                    product.description.ifBlank { product.category.ifBlank { "Digital product" } },
                                    color = Color(0xFF232323)
                                )
                                Text(product.materials, color = Color(0xFF5A534A))
                                Text("${product.price.toInt()} ${product.currency.ifBlank { "PARAG" }}", fontWeight = FontWeight.Bold)
                                Text(
                                    "${product.mediaType.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() }} • ${product.processingStatus}",
                                    color = Color(0xFF6B5F4B)
                                )
                                Button(
                                    onClick = {
                                        scope.launch {
                                            runCatching { centerRepository.deleteProduct(product.id) }
                                                .onSuccess {
                                                    statusMessage = "Product deleted."
                                                    reloadCenter()
                                                }
                                                .onFailure { error = it.message ?: "Product could not be deleted." }
                                        }
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB42318), contentColor = Color.White)
                                ) {
                                    Text("Delete")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun MerchantProductTypeDropdown(
    value: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelected: (String) -> Unit,
) {
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = onExpandedChange,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text("Product type") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            colors = merchantDropdownColors(),
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { onExpandedChange(false) }
        ) {
            merchantProductTypes.forEach { type ->
                DropdownMenuItem(
                    text = { Text(type) },
                    onClick = { onSelected(type) }
                )
            }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun MerchantCurrencyDropdown(
    value: String,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = onExpandedChange,
        modifier = modifier,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text("Currency") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            colors = merchantDropdownColors(),
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { onExpandedChange(false) }
        ) {
            listOf("PARAG", "GBAZILO").forEach { currency ->
                DropdownMenuItem(
                    text = { Text(currency) },
                    onClick = { onSelected(currency) }
                )
            }
        }
    }
}

@Composable
private fun MerchantProductMediaPreview(product: MerchantProductItem) {
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
private fun merchantFieldColors() = OutlinedTextFieldDefaults.colors(
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

@Composable
private fun merchantDropdownColors() = TextFieldDefaults.colors(
    focusedTextColor = Color(0xFF111111),
    unfocusedTextColor = Color(0xFF111111),
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White,
    disabledContainerColor = Color.White,
    focusedIndicatorColor = ParagonGold,
    unfocusedIndicatorColor = Color(0xFFD0D5DD),
    focusedLabelColor = Color(0xFF4C453D),
    unfocusedLabelColor = Color(0xFF4C453D),
    cursorColor = Color(0xFF111111),
)

