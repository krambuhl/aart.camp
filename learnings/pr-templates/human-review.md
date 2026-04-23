# needs-review: learning {{LEARNING_ID}} failed validation

{{TAGS_LINE}}

## Diagnosed failure pattern

{{OPERATOR_DIAGNOSIS}}

One of:

- **Same assertion fails every attempt** → rubric is likely wrong. Consider
  redefining.
- **Different assertions fail each attempt** → lesson is multi-faceted and
  resists concision. Consider splitting.
- **Control and treatment always identical** → prompt doesn't reproduce the
  failure. Consider rejecting as non-reproducible.
- **Other** → see operator notes.

## Categorical ask

Pick one, not open-ended rewrite:

- [ ] **Redefine rubric.** The assertions don't capture the actual lesson.
- [ ] **Split learning.** This should be two or more separate entries.
- [ ] **Reject as unlearnable.** The lesson exists but can't be specified as
      a benchmark.
- [ ] **Reject as non-reproducible.** The origin prompt doesn't trigger the
      failure anymore.
- [ ] **Accept with manual rubric edit** _(Phase 2+ only)_.

## Origin

- Session note: `{{ORIGIN_PATH}}`
- Captured: {{CAPTURED_AT}}

## All 5 attempts

{{ATTEMPTS_EVIDENCE}}

Each attempt includes:
- the proposed `learning.md`
- the mediator panel transcript (`learnings/runs/{{LEARNING_ID}}/<ts>.json`)
- the verdict and which assertions failed

## Operator interventions

{{OPERATOR_INTERVENTIONS}}

---

_Do not ask the author to "please rewrite." The rewrite loop already failed 5
times. If none of the categorical options above fits, reject the learning._
