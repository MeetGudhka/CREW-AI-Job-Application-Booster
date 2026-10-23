
from app.crew import job_application_crew


def run_job_application(
    job_description: str,
    job_url: str,
    resume_text: str,
):
    inputs = {
        "job_description": job_description,
        "job_url": job_url,
        "resume_text": resume_text,
    }

    return job_application_crew.kickoff(inputs=inputs)
