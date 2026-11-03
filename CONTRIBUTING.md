# Contributing to Bloxdy Client

Bloxdy Client is in active development. Small, focused fixes with a clear
reproduction or test are especially useful. A general beta has not launched;
please do not recruit new testers or promote a release on the project's behalf.

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
   source fixtures and mod projects that are not redistributed here.
4. Add a test when it demonstrates a real regression or contract. Label live
   behavior as unverified until a user checks it in the client.

Do not add private account data, copied game source, third-party mods without
redistribution rights, generated installers, or local diagnostic files. By
submitting a contribution, you agree that your original contribution may be
distributed under this repository's MIT license. Third-party material must
keep its own license and attribution.
