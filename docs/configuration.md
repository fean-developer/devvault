# Configuration

`devvault.yaml` is project metadata. It is safe to commit only when it contains no credentials.

```yaml
version: 1
project: my-api
environment: development
vault:
  mount: secret
  path: projects/my-api/development
runtime:
  mappings:
    DATABASE_URL: database.url
```

The schema rejects unknown top-level fields, invalid project identifiers and literal mapping values. Mapping keys are environment variable names; mapping values are references such as `database.url`.