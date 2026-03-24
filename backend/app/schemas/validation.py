from pydantic import BaseModel


class ValidationMessage(BaseModel):
    code: str
    message: str
    field: str
    severity: str  # "error" or "warning"


class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationMessage]
    warnings: list[ValidationMessage]
    scores: dict[str, float]
