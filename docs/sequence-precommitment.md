# Design Precommitment

This document implements §7.3 of the deployment plan and its Choice 2 extension: the stochastic environment **and** the treatment-allocation table are frozen and hash-precommitted before recruitment, without exposing hidden cases while the study is live.

## What is committed here

Three independent SHA-256 commitments are frozen at provisioning and re-verified by the release gate before collection can open. There is no single sequence-only hash and no single opaque all-purpose hash: each component verifies on its own, so any later change to the environment, to the treatment orders, or to their binding is localised and detectable.

| Field | Value |
|---|---|
| `experiment_version` | `queue-study-v1.0.0` |
| `sequence_version` | `seq-v1` |
| `generator_version` | `hmac-sha256-ctr-v1` |
| Sequence rows (blocks × 20) | `6680`  (334 blocks × 20 rounds) |
| Allocation rows | `1002`  (334 blocks × 3 arms) |
| **(1) SHA-256 — stochastic-sequence table** | `dcfb470fc281812c9cc2dfe5992584997b559ce6315d9d60f3f92cabaeb41496` |
| **(2) SHA-256 — treatment-allocation table** | `2e27cf2e4a4c7d0fbe90474fbab55c6cb714414e7c6122dad776dfff6c4139bd` |
| **(3) SHA-256 — combined design manifest** | `f5251ab9001d193750d06d8964d275dbed6dee5ffe80ec8621ca22fe5e12c4e9` |
| Committed at (UTC) | `2026-08-19 07:57 UTC` |

Produce all three with **Queue Study → Show frozen precommitment hashes** (Sheet menu) or `freezeDesignPrecommitment()` in the Apps Script editor. Both tables remain private in the research workbook until data collection closes; they may be published afterwards, at which point anyone can recompute the three hashes and verify that the environment and the assignment recruiting participants were those analysed.

## Generator

For each block $b$ and round $r \in \{1,\dots,20\}$, the backend draws two uniforms from a keyed deterministic stream:

```
u^θ_{br} = U(HMAC-SHA256(seed, version ":theta:"    b ":" r))
u^R_{br} = U(HMAC-SHA256(seed, version ":recovery:" b ":" r))
```

where `U(·)` maps the first 56 bits of the MAC to $[0,1)$. Case types are i.i.d. draws $\theta_{br} = H \iff u^θ_{br} < 0.40$ — sequences are **not** forced to contain exactly eight H cases (§7.2), so the stated 40% probability is exactly true at every information set. Recovery draws are indexed by round, not by recovery opportunity, so the random stream is auditable across treatment paths: when the system is in the high waiting-cost state and no Type H case is processed in round $r$, it recovers iff $u^R_{br} < 0.50$.

Each block's environment is shared by exactly three invitation slots, one per treatment arm (§7.1): exact treatment balance with common random numbers across arms. Invitation order is permuted with the same keyed stream (labels `version ":permute:" i`), so recruitment order carries no information about assignment.

## Seed governance

The seed is a 72-character random string generated once inside the production Apps Script project and stored only in its Script Properties (`SEQUENCE_SEED`). It is never committed to any repository, never transmitted to any client, and never reused across sequence versions. Regenerating sequences under an existing version is refused by the backend (`generateAssignmentBlocks` throws if sequences exist); a new environment requires a new `SEQUENCE_VERSION`, a new workbook, and a new commitment in this file.

## Canonical serialization

**(1) Stochastic-sequence table.** One line per row, in (block, round) order, fields comma-joined:

```
sequence_version,sequence_id,round,case_type,recovery_u
```

with `recovery_u` rounded to 12 decimal places at generation time (the stored and hashed values are identical).

**(2) Treatment-allocation table.** One line per allocation slot, in claim order, over the fixed assignment columns only (run-time status and session links are excluded, so the commitment is stable as places are claimed or retired):

```
lecture_id,claim_order,block_id,treatment,sequence_id
```

For a token/slip deployment (no allocation slots) the tokens table is used instead, serialized as `token_hash,block_id,treatment,sequence_id`.

**(3) Combined design manifest.** A short manifest binds the two component commitments to the frozen design parameters and is itself hashed:

```
experiment_version=… / sequence_version=… / generator_version=… / num_rounds=20 /
treatments=mixed|fine|state_dependent / sequence_rows=… / sequence_sha256=… /
allocation_kind=… / allocation_rows=… / allocation_sha256=…
```

`freezeDesignPrecommitment()` performs all three serializations and returns the three SHA-256 digests recorded above; `verifyDesignManifest_()` (run by the release gate) recomputes and checks each one independently.
