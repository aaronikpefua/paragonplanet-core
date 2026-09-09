FROM bluenviron/mediamtx:1.21.0 AS mediamtx

FROM ubuntu:24.04
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl ffmpeg gettext-base jq \
    && rm -rf /var/lib/apt/lists/*
COPY --from=mediamtx /mediamtx /usr/local/bin/mediamtx
COPY mediamtx.yml /etc/mediamtx.yml
COPY scripts /opt/paragon
RUN chmod 0755 /opt/paragon/*.sh
ENTRYPOINT ["/opt/paragon/entrypoint.sh"]
