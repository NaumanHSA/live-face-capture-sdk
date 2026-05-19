import { describe, it, expect } from "vitest";
import { encryptEnvelope, decryptEnvelope } from "../src/crypto/envelope.js";

// Generate a test RSA key pair once for the suite (Node 18+ Web Crypto).
async function generateTestKeyPair() {
  const kp = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"]
  );
  const pub = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
  const pri = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));

  function wrapPem(u8, type) {
    const b64 = btoa(String.fromCharCode(...u8));
    return `-----BEGIN ${type}-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END ${type}-----`;
  }

  return {
    publicPem: wrapPem(pub, "PUBLIC KEY"),
    privatePem: wrapPem(pri, "PRIVATE KEY"),
  };
}

describe("encryptEnvelope / decryptEnvelope (AES-GCM)", () => {
  it("round-trips a plaintext string", async () => {
    const { publicPem, privatePem } = await generateTestKeyPair();
    const plaintext = "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...";

    const token = await encryptEnvelope(plaintext, publicPem, { alg: "A256GCM", version: "v2" });
    expect(token).toMatch(/^v2\.A256GCM\./);

    const decrypted = await decryptEnvelope(token, privatePem);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const { publicPem } = await generateTestKeyPair();
    const pt = "hello";
    const t1 = await encryptEnvelope(pt, publicPem);
    const t2 = await encryptEnvelope(pt, publicPem);
    expect(t1).not.toBe(t2);
  });

  it("token has exactly 6 dot-separated parts for GCM", async () => {
    const { publicPem } = await generateTestKeyPair();
    const token = await encryptEnvelope("test", publicPem, { alg: "A256GCM" });
    expect(token.split(".").length).toBe(6);
  });
});

describe("encryptEnvelope / decryptEnvelope (AES-CBC)", () => {
  it("round-trips a plaintext string", async () => {
    const { publicPem, privatePem } = await generateTestKeyPair();
    const plaintext = "CBC mode payload";

    const token = await encryptEnvelope(plaintext, publicPem, { alg: "A256CBC", version: "v2" });
    expect(token).toMatch(/^v2\.A256CBC\./);

    const decrypted = await decryptEnvelope(token, privatePem);
    expect(decrypted).toBe(plaintext);
  });

  it("token has exactly 5 dot-separated parts for CBC", async () => {
    const { publicPem } = await generateTestKeyPair();
    const token = await encryptEnvelope("test", publicPem, { alg: "A256CBC" });
    expect(token.split(".").length).toBe(5);
  });
});

describe("error cases", () => {
  it("throws when publicKeyPem is missing", async () => {
    await expect(encryptEnvelope("data", null)).rejects.toThrow();
  });

  it("throws on malformed token", async () => {
    const { privatePem } = await generateTestKeyPair();
    await expect(decryptEnvelope("not.a.valid.token", privatePem)).rejects.toThrow();
  });

  it("throws on unsupported algorithm", async () => {
    const { publicPem } = await generateTestKeyPair();
    await expect(encryptEnvelope("data", publicPem, { alg: "A128GCM" })).rejects.toThrow();
  });
});
