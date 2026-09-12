# 0006: identity confidence is the vote margin, not the winning share

- Status: accepted
- Date: 2026-09-12
- Milestone: M1

## Context

earshot 0.5.0 ships the mechanism spec 6.4 asks for: a cosine kNN with
distance-weighted votes, per-label prototypes and a stratified k-fold
self-test. Meowlogue supplies the policy — the feature vector, the thresholds
and the gate.

One of those thresholds does not survive contact with earshot's numbers.
`CONFIDENCE.notSureBelow` is 0.55: below it, spec 6.4 says the guess is shown
as "not sure" and the confirmation chips are emphasised. earshot's
`Prediction.confidence` is the winner's **share of the total vote weight**.

With k = 5 neighbours and two cats, the winner's share cannot fall below 0.5,
and with roughly equal weights the worst real case — three votes to two — is
0.6. A threshold of 0.55 against that quantity never fires. Every guess, down
to a three-to-two split between littermates, would be shown as a name with no
hedge. The app would look confident precisely where it is least entitled to
be, which is the one failure mode spec section 2 exists to prevent.

Reading spec 6.4 again settles it: "Confidence: **vote margin** mapped to 0 to
1." The margin, not the share.

## Decision

`predictIdentity` reports the margin — the winner's share minus the
runner-up's — as `confidence`, and carries earshot's share alongside it as
`voteShare` so nothing is hidden.

Against the margin the thresholds mean what spec 6.4 evidently intends:

| vote            | share | margin | shown as   |
| --------------- | ----- | ------ | ---------- |
| 5–0             | 1.00  | 1.00   | a name     |
| 4–1             | ~0.80 | ~0.60  | a name     |
| 3–2             | ~0.60 | ~0.20  | "not sure" |
| 3–2 nearly tied | ~0.55 | ~0.10  | "not sure" |

The active-learning band (0.4 to 0.7) and the auto-confirm threshold (0.85)
are read against the same quantity, so a card is highlighted for confirmation
when the vote is genuinely close rather than whenever a second cat got a vote
at all.

## Consequences

- The number shown next to a guess is a margin, so it reads lower than a
  classifier's usual "confidence" for the same prediction. That is the honest
  direction to be wrong in, and the copy says what it is measuring.
- earshot needs no change. The share is the right primitive for a library; the
  mapping onto what a person is told is the app's to make, which is what the
  seam is for.
- If earshot ever grows a margin of its own, this becomes a re-export. The
  tests would not change: they assert the policy, not the arithmetic.
