# Drip Coffee Maker: A V60 Convergence Coach — and the Eval Discipline That Kept It Honest

*Kaggle Agentic Engineering Capstone · Concierge Agents track*

## The Problem

A master's pour-over recipe is written for a standard bean, standard water, standard hands, and a standard palate. A beginner opening a fresh bag has none of these: their grinder may have no scale, they don't measure water temperature, and their pouring is unstable. The recipe they follow is a reasonable *starting point* — but the ~15 cups in that bag's lifecycle are brewed by trial and error, and most beginners never converge. They finish the bag still wondering whether the sourness was the bean, their technique, or their taste.

The product insight is that this is not a recommendation problem. It is a **convergence problem**: from a master-recipe seed, walk this specific user — with this bag, this grinder, this palate — toward "extraction dialed in *and* taste-aligned," one cup at a time.

## Why an Agent (and Not a Chatbot)

A recipe database with a chat skin can retrieve and recite. It cannot converge, because convergence requires four capabilities that only co-exist inside an agent:

**Cross-cup memory** (the previous cup is the reference point for every decision), **orchestration** (which axis to move, when to hold, when to stop), **disambiguation** (the same word "sour" demands opposite actions depending on context), and **termination judgment** (knowing when further adjustment will over-extract a good cup). Remove any one and the loop degrades into a script. The hill-climb's defining behavior — *decide the next step from the last step* — is impossible without a persisted "last step."

One deliberate consequence: the system does not trust absolute parameters. A user with an unscaled grinder cannot report "grind setting 20" meaningfully, so the entire diagnostic paradigm is built on **relative change** — better / worse / unchanged versus the previous cup — with large step sizes so signal beats beginner noise.

## Architecture

The v1 build is intentionally a narrow vertical slice: **V60 only, grind as the only active axis**, with water temperature, ratio, dose, and technique frozen after the seed recipe. This keeps the gradient signal short, clean, and readable.

**ADK agent** (`agents/hello_agent/agent.py`): owns the convergence loop — reading each cup's gradient against the previous cup, deciding one action (adjust / probe / stop), and enforcing single-variable discipline.

**Bean-level memory** (`memory.py`, SQLite-backed): `start_bag` writes the bag header at cold start; `record_cup` appends one structured record per cup (turn_type, gradient, direction, step, terminate_reason, flags); `render_trajectory` injects the full trajectory into each turn, so the agent reasons from persisted structured history, not chat recollection. Persistence is verified across process restart: a fresh database connection reads back the same bag and cup records.

**State-write guardrails**: `record_cup` enforces invariants before writing — a terminate decision cannot co-occur with an adjust direction; contradictory records are rejected with an error rather than stored. This is a data-contract guardrail, not adversarial-input defense, and it earned its keep during live model evaluation in this build (see the EDD section): when instruction-following degraded, the invariant rejected a contradictory record at the write boundary and kept the trajectory store clean. Credentials live in `.env`; the session database is git-ignored.

**MCP server** (standalone): seed-recipe matching and pre-brew checks are static-rule territory — same input, same output, no reasoning. Per the project's three-tool ruler (is a static rule enough? retrieval? a decision tree?), these commodity functions were deliberately kept *out* of the agent and exposed as a standalone MCP server. The ADK agent does not call it at runtime; the separation itself is the design statement.

**Deployability**: the claim is precise — a locally reproducible ADK run path with documented dependencies, environment setup, launch commands, and SQLite-backed session persistence verified across restarts, plus a limited live-demo path: Vercel frontend → Cloudflare Tunnel → local ADK/SQLite backend. That deployed browser-to-agent path was manually exercised once. This is not a 24/7 hosted backend or production service; Docker, CI/CD, production auth, monitoring, and scaling are not claimed.

## The Diagnostic IP: A Layer Boundary, Not a Classifier

The load-bearing judgment in this product is the split between two layers:

- **"Extraction isn't there yet"** — objective, has a right answer, should be treated.
- **"Dialed in, but not to your taste"** — subjective, no right answer; acknowledge the bean's character or route to a different exit.

