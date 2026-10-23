
from io import BytesIO

from pypdf import PdfReader


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract readable text from an uploaded PDF resume."""

    if not pdf_bytes:
        raise ValueError("The uploaded PDF is empty.")

    try:
        reader = PdfReader(BytesIO(pdf_bytes))

        if reader.is_encrypted:
            raise ValueError(
                "The PDF is password-protected. Upload an unlocked PDF."
            )

        extracted_pages = []

        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_pages.append(page_text.strip())

        extracted_text = "\n\n".join(extracted_pages).strip()

        if not extracted_text:
            raise ValueError(
                "No readable text was found in the PDF. "
                "It may be a scanned document requiring OCR."
            )

        return extracted_text

    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(
            "Could not read this PDF. Please upload a valid PDF resume."
        ) from exc
