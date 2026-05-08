---
name: golang-app
description: Go app bootstrap pattern — cobra command, pflag options with viper config loading, and the Options→Config pipeline. Use when wiring up a Go service entry point.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - cobra
      - viper
      - pflag
      - options
      - mapstructure
      - ServerOptions
      - cobra.OnInitialize
---

# Go App Bootstrap

## Options Struct

```go
// cmd/myapp/app/options/options.go
type ServerOptions struct {
    ServerMode  string                      `json:"server-mode"  mapstructure:"server-mode"`
    JWTKey      string                      `json:"jwt-key"      mapstructure:"jwt-key"`
    HTTPOptions *genericoptions.HTTPOptions `json:"http"         mapstructure:"http"`
}
func NewServerOptions() *ServerOptions {
    return &ServerOptions{ServerMode: "http", JWTKey: "default-key",
        HTTPOptions: genericoptions.NewHTTPOptions()}
}
func (o *ServerOptions) AddFlags(fs *pflag.FlagSet) {
    fs.StringVar(&o.ServerMode, "server-mode", o.ServerMode, "Server mode.")
    fs.StringVar(&o.JWTKey, "jwt-key", o.JWTKey, "JWT signing key.")
    o.HTTPOptions.AddFlags(fs)
}
func (o *ServerOptions) Validate() error {
    var errs []error
    if o.JWTKey == "" { errs = append(errs, errors.New("jwt-key is required")) }
    errs = append(errs, o.HTTPOptions.Validate()...)
    return utilerrors.NewAggregate(errs)
}
func (o *ServerOptions) Config() (*apiserver.Config, error) {
    return &apiserver.Config{ServerMode: o.ServerMode, HTTPOptions: o.HTTPOptions}, nil
}
```

**Options ↔ Config**: `Options` are flag-bound and viper-unmarshaled; `Config` is the internal runtime struct passed into constructors. Never pass `opts` directly to server constructors.

## cobra.Command Setup

```go
var configFile string
func NewAppCommand() *cobra.Command {
    opts := options.NewServerOptions()
    cmd := &cobra.Command{Use: "myapp", SilenceUsage: true,
        RunE: func(cmd *cobra.Command, args []string) error { return run(opts) },
    }
    cobra.OnInitialize(func() { setupViper(configFile) })
    cmd.PersistentFlags().StringVarP(&configFile, "config", "c", filePath(), "Config file.")
    opts.AddFlags(cmd.PersistentFlags())
    version.AddFlags(cmd.PersistentFlags())
    return cmd
}
```

`cobra.OnInitialize` runs after flag parsing — viper reads the config file and env vars then.

## run() Sequence

Config precedence (highest → lowest): CLI flags > env vars (`MYAPP_*`) > config file > defaults.

```go
func run(opts *options.ServerOptions) error {
    version.PrintAndExitIfRequested()
    log.Init(logOptions()); defer log.Sync()
    if err := viper.Unmarshal(opts); err != nil {
        return fmt.Errorf("unmarshal config: %w", err)
    }
    if err := opts.Validate(); err != nil { return err }
    cfg, err := opts.Config()
    if err != nil { return err }
    srv, err := cfg.NewServer()
    if err != nil { return err }
    return srv.Run()
}
```

## Anti-Patterns

- ❌ Calling `opts.Validate()` before `viper.Unmarshal(opts)` — config file values are not yet merged
- ❌ Passing `*ServerOptions` directly to server constructors — use `opts.Config()` to decouple
- ❌ Missing `mapstructure` tags on Options fields — `viper.Unmarshal` silently skips untagged fields
- ❌ Missing `SilenceUsage: true` — cobra prints full help on every `RunE` error

## References

- [App Patterns](references/app-patterns.md) — full viper setup, env var naming, sub-option contract
