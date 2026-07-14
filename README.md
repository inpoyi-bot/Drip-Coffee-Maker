# Drip Coffee Maker

An ADK coffee agent capstone: a V60 pour-over coach that helps a beginner converge across cups, not a one-shot recipe recommender.

The full product definition is locked in [`docs/SPEC.md`](docs/SPEC.md). The load-bearing idea is SPEC §3: this project implements a stateful hill-climb loop over one bag of beans. The agent remembers prior cups, reads the gradient against the previous cup, decides whether to continue, probe, stop, or route to taste-layer handling, and records each turn as structured trajectory data.

## Current Scope

This build intentionally freezes the product to a small, explainable slice:

- Brewing method: V60 only.
- Optimization axis: grind only.
- Technique, water temperature, dose, and ratio: held constant after the seed recipe.
- Memory: bean-level trajectory only.
- Taste profile across beans: out of scope for this version.

The goal is not to beat a coffee master recipe. The master recipe is only the seed. The agent's value is the convergence process from that seed toward this user's cup, grinder, water, bean, and taste.

## What The Agent Does

The agent follows the loop in SPEC §3:

1. Start a new bag from a static seed recipe.
2. Hold technique and non-grind variables constant.
3. Ask for light feedback after each cup.
4. Compare this cup against the previous cup.
5. Decide one action: adjust grind, probe uncertainty, or stop.
6. Record a structured cup entry.
7. Render the trajectory back into the next turn so the agent reasons from real memory, not chat recollection.

Key files:

| File | Role |
|---|---|
| [`agents/hello_agent/agent.py`](agents/hello_agent/agent.py) | ADK agent instruction and tool wiring. |
| [`agents/hello_agent/memory.py`](agents/hello_agent/memory.py) | Bean-level memory tools: `start_bag`, `record_cup`, `render_trajectory`. |
| [`docs/demo-arc.md`](docs/demo-arc.md) | Clean 5-cup demo arc transcript. |
| [`docs/evals.md`](docs/evals.md) | Human-readable eval rubric and gap board. |
| [`docs/writeup-v2.md`](docs/writeup-v2.md) | Repo copy of the Kaggle submission writeup; each evidence claim points back to `REPORT.md` result files so the committed file is the reviewable source of truth. |
| [`mcp_server/coffee_server.py`](mcp_server/coffee_server.py) | Minimal MCP server for static coffee rules. |

## Install

Use a virtual environment, then install dependencies:

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

Create the local agent environment file from the example:

```bash
cp .env.example agents/hello_agent/.env
```

Then put your Gemini API key in `agents/hello_agent/.env`.

## Run The Agent

Start ADK web from the repo root:

```bash
./.venv/bin/adk web agents
```

Select `hello_agent` in the ADK UI.

For persistent sessions, use SQLite:

```bash
./.venv/bin/adk web agents --session_service_uri="sqlite+aiosqlite:///./sessions.db"
```

`sessions.db` is local runtime state and is ignored by git.

## Run Evals

These evals call the real Gemini model and may consume API quota.

E3/E3b grinder attribution:

```bash
PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval \
  agents/hello_agent \
  agents/hello_agent/e3_grinder.evalset.json \
  --config_file_path agents/hello_agent/e3_test_config.json
```

E5 plateau termination record:

```bash
PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval \
  agents/hello_agent \
  agents/hello_agent/e5_plateau.evalset.json \
  --config_file_path agents/hello_agent/e5_test_config.json
```

E7c unknown roast age:

```bash
PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval \
  agents/hello_agent \
  agents/hello_agent/e7c_unknown_roast_age.evalset.json \
  --config_file_path agents/hello_agent/e7c_test_config.json
```

E11 taste-layer twin:

```bash
PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval \
  agents/hello_agent \
  agents/hello_agent/e11_taste_twin.evalset.json \
  --config_file_path agents/hello_agent/e11_test_config.json
```

E12 graduation gate:

```bash
PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval \
  agents/hello_agent \
  agents/hello_agent/e12_graduation_gate.evalset.json \
  --config_file_path agents/hello_agent/e12_test_config.json
```

Committed eval histories live under:

```text
agents/hello_agent/.adk/eval_history/
```

Some older eval history files are intentionally kept as iteration traces. For pass/fail evidence, use the latest passing runs called out in `docs/evals.md` rather than treating every historical run as current status.

## Limited Live Demo Deployment

