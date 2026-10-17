from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.assistant import AssistantQueryRequest, AssistantQueryResponse
from app.auth.security import get_current_active_user
from app.services.assistant_service import process_assistant_query
from app.services.llm_explainer import available_providers, explain_facts

router = APIRouter(prefix="/api/assistant", tags=["Medicine Assistant"])


@router.get("/providers")
def list_explanation_providers(current_user: User = Depends(get_current_active_user)):
    return {"providers": available_providers()}


@router.post("/query", response_model=AssistantQueryResponse)
def query_assistant(
    data: AssistantQueryRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Query the MedRescue System rule-based medicine and inventory assistant.
    Returns matched intent, factual natural language summary, structured facts, and recommended next actions.
    """
    hosp_filter = data.hospital_id
    if current_user.role == "staff" and current_user.hospital_id:
        hosp_filter = current_user.hospital_id

    response = process_assistant_query(
        db=db,
        query=data.query,
        hospital_id=hosp_filter
    )
    provider = data.provider.lower()
    if provider not in {"rules", "openai", "anthropic", "claude"}:
        provider = "rules"
    provider = "anthropic" if provider == "claude" else provider
    explanation = explain_facts(data.query, response.get("facts", []), provider)
    if provider != "rules" and not explanation:
        explanation = "The selected LLM is not configured or did not respond. The database-backed rule result above is unchanged."
    response["explanation"] = explanation
    response["explanation_provider"] = provider if explanation else "rules"
    return response
