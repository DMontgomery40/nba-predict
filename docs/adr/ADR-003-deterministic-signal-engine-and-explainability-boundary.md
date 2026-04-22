# ADR-003: Keep Core Signal Scoring Deterministic and Use Explainability as a Thin Layer

## Status

Accepted

## Context

The product has to earn trader trust. The seed materials are clear that language models may help summarize, but they must not silently alter numeric outputs or invent explanations for core pricing decisions.

## Decision

Implement the signal engine as deterministic TypeScript logic with:

- explicit weights
- bounded scoring ranges
- traceable reason codes
- stable provenance inputs

Narrative copy will be generated from deterministic reason codes and numeric outputs. If a future LLM summarizer is added, it must be optional and downstream of the scored event payload.

## Consequences

Positive:

- numeric behavior remains testable and reviewable
- UI copy can cite exact causes for divergence and confidence
- regression coverage can target whole bug families in scoring rather than prose strings

Negative:

- explainability copy will be more templated than a free-form LLM layer
- source-specific nuance has to be modeled explicitly in reason codes

## Follow-Up

- codify scoring formulas in `packages/domain`.
- return both raw sub-scores and rolled-up severity/confidence bands.
- treat narrative text as presentation over deterministic data.
