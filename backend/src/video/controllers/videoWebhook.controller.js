import admin from "../../config/firebase.js";
import {
  parseStreamWebhookPayload,
  processCitizenStreamWebhook,
  verifyStreamWebhookSignature,
} from "../services/cloudflareStreamWebhook.js";

export async function receiveCloudflareStreamWebhook(req, res) {
  const rawBody = req.rawBody;
  const signatureHeader = req.headers["webhook-signature"];
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET || "";
  if (!secret) return res.status(503).json({ error: "Stream webhook is not configured" });
  if (!verifyStreamWebhookSignature({ rawBody, signatureHeader, secret })) {
    console.warn("video.stream.webhook_invalid_signature");
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const parsed = parseStreamWebhookPayload(rawBody);
  if (!parsed) return res.status(400).json({ error: "Malformed Stream webhook payload" });

  try {
    const result = await processCitizenStreamWebhook({
      db: admin.firestore(),
      payload: parsed.payload,
    });
    console.info(JSON.stringify({
      event: "video.stream.webhook",
      uid: parsed.uid,
      state: parsed.state,
      outcome: result.outcome,
      videoId: result.videoId || "",
      timestamp: new Date().toISOString(),
    }));
    if (["unknown_uid", "ambiguous_uid", "video_id_mismatch", "uid_changed"].includes(result.outcome)) {
      return res.status(202).json({ ok: true, ignored: true, outcome: result.outcome });
    }
    return res.status(200).json({ ok: true, outcome: result.outcome });
  } catch (error) {
    console.error("video.stream.webhook_failed", error?.message || error);
    return res.status(500).json({ error: "Could not process Stream webhook" });
  }
}
