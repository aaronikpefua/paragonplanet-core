package com.app.natureswayproduction.nativeapp.feature.onboarding

import android.content.ContentResolver
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.api.UploadRequestPayload
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class MerchantCenterRepository(
    private val contentResolver: ContentResolver,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val apiService: ParagonApiService = ParagonApiService(),
    private val sessionRepository: SessionRepository = SessionRepository(apiService = apiService),
    private val appCheckRepository: AppCheckRepository = AppCheckRepository(),
) {
    suspend fun loadCenter(): MerchantCenterSnapshot = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Sign in first.")
        val profileSnap = firestore.collection("merchant_profiles").document(user.uid).get().await()
        val profile = if (profileSnap.exists()) {
            val data = profileSnap.data.orEmpty()
            MerchantProfileData(
                storeName = data["storeName"] as? String ?: data["businessName"] as? String ?: "",
                realName = data["realName"] as? String ?: "",
                gender = data["gender"] as? String ?: "",
                phone = data["phone"] as? String ?: "",
                email = data["email"] as? String ?: user.email.orEmpty(),
                country = data["country"] as? String ?: "",
                state = data["state"] as? String ?: data["stateCity"] as? String ?: "",
                productTypes = (data["productTypes"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                paymentMethods = (data["paymentMethods"] as? List<*>)?.mapNotNull { it?.toString() } ?: listOf("Parag coins"),
            )
        } else {
            MerchantProfileData(email = user.email.orEmpty(), paymentMethods = listOf("Parag coins"))
        }

        val products = firestore.collection("merchant_products")
            .whereEqualTo("merchantId", user.uid)
            .get()
            .await()
            .documents
            .map { doc ->
                val data = doc.data.orEmpty()
                MerchantProductItem(
                    id = doc.id,
                    name = data["name"] as? String ?: data["title"] as? String ?: "Untitled product",
                    description = data["description"] as? String ?: "",
                    materials = data["materials"] as? String ?: "",
                    price = when (val raw = data["price"]) {
                        is Number -> raw.toDouble()
                        is String -> raw.toDoubleOrNull() ?: 0.0
                        else -> 0.0
                    },
                    currency = data["currency"] as? String ?: "PARAG",
                    mediaUrl = data["mediaUrl"] as? String ?: "",
                    streamUrl = data["streamUrl"] as? String ?: "",
                    originalUrl = data["originalUrl"] as? String ?: "",
                    thumbnailUrl = data["thumbnailUrl"] as? String ?: "",
                    mediaType = data["mediaType"] as? String ?: inferMediaType(data["mediaUrl"] as? String ?: ""),
                    category = data["category"] as? String ?: "",
                    status = data["status"] as? String ?: "active",
                    processingStatus = data["processingStatus"] as? String ?: "ready",
                    createdAtMillis = (data["createdAt"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
                )
            }
            .sortedByDescending { it.createdAtMillis }

        MerchantCenterSnapshot(
            profile = profile,
            profileExists = profileSnap.exists(),
            products = products,
            orders = emptyList(),
        )
    }

    suspend fun loadMerchantOrders(): List<MerchantOrderItem> = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Sign in first.")
        firestore.collection("merchant_orders")
            .whereEqualTo("merchantId", user.uid)
            .get()
            .await()
            .documents
            .map { doc -> doc.toMerchantOrder() }
            .sortedByDescending { it.createdAtMillis }
    }

    suspend fun loadOrderMessages(orderId: String): List<MerchantOrderMessageItem> = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Sign in first.")
        val docs = firestore.collection("merchant_order_messages")
            .whereEqualTo("orderId", orderId)
            .whereEqualTo("merchantId", user.uid)
            .get()
            .await()
            .documents

        val unreadIncoming = docs.filter { doc ->
            val data = doc.data.orEmpty()
            val senderId = data["senderId"] as? String
            val readBy = (data["readBy"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
            !senderId.isNullOrBlank() && senderId != user.uid && !readBy.contains(user.uid)
        }
        unreadIncoming.forEach { doc ->
            firestore.collection("merchant_order_messages").document(doc.id)
                .update("readBy", FieldValue.arrayUnion(user.uid))
                .await()
        }

        docs.map { doc ->
            val data = doc.data.orEmpty()
            MerchantOrderMessageItem(
                id = doc.id,
                senderId = data["senderId"] as? String ?: "",
                senderName = data["senderName"] as? String ?: "Member",
                text = data["text"] as? String ?: "",
                productName = data["productName"] as? String ?: "",
                productMediaUrl = data["productMediaUrl"] as? String ?: "",
                productStreamUrl = data["productStreamUrl"] as? String ?: "",
                productOriginalUrl = data["productOriginalUrl"] as? String ?: "",
                productThumbnailUrl = data["productThumbnailUrl"] as? String ?: "",
                productMediaType = data["productMediaType"] as? String ?: "",
                createdAtMillis = (data["createdAt"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
            )
        }.sortedBy { it.createdAtMillis }
    }

    suspend fun uploadProduct(
        draft: MerchantProductDraft,
        mediaUri: Uri?,
        onProgress: (Int, String) -> Unit,
    ) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Sign in first.")
        if (draft.name.isBlank() || draft.description.isBlank() || draft.materials.isBlank() || draft.price.isBlank()) {
            throw IllegalStateException("Product name, description, materials, and price are required.")
        }

        val profileSnap = firestore.collection("merchant_profiles").document(user.uid).get().await()
        if (!profileSnap.exists()) {
            throw IllegalStateException("Save your merchant profile before uploading products.")
        }
        val profile = profileSnap.data.orEmpty()

        var mediaUrl = draft.mediaUrl.trim()
        var originalUrl = mediaUrl
        var streamUrl = mediaUrl
        var objectPath = ""
        var mediaType = inferMediaType(mediaUrl)
        var uploadedFileName = ""
        var uploadedFile = false

        if (mediaUri != null) {
            val idToken = sessionRepository.getFreshIdToken()
                ?: throw IllegalStateException("Sign in first to upload product media.")
            val appCheckToken = appCheckRepository.getToken(forceRefresh = true)
            val meta = readFileMeta(mediaUri)
            onProgress(5, "Requesting signed upload URL…")
            val ticket = apiService.requestVideoUpload(
                idToken = idToken,
                appCheckToken = appCheckToken,
                payload = UploadRequestPayload(
                    title = draft.name.trim(),
                    description = draft.description.trim(),
                    category = draft.category,
                    fileName = meta.displayName,
                    fileType = meta.mimeType,
                    fileSize = meta.sizeBytes,
                    durationSeconds = meta.durationSeconds,
                    uploadPurpose = "merchant_product",
                )
            )
            onProgress(15, "Uploading product media…")
            uploadToSignedUrl(mediaUri, meta.mimeType, ticket.uploadUrl, onProgress)
            mediaUrl = ticket.fileUrl
            originalUrl = ticket.fileUrl
            streamUrl = ticket.fileUrl
            objectPath = ticket.objectPath
            uploadedFileName = ticket.objectPath
            mediaType = if (meta.mimeType.startsWith("video/")) "video" else "image"
            uploadedFile = true
        }

        if (mediaUrl.isBlank()) {
            throw IllegalStateException("Upload a product image/video or paste a media URL.")
        }

        val docRef = firestore.collection("merchant_products").document()
        val isVideo = mediaType == "video"
        docRef.set(
            mapOf(
                "merchantId" to user.uid,
                "merchantName" to ((profile["realName"] as? String)?.ifBlank { null } ?: user.email ?: "Merchant"),
                "name" to draft.name.trim(),
                "description" to draft.description.trim(),
                "materials" to draft.materials.trim(),
                "price" to (draft.price.toDoubleOrNull() ?: 0.0),
                "currency" to draft.currency.ifBlank { "PARAG" },
                "mediaUrl" to mediaUrl,
                "originalUrl" to originalUrl,
                "streamUrl" to streamUrl,
                "sourceFileName" to uploadedFileName,
                "objectPath" to objectPath,
                "mediaType" to mediaType,
                "processingStatus" to if (isVideo && uploadedFile) "processing" else "ready",
                "category" to draft.category,
                "uploadPurpose" to "merchant_product",
                "visibility" to "marketplace",
                "source" to "merchant_product_upload",
                "status" to "active",
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            )
        ).await()

        if (isVideo && uploadedFile) {
            onProgress(96, "Queuing product video processing…")
            val idToken = sessionRepository.getFreshIdToken()
                ?: throw IllegalStateException("Sign in first to finish product upload.")
            apiService.triggerMerchantProductCompression(
                idToken = idToken,
                appCheckToken = appCheckRepository.getToken(forceRefresh = true),
                objectPath = objectPath,
                fileUrl = mediaUrl,
                productId = docRef.id,
            )
        }
        onProgress(100, "Product uploaded to the marketplace.")
    }

    suspend fun deleteProduct(productId: String) = withContext(Dispatchers.IO) {
        firestore.collection("merchant_products").document(productId).delete().await()
    }

    suspend fun sendMerchantReply(order: MerchantOrderItem, senderName: String, text: String) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: throw IllegalStateException("Sign in first.")
        if (text.isBlank()) return@withContext
        val payload = mapOf(
            "productMediaUrl" to order.productMediaUrl,
            "productStreamUrl" to order.productStreamUrl,
            "productOriginalUrl" to order.productOriginalUrl,
            "productThumbnailUrl" to order.productThumbnailUrl,
            "productMediaType" to order.productMediaType,
        )
        val messageRef = firestore.collection("merchant_order_messages").document()
        messageRef.set(
            mapOf(
                "orderId" to order.id,
                "productId" to order.productId,
                "productName" to order.productName,
                "buyerId" to order.buyerId,
                "buyerName" to order.buyerName,
                "merchantId" to order.merchantId,
                "senderId" to user.uid,
                "senderName" to senderName,
                "text" to text.trim(),
                "readBy" to listOf(user.uid),
                "createdAt" to FieldValue.serverTimestamp(),
            ) + payload
        ).await()

        runCatching {
            firestore.collection("direct_messages").add(
                mapOf(
                    "chatId" to listOf(order.buyerId, order.merchantId).sorted().joinToString("__"),
                    "participantIds" to listOf(order.buyerId, order.merchantId).sorted(),
                    "senderId" to user.uid,
                    "senderName" to senderName,
                    "senderRole" to "Merchant",
                    "recipientId" to order.buyerId,
                    "recipientName" to order.buyerName.ifBlank { "Buyer" },
                    "recipientRole" to "Member",
                    "text" to text.trim(),
                    "source" to "merchant_order",
                    "orderId" to order.id,
                    "productId" to order.productId,
                    "productName" to order.productName,
                    "readBy" to listOf(user.uid),
                    "createdAt" to FieldValue.serverTimestamp(),
                ) + payload
            ).await()
        }
    }

    suspend fun sendFinalOffer(order: MerchantOrderItem, amount: Double, senderName: String) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext
        val orderId = order.id.ifBlank { return@withContext }

        val payload = mapOf(
            "productMediaUrl" to order.productMediaUrl,
            "productStreamUrl" to order.productStreamUrl,
            "productOriginalUrl" to order.productOriginalUrl,
            "productThumbnailUrl" to order.productThumbnailUrl,
            "productMediaType" to order.productMediaType,
        )

        firestore.collection("merchant_orders").document(orderId).update(
            mapOf(
                "status" to "final_offer_sent",
                "amount" to amount,
                "updatedAt" to FieldValue.serverTimestamp(),
            )
        ).await()

        firestore.collection("merchant_order_messages").document().set(
            mapOf(
                "orderId" to orderId,
                "productId" to order.productId,
                "productName" to order.productName,
                "buyerId" to order.buyerId,
                "buyerName" to order.buyerName.ifBlank { "Buyer" },
                "merchantId" to order.merchantId,
                "senderId" to user.uid,
                "senderName" to senderName.ifBlank { "Merchant" },
                "text" to "📋 Final Offer: ${amount} ${order.currency}. Please accept and pay from your wallet to proceed.",
                "type" to "final_offer",
                "readBy" to listOf(user.uid),
                "createdAt" to FieldValue.serverTimestamp(),
            ) + payload
        ).await()
    }

    suspend fun markAsDelivered(
        order: MerchantOrderItem,
        senderName: String,
        deliveryNote: String = "",
        links: List<String> = emptyList(),
        accessCodes: List<String> = emptyList(),
    ) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext
        val orderId = order.id.ifBlank { return@withContext }
        val idToken = user.getIdToken(false).await()?.token ?: return@withContext
        apiService.submitMarketplaceDelivery(
            idToken = idToken,
            orderId = orderId,
            deliveryNote = deliveryNote,
            links = links,
            accessCodes = accessCodes,
        )
    }

    suspend fun confirmDelivery(order: MerchantOrderItem) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext
        val idToken = user.getIdToken(false).await()?.token ?: return@withContext
        apiService.confirmMarketplaceDelivery(idToken = idToken, orderId = order.id)
    }

    suspend fun openDispute(order: MerchantOrderItem, reason: String, description: String) = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext
        val idToken = user.getIdToken(false).await()?.token ?: return@withContext
        apiService.openMarketplaceDispute(
            idToken = idToken,
            orderId = order.id,
            reason = reason,
            description = description,
        )
    }

    suspend fun cancelOrder(order: MerchantOrderItem, reason: String = "") = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext
        val idToken = user.getIdToken(false).await()?.token ?: return@withContext
        apiService.cancelMarketplaceOrder(idToken = idToken, orderId = order.id, reason = reason)
    }

    suspend fun deleteMerchantAccount() = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: return@withContext
        firestore.collection("merchant_profiles").document(user.uid).delete().await()
        firestore.collection("public_profiles").document(user.uid).delete().await()
        user.delete().await()
        auth.signOut()
    }

    private fun readFileMeta(uri: Uri): FileMeta {
        var name = "upload.bin"
        var size = 0L
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIndex >= 0) name = cursor.getString(nameIndex) ?: name
                if (sizeIndex >= 0) size = cursor.getLong(sizeIndex)
            }
        }
        val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
        val durationSeconds = if (mimeType.startsWith("video/")) {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(contentResolver.openAssetFileDescriptor(uri, "r")?.fileDescriptor)
                val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                (durationMs / 1000L).toInt()
            } finally {
                runCatching { retriever.release() }
            }
        } else {
            0
        }
        return FileMeta(name, size, mimeType, durationSeconds)
    }

    private fun uploadToSignedUrl(
        uri: Uri,
        mimeType: String,
        signedUrl: String,
        onProgress: (Int, String) -> Unit,
    ) {
        val totalBytes = contentResolver.openFileDescriptor(uri, "r")?.statSize ?: -1L
        val connection = (URL(signedUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "PUT"
            doOutput = true
            connectTimeout = 15000
            readTimeout = 60000
            setRequestProperty("Content-Type", mimeType)
        }

        contentResolver.openInputStream(uri)?.use { rawInput ->
            BufferedInputStream(rawInput).use { input ->
                connection.outputStream.use { output ->
                    copyWithProgress(input, output, totalBytes, onProgress)
                }
            }
        } ?: throw IllegalStateException("Could not open the selected product media.")

        val code = connection.responseCode
        if (code !in 200..299) {
            val errorBody = connection.errorStream?.bufferedReader()?.readText().orEmpty()
            throw IllegalStateException("Product media upload failed ($code): $errorBody")
        }
    }

    private fun copyWithProgress(
        input: BufferedInputStream,
        output: OutputStream,
        totalBytes: Long,
        onProgress: (Int, String) -> Unit,
    ) {
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var uploaded = 0L
        while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            output.write(buffer, 0, read)
            uploaded += read
            if (totalBytes > 0) {
                val percent = 15 + ((uploaded.toDouble() / totalBytes.toDouble()) * 75.0).toInt().coerceIn(0, 75)
                onProgress(percent, "Uploading product media…")
            }
        }
        output.flush()
    }

    private fun inferMediaType(url: String): String {
        val normalized = url.lowercase(Locale.ROOT)
        return if (
            normalized.endsWith(".mp4") || normalized.endsWith(".mov") || normalized.endsWith(".webm") ||
            normalized.contains("video")
        ) {
            "video"
        } else {
            "image"
        }
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toMerchantOrder(): MerchantOrderItem {
        val data = data.orEmpty()
        return MerchantOrderItem(
            id = id,
            productId = data["productId"] as? String ?: "",
            productName = data["productName"] as? String ?: "Product request",
            productMediaUrl = data["productMediaUrl"] as? String ?: "",
            productStreamUrl = data["productStreamUrl"] as? String ?: "",
            productOriginalUrl = data["productOriginalUrl"] as? String ?: "",
            productThumbnailUrl = data["productThumbnailUrl"] as? String ?: "",
            productMediaType = data["productMediaType"] as? String ?: "",
            buyerId = data["buyerId"] as? String ?: "",
            buyerName = data["buyerName"] as? String ?: "Buyer",
            merchantId = data["merchantId"] as? String ?: "",
            amount = when (val raw = data["amount"]) {
                is Number -> raw.toDouble()
                is String -> raw.toDoubleOrNull() ?: 0.0
                else -> 0.0
            },
            currency = data["currency"] as? String ?: "PARAG",
            status = data["status"] as? String ?: "pending",
            escrowStatus = data["escrowStatus"] as? String ?: "",
            createdAtMillis = (data["createdAt"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
        )
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toMerchantMessageBackfillOrder(): MerchantOrderItem {
        val data = data.orEmpty()
        return MerchantOrderItem(
            id = data["orderId"] as? String ?: "",
            productId = data["productId"] as? String ?: "",
            productName = data["productName"] as? String ?: "Product request",
            productMediaUrl = data["productMediaUrl"] as? String ?: "",
            productStreamUrl = data["productStreamUrl"] as? String ?: "",
            productOriginalUrl = data["productOriginalUrl"] as? String ?: "",
            productThumbnailUrl = data["productThumbnailUrl"] as? String ?: "",
            productMediaType = data["productMediaType"] as? String ?: "",
            buyerId = data["buyerId"] as? String ?: "",
            buyerName = data["buyerName"] as? String ?: data["senderName"] as? String ?: "Buyer",
            merchantId = data["merchantId"] as? String ?: "",
            amount = when (val raw = data["amount"]) {
                is Number -> raw.toDouble()
                is String -> raw.toDoubleOrNull() ?: 0.0
                else -> 0.0
            },
            currency = data["currency"] as? String ?: "PARAG",
            status = "chat_open",
            escrowStatus = "not_requested",
            createdAtMillis = (data["createdAt"] as? com.google.firebase.Timestamp)?.toDate()?.time ?: 0L,
        )
    }
}

data class MerchantCenterSnapshot(
    val profile: MerchantProfileData,
    val profileExists: Boolean,
    val products: List<MerchantProductItem>,
    val orders: List<MerchantOrderItem>,
)

data class MerchantProfileData(
    val storeName: String = "",
    val realName: String = "",
    val gender: String = "",
    val phone: String = "",
    val email: String = "",
    val country: String = "",
    val state: String = "",
    val productTypes: List<String> = emptyList(),
    val paymentMethods: List<String> = listOf("Parag coins"),
)

data class MerchantProductDraft(
    val name: String,
    val category: String,
    val price: String,
    val currency: String,
    val description: String,
    val materials: String,
    val mediaUrl: String,
)

data class MerchantProductItem(
    val id: String,
    val name: String,
    val description: String,
    val materials: String,
    val price: Double,
    val currency: String,
    val mediaUrl: String,
    val streamUrl: String,
    val originalUrl: String,
    val thumbnailUrl: String,
    val mediaType: String,
    val category: String,
    val status: String,
    val processingStatus: String,
    val createdAtMillis: Long,
)

data class MerchantOrderItem(
    val id: String,
    val productId: String,
    val productName: String,
    val productMediaUrl: String,
    val productStreamUrl: String,
    val productOriginalUrl: String,
    val productThumbnailUrl: String,
    val productMediaType: String,
    val buyerId: String,
    val buyerName: String,
    val merchantId: String,
    val amount: Double,
    val currency: String,
    val status: String,
    val escrowStatus: String,
    val createdAtMillis: Long,
)

data class MerchantOrderMessageItem(
    val id: String,
    val senderId: String,
    val senderName: String,
    val text: String,
    val productName: String,
    val productMediaUrl: String,
    val productStreamUrl: String,
    val productOriginalUrl: String,
    val productThumbnailUrl: String,
    val productMediaType: String,
    val createdAtMillis: Long,
)

private data class FileMeta(
    val displayName: String,
    val sizeBytes: Long,
    val mimeType: String,
    val durationSeconds: Int,
)
