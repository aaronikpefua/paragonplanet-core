# Auth Measurements

TEST A1 existing login/session restoration is NOT YET MEASURABLE.

## Reason

No interactive browser or Android session was run, and no tokens were requested or exposed.

## Safe Future Capture

Use session restoration when already authenticated. Capture auth start, Firebase completion, profile/bootstrap load, and ready state without logging tokens or provider secrets.
