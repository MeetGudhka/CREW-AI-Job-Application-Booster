
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response

from app.schemas import JobApplicationRequest
from app.streaming_service import stream_job_application
from app.pdf_service import (
    generate_resume_pdf,
    generate_interview_guide_pdf,
)
from app.resume_parser import extract_text_from_pdf


app = FastAPI(
    title="CREW-AI Job Application Booster",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "CREW-AI Job Application Booster API is running."
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/generate")
def generate_application(request: JobApplicationRequest):
    """Run the crew and return plain-text task outputs."""

    try:
        from app.crew import job_application_crew

        inputs = {
            "job_description": request.job_description,
            "job_url": request.job_url or "",
            "resume_text": request.resume_text,
        }

        result = job_application_crew.kickoff(inputs=inputs)
        task_outputs = getattr(result, "tasks_output", []) or []

        keys = [
            "job_analysis",
            "candidate_profile",
            "tailored_resume",
            "interview_guide",
        ]

        results = []

        for key, task_output in zip(keys, task_outputs):
            raw_text = getattr(task_output, "raw", None)
            results.append({
                "key": key,
                "text": str(
                    raw_text if raw_text is not None else task_output
                ),
            })

        return {"results": results}

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate the job application results.",
        )


@app.post("/api/generate/stream")
def generate_application_stream(request: JobApplicationRequest):
    """Stream generation progress and plain-text task results."""

    return StreamingResponse(
        stream_job_application(
            job_description=request.job_description,
            job_url=request.job_url or "",
            resume_text=request.resume_text,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/pdf/resume")
def download_resume_pdf(request: dict):
    """Generate a PDF from plain-text tailored resume content."""

    resume_text = request.get("resume_text", "")

    if not isinstance(resume_text, str) or not resume_text.strip():
        raise HTTPException(
            status_code=422,
            detail="A non-empty resume_text string is required.",
        )

    try:
        pdf_bytes = generate_resume_pdf(resume_text)
        return _pdf_response(pdf_bytes, "tailored_resume.pdf")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate the resume PDF.",
        )


@app.post("/api/pdf/interview-guide")
def download_interview_guide_pdf(request: dict):
    """Generate a PDF from plain-text interview guide content."""

    guide_text = request.get("interview_guide", "")

    if not isinstance(guide_text, str) or not guide_text.strip():
        raise HTTPException(
            status_code=422,
            detail="A non-empty interview_guide string is required.",
        )

    try:
        pdf_bytes = generate_interview_guide_pdf(guide_text)
        return _pdf_response(pdf_bytes, "interview_guide.pdf")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate the interview guide PDF.",
        )


@app.post("/api/extract-resume")
async def extract_resume(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF resume."""

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=415,
            detail="Please upload a PDF file.",
        )

    try:
        pdf_bytes = await file.read()

        # Avoid accepting excessively large uploads.
        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="The uploaded PDF must be 10 MB or smaller.",
            )

        extracted_text = extract_text_from_pdf(pdf_bytes)

        return {"text": extracted_text}

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    finally:
        await file.close()


def _pdf_response(pdf_bytes: bytes, filename: str):
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
