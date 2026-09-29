#!/usr/bin/env bash
set -euo pipefail
out="${1:?csv output required}"; interval="${2:-2}"
iface="$(ip route show default | awk 'NR==1{print $5}')"
printf 'timestamp,cpu_pct,mem_pct,rx_mbps,tx_mbps,mediamtx_cpu,mediamtx_rss_mb,normalizer_cpu,normalizer_rss_mb,recorder_cpu,recorder_rss_mb,recorders,zombies,damaged_h264\n' >"$out"
read -r rx0 tx0 < <(awk -v dev="$iface" '$1==dev":"{print $2,$10}' /proc/net/dev); t0=$(date +%s%N)
while true; do
  sleep "$interval"; read -r rx1 tx1 < <(awk -v dev="$iface" '$1==dev":"{print $2,$10}' /proc/net/dev); t1=$(date +%s%N)
  dt=$(awk -v a="$t0" -v b="$t1" 'BEGIN{print (b-a)/1000000000}')
  cpu=$(LC_ALL=C mpstat 1 1 | awk '/Average:/ && $2=="all"{print 100-$NF}'); mem=$(free | awk '/Mem:/{print $3*100/$2}')
  stats=$(ps -eo stat,pcpu,rss,args --no-headers | awk '
    /[m]ediamtx/{mc+=$2;mr+=$3} /[f]fmpeg.*live_cap/{nc+=$2;nr+=$3} /[f]fmpeg.*-f null -/{rc+=$2;rr+=$3;n++} $1~/^Z/{z++}
    END{printf "%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%d,%d",mc,mr/1024,nc,nr/1024,rc,rr/1024,n,z}')
  damaged=$(docker logs cap-mediamtx 2>&1 | grep -Eci 'RTP packet lost|damaged|invalid NALU|non-monoton|corrupt' || true)
  rx=$(awk -v d="$dt" -v a="$rx0" -v b="$rx1" 'BEGIN{print (b-a)*8/d/1000000}'); tx=$(awk -v d="$dt" -v a="$tx0" -v b="$tx1" 'BEGIN{print (b-a)*8/d/1000000}')
  printf '%s,%.2f,%.2f,%.3f,%.3f,%s,%d\n' "$(date -Iseconds)" "$cpu" "$mem" "$rx" "$tx" "$stats" "$damaged" >>"$out"
  rx0=$rx1; tx0=$tx1; t0=$t1
done
