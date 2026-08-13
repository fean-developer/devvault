# Platform Compatibility

This matrix records executed evidence. A platform is not marked as tested because the code is expected to work there.

| Platform | Tested | Environment | Result | Limitations |
| --- | --- | --- | --- | --- |
| Linux | Yes | WSL2 Linux environment, Node.js 24, Docker 29, Compose 2.40 | PASS | Secret Service unavailable in this session |
| WSL2 | Yes | WSL2 kernel `6.6.87.2-microsoft-standard-WSL2` | PASS WITH LIMITATION | Docker Desktop-specific integration not proven; Compose restart returned Vault to sealed state and unseal key was not available for recovery validation |
| Windows | No | No Windows runner available | NOT EXECUTED | Credential Manager, paths and process signals remain unvalidated |
| PowerShell | Yes, via WSL bridge | Windows PowerShell `5.1.26100.8875` invoking `wsl.exe -d Ubuntu-24.04` | PASS WITH LIMITATION | Native Windows Node/CLI was not executed; the process runtime remained Linux/WSL |
| Docker Desktop | No | Corporate compliance blocks installation/execution | BLOCKED BY ENVIRONMENT | Validate later on an authorized machine |

## Phase 0 evidence

The Phase 0 setup, security and readiness suites ran in the Linux/WSL2 workspace. They cover injected Linux, WSL2, Windows/PowerShell signals, Docker policy blocking and read-only remote backend behavior. Native Windows and live remote Vault remain untested.

The Phase 0 repository gate ran:

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

See [Phase 0 readiness report](phase-0-readiness-report.md) for the complete evidence and limitations.

## Existing baseline evidence

The Linux baseline ran:

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```

The platform tests cover injected Linux, WSL2 and Windows/PowerShell signals. WSL2 and the PowerShell-to-WSL bridge were executed for real. Native Windows remains unexecuted.