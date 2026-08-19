---
id: config
display_name: Configuración de entorno (caarlos0/env)
language: golang
description: Type-safe env loading and validation at startup
applies_to: [api, worker, cli]
required_by: []
package: github.com/caarlos0/env/v11
---

# Configuration (Go, caarlos0/env)

Configuration comes from environment variables, parsed into a typed struct and validated **at startup** (fail fast). Default: [caarlos0/env](https://github.com/caarlos0/env) — struct tags, no codegen, supports defaults and required fields.

## When to use

Every service. The `Config` struct is the single typed source of configuration; the rest of the code consumes it, never `os.Getenv` directly.

## Package

```
github.com/caarlos0/env/v11
github.com/joho/godotenv   # dev only, to load .env in local runs
```

## Base configuration

```go
// cmd/{service}/config.go
package main

import "time"

type Config struct {
	Env            string        `env:"ENV" envDefault:"development"`
	HTTPAddr       string        `env:"HTTP_ADDR" envDefault:":8080"`
	LogLevel       string        `env:"LOG_LEVEL" envDefault:"info"`
	LogPretty      bool          `env:"LOG_PRETTY" envDefault:"false"`
	DatabaseURL    string        `env:"DATABASE_URL,required"`
	RequestTimeout time.Duration `env:"REQUEST_TIMEOUT" envDefault:"30s"`
}
```

```go
// cmd/{service}/main.go
import (
	"fmt"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

func loadConfig() (Config, error) {
	_ = godotenv.Load() // best-effort in dev; no error if .env is absent

	cfg, err := env.ParseAs[Config]()
	if err != nil {
		return Config{}, fmt.Errorf("load config: %w", err)
	}
	return cfg, nil
}
```

`env.ParseAs[Config]()` fails if a `required` var is missing or a value cannot be parsed — the process should exit before serving traffic.

## Structure

- One `Config` struct, defined in `cmd/{service}/config.go`.
- Nested structs with `envPrefix` for grouped config:

  ```go
  type Config struct {
  	DB DBConfig `envPrefix:"DB_"`
  }
  type DBConfig struct {
  	URL      string `env:"URL,required"`
  	PoolSize int    `env:"POOL_SIZE" envDefault:"10"`
  }
  ```

- A committed `.env.dist` (or `.env.example`) lists every variable with safe placeholder values. The real `.env` is git-ignored.

## Rules

- All configuration is read in **one place** (`loadConfig`) and validated at startup. Fail fast on missing/invalid values.
- The rest of the code receives the typed `Config` (or a sub-struct). No `os.Getenv` outside `loadConfig`.
- Secrets (DB URL, tokens) come from env, never from committed files or code. `.env` is git-ignored; `.env.dist` documents the keys.
- Sensible defaults via `envDefault` for non-secret values. Secrets are `required` with no default.
- Durations are `time.Duration` (`30s`, `5m`), not raw ints.
- Never log the full config or secret values (see `logging`).

## Framework variant

`viper` (files + env + flags) or `koanf` are acceptable when the service genuinely needs layered/file-based config. For pure 12-factor env config, prefer the struct-tag approach above. Document any deviation in `overview.md`.
