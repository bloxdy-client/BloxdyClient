# Contributing to Bloxdy Client

Bloxdy Client is in active development. Small, focused fixes with a clear
reproduction or test are especially useful. Windows installers are published in
GitHub Releases; please do not make release or compatibility claims on the
project's behalf.

## Before opening an issue

- Check current limitations in [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md).
- State the client version, Windows version, affected feature, and steps to
  reproduce the problem.
- For graphics or FPS reports, describe the scene, selected mods, shader
  settings, expected result, and observed result. State whether the result
  came from a live client test or a CPU-only check.
- Remove usernames, session data, cookies, tokens, account details, and local
  paths from logs and screenshots before sharing them.

## Proposing code

1. Open an issue or describe the problem in a pull request.
2. Keep the change scoped and explain the behavior it changes.
3. Run `npm run test:public`. The fuller local checks require original
   source fixtures and mod projects that are not redistributed here. Public
   updater tests use mocked services and do not install or publish anything.
4. Add a test when it demonstrates a real regression or contract. Label live
   behavior as unverified until a user checks it in the client.

Do not add private account data, copied game source, third-party mods without
redistribution rights, generated installers, or local diagnostic files. By
submitting a contribution, you agree that your original contribution may be
distributed under this repository's MIT license. Third-party material must
keep its own license and attribution.

## Development checks

Use Node.js 22 and install the public test dependencies with
`npm ci --ignore-scripts`. Run `npm run test:public` from the repository root.
GitHub Actions runs this suite on Windows and Linux; the Linux job checks
portable CPU code and does not imply Linux client support.

Read [AGENTS.md](AGENTS.md) before running other scripts. Automated agents
must not launch Electron, the client, installers, or interactive bridge tests,
or operate game accounts. Any required live checks are performed by the user.

## Reviewing a pull request

Explain the user-visible result, how you verified it, and any remaining limits.
Keep unrelated formatting changes out of functional fixes. Update an existing
reference when behavior changes instead of adding another release report.
Documentation-only changes do not require an installer build. Client releases
follow the version and packaging rules in AGENTS.md.
