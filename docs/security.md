# Security Guide

Vault is the source of truth for secrets. DevVault stores project mappings, not secret values.

Human authentication uses Vault Userpass in the MVP. Tokens are stored through the operating system keyring via `keytar`; DevVault does not write tokens to project files or plaintext configuration. Applications do not receive the developer token as an environment variable.

Developer and application policies are generated per project and environment. A global `secret/data/projects/+/+` application policy is not used.

The `doctor` command checks the current identity's effective capability on the configured project path. It does not fetch secret data for this check.

The MVP injects resolved values into a child process environment because that works with existing applications. This does not protect against `/proc` inspection, debuggers, crash dumps, inherited child processes or a compromised workstation.

Tokens, passwords, API keys, SecretIDs and private keys must not appear in logs, error messages, command-line arguments or project files. Future adapters can support Vault Agent, local sockets and direct SDK integration without changing the Core ports.