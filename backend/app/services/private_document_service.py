import base64
import hashlib
import uuid
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, UploadFile

from app.config import settings

PRIVATE_DOCUMENT_DIR = Path(__file__).resolve().parents[2] / "private_uploads" / "staff-registration"
MAX_DOCUMENT_BYTES = 5 * 1024 * 1024


def _fernet() -> Fernet:
    # Derive a stable encryption key from the deployment secret; source documents
    # are removed as soon as an administrator finishes reviewing the application.
    digest = hashlib.sha256(("medrescue-private-staff-docs:" + settings.SECRET_KEY).encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _detect_document_type(content: bytes) -> tuple[str, str]:
    if content.startswith(b"%PDF-"):
        return ".pdf", "application/pdf"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"
    raise HTTPException(status_code=415, detail="Upload a PDF, JPG, or PNG document")


def encrypt_private_upload(upload: UploadFile) -> tuple[str, str]:
    content = upload.file.read(MAX_DOCUMENT_BYTES + 1)
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded verification document is empty")
    if len(content) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Each verification document must be 5 MB or smaller")

    extension, mime_type = _detect_document_type(content)
    PRIVATE_DOCUMENT_DIR.mkdir(parents=True, exist_ok=True)
    document_path = PRIVATE_DOCUMENT_DIR / f"{uuid.uuid4().hex}{extension}.enc"
    document_path.write_bytes(_fernet().encrypt(content))
    return str(document_path), mime_type


def read_private_document(path: str) -> bytes:
    document_path = Path(path).resolve()
    if document_path.parent != PRIVATE_DOCUMENT_DIR.resolve() or not document_path.is_file():
        raise HTTPException(status_code=404, detail="Verification document is no longer available")
    try:
        return _fernet().decrypt(document_path.read_bytes())
    except InvalidToken as exc:
        raise HTTPException(status_code=500, detail="Verification document could not be decrypted") from exc


def delete_private_document(path: str | None) -> None:
    if not path:
        return
    document_path = Path(path).resolve()
    if document_path.parent == PRIVATE_DOCUMENT_DIR.resolve():
        document_path.unlink(missing_ok=True)
