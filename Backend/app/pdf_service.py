
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
    KeepTogether,
)


def _register_fonts():
    """Use Arial when available, otherwise use standard PDF fonts."""

    regular_path = r"C:\Windows\Fonts\arial.ttf"
    bold_path = r"C:\Windows\Fonts\arialbd.ttf"

    try:
        if "CREWArial" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("CREWArial", regular_path))

        if "CREWArial-Bold" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(
                TTFont("CREWArial-Bold", bold_path)
            )

        return "CREWArial", "CREWArial-Bold"

    except Exception:
        return "Helvetica", "Helvetica-Bold"


def _make_styles():
    regular_font, bold_font = _register_fonts()
    base = getSampleStyleSheet()

    return {
        "title": ParagraphStyle(
            "CrewTitle",
            parent=base["Title"],
            fontName=bold_font,
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#17365D"),
            spaceAfter=8 * mm,
        ),
        "subtitle": ParagraphStyle(
            "CrewSubtitle",
            parent=base["Normal"],
            fontName=regular_font,
            fontSize=9,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=6 * mm,
        ),
        "heading": ParagraphStyle(
            "CrewHeading",
            parent=base["Heading2"],
            fontName=bold_font,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#17365D"),
            spaceBefore=5 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
        ),
        "subheading": ParagraphStyle(
            "CrewSubheading",
            parent=base["Heading3"],
            fontName=bold_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceBefore=3 * mm,
            spaceAfter=1.5 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "CrewBody",
            parent=base["BodyText"],
            fontName=regular_font,
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#263238"),
            spaceAfter=2 * mm,
            splitLongWords=True,
        ),
        "small": ParagraphStyle(
            "CrewSmall",
            parent=base["BodyText"],
            fontName=regular_font,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=1.5 * mm,
        ),
    }


def _page_footer(canvas, document):
    """Draw the footer and page number on every page."""

    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D8DEE8"))
    canvas.line(
        18 * mm,
        15 * mm,
        A4[0] - 18 * mm,
        15 * mm,
    )
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(
        18 * mm,
        9 * mm,
        "CREW-AI | Job Application Booster",
    )
    canvas.drawRightString(
        A4[0] - 18 * mm,
        9 * mm,
        f"Page {document.page}",
    )
    canvas.restoreState()


def _build_pdf(story, title):
    """Build a PDF and return its bytes."""

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=22 * mm,
        title=title,
        author="CREW-AI",
    )

    document.build(
        story,
        onFirstPage=_page_footer,
        onLaterPages=_page_footer,
    )

    return buffer.getvalue()


def _append_text_content(story, text, styles):
    """Add plain-text content to a PDF with basic heading recognition."""

    heading_names = {
        "summary",
        "professional summary",
        "candidate summary",
        "skills",
        "technical skills",
        "experience",
        "professional experience",
        "education",
        "projects",
        "certifications",
        "required skills",
        "preferred skills",
        "responsibilities",
        "important keywords",
        "evidence-based strengths",
        "priority gaps",
        "priority preparation areas",
        "interview questions",
        "confirmation notes",
        "skill assessments",
    }

    subheading_names = {
        "interview questions",
        "technical questions",
        "behavioral questions",
        "project-based questions",
        "preparation areas",
    }

    for line in text.splitlines():
        cleaned = line.strip()

        if not cleaned:
            story.append(Spacer(1, 2 * mm))
            continue

        # Recognize basic Markdown headings without requiring Markdown output.
        heading_text = cleaned.lstrip("#").strip()
        normalized = heading_text.rstrip(":").strip().lower()

        # Remove common Markdown bullet or numbered-list prefixes.
        is_bullet = cleaned.startswith(("- ", "* ", "• "))
        is_numbered = (
            len(cleaned) > 2
            and cleaned[0].isdigit()
            and cleaned[1:3] in {". ", ") "}
        )

        if is_bullet:
            bullet_text = cleaned[2:].strip()
            story.append(
                Paragraph(
                    f"&bull; {escape(bullet_text)}",
                    styles["body"],
                )
            )
        elif is_numbered:
            story.append(
                Paragraph(escape(cleaned), styles["body"])
            )
        elif (
            cleaned.startswith("#")
            or normalized in heading_names
            or cleaned.endswith(":")
        ):
            style = (
                styles["subheading"]
                if normalized in subheading_names
                else styles["heading"]
            )
            story.append(Paragraph(escape(heading_text), style))
        else:
            story.append(
                Paragraph(escape(cleaned), styles["body"])
            )


def generate_resume_pdf(resume_text: str) -> bytes:
    """Create a PDF from the tailored resume plain text."""

    if not resume_text or not resume_text.strip():
        raise ValueError("Resume text cannot be empty.")

    styles = _make_styles()

    story = [
        Paragraph("TAILORED RESUME", styles["title"]),
        Paragraph(
            "Prepared by CREW-AI from the information supplied by the candidate",
            styles["subtitle"],
        ),
        HRFlowable(
            width="100%",
            thickness=1,
            color=colors.HexColor("#CBD5E1"),
            spaceAfter=5 * mm,
        ),
    ]

    _append_text_content(story, resume_text, styles)

    return _build_pdf(story, "CREW-AI Tailored Resume")


def generate_interview_guide_pdf(guide_text: str) -> bytes:
    """Create a PDF from the interview guide plain text."""

    if not guide_text or not guide_text.strip():
        raise ValueError("Interview guide text cannot be empty.")

    styles = _make_styles()

    story = [
        Paragraph(
            "INTERVIEW PREPARATION GUIDE",
            styles["title"],
        ),
        Paragraph(
            "Role-specific practice questions and preparation advice",
            styles["subtitle"],
        ),
        HRFlowable(
            width="100%",
            thickness=1,
            color=colors.HexColor("#CBD5E1"),
            spaceAfter=5 * mm,
        ),
    ]

    _append_text_content(story, guide_text, styles)

    return _build_pdf(story, "CREW-AI Interview Preparation Guide")
