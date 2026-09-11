# 0004: GitHub git dependencies need an HTTPS rewrite in CI

- Status: accepted
- Date: 2026-09-11
- Milestone: M0

## Context

Spec section 7 specifies the earshot dependency as
`"earshot": "github:ezar/earshot#vX.Y.Z"`, and that is what `package.json`
uses. It installed fine locally and CI died immediately:

```
pnpm: Command failed with exit code 128:
  /usr/bin/git clone git@github.com:ezar/earshot.git
git@github.com: Permission denied (publickey)
```

pnpm normalises any GitHub dependency to that host's **canonical SSH URL** and
records it in `pnpm-lock.yaml` as `repo: git@github.com:ezar/earshot.git`,
regardless of the specifier in `package.json`. Rewriting the specifier to
`git+https://github.com/ezar/earshot.git#v0.3.0` was tried and changed nothing:
the same SSH URL came out in the lockfile.

Installing therefore needs SSH access to GitHub. A developer machine usually
has a key. A GitHub Actions runner has none.

It passed locally for a reason worth recording: the sandbox this was developed
in injects `url."https://github.com/".insteadOf git@github.com:` into its git
config. The green local install was an artefact of the environment, not
evidence the dependency resolved portably — the same class of mistake as a
`localhost` binding that only works where `localhost` is IPv4.

## Decision

Keep the specifier the spec names, and add the rewrite to CI, where the gap
actually is. Both workflows now run, before `pnpm install`:

```yaml
git config --global url."https://github.com/".insteadOf git@github.com:
```

This is the same configuration a developer machine effectively has. It is one
line, applies to any future GitHub dependency, and does not require deviating
from the spec's specifier or hand-editing a generated lockfile.

## Verification

Reproduced and fixed rather than assumed. In an isolated copy of the project
with an empty pnpm store and the sandbox's git config suppressed:

- without the rewrite: `git clone git@github.com:ezar/earshot.git` fails,
  matching the CI log exactly;
- with the rewrite: `+ earshot 0.3.0`, install completes.

## Consequences

- A contributor cloning fresh with only HTTPS access to GitHub needs the same
  rewrite. The README says so.
- If earshot is ever published to a registry, this and the specifier both go
  away.
