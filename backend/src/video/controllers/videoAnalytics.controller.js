import admin from "../../config/firebase.js";
import { heartbeatVideoViewSession, startVideoViewSession } from "../services/videoAnalytics.js";

export async function startVideoView(req, res) {
  try {
    const result = await startVideoViewSession({ db: admin.firestore(), videoId: String(req.body?.videoId || ""), viewerId: req.user.uid, durationSeconds: req.body?.durationSeconds });
    return res.status(201).json(result);
  } catch (error) { return res.status(error.status || 500).json({ error: error.message || "Could not start video view" }); }
}

export async function heartbeatVideoView(req, res) {
  try {
    const result = await heartbeatVideoViewSession({ db: admin.firestore(), sessionId: String(req.params.sessionId || ""), viewerId: req.user.uid, watchedDeltaSeconds: req.body?.watchedDeltaSeconds, positionSeconds: req.body?.positionSeconds, durationSeconds: req.body?.durationSeconds, ended: Boolean(req.body?.ended) });
    return res.json(result);
  } catch (error) { return res.status(error.status || 500).json({ error: error.message || "Could not update video view" }); }
}
