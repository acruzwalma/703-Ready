// Passphrase-based encryption (PBKDF2 → AES-256-GCM). The browser uses the same scheme,
// so data committed to a public repo can only be read by someone who knows APP_PASSPHRASE.
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u => Buffer.from(u).toString("base64");
const ub64 = s => new Uint8Array(Buffer.from(s, "base64"));
async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey("raw", te.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function seal(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deriveKey(pass, salt), te.encode(JSON.stringify(obj)));
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}
export async function open(box, pass) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64(box.iv) }, await deriveKey(pass, ub64(box.salt)), ub64(box.ct));
  return JSON.parse(td.decode(pt));
}
