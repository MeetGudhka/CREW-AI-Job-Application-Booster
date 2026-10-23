
from typing import Literal

from pydantic import BaseModel, Field, model_validator


# --------------------------------------------------
# INPUT SCHEMA
# --------------------------------------------------

class JobApplicationRequest(BaseModel):
    job_description: str = Field(default="", max_length=50000)
    job_url: str | None = Field(default=None, max_length=2048)
    resume_text: str = Field(min_length=1, max_length=100000)

    @model_validator(mode="after")
    def validate_job_input(self):
        has_description = bool(self.job_description.strip())
        has_url = bool(self.job_url and self.job_url.strip())

        if not has_description and not has_url:
            raise ValueError(
                "Provide a job description or a job posting URL."
            )

        return self


# --------------------------------------------------
# OUTPUT SCHEMA 1: JOB ANALYSIS
# --------------------------------------------------

# class JobAnalysisOutput(BaseModel):
#     job_title: str | None = None
#     responsibilities: list[str] = Field(default_factory=list)
#     required_skills: list[str] = Field(default_factory=list)
#     preferred_skills: list[str] = Field(default_factory=list)
#     qualifications: list[str] = Field(default_factory=list)
#     certifications: list[str] = Field(default_factory=list)
#     experience_requirements: list[str] = Field(default_factory=list)
#     keywords: list[str] = Field(default_factory=list)
#     source_limitations: list[str] = Field(default_factory=list)
#     conflicts_or_unclear_details: list[str] = Field(
#         default_factory=list
#     )


# --------------------------------------------------
# OUTPUT SCHEMA 2: CANDIDATE PROFILE
# --------------------------------------------------

# class SkillAssessment(BaseModel):
#     requirement: str
#     requirement_type: Literal["Required", "Preferred"]
#     status: Literal[
#         "Match",
#         "Partial match",
#         "Not evidenced",
#         "Unable to assess",
#     ]
#     evidence: str = ""
#     missing_evidence: str = ""


# class CandidateProfileOutput(BaseModel):
#     summary: str
#     skills: list[SkillAssessment] = Field(default_factory=list)
#     strengths: list[str] = Field(default_factory=list)
#     priority_gaps: list[str] = Field(default_factory=list)


# --------------------------------------------------
# OUTPUT SCHEMA 3: TAILORED RESUME
# --------------------------------------------------

# class TailoredResumeOutput(BaseModel):
#     resume_text: str = ""
#     confirmation_notes: list[str] = Field(default_factory=list)


# --------------------------------------------------
# OUTPUT SCHEMA 4: INTERVIEW GUIDE
# --------------------------------------------------

# class InterviewQuestion(BaseModel):
#     category: Literal[
#         "Technical",
#         "Role-specific",
#         "Behavioral",
#     ]
#     question: str
#     evaluation_criteria: str
#     answer_guidance: str


# class InterviewGuideOutput(BaseModel):
#     questions: list[InterviewQuestion] = Field(default_factory=list)
#     priority_preparation_areas: list[str] = Field(
#         default_factory=list
#     )
