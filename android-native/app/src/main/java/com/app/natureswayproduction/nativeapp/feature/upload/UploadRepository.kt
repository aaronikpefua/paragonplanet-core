package com.app.natureswayproduction.nativeapp.feature.upload

import android.content.ContentResolver
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import com.app.natureswayproduction.nativeapp.data.api.ParagonApiService
import com.app.natureswayproduction.nativeapp.data.api.UploadRequestPayload
import com.app.natureswayproduction.nativeapp.data.appcheck.AppCheckRepository
import com.app.natureswayproduction.nativeapp.data.auth.SessionRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

class UploadRepository(
    private val contentResolver: ContentResolver,
    private val apiService: ParagonApiService,
    private val sessionRepository: SessionRepository,
    private val appCheckRepository: AppCheckRepository,
) {
    suspend fun uploadVideo(
        uri: Uri,
        title: String,
        description: String,
        category: String,
        onProgress: (Int, String) -> Unit,
    ): String = withContext(Dispatchers.IO) {
        val idToken = sessionRepository.getFreshIdToken()
            ?: throw IllegalStateException("Sign in first to upload.")
        val appCheckToken = appCheckRepository.getToken(forceRefresh = true)

        val meta = readFileMeta(uri)
        if (!meta.mimeType.startsWith("video/")) {
            throw IllegalStateException("Please choose a valid video file.")
        }

        if (appCheckToken == null) {
            onProgress(0, "App Check token not available. Continuing with trusted tester upload path…")
        } else {
            onProgress(0, "App Check token acquired. Requesting signed upload URL…")
        }

        val ticket = apiService.requestVideoUpload(
            idToken = idToken,
            appCheckToken = appCheckToken,
            payload = UploadRequestPayload(
                title = title,
                description = description,
                category = category,
                fileName = meta.displayName,
                fileType = meta.mimeType,
                fileSize = meta.sizeBytes,
                durationSeconds = meta.durationSeconds,
            )
        )

        onProgress(5, "Uploading video file…")
        uploadToSignedUrl(uri, meta.mimeType, ticket.uploadUrl, onProgress)

        onProgress(96, "Queuing processing…")
        apiService.triggerVideoCompression(
            idToken = idToken,
            appCheckToken = appCheckToken,
            objectPath = ticket.objectPath,
            fileUrl = ticket.fileUrl,
            videoId = ticket.videoId,
            title = title,
            description = description,
            category = category,
            durationSeconds = meta.durationSeconds,
        )

        onProgress(100, "Upload queued successfully.")
        ticket.videoId
    }

    private fun readFileMeta(uri: Uri): FileMeta {
        var name = "upload.mp4"
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
        val retriever = MediaMetadataRetriever()
        val durationSeconds = try {
            retriever.setDataSource(contentResolver.openAssetFileDescriptor(uri, "r")?.fileDescriptor)
            val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            (durationMs / 1000L).toInt()
        } finally {
            runCatching { retriever.release() }
        }

        return FileMeta(
            displayName = name,
            sizeBytes = size,
            mimeType = mimeType,
            durationSeconds = durationSeconds,
        )
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
        } ?: throw IllegalStateException("Could not open the selected video file.")

        val code = connection.responseCode
        if (code !in 200..299) {
            val errorBody = connection.errorStream?.bufferedReader()?.readText().orEmpty()
            throw IllegalStateException("Video upload failed ($code): $errorBody")
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
                val percent = 5 + ((uploaded.toDouble() / totalBytes.toDouble()) * 90.0).toInt().coerceIn(0, 90)
                onProgress(percent, "Uploading video file…")
            }
        }
        output.flush()
    }
}

private data class FileMeta(
    val displayName: String,
    val sizeBytes: Long,
    val mimeType: String,
    val durationSeconds: Int,
)
