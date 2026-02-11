import { createSignedUploadUrl } from "../services/video.service.js";
import { createVideo } from "../models/video.model.js";

// Temporary in-memory store (DB comes next)
const videos = [];

export async function requestUploadUrl(req, res) {
  const { filename, contentType, title, category } = req.body;

  const upload = await createSignedUploadUrl({
    userId: req.user.uid,
    filename,
    contentType
  });

  const video = createVideo({
    userId: req.user.uid,
    title,
    category,
    bucket: upload.bucket,
    objectPath: upload.objectPath
  });

  videos.push(video);

  res.status(201).json({
    uploadUrl: upload.uploadUrl,
    video
  });
}

export function listVideos(req, res) {
  res.json(videos.filter(v => v.status === "ACTIVE"));
}
