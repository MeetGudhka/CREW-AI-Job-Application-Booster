
from crewai import Crew, Process

from app.agents import (
    job_requirements_analyst,
    candidate_profiler,
    resume_tailor,
    interview_prep_coach,
)

from app.tasks import (
    job_analysis_task,
    candidate_profiling_task,
    resume_tailoring_task,
    interview_preparation_task,
)


job_application_crew = Crew(
    agents=[
        job_requirements_analyst,
        candidate_profiler,
        resume_tailor,
        interview_prep_coach,
    ],
    tasks=[
        job_analysis_task,
        candidate_profiling_task,
        resume_tailoring_task,
        interview_preparation_task,
    ],
    process=Process.sequential,
    verbose=True,
)
