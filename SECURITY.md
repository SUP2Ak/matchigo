# Security Policy

## Supported versions

Only the latest published version of matchigo receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Do not open a public issue for security reports.**

Use GitHub's private vulnerability reporting instead:
**[Report a vulnerability](https://github.com/SUP2Ak/matchigo/security/advisories/new)**

Include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce or a minimal proof of concept.
- The matchigo version, runtime (Node/Bun/Deno) and TypeScript version.

I will acknowledge your report within **72 hours** and aim to release a fix within **14 days** depending on severity. I will credit you in the release notes unless you prefer to remain anonymous.

## Scope

matchigo is a zero-dependency TypeScript pattern-matching library with no network access, no file system access, and no external calls. The attack surface is limited to pattern evaluation logic and type inference. Reports outside this scope (e.g. your bundler, your runtime) should be directed to the relevant upstream project.
