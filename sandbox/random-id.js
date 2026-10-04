// BizStack sandbox — random ID generator demo
// A tiny, self-contained snippet pushed as a live test of repo write access.

function randomHexId(length = 8) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

console.log("BizStack random ID:", randomHexId());
