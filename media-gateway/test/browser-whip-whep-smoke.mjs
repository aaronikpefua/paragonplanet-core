const endpoint = process.env.PARAGON_CDP_ENDPOINT || "http://127.0.0.1:9222";
const targets = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const target = targets.find((candidate) => candidate.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("No Chrome page target is available");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let requestId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await command("Page.enable");
await command("Page.navigate", { url: "https://www.paragonplanet.com/" });
await new Promise((resolve) => setTimeout(resolve, 3000));

const config = {
  whipUrl: process.env.PARAGON_SMOKE_WHIP_URL,
  publishToken: process.env.PARAGON_SMOKE_PUBLISH_TOKEN,
  whepUrl: process.env.PARAGON_SMOKE_WHEP_URL,
  playbackToken: process.env.PARAGON_SMOKE_PLAYBACK_TOKEN,
};
if (Object.values(config).some((value) => !value)) throw new Error("Smoke connection parameters are incomplete");

const expression = `
(async (config) => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const gathered = (peer) => peer.iceGatheringState === "complete" ? Promise.resolve() : new Promise((resolve) => {
    peer.addEventListener("icegatheringstatechange", () => peer.iceGatheringState === "complete" && resolve());
  });
  const exchange = async (peer, url, token) => {
    await peer.setLocalDescription(await peer.createOffer());
    await gathered(peer);
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/sdp" },
      body: peer.localDescription.sdp,
    });
    const answer = await response.text();
    if (!response.ok) throw new Error(response.status + " " + answer);
    await peer.setRemoteDescription({ type: "answer", sdp: answer });
  };
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  let frame = 0;
  const timer = setInterval(() => {
    frame += 1;
    context.fillStyle = frame % 2 ? "#d71920" : "#e5b321";
    context.fillRect(0, 0, 640, 360);
    context.fillStyle = "white";
    context.font = "48px sans-serif";
    context.fillText("Paragon WHIP " + frame, 30, 190);
  }, 33);
  const publish = new RTCPeerConnection();
  publish.addTrack(canvas.captureStream(30).getVideoTracks()[0]);
  await exchange(publish, config.whipUrl, config.publishToken);
  await sleep(5000);
  const playback = new RTCPeerConnection();
  playback.addTransceiver("video", { direction: "recvonly" });
  await exchange(playback, config.whepUrl, config.playbackToken);
  await sleep(5000);
  const inbound = [...(await playback.getStats()).values()].find((entry) => entry.type === "inbound-rtp" && entry.kind === "video");
  const result = {
    publishState: publish.connectionState,
    playbackState: playback.connectionState,
    packetsReceived: Number(inbound?.packetsReceived || 0),
    framesDecoded: Number(inbound?.framesDecoded || 0),
  };
  clearInterval(timer);
  publish.close();
  playback.close();
  return result;
})(${JSON.stringify(config)})`;

const evaluation = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
socket.close();
if (evaluation.exceptionDetails) throw new Error(evaluation.exceptionDetails.text || "Browser WebRTC smoke failed");
const result = evaluation.result?.value;
if (result?.publishState !== "connected" || result?.playbackState !== "connected" || result?.packetsReceived < 1) {
  throw new Error(`Browser media smoke failed: ${JSON.stringify(result)}`);
}
process.stdout.write(JSON.stringify(result));
