# Remaining Bottlenecks

## Web feed transition

Classification: MEASURED / SOURCE-CONFIRMED.

The thumbnail bridge reduced the visible black-screen transition, but remaining delay is still visible because the next media source is not prepared until the item becomes active.

Current source details:

- Inactive feed cards render thumbnail placeholders, not video elements.
- The existing intersection observer tries to set `preload = "metadata"` on the next `<video>`.
- Because the inactive next item has no `<video>`, the preload path is effectively a no-op.
- Activation still performs player/source creation, metadata readiness, and first-frame startup.

Recommended follow-up: bounded one-next-video preparation, with no UI redesign and no unbounded preload.

