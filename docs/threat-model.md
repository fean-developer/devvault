# Threat Model

| Threat | Impact | Likelihood | Mitigation | Residual risk |
| --- | --- | --- | --- | --- |
| Accidental Git commit | Secret disclosure | Medium | Reject secret fields and never generate secret files | Manually created files can still be committed |
| Malicious developer | Unauthorized secret access | Medium | Vault policies and project-scoped paths | A user with local Vault access can misuse permitted secrets |
| Compromised local machine | Broad secret disclosure | High | Short-lived process injection and no project persistence | Environment variables and process inspection remain exposed |
| Leaked Vault token | Vault access | Medium | Avoid file persistence and least-privilege policies | A valid token works until revoked or expired |
| Docker compromise | Local Vault data access | Low/Medium | Local bind, persistent volume permissions and restricted policies | Host/container compromise is outside the application boundary |