from typing import List, Optional, Any, Dict
from pydantic import BaseModel


class AssistantQueryRequest(BaseModel):
    query: str
    hospital_id: Optional[int] = None
    provider: str = "rules"


class AssistantSourceFact(BaseModel):
    title: str
    data: Any


class AssistantQueryResponse(BaseModel):
    query: str
    matched_intent: str
    answer: str
    facts: List[AssistantSourceFact] = []
    suggested_actions: List[str] = []
    explanation: Optional[str] = None
    explanation_provider: str = "rules"