Mistaking "he dislikes acidity" for "under-extraction" sends the system grinding finer and hotter, destroying a good light roast while the user blames their own hands. The **Taste Diagnostician** is therefore built as a *boundary controller*: the taste layer takes "extraction has graduated" as a given truth guaranteed upstream, and trusts it without re-verifying.

That contract ("downstream trusts, does not re-verify") forces all verification responsibility onto the boundary itself, guarded by two distinct gates:

- **The exit gate (E12)** protects against the system's own false graduation: four surface signals can look green while the truth is an under-extraction plateau. The gold behavior is an absolute-scale probe, not a graduation stamp.
- **The admission gate (E11c/E11d)** protects against ambiguous user language *after* real graduation: "not sweet" might be a missed extraction debt (route back) or a preference for more body (route forward). A reverse probe disambiguates before any routing.

The two gates fail into the *same* end-user symptom — treatable under-extraction mislabeled as an unfixable taste preference — but from different fault sources, at different times, on different evidence. That is why they are two gates with two eval sets, not one.

Termination is likewise not a boolean but an **attributed enum**: `satisfied` (user endorsement), `plateau_ambiguous` (underdetermined attribution), `axis_limit_underextracted` (axis exhausted before graduation), `flavor_mismatch` (taste layer, addressable by changing beans), `taste_unaddressable` (taste layer, unaddressable in this version), `axis_unreliable` (hardware makes the axis unfeedbackable). Each terminate record carries a diagnostic conclusion into persistent memory; polluting that enum costs more than answering one cup wrong.

## Eval-Driven Development: The Full Arc, Including the Part Where It Failed

Evals here are the product spec: twin cases with explicit discriminating power, forbidden flags, and deterministic metrics over structured `record_cup` fields ("judge the action, not the wording"). Three real bugs were caught this way before the final week: a blade-grinder case exposed a missing terminate enum (`axis_unreliable` was added rather than misusing `plateau_ambiguous`); a plateau case caught a live record where the reply said *stop* but the structured record said *adjust finer* — which led to the write-boundary invariants above.

The third catch became a full engineering story. A coverage audit showed the gradient-response matrix had a hole: better→continue and unchanged→plateau were tested, but **worse→reverse** — the hill-climb's defining behavior on a negative gradient — had no eval. I designed E13 as a twin: E13a (clear overshoot, objectively corroborated → reverse direction, shrink step, continue searching) and E13b (weak subjective "worse," objective channels silent → verify, don't reflex-reverse). The twin's discriminating power paid off immediately: the live baseline failed both, revealing a "bitter → grind coarser" keyword reflex — E13a's correct direction was right-for-the-wrong-reason, and E13b unmasked it.

Then the honest part. An instruction fix made E13 pass 2/2 — and full regression caught a routing regression *two layers away*: the new noise gate, lacking a layer precondition, captured the taste layer's entry turn. A scoped fix followed; the next regression surfaced a new failure shape; a third, minimal declarative fix triggered a failure in previously stable territory (a `seed`-typed record carrying a terminate decision — rejected, notably, by the write-boundary invariant). Per a **pre-committed hard cap**, I stopped: three fixes, three non-adjacent failure surfaces meant instruction-level repair was not converging. The entire E13 instruction package was rolled back; the eval artifacts were kept.

The rollback verification then exposed something deeper: the E11 eval set's *seed itself* was self-contradictory — it injected a record shape the runtime contract would have rejected, because **seed injection bypasses the write-path invariants**. The test fixture was an ungoverned state writer. I built a seed linter (verified first against the known-bad seed, then run across all eval sets), repaired the seed, and reran E11 as its **first fully-valid observation: 2/4** — with the flagship "don't swap a bean the user loves" twin (E11b) passing (N=1), and the sole structured-value failure isolating to a documented `gradient` field defect rather than routing capability. The clinching evidence: E11a and E11b share an identical opening input, and in the same run one carried the upstream state correctly while the other degraded it — same input, divergent output, which pins the root cause on a semantically overloaded contract field, not on the diagnostic logic. E13 itself is shipped as an **encoded gate with a failing baseline (N=2, shape-stable): the capability is not claimed for v1.**

