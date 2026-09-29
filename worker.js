importScripts("keccak.js");
let job = null, running = false;
const s = new Int32Array(50), tpl = new Int32Array(50), tgt = new Uint32Array(8);
function hexBytes(h) {
  h = h.replace(/^0x/, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
function setup(d) {
  const msg = new Uint8Array(136);
  msg.set(hexBytes(d.miner).subarray(0, 20), 0);
  const pre = new Uint8Array(28);
  crypto.getRandomValues(pre);
  msg.set(pre, 20);
  msg.set(hexBytes(d.lastWork), 52);
  msg.set(hexBytes(d.bh), 84);
  msg[116] ^= 0x01; msg[135] ^= 0x80;
  tpl.fill(0);
  for (let i = 0; i < 34; i++) tpl[i] = msg[4 * i] | (msg[4 * i + 1] << 8) | (msg[4 * i + 2] << 16) | (msg[4 * i + 3] << 24);
  const t = hexBytes(d.target.replace(/^0x/, "").padStart(64, "0"));
  for (let i = 0; i < 8; i++) tgt[i] = ((t[4 * i] << 24) | (t[4 * i + 1] << 16) | (t[4 * i + 2] << 8) | t[4 * i + 3]) >>> 0;
  job = { id: d.id, bn: d.bn, pre, counter: (Math.random() * 0x7fffffff) >>> 0 };
}
function bswap(v) { return (((v & 255) << 24) | (((v >>> 8) & 255) << 16) | (((v >>> 16) & 255) << 8) | ((v >>> 24) & 255)) >>> 0; }
function loop() {
  if (!running || !job) return;
  const t0 = performance.now();
  let n = 0;
  const f = Keccak.f;
  while (performance.now() - t0 < 200) {
    for (let k = 0; k < 2000; k++) {
      const c = job.counter = (job.counter + 1) >>> 0;
      s.set(tpl);
      s[12] = (((c >>> 24) & 255) | (((c >>> 16) & 255) << 8) | (((c >>> 8) & 255) << 16) | ((c & 255) << 24)) | 0;
      f(s);
      let ok = false;
      for (let i = 0; i < 8; i++) {
        const h = bswap(s[i]);
        if (h < tgt[i]) { ok = true; break; }
        if (h > tgt[i]) break;
        if (i === 7) ok = true;
      }
      if (ok) {
        let nonce = "";
        for (const b of job.pre) nonce += b.toString(16).padStart(2, "0");
        nonce += c.toString(16).padStart(8, "0");
        let hash = "";
        for (let i = 0; i < 8; i++) hash += bswap(s[i]).toString(16).padStart(8, "0");
        postMessage({ type: "found", id: job.id, nonce: "0x" + nonce, bn: job.bn, hash: "0x" + hash, hashes: n + k + 1 });
        running = false;
        return;
      }
    }
    n += 2000;
  }
  postMessage({ type: "rate", hashes: n, ms: performance.now() - t0 });
  setTimeout(loop, 0);
}
onmessage = (e) => {
  const d = e.data;
  if (d.type === "job") { setup(d); if (!running) { running = true; loop(); } }
  else if (d.type === "stop") { running = false; }
};
