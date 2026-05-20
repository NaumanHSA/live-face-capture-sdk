"""
Liveness Demo Server
--------------------
Endpoints
  GET  /api/v1/key          → RSA-2048 public key PEM (for SDK encryption)
  POST /api/v1/liveness     → decrypt token, run stub liveness check, return result

Run:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""

import base64
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("liveness")

app = FastAPI(title="Liveness Demo Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── RSA key pair — generated once at startup ──────────────────────────────────
_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_key  = _private_key.public_key()

PUBLIC_KEY_PEM: str = _public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
).decode()

log.info("RSA-2048 key pair generated.")
log.info("Public key:\n%s", PUBLIC_KEY_PEM)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/v1/key")
def get_public_key():
    """Return the RSA public key PEM so the SDK can encrypt frames."""
    return {"key": PUBLIC_KEY_PEM}


class LivenessRequest(BaseModel):
    token: str   # v2.<alg>.<ct>.<wrappedKey>.<iv>.<tag?>


@app.post("/api/v1/liveness")
def check_liveness(req: LivenessRequest):
    """
    Decrypt the SDK token and run a liveness check.
    Returns { passed: bool, score: float, message: str }.
    """
    try:
        frame_b64 = _decrypt_token(req.token)
    except Exception as exc:
        log.warning("Decryption failed: %s", exc)
        raise HTTPException(status_code=400, detail=f"Decryption failed: {exc}")

    result = _liveness_check(frame_b64)
    log.info("Liveness result: %s", result)
    return {"status": "ok", "liveness": result}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decrypt_token(token: str) -> str:
    """
    Token format (from SDK envelope.js):
      v2.A256GCM.<ct_b64>.<wrappedKey_b64>.<iv_b64>.<tag_b64>
      v2.A256CBC.<ct_b64>.<wrappedKey_b64>.<iv_b64>
    """
    parts = token.split(".")
    if len(parts) < 5:
        raise ValueError("Token has too few parts")

    version, alg = parts[0], parts[1]
    if version != "v2":
        raise ValueError(f"Unsupported token version: {version}")

    ct          = base64.b64decode(parts[2])
    wrapped_key = base64.b64decode(parts[3])
    iv          = base64.b64decode(parts[4])

    # Unwrap the per-frame AES key with our RSA private key
    aes_key = _private_key.decrypt(
        wrapped_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    if alg == "A256GCM":
        if len(parts) < 6:
            raise ValueError("Missing GCM auth tag")
        tag = base64.b64decode(parts[5])
        aesgcm = AESGCM(aes_key)
        plaintext = aesgcm.decrypt(iv, ct + tag, None)   # WebCrypto sends ct||tag
        return plaintext.decode()

    if alg == "A256CBC":
        cipher    = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        padded    = decryptor.update(ct) + decryptor.finalize()
        pad_len   = padded[-1]                            # PKCS7 padding
        return padded[:-pad_len].decode()

    raise ValueError(f"Unsupported algorithm: {alg}")


def _liveness_check(frame_b64: str) -> dict:
    """
    Stub liveness check.
    Replace this body with your real ML model call.
    Currently: verifies the payload is a non-empty valid base64 JPEG and passes.
    """
    # Strip data-URL prefix if present (e.g. "data:image/jpeg;base64,...")
    if "," in frame_b64:
        frame_b64 = frame_b64.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(frame_b64)
        # Minimal JPEG sanity check: starts with FF D8, ends with FF D9
        is_jpeg = img_bytes[:2] == b"\xff\xd8" and img_bytes[-2:] == b"\xff\xd9"
        size_kb  = len(img_bytes) / 1024
    except Exception:
        return {"passed": False, "score": 0.0, "message": "Invalid image payload"}

    if not is_jpeg:
        return {"passed": False, "score": 0.1, "message": "Payload is not a JPEG"}

    # ── stub result (always PASS for valid JPEG) ──────────────────────────────
    score = min(0.99, 0.85 + size_kb / 1000)   # naive size heuristic for demo
    return {
        "passed": True,
        "score": round(score, 3),
        "message": f"Liveness passed (stub) — frame {size_kb:.1f} KB",
    }
