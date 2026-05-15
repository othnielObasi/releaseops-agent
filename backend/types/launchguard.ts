// types/launchguard.ts

export interface SessionSummary {
  id: string;
  feature_title: string;
  feature_description: string;
  status: "pending" | "running" | "complete" | "error";
}

export interface Persona {
  name: string;
  role: string;
  needs: string[];
  pain_points: string[];
}

export interface ReleaseSpecMeta {
  confidence?: "Low" | "Medium" | "High";
  needs_more_detail?: boolean;
  missing_fields?: string[];
  [key: string]: unknown;
}

export interface ReleaseSpec {
  problem: string;
  target_users: string[];
  personas: Persona[];
  core_use_cases: string[];
  user_stories: string[];
  non_functional_requirements: string[];
  success_metrics: string[];
  meta?: ReleaseSpecMeta;
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  category: "Safety" | "Security" | "Privacy" | "UX/Business" | string;
  likelihood: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High";
  severity: "Low" | "Medium" | "High";
  mitigation_ideas: string[];
}

export interface RiskRegister {
  risks: Risk[];
}

export interface ChecklistItem {
  id: string;
  category: "Requirements" | "Testing" | "Risk_Mitigation" | "Docs" | "UX" | string;
  item: string;
  owner_role: string;
  priority: "Must" | "Should" | "NiceToHave" | string;
}

export interface ReadinessChecklist {
  checklist: ChecklistItem[];
}

export interface NavigatorSection {
  release_spec: ReleaseSpec;
  risk_register: RiskRegister;
  readiness_checklist: ReadinessChecklist;
}

export interface TestingLevel {
  level: "Unit" | "Integration" | "E2E" | "AI_Eval" | string;
  description: string;
  primary_owners: string[];
  notes: string[];
}

export interface TestingStrategy {
  levels: TestingLevel[];
}

export interface TestCase {
  id: string;
  name: string;
  linked_risks: string[];
  linked_checklist_items: string[];
  category: string;
  abstract_input: string;
  expected_behavior: string;
  automation: "Manual" | "Automatable" | "Hybrid" | string;
}

export interface TestCases {
  test_cases: TestCase[];
}

export interface Guardrail {
  id: string;
  name: string;
  description: string;
  risk_ids: string[];
  where_applied: "PreProcessing" | "ModelCall" | "PostProcessing" | "UI" | "AccessControl" | string;
  implementation_idea: string;
}

export interface Guardrails {
  guardrails: Guardrail[];
}

export interface SentinelSection {
  testing_strategy: TestingStrategy;
  test_cases: TestCases;
  guardrails: Guardrails;
}

export interface ReleaseNotes {
  title: string;
  version: string;
  summary: string;
  whats_new: string[];
  why_it_matters: string[];
  known_limitations: string[];
}

export interface LandingFeatureSection {
  title: string;
  body: string;
}

export interface LandingTrustAndSafety {
  headline: string;
  bullets: string[];
}

export interface LandingCopy {
  hero_title: string;
  hero_subtitle: string;
  tagline: string;
  key_benefits: string[];
  feature_sections: LandingFeatureSection[];
  trust_and_safety: LandingTrustAndSafety;
  cta: string;
}

export interface PitchSlide {
  id: number;
  title: string;
  key_points: string[];
  objective?: string;
  notes_for_speaker?: string[];
}

export interface PitchDeckOutline {
  slides: PitchSlide[];
}

export interface HeraldSection {
  release_notes: ReleaseNotes;
  landing_copy: LandingCopy;
  pitch_outline: PitchDeckOutline;
}

export interface LaunchGuardSessionResponse {
  session: SessionSummary;
  navigator: NavigatorSection;
  sentinel: SentinelSection;
  herald: HeraldSection;
}