This project is reproducibly runnable locally and deployed as a limited live demo. The frontend is publicly hosted on Vercel; requests reach the ADK backend and SQLite session store through a Cloudflare Tunnel, while both backend processes remain on the local machine. `docs/START-TEST.md` records the first manual browser-to-agent acceptance and the operating runbook.

Supported:

- Documented dependency setup from `requirements.txt`.
- Documented environment-variable setup via `.env.example`.
- Documented local ADK runtime launch command.
- Verified SQLite-backed session persistence across restarts.
- Documented ADK eval regression commands and committed eval artifacts.
- Public Vercel frontend plus a fixed Cloudflare Tunnel URL for limited live demonstrations.
- One manually exercised browser-to-agent interaction through that deployed path.

Not claimed:

- No Docker image.
- No 24/7 hosted backend or Cloud Run deployment: the local machine, network, tunnel, and ADK process must remain available.
- No CI/CD pipeline.
- No production auth, monitoring, or scaling guarantees.

## Evidence Map

This section maps repo artifacts back to the course/project concepts in SPEC §6.4. It is intentionally evidence-based: each claim points to a file or reproducible command in this repo.

| Concept | Repo evidence | Accurate claim |
|---|---|---|
| ADK agent | `agents/hello_agent/agent.py` defines `root_agent` with ADK tools. | The runtime agent owns the V60 convergence loop, tool orchestration, gradient reading, and termination decisions. |
| Cross-round memory | `agents/hello_agent/memory.py` stores `bag` and `cups`; `render_trajectory` injects the trajectory into each turn. | The agent reasons from structured cup history, not just chat transcript recollection. |
| Convergence loop | `docs/demo-arc.md` shows cold start -> feedback -> grind moves -> satisfied stop. | The demo evidence is a stateful hill-climb over one bag of beans, not a one-shot recipe answer. |
| Eval-driven development | `docs/evals.md` plus E3/E5/E7c/E11/E12 evalsets, custom metrics, and committed eval histories. | High-risk behavior is guarded by deterministic eval gates where possible; earlier failed histories are kept as build trace, while latest passing evidence is called out in `docs/evals.md`. |
| Guardrails | `record_cup` in `memory.py` rejects contradictory structured records; evals check contract-sensitive failures. | The build protects the memory trajectory from invalid action/termination records. |
| Security features | `record_cup` invariants (`memory.py`) reject internally contradictory writes, for example a `terminate` decision co-occurring with an `adjust` write; credentials use `.env` and are never committed; `sessions.db` is git-ignored. | The build validates every write to persisted trajectory state, preventing a class of state-corruption failures. This is a data-contract guardrail, not adversarial-input or prompt-injection defense; no such threat model was tested in this version. |
| MCP Server | `mcp_server/coffee_server.py` and `mcp_server/README.md` define and smoke-test static seed/precheck tools. | MCP demonstrates the external static-tool boundary; it is standalone and intentionally separate from the ADK runtime path. |
| Deployability | `requirements.txt`, `.env.example`, `docs/DEPLOY.md`, `docs/START-TEST.md`, Vercel configuration, local ADK/SQLite launch commands, and eval run commands. | The project has a reproducible local run path and a manually exercised limited live-demo path: Vercel frontend → Cloudflare Tunnel → local ADK/SQLite backend. It does not claim a 24/7 hosted backend or production operations. |

## Failure-mode Evidence Table

This table names the dangerous wrong behaviors the project either prevents or explicitly marks as boundaries, and how strong the current proof is.

