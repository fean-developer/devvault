```mermaid
stateDiagram-v2

    [*] --> Unavailable

    Unavailable --> NotInitialized: Vault started

    NotInitialized --> Sealed: vault operator init

    Sealed --> Unsealed: unseal

    Unsealed --> Configured: KV + policies + auth

    Configured --> Ready: health + auth + permissions

    Ready --> Sealed: Vault restart

    Sealed --> Unsealed: unseal

    Ready --> Unavailable: Docker stopped

    Unavailable --> NotInitialized: Docker started
```
### devvault init
Responsibility:

- verify Docker
- start Vault
- detect Vault state
- configure local infrastructure
- enable KV when appropriate
- verify configuration
- remain idempotent

### devvault bootstrap

Responsibility:

- initialize new Vault
- establish initial configuration
- configure policies
- configure authentication
- establish administrative identity

Security rule:

- never silently persist root token
- never silently persist unseal keys

The current CLI deliberately stops before operator initialization and unseal. Those operations require explicit operator handling; `devvault bootstrap` starts only after the Vault is initialized and unsealed.