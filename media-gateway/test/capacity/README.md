# Paragon Live isolated capacity harness

This directory contains the reusable harness used for the September 2026
production-style capacity benchmark. It is intentionally isolated from the
production gateway and must only be pointed at disposable test infrastructure.

The harness models the current gateway path:

- `publishers.sh` creates RTMP publishers from a fixed 720p30 H264/AAC sample.
- `restream.sh` copies H264 and converts AAC to Opus for the WHEP path.
- `recording-worker.sh` models one Cloudflare recording worker per publisher
  without sending media to a production Cloudflare input.
- `whep-load-go.go` creates non-decoding WHEP peers using MediaMTX's own WHIP
  client. Since it imports MediaMTX internal packages, copy it into a matching
  MediaMTX source checkout before building it.
- `whep-load.html` and `run-whep.mjs` provide a browser-decoding smoke test.
- `sample-metrics.sh` records host, network, process, recorder, zombie, and
  damaged-H264 metrics to CSV.

`mediamtx.yml` is test-only. Substitute `CAP_GATEWAY_IP` before startup. The
benchmark requires an external load-generator host and the Linux UDP read/write
buffers used by production (`net.core.rmem_max` and `net.core.wmem_max` at
4,194,304 bytes).

Never reuse production publish URLs, session credentials, Cloudflare inputs, or
customer gateway addresses in this harness. Apply staged load and stop on the
authorized CPU, memory, network, packet-loss, failure, or latency thresholds.

Raw CSV evidence from the completed isolated run is retained in `results/` and
the `pub*c.csv` files. Files without the `c` suffix are setup-validation runs
and are not benchmark evidence.

For the separated-recording publisher test, use `mediamtx-separated.yml` on the
origin, `publisher-stage.sh` on the external generator, and
`recording-pool-stage.sh` on independent recording compute. Collect origin and
recording metrics separately with `sample-origin-metrics.sh` and
`sample-recorder-metrics.sh`.