| Failure mode | Wrong behavior prevented | Guardrail / eval | Evidence status | Portfolio value |
|---|---|---|---|---|
| Agent degenerates into a one-shot recipe recommender | Gives a static "perfect recipe" and stops using prior cups | 5-cup demo arc + memory trajectory | **Completed demo evidence**: clean 5-cup arc; structured trajectory persisted across session restart | Shows why this is an agentic loop, not a chatbot wrapper |
| Hardware-unreliable grind axis | Treats blade-grinder sour+bitter as normal extraction feedback; keeps adjusting grind or blames pouring | E3/E3b grinder attribution evalset + `e3_metric.py` | **Partial / encoded gate**: deterministic gate exists; latest live pass should only be claimed if a passing result file is cited | Shows causal diagnosis and tool/axis reliability judgment |
| Plateau termination record contradiction | User-facing answer says stop, but `record_cup` writes `adjust + finer` and pollutes memory | `record_cup` contract invariants + E5 plateau metric | **Partial / encoded gate**: invariants reject contradictory records; E5 metric checks terminate contract | Shows guardrail placement at the state-write boundary, not only prompt wording |
| Unknown roast age cold start | Over-trusts first-cup degassing / flow instability and keeps grinding finer | E7c unknown roast age evalset + `e7c_metric.py` | **Completed e2e**: documented `Tests passed: 1`, `Tests failed: 0` | Shows uncertainty handling and low-confidence cold-start behavior |
| Taste-layer acid preference split | After extraction graduation, either keeps grinding finer or reflexively recommends changing beans | E11a/E11b taste-layer twin + `e11_metric.py` | **First valid observation**: after seed cleanup, the full E11 group produced `passed 2 / failed 2`; do not claim full live pass | Shows Taste Diagnostician IP: same symptom, different user preference, different correct exit |
| "Not sweet" admission gate before taste layer | Misroutes true underextraction into `taste_unaddressable`, or mislabels preference uncertainty before extraction graduation | E11c/E11d admission gate twin in E11 evalset | **Partial / offline + encoded**: encoded and offline-validated; no full live pass claim | Shows boundary control between extraction layer and taste layer |
| Underextraction disguised as graduation | Treats relative improvement or "some sweetness" as absolute extraction graduation; enters taste layer too early | E12 graduation gate evalset + `e12_metric.py` | **Completed e2e**: documented `Tests passed: 2`, `Tests failed: 0` | Shows upstream qualification before downstream trust; prevents false taste-layer handoff |
| Dirty-arc overshoot reversal (v2 boundary) | Treats an uncertain bitter note as a definite worse gradient, or fails to reverse with a smaller step after real mid-search overshoot | E13 overshoot evalset + `e13_metric.py` | **Limitation**: encoded gate exists, but latest live snapshot is `Tests passed: 0`, `Tests failed: 2`; not a v1 delivery claim | Documents what v1 does not deliver around noisy gradient handling |
| Multiple contradictory sensory descriptors in one report | Pretends to decompose conflicting symptoms into reliable causal hypotheses | Known Boundary / no full sensory interview | **Limitation**: v1 pauses/probes but does not fully decompose multi-symptom contradiction | Shows honest product boundary; prevents portfolio overclaim |

## Why MCP Is Separate

SPEC §6.5 says seed matching and pre-recipe checks are static-rule territory, not agent reasoning. The MCP server intentionally only covers that commodity layer:

- `get_seed_recipe`
- `precheck_bag`

MCP is implemented but intentionally separate from the ADK convergence loop in this version. The ADK agent does not call MCP tools at runtime; it owns the cross-cup memory, gradient reading, orchestration, and termination decisions. MCP demonstrates the external static-tool boundary for seed recipes and precheck advice.

## Known Boundaries

This version is a focused capstone build, not a full coffee product.

- Only V60 is supported.
- Only grind is actively adjusted.
- Water temperature, ratio, dose, and technique are frozen after the seed.
- User-level taste memory is not implemented.
- Some remaining rubric gaps are documented in `docs/evals.md`.
- Contradictory multi-symptom sensory reports are out of scope for v1. The current agent can pause and ask a calibration probe, but it does not yet run a full sensory interview that decomposes multiple conflicting descriptors into separate diagnostic hypotheses.
- E11b's `taste_unaddressable` behavior is a version boundary, not a permanent product principle. If brew axes are unlocked later, the gold should be rejudged.
- Feedback-compliance is an unverified assumption: evals assume users follow the one-action/frozen-variable instruction well enough to report a readable next-cup gradient.

## Project Status

The project is in final submission packaging, not feature expansion. The grind-only V60 vertical slice is implemented; local run and eval instructions are documented; and the main high-risk eval gates are evidence-tracked through committed artifacts and the status notes in `docs/evals.md`. The same slice is also available as a limited live demo through a Vercel frontend and Cloudflare Tunnel to the local ADK backend; the deployed browser-to-agent path has been manually exercised and is recorded in `docs/START-TEST.md`.

The final writeup, demo/video scripts, and claim-review pass are complete. Remaining work is submission hand-off only. This status does not claim that every E1-E13 rubric case is automated, that E13 is delivered, or that the full E11 group has a complete live pass; E11 live evidence is the documented first valid observation after seed cleanup plus offline/mutation validation for the broader encoded gate.
