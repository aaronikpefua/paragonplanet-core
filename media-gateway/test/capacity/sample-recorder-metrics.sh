#!/usr/bin/env bash
set -euo pipefail
out="${1:?CSV output required}"; interval="${2:-2}"
iface="$(ip route show default | awk 'NR==1{print $5}')"
printf 'timestamp,cpu_pct,mem_pct,rx_mbps,tx_mbps,worker_cpu,worker_rss_mb,workers,zombies,failures,falling_behind,timestamp_anomalies\n' >"$out"
read -r rx0 tx0 < <(awk -v dev="$iface" '$1==dev":"{print $2,$10}' /proc/net/dev); t0=$(date +%s%N)
while true; do
  sleep "$interval"
  read -r rx1 tx1 < <(awk -v dev="$iface" '$1==dev":"{print $2,$10}' /proc/net/dev); t1=$(date +%s%N)
  dt=$(awk -v a="$t0" -v b="$t1" 'BEGIN{print (b-a)/1000000000}')
  cpu=$(LC_ALL=C mpstat 1 1 | awk '/Average:/ && $2=="all"{print 100-$NF}')
  mem=$(free | awk '/Mem:/{print $3*100/$2}')
  stats=$(ps -eo stat,pcpu,rss,args --no-headers | awk '
    /[f]fmpeg.*-f null -/{c+=$2;r+=$3;n++} $1~/^Z/{z++}
    END{printf "%.2f,%.2f,%d,%d",c,r/1024,n,z}')
  failures=$(cat /opt/results/recording-*.log 2>/dev/null | grep -Eci 'error|failed|invalid data|connection refused' || true)
  behind=$(cat /opt/results/recording-*.log 2>/dev/null | grep -Eci 'dropping|queue.*full|buffer underflow' || true)
  timestamps=$(cat /opt/results/recording-*.log 2>/dev/null | grep -Eci 'non-monoton|backward' || true)
  rx=$(awk -v d="$dt" -v a="$rx0" -v b="$rx1" 'BEGIN{print (b-a)*8/d/1000000}')
  tx=$(awk -v d="$dt" -v a="$tx0" -v b="$tx1" 'BEGIN{print (b-a)*8/d/1000000}')
  printf '%s,%.2f,%.2f,%.3f,%.3f,%s,%d,%d,%d\n' "$(date -Iseconds)" "$cpu" "$mem" "$rx" "$tx" "$stats" "$failures" "$behind" "$timestamps" >>"$out"
  rx0=$rx1; tx0=$tx1; t0=$t1
done
