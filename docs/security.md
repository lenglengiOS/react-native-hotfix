# Security model

**English** | [简体中文](zh-CN/security.md)

## Protected properties

- A malicious network response cannot execute JavaScript unless it has a valid
  RSA-SHA256 signature from the configured publisher key.
- A modified launch bundle or asset is rejected by SHA-256 verification.
- Path traversal, duplicate paths, oversized responses, runtime mismatch,
  platform mismatch, and channel mismatch are rejected before installation.
- A partially downloaded update is never selected at startup.
- A launch-failure loop falls back to the previous known-good update or the
  embedded bundle.

## Key management

- Generate at least RSA-3072 keys; the CLI default is 3072.
- The app contains only the SPKI public key.
- Keep the private key outside the repository, in a secret manager or HSM.
- Give the admin token high entropy and rotate it independently from signing
  keys.
- Keep a key ID in release records. Protocol v1 clients currently trust a single
  embedded key, so key rotation requires a native app release that trusts the
  new key.

## Transport

Production endpoints must use HTTPS. Android cleartext is permitted only when
explicitly enabled and restricted to a local development host. iOS permits
loopback HTTP only in a debug build with `HotfixAllowCleartext`.

TLS protects availability and privacy. The manifest signature protects code
integrity even if a CDN or origin storage is compromised.

## Server hardening still required for public production

The reference server is a single-node implementation. Before exposing it
publicly:

- authenticate and rate-limit all admin and check endpoints at the edge;
- terminate TLS with a trusted certificate;
- run the server as an unprivileged user with a read-only root filesystem;
- put immutable update files behind a CDN;
- monitor failed signatures, hash failures, rollback spikes, and publish errors;
- back up release metadata and protect the private key with an HSM/KMS;
- replace local channel files with transactional multi-node storage;
- add request IDs, structured audit logs, and retention controls;
- perform an independent security review of the native code.

Do not put the private key, admin token, source maps, or signing environment
inside the mobile app.

## Store and legal policy

OTA code delivery does not remove platform distribution requirements. Review
Apple App Store and Google Play rules for executable code, disclosure, and
update behavior before enabling production updates.
