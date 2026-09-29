export const TV_CHANNEL_STATES = Object.freeze(["DRAFT", "ACTIVE", "INACTIVE"]);
export const TV_PROGRAM_STATES = Object.freeze(["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"]);

export function isTvChannelState(value) {
  return TV_CHANNEL_STATES.includes(String(value || "").toUpperCase());
}

export function isTvProgramState(value) {
  return TV_PROGRAM_STATES.includes(String(value || "").toUpperCase());
}