Two closing cases from the demo work show the same discipline applied in both time directions:

**Pre-run re-judgment (clean).** The "dirty arc" demo includes an overshoot cup whose original acceptance criterion was E13a's gold — live-verified unreachable (N=2) after the rollback. With a hard 3-attempt budget, I re-judged the criteria *before* running: hard gates (adjust, coarser, gradient contains worse, no termination, no technique-blaming, other axes frozen) versus documented-limitation exemptions (free-text `decision=反向`, step not shrunk, missing flag — all pre-registered in the report). Run 1 passed all hard gates with exemptions exactly in the predicted range; 2 of 3 attempts were never used.

**Post-run calibration fix (sensitive, so argued explicitly).** The probe cup recorded `gradient=变好` where the expectation table said "unchanged / insufficient." Triage (metric-vs-behavior, decided before touching anything) ruled the *expectation table* wrong: the scripted user message literally reports improvement, so the agent's record was faithful — and it spontaneously did the correct field division, putting the current delta in `gradient` and the absolute-scale uncertainty in its dedicated flag. The doc was fixed, the agent was not, the run was not repeated; a calibration note marks the post-hoc change to preempt any moving-goalposts reading. It is also a *positive* data point for the same schema-overload observation: the agent partitioned the semantics better than my own document did.

## Demo Evidence

Two arcs share the work. The **clean arc** (5 cups: cold start → under-extraction → finer → gradient reading → satisfied stop) optimizes readability and shows 2 of the 4 decision outcomes. The **dirty arc** (session `dirty_arc_1783178002`, one attempt, 5 cup records persisted and re-read through a fresh SQLite connection) adds the other half: a mid-search overshoot identified and *reversed*, an absolute-scale probe instead of a premature graduation, and a confirmed satisfied stop. The reversal is shown honestly: direction correct, step discipline absent — the trajectory table displays it as-is, and this writeup, not the demo, carries the explanation.

## Honest Boundaries

- **Overshoot step discipline (E13)**: encoded gate, failing baseline, shape-stable across two runs. Not claimed for v1.
- **Taste-layer live reliability**: first fully-valid observation is 2/4; E11b passed at N=1. The gate *design* and harness integrity are verified; live reliability is below a claimable threshold and is reported with sample sizes.
- **`gradient` semantic overload**: one field carries both extraction-search delta and carried graduation state; confirmed as a baseline defect by clean-input evidence. The v2 schema split is the top architecture item.
- **E9 peak-backtrack termination**: rubric-only; its `peak_backtracked` enum is deferred to land atomically with its eval.
- **Tool-call omission**: a small but real ledger (3 observed, all in later turns of multi-turn cases) — model-side reliability is a quantified v1 risk.
- **Unverified assumption**: the five-item structured feedback each cup depends on; real beginner compliance is untested, and if it collapses, the gradient signal source collapses with it.
- Multi-symptom contradictory reports remain out of scope; the agent probes but does not decompose them.

## What's Next

v2's roadmap is written by this build's evidence: split `gradient` into `gradient_delta` and `extraction_state` (set once at the layer boundary, read-only after); move `decision` and step-sign semantics into contract-level validation (two independent baselines invented out-of-enum values; instruction-level constraints proved effective but un-retainable); land `peak_backtracked` atomically with an E9 eval; tighten metrics to all-turns-must-pass semantics; then, and only then, unfreeze the next axis and let the multi-axis conductor earn its name.

The honest summary of this capstone: the convergence loop works and is demonstrated; the diagnostic boundary is designed, encoded, and partially verified; and the most valuable artifact is the audit trail — a regression net that caught a cross-layer break a self-test missed, a hard cap that actually fired, a linter born from discovering my own test fixture was lying, and a claims ledger where every sentence above can be traced to a result file.
