import hashlib
import hmac
import os


def hash_password(password: str, salt: str | None = None) -> str:
    """
    Simple salted hash (demo-grade). For production use bcrypt/argon2.
    Format: sha256$<salt_hex>$<digest_hex>
    """
    if salt is None:
        salt = os.urandom(16).hex()
    msg = (salt + password).encode("utf-8")
    digest = hashlib.sha256(msg).hexdigest()
    return f"sha256${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt, digest = stored.split("$", 2)
        if algo != "sha256":
            return False
        computed = hash_password(password, salt=salt).split("$", 2)[2]
        return hmac.compare_digest(computed, digest)
    except Exception:
        return False


def as_float(value, default=0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def as_int(value, default=0) -> int:
    try:
        return int(value)
    except Exception:
        return int(default)

