package com.app.natureswayproduction.nativeapp.feature.upload

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.app.natureswayproduction.R
import com.app.natureswayproduction.nativeapp.ui.theme.ParagonGold

private val UploadCategories = listOf(
    "Dancer",
    "Singer",
    "Instrumentalist",
    "Comedian",
    "Debater",
    "Actor",
    "Model",
    "Cultural Performer",
    "Special Ability",
    "Stunt Performer",
    "Nutritionist",
    "Artist & Designer",
)

@Composable
fun UploadScreen(
    uploadViewModel: UploadViewModel,
    currentEmail: String?,
    currentRole: String?,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenMenu: () -> Unit,
    onSignOut: () -> Unit,
    onUploadCompleted: () -> Unit,
) {
    val state by uploadViewModel.uiState.collectAsState()
    val context = LocalContext.current
    var pendingCaptureUri by remember { mutableStateOf<Uri?>(null) }
    var showCategoryDialog by remember { mutableStateOf(false) }
    var categoryDraft by remember { mutableStateOf("") }
    val currentCategory by rememberUpdatedState(state.categories.firstOrNull().orEmpty())
    var checkingCitizenAccess by remember { mutableStateOf(true) }
    var isCitizenUploader by remember { mutableStateOf(false) }
    var citizenAccessCheckedUid by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(FirebaseAuth.getInstance().currentUser?.uid, currentRole) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid
        citizenAccessCheckedUid = uid
        if (uid.isNullOrBlank()) {
            isCitizenUploader = false
            checkingCitizenAccess = false
            return@LaunchedEffect
        }

        checkingCitizenAccess = true
        isCitizenUploader = false

        val fallbackRoleAllows = currentRole.equals("CITIZEN", ignoreCase = true)

        val allowed = runCatching {
            val snapshot = FirebaseFirestore.getInstance()
                .collection("citizen_profiles")
                .document(uid)
                .get()
                .await()
            snapshot.exists() && !snapshot.getString("status").equals("banned", ignoreCase = true)
        }.getOrElse { fallbackRoleAllows }

        isCitizenUploader = allowed
        checkingCitizenAccess = false
    }

    LaunchedEffect(state.uploadedVideoId) {
        if (!state.uploadedVideoId.isNullOrBlank()) {
            onUploadCompleted()
        }
    }

    val cameraVideoPicker = rememberLauncherForActivityResult(ActivityResultContracts.CaptureVideo()) { success ->
        uploadViewModel.updateSource(UploadSource.CAMERA)
        uploadViewModel.setPickedVideo(if (success) pendingCaptureUri else null)
    }
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uploadViewModel.updateSource(UploadSource.FILE)
        uri?.let {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    it,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
        }
        uploadViewModel.setPickedVideo(uri)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4EEE7))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            UploadHeaderBar(
                currentEmail = currentEmail,
                onOpenUpload = onOpenUpload,
                onOpenProfile = onOpenProfile,
                onOpenSignIn = onOpenSignIn,
                onOpenMenu = onOpenMenu,
                onSignOut = onSignOut,
            )
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.Transparent)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 2.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Upload Video",
                        color = Color(0xFF111111),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Citizen videos upload to the main home video feed.",
                        color = Color(0xFF444444),
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        UploadSourceChip(
                            label = "Camera / Video",
                            selected = state.source == UploadSource.CAMERA,
                            onClick = {
                                uploadViewModel.updateSource(UploadSource.CAMERA)
                                pendingCaptureUri = createVideoCaptureUri(context)
                                pendingCaptureUri?.let { cameraVideoPicker.launch(it) }
                            }
                        )
                        UploadSourceChip(
                            label = "File",
                            selected = state.source == UploadSource.FILE,
                            onClick = {
                                uploadViewModel.updateSource(UploadSource.FILE)
                                filePicker.launch(arrayOf("video/*"))
                            }
                        )
                        UploadSourceChip(
                            label = "Paste link",
                            selected = state.source == UploadSource.LINK,
                            onClick = { uploadViewModel.updateSource(UploadSource.LINK) }
                        )
                    }
                }
            }
        }

        if (checkingCitizenAccess) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "Checking citizen upload access...",
                            color = Color(0xFF111111),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Please wait while native verifies your upload access like the website.",
                            color = Color(0xFF4C453D),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        } else if (!isCitizenUploader) {
            item {
                CitizenOnlyUploadNotice(onOpenProfile = onOpenProfile)
            }
        } else {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(18.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        UploadFieldLabel("Talent category")
                        WebsiteLikeSelectField(
                            value = state.categories.firstOrNull().orEmpty(),
                            onOpen = {
                                categoryDraft = currentCategory.ifBlank { "Cultural Performer" }
                                showCategoryDialog = true
                            },
                        )

                        UploadFieldLabel("Title")
                        OutlinedTextField(
                            value = state.title,
                            onValueChange = uploadViewModel::updateTitle,
                            placeholder = { Text("Title") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            colors = websiteFieldColors()
                        )

                        UploadFieldLabel("Description")
                        OutlinedTextField(
                            value = state.description,
                            onValueChange = uploadViewModel::updateDescription,
                            placeholder = { Text("Description") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 4,
                            colors = websiteFieldColors()
                        )

                        UploadFieldLabel("Video file")
                        if (state.source == UploadSource.LINK) {
                            OutlinedTextField(
                                value = state.linkUrl,
                                onValueChange = uploadViewModel::updateLinkUrl,
                                placeholder = { Text("Paste direct video link") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                colors = websiteFieldColors()
                            )
                            Text(
                                text = "Link upload is the next safe rollout. For now, Camera / Video and File are ready first.",
                                color = Color(0xFF4C453D),
                                style = MaterialTheme.typography.bodySmall
                            )
                        } else {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    modifier = Modifier.clickable {
                                        if (state.source == UploadSource.CAMERA) {
                                            pendingCaptureUri = createVideoCaptureUri(context)
                                            pendingCaptureUri?.let { cameraVideoPicker.launch(it) }
                                        } else {
                                            filePicker.launch(arrayOf("video/*"))
                                        }
                                    },
                                    shape = RoundedCornerShape(4.dp),
                                    color = Color(0xFFF2F2F2),
                                    border = null
                                ) {
                                    Text(
                                        text = if (state.source == UploadSource.CAMERA) "Choose camera/video" else "Choose file",
                                        color = Color(0xFF111111),
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
                                    )
                                }
                                Text(
                                    text = state.videoUri?.toCompactLabel() ?: "No file chosen",
                                    color = Color(0xFF4C453D),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }

                        state.errorMessage?.let {
                            Text(
                                text = buildString {
                                    append(it)
                                    if (it.contains("signed-in test account", ignoreCase = true) && !currentEmail.isNullOrBlank()) {
                                        append(" (")
                                        append(currentEmail)
                                        append(")")
                                    }
                                },
                                color = Color(0xFFB00020),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }

                        if (state.message.isNotBlank() && state.errorMessage == null) {
                            Text(
                                text = state.message,
                                color = Color(0xFF4C453D),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }

                        if (state.isUploading) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                LinearProgressIndicator(
                                    progress = { (state.progress.coerceIn(0, 100) / 100f) },
                                    modifier = Modifier.fillMaxWidth(),
                                    color = ParagonGold,
                                    trackColor = Color(0xFFE9E2D6),
                                )
                                Text(
                                    text = "${state.progress.coerceIn(0, 100)}%",
                                    color = Color(0xFF4C453D),
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }

                        Button(
                            onClick = uploadViewModel::upload,
                            enabled = !state.isUploading,
                        ) {
                            Text(if (state.isUploading) "Uploading..." else "Upload")
                        }
                    }
                }
            }
        }
    }

    if (showCategoryDialog) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showCategoryDialog = false },
            containerColor = Color.White,
            titleContentColor = Color(0xFF111111),
            textContentColor = Color(0xFF111111),
            tonalElevation = 0.dp,
            confirmButton = {
                TextButton(
                    onClick = {
                        uploadViewModel.updateCategory(categoryDraft.ifBlank { "Cultural Performer" })
                        showCategoryDialog = false
                    }
                ) {
                    Text("Apply", color = Color(0xFFB8860B))
                }
            },
            dismissButton = {
                TextButton(onClick = { showCategoryDialog = false }) {
                    Text("Cancel", color = Color(0xFF4C453D))
                }
            },
            title = {
                Text(
                    "Select talent categories",
                    color = Color(0xFF111111),
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    UploadCategories.forEach { option ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    categoryDraft = option
                                }
                                .padding(vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            RadioButton(
                                selected = categoryDraft == option,
                                onClick = { categoryDraft = option },
                                colors = RadioButtonDefaults.colors(
                                    selectedColor = ParagonGold,
                                    unselectedColor = Color(0xFF4C453D)
                                )
                            )
                            Text(
                                option,
                                color = Color(0xFF111111),
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            }
        )
    }
}

@Composable
private fun CitizenOnlyUploadNotice(
    onOpenProfile: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Citizen upload only",
                color = Color(0xFF111111),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Only citizens can post videos to the main home feed. Open your profile to complete or confirm your citizen registration first.",
                color = Color(0xFF4C453D),
                style = MaterialTheme.typography.bodyMedium
            )
            Button(onClick = onOpenProfile) {
                Text("Open Profile")
            }
        }
    }
}

