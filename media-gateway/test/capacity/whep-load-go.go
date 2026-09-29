package main

import (
  "context"
  "encoding/json"
  "fmt"
  "net/http"
  "net/url"
  "os"
  "strconv"
  "sync"
  "sync/atomic"
  "time"

  "github.com/bluenviron/mediamtx/internal/logger"
  "github.com/bluenviron/mediamtx/internal/protocols/whip"
)

type quietLog struct{}
func (quietLog) Log(logger.Level, string, ...any) {}

type result struct {
  Requested int `json:"requested"`; Connected int64 `json:"connected"`; Failed int64 `json:"failed"`
  AverageStartupMs float64 `json:"averageStartupMs"`; P95StartupMs float64 `json:"p95StartupMs"`
  BytesReceived uint64 `json:"bytesReceived"`; PacketsReceived uint64 `json:"packetsReceived"`
  PacketsLost uint64 `json:"packetsLost"`; JitterAverage float64 `json:"jitterAverage"`
  DirectUDP int `json:"directUdp"`; TCP int `json:"tcp"`; TURN int `json:"turn"`; Reconnects int `json:"reconnects"`
}

func main() {
  if len(os.Args) != 4 { panic("usage: whep-load URL COUNT HOLD_SECONDS") }
  target, err := url.Parse(os.Args[1]); if err != nil { panic(err) }
  count, _ := strconv.Atoi(os.Args[2]); hold, _ := strconv.Atoi(os.Args[3])
  clients := make([]*whip.Client, count); starts := make([]float64, 0, count)
  var connected, failed int64; var mu sync.Mutex; var wg sync.WaitGroup
  sem := make(chan struct{}, 50)
  for i := 0; i < count; i++ { wg.Add(1); go func(i int) { defer wg.Done(); sem <- struct{}{}; defer func(){<-sem}()
    u := *target; t := time.Now(); c := &whip.Client{URL:&u, HTTPClient:&http.Client{Timeout:20*time.Second}, UDPReadBufferSize:4194304, STUNGatherTimeout:5*time.Second, HandshakeTimeout:12*time.Second, TrackGatherTimeout:3*time.Second, Log:quietLog{}}
    if err := c.Initialize(context.Background()); err != nil { atomic.AddInt64(&failed,1); return }
    c.StartReading(); clients[i]=c; atomic.AddInt64(&connected,1); mu.Lock(); starts=append(starts,float64(time.Since(t).Microseconds())/1000); mu.Unlock()
  }(i); if i%50==49 { time.Sleep(100*time.Millisecond) } }
  wg.Wait(); time.Sleep(time.Duration(hold)*time.Second)
  out := result{Requested:count,Connected:connected,Failed:failed}; var jitters float64
  for _, c := range clients { if c==nil {continue}; s:=c.PeerConnection().Stats(); out.BytesReceived+=s.BytesReceived; out.PacketsReceived+=s.RTPPacketsReceived; out.PacketsLost+=s.RTPPacketsLost; jitters+=s.RTPPacketsJitter; if fmt.Sprint(c.PeerConnection().LocalCandidate())!="<nil>" {out.DirectUDP++}; _=c.Close() }
  for i:=0;i<len(starts);i++ {for j:=i+1;j<len(starts);j++ {if starts[j]<starts[i]{starts[i],starts[j]=starts[j],starts[i]}}}
  for _,v:=range starts{out.AverageStartupMs+=v}; if len(starts)>0 {out.AverageStartupMs/=float64(len(starts));out.P95StartupMs=starts[int(float64(len(starts)-1)*.95)];out.JitterAverage=jitters/float64(len(starts))}
  _=json.NewEncoder(os.Stdout).Encode(out)
}
