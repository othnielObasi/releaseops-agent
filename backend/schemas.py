# schemas.py
from __future__ import annotations
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class SessionSummary(BaseModel):
    id: str
    feature_title: str
    feature_description: str
    status: Literal["pending", "running", "complete", "error"] = "pending"


class Persona(BaseModel):
    name: str
    role: str
    needs: List[str]
    pain_points: List[str]


class ReleaseSpecMeta(BaseModel):
    confidence: Optional[Literal["Low", "Medium", "High"]] = None
    needs_more_detail: Optional[bool] = None
    missing_fields: Optional[List[str]] = None


class ReleaseSpec(BaseModel):
    problem: str
    target_users: List[str]
    personas: List[Persona] = Field(default_factory=list)
    core_use_cases: List[str]
    user_stories: List[str] = Field(default_factory=list)
    non_functional_requirements: List[str] = Field(default_factory=list)
    success_metrics: List[str] = Field(default_factory=list)
    meta: Optional[ReleaseSpecMeta] = None


class Risk(BaseModel):
    id: str
    title: str
    description: str
    category: str
    likelihood: Literal["Low", "Medium", "High"]
    impact: Literal["Low", "Medium", "High"]
    severity: Literal["Low", "Medium", "High"]
    mitigation_ideas: List[str]


class RiskRegister(BaseModel):
    risks: List[Risk] = Field(default_factory=list)


class ChecklistItem(BaseModel):
    id: str
    category: str
    item: str
    owner_role: str
    priority: str


class ReadinessChecklist(BaseModel):
    checklist: List[ChecklistItem] = Field(default_factory=list)


class NavigatorSection(BaseModel):
    release_spec: ReleaseSpec
    risk_register: RiskRegister
    readiness_checklist: ReadinessChecklist


class TestingLevel(BaseModel):
    level: str
    description: str
    primary_owners: List[str]
    notes: List[str] = Field(default_factory=list)


class TestingStrategy(BaseModel):
    levels: List[TestingLevel] = Field(default_factory=list)


class TestCase(BaseModel):
    id: str
    name: str
    linked_risks: List[str] = Field(default_factory=list)
    linked_checklist_items: List[str] = Field(default_factory=list)
    category: str
    abstract_input: str
    expected_behavior: str
    automation: str


class TestCases(BaseModel):
    test_cases: List[TestCase] = Field(default_factory=list)


class Guardrail(BaseModel):
    id: str
    name: str
    description: str
    risk_ids: List[str] = Field(default_factory=list)
    where_applied: str
    implementation_idea: str


class Guardrails(BaseModel):
    guardrails: List[Guardrail] = Field(default_factory=list)


class SentinelSection(BaseModel):
    testing_strategy: TestingStrategy
    test_cases: TestCases
    guardrails: Guardrails


class ReleaseNotes(BaseModel):
    title: str
    version: str
    summary: str
    whats_new: List[str] = Field(default_factory=list)
    why_it_matters: List[str] = Field(default_factory=list)
    known_limitations: List[str] = Field(default_factory=list)


class LandingFeatureSection(BaseModel):
    title: str
    body: str


class LandingTrustAndSafety(BaseModel):
    headline: str
    bullets: List[str] = Field(default_factory=list)


class LandingCopy(BaseModel):
    hero_title: str
    hero_subtitle: str
    tagline: str
    key_benefits: List[str] = Field(default_factory=list)
    feature_sections: List[LandingFeatureSection] = Field(default_factory=list)
    trust_and_safety: LandingTrustAndSafety
    cta: str


class PitchSlide(BaseModel):
    id: int
    title: str
    key_points: List[str] = Field(default_factory=list)
    objective: Optional[str] = None
    notes_for_speaker: Optional[List[str]] = None


class PitchDeckOutline(BaseModel):
    slides: List[PitchSlide] = Field(default_factory=list)


class HeraldSection(BaseModel):
    release_notes: ReleaseNotes
    landing_copy: LandingCopy
    pitch_outline: PitchDeckOutline


class LaunchGuardSessionResponse(BaseModel):
    session: SessionSummary
    navigator: NavigatorSection
    sentinel: SentinelSection
    herald: HeraldSection


class SessionCreateRequest(BaseModel):
    feature_title: str
    feature_description: str
