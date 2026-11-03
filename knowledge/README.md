# Curated evidence, Stage 4

The corpus contains short excerpts from UCI's AI4I dataset description and official Haas maintenance documentation, checked on 2026-11-03. UCI dataset documentation is attributed under CC BY 4.0; Haas excerpts remain attributed short quotations. Each item records a title, URL, section, applicability and curated interpretation.

Retrieval matches the top positive SHAP feature names to manually curated feature tags, ranks by overlap, and returns up to three records. This is deterministic tag retrieval, not semantic search or an LLM diagnosis. It cannot determine whether a physical fault is present. No live LLM is used; free-form LLM paraphrasing remains optional future work.

UCI entries explain synthetic label definitions. Haas entries are educational references only. The AI4I demo has no validated manufacturer/model/manual match. Requests for equipment-specific procedures return no evidence and a technician-assessment fallback. In particular, AI4I torque must not be confused with pull-stud tightening torque, and tool-wear time does not establish toolholder wear.

Every returned guidance item references an existing source ID and is copied from curated text. Excerpt presence and valid IDs are structural checks, not proof of entailment or equipment applicability. Source/interpretation pairs were reviewed during implementation; no independent expert approval or measured claim-support accuracy is claimed.

The snapshot stored with each new incident includes excerpts, interpretations, model version and corpus hash. Older incidents are not retroactively given explanations. Updating the corpus does not change their recorded evidence.