@Composable
private fun UploadSourceChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(999.dp),
        color = if (selected) Color(0xFF111827) else Color.White,
        tonalElevation = if (selected) 0.dp else 0.dp,
        shadowElevation = 0.dp,
    ) {
        Text(
            text = label,
            color = if (selected) Color.White else Color(0xFF111111),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}

@Composable
private fun UploadHeaderBar(
    currentEmail: String?,
    onOpenUpload: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSignIn: () -> Unit,
    onOpenMenu: () -> Unit,
    onSignOut: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1B1B1B)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    painter = painterResource(id = R.drawable.paragon_logo),
                    contentDescription = "Paragon Planet logo",
                    modifier = Modifier.size(34.dp)
                )
                Text(
                    text = "Paragon Planet",
                    color = Color.White,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HeaderButton("⬆️", onOpenUpload)
                HeaderButton("👤", onOpenProfile)
                HeaderButton(
                    if (currentEmail.isNullOrBlank()) "🔑" else "🚪",
                    if (currentEmail.isNullOrBlank()) onOpenSignIn else onSignOut
                )
                HeaderButton("☰", onOpenMenu)
            }
        }
    }
}

@Composable
private fun HeaderButton(
    symbol: String,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.size(28.dp),
        shape = RoundedCornerShape(7.dp),
        color = Color.Black.copy(alpha = 0.34f),
    ) {
        IconButton(onClick = onClick) {
            Text(
                text = symbol,
                color = if (symbol == "🔑") ParagonGold else Color.White,
                style = MaterialTheme.typography.labelMedium
            )
        }
    }
}

