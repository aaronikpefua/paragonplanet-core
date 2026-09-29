import admin from "../config/firebase.js";
import {
  createChannel,
  createProgram,
  getChannel,
  getCurrentProgram,
  getNextProgram,
  listChannels,
  listSchedule,
  scheduleProgram,
  setChannelStatus,
  updateChannel,
  updateProgram,
} from "./tv.service.js";

function handler(action) {
  return async (req, res) => {
    try {
      return res.json(await action(req, admin.firestore()));
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message || "TV request failed" });
    }
  };
}

export const adminCreateChannel = handler((req, db) => createChannel({ db, body: req.body, actorUid: req.user.uid }));
export const adminUpdateChannel = handler((req, db) => updateChannel({ db, channelId: req.params.channelId, body: req.body, actorUid: req.user.uid }));
export const adminActivateChannel = handler((req, db) => setChannelStatus({ db, channelId: req.params.channelId, status: "ACTIVE", actorUid: req.user.uid }));
export const adminDeactivateChannel = handler((req, db) => setChannelStatus({ db, channelId: req.params.channelId, status: "INACTIVE", actorUid: req.user.uid }));
export const adminCreateProgram = handler((req, db) => createProgram({ db, body: req.body, actorUid: req.user.uid }));
export const adminUpdateProgram = handler((req, db) => updateProgram({ db, programId: req.params.programId, body: req.body, actorUid: req.user.uid }));
export const adminScheduleProgram = handler((req, db) => scheduleProgram({ db, programId: req.params.programId, startsAt: req.body?.startsAt, endsAt: req.body?.endsAt, actorUid: req.user.uid }));

export const publicListChannels = handler((req, db) => listChannels({ db, requestedPageSize: req.query.pageSize, cursor: req.query.cursor }));
export const publicGetChannel = handler((req, db) => getChannel({ db, channelId: req.params.channelId }));
export const publicGetCurrentProgram = handler((req, db) => getCurrentProgram({ db, channelId: req.params.channelId }).then((program) => ({ program })));
export const publicGetNextProgram = handler((req, db) => getNextProgram({ db, channelId: req.params.channelId }).then((program) => ({ program })));
export const publicListSchedule = handler((req, db) => listSchedule({ db, channelId: req.params.channelId, requestedPageSize: req.query.pageSize, cursor: req.query.cursor }));
