// Hybrid encryption: RSA-OAEP(SHA-256) to wrap AES-256 key + AES-GCM or AES-CBC for data.
// Output format (v2 recommended):
//   v2.<alg>.<ctB64>.<wrappedKeyB64>.<ivB64>.<tagB64?>
//
// Notes:
// - Use URL-safe base64 if you want to put tokens in URLs (optional).
// - For AES-GCM, WebCrypto expects ct||tag as the ciphertext input to decrypt().

const PEM_PUB_H = "-----BEGIN PUBLIC KEY-----";
const PEM_PUB_F = "-----END PUBLIC KEY-----";
const PEM_PRI_H = "-----BEGIN PRIVATE KEY-----";
const PEM_PRI_F = "-----END PRIVATE KEY-----";

function stripPem(pem) {
  if (!pem || typeof pem !== "string") throw new Error("Missing PEM key string");
  return pem
    .replace(PEM_PUB_H, "")
    .replace(PEM_PUB_F, "")
    .replace(PEM_PRI_H, "")
    .replace(PEM_PRI_F, "")
    .replace(/\s+/g, "");
}

function b64ToU8(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function u8ToB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

async function importRsaPublicKey(pem) {
  const der = b64ToU8(stripPem(pem));
  return crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function importRsaPrivateKey(pem) {
  const der = b64ToU8(stripPem(pem));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

async function rsaWrapAesKey(aesKeyRaw, publicKeyPem) {
  const pub = await importRsaPublicKey(publicKeyPem);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, aesKeyRaw);
  return new Uint8Array(wrapped);
}

async function rsaUnwrapAesKey(wrappedKeyU8, privateKeyPem) {
  const pri = await importRsaPrivateKey(privateKeyPem);
  const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, pri, wrappedKeyU8);
  return new Uint8Array(raw);
}

export async function encryptEnvelope(plaintextStr, publicKeyPem, opts = {}) {
  const {
    alg = "A256GCM",     // "A256GCM" (recommended) or "A256CBC"
    version = "v2",
  } = opts;

  if (!publicKeyPem) throw new Error("encryptEnvelope: publicKeyPem is required");

  const enc = new TextEncoder();
  const plainU8 = enc.encode(plaintextStr);

  // ✅ cryptographically random 256-bit key
  const aesKeyRaw = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(alg === "A256GCM" ? 12 : 16));

  const wrappedKey = await rsaWrapAesKey(aesKeyRaw, publicKeyPem);

  if (alg === "A256GCM") {
    const key = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-GCM" }, false, ["encrypt"]);
    const out = new Uint8Array(await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      plainU8
    ));

    // WebCrypto returns ct||tag
    const ct = out.slice(0, out.length - 16);
    const tag = out.slice(out.length - 16);

    return `${version}.${alg}.${u8ToB64(ct)}.${u8ToB64(wrappedKey)}.${u8ToB64(iv)}.${u8ToB64(tag)}`;
  }

  if (alg === "A256CBC") {
    const key = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-CBC" }, false, ["encrypt"]);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, plainU8));
    return `${version}.${alg}.${u8ToB64(ct)}.${u8ToB64(wrappedKey)}.${u8ToB64(iv)}`;
  }

  throw new Error(`encryptEnvelope: unsupported alg=${alg}`);
}

export async function decryptEnvelope(token, privateKeyPem) {
  if (!token || typeof token !== "string") throw new Error("decryptEnvelope: token required");
  if (!privateKeyPem) throw new Error("decryptEnvelope: privateKeyPem required");

  const parts = token.split(".");
  if (parts.length < 5) throw new Error("Invalid token format");

  const [version, alg, ctB64, wrappedKeyB64, ivB64, tagB64] = parts;

  if (version !== "v2") throw new Error(`Unsupported version ${version}`);

  const ct = b64ToU8(ctB64);
  const wrappedKey = b64ToU8(wrappedKeyB64);
  const iv = b64ToU8(ivB64);

  const aesKeyRaw = await rsaUnwrapAesKey(wrappedKey, privateKeyPem);

  if (alg === "A256GCM") {
    if (!tagB64) throw new Error("Missing GCM tag");
    const tag = b64ToU8(tagB64);

    // ✅ recombine ct||tag as WebCrypto expects
    const combined = new Uint8Array(ct.length + tag.length);
    combined.set(ct, 0);
    combined.set(tag, ct.length);

    const key = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-GCM" }, false, ["decrypt"]);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      combined
    );
    return new TextDecoder().decode(plainBuf);
  }

  if (alg === "A256CBC") {
    const key = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-CBC" }, false, ["decrypt"]);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ct);
    return new TextDecoder().decode(plainBuf);
  }

  throw new Error(`Unsupported alg ${alg}`);
}