@Composable
private fun websiteFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color(0xFF111111),
    unfocusedTextColor = Color(0xFF111111),
    focusedPlaceholderColor = Color(0xFF6B5F4B),
    unfocusedPlaceholderColor = Color(0xFF6B5F4B),
    focusedBorderColor = ParagonGold,
    unfocusedBorderColor = Color(0xFFB9B9B9),
    cursorColor = Color(0xFF111111),
    focusedLabelColor = Color(0xFF111111),
    unfocusedLabelColor = Color(0xFF4C453D),
)

@Composable
private fun UploadFieldLabel(label: String) {
    Text(
        text = label,
        color = Color(0xFF111111),
        style = MaterialTheme.typography.bodyMedium,
        fontWeight = FontWeight.Bold
    )
}

@Composable
private fun WebsiteLikeSelectField(
    value: String,
    onOpen: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(4.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = value,
                color = Color(0xFF111111),
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "▼",
                color = Color(0xFF4C453D),
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

private fun Uri?.toCompactLabel(): String {
    if (this == null) return "No file chosen"
    val raw = toString()
    return raw.substringAfterLast('/').ifBlank { raw }
}

private fun createVideoCaptureUri(context: android.content.Context): Uri? {
    val values = ContentValues().apply {
        put(MediaStore.Video.Media.DISPLAY_NAME, "paragon-${System.currentTimeMillis()}.mp4")
        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/ParagonPlanet")
        }
    }
    return context.contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
}

