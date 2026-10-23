
import json
import queue
import threading
import traceback

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


TASK_KEYS = [
    "job_analysis",
    "candidate_profile",
    "tailored_resume",
    "interview_guide",
]

TASK_LABELS = [
    "Analyzing job description",
    "Checking resume skills",
    "Tailoring your resume",
    "Preparing interview questions",
]


def _task_result_to_dict(task_output):
    """Convert a CrewAI task output into a frontend-compatible result."""

    raw_text = getattr(task_output, "raw", None)

    if raw_text is not None and str(raw_text).strip():
        return {"text": str(raw_text)}

    return {"text": str(task_output)}


def _send_event(event_queue, event_name, data):
    """Put a Server-Sent Event into the queue."""

    event_queue.put(
        f"event: {event_name}\n"
        f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
    )


def stream_job_application(
    job_description: str,
    job_url: str,
    resume_text: str,
):
    """
    Yield SSE progress and plain-text task results.

    Each task result is transported as:
    {
        "key": "job_analysis",
        "label": "Analyzing job description",
        "result": {"text": "..."}
    }
    """

    event_queue = queue.Queue()
    completed = threading.Event()

    inputs = {
        "job_description": job_description,
        "job_url": job_url,
        "resume_text": resume_text,
    }

    callback_state = {"completed_count": 0}

    
    def task_callback(task_output):
        index = callback_state["completed_count"]

        # Ignore unexpected extra callbacks instead of crashing the crew.
        if index >= len(TASK_KEYS):
            print(
                "[WARNING] Received an extra task callback. "
                "All expected task results have already been processed."
            )
            return

        result = _task_result_to_dict(task_output)

        _send_event(
            event_queue,
            "task_complete",
            {
                "key": TASK_KEYS[index],
                "label": TASK_LABELS[index],
                "result": result,
            },
        )

        callback_state["completed_count"] += 1

        if callback_state["completed_count"] < len(TASK_KEYS):
            next_index = callback_state["completed_count"]

            _send_event(
                event_queue,
                "progress",
                {
                    "stage": TASK_KEYS[next_index],
                    "message": TASK_LABELS[next_index],
                    "status": "running",
                },
            )


    def run_crew():
        try:
            _send_event(
                event_queue,
                "progress",
                {
                    "stage": TASK_KEYS[0],
                    "message": TASK_LABELS[0],
                    "status": "running",
                },
            )

            crew = Crew(
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
                task_callback=task_callback,
            )

            crew.kickoff(inputs=inputs)

            _send_event(
                event_queue,
                "complete",
                {
                    "status": "success",
                    "message": "All application sections are ready.",
                },
            )

        except Exception:
            traceback.print_exc()

            _send_event(
                event_queue,
                "error",
                {
                    "message": (
                        "Application generation failed. "
                        "Check the backend terminal for details."
                    )
                },
            )

        finally:
            completed.set()
            event_queue.put(None)

    threading.Thread(
        target=run_crew,
        daemon=True,
    ).start()

    while True:
        event = event_queue.get()

        if event is None:
            break

        yield event
