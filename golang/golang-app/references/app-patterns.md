# App Patterns Reference

## Full Viper Config Setup

```go
// cmd/myapp/app/config.go
const (
    defaultHomeDir    = ".myapp"
    defaultConfigName = "myapp.yaml"
)

func setupViper(configFile string) {
    if configFile != "" {
        viper.SetConfigFile(configFile)
    } else {
        for _, dir := range searchDirs() {
            viper.AddConfigPath(dir)
        }
        viper.SetConfigType("yaml")
        viper.SetConfigName(defaultConfigName)
    }
    setupEnvVars()
    if err := viper.ReadInConfig(); err != nil {
        log.Printf("config file not found, using flags/env only: %v", err)
    }
}

func setupEnvVars() {
    viper.AutomaticEnv()
    viper.SetEnvPrefix("MYAPP")                          // MYAPP_HTTP_ADDR, MYAPP_JWT_KEY
    replacer := strings.NewReplacer(".", "_", "-", "_")
    viper.SetEnvKeyReplacer(replacer)                    // http.addr → MYAPP_HTTP_ADDR
}

func searchDirs() []string {
    home, _ := os.UserHomeDir()
    return []string{filepath.Join(home, defaultHomeDir), "."}
}

func filePath() string {
    home, _ := os.UserHomeDir()
    return filepath.Join(home, defaultHomeDir, defaultConfigName)
}
```

## Env Var Naming Convention

The env key replacer converts YAML key separators to underscores automatically:

| YAML key       | CLI flag          | Env var               |
|----------------|-------------------|-----------------------|
| `http.addr`    | `--http-addr`     | `MYAPP_HTTP_ADDR`     |
| `server-mode`  | `--server-mode`   | `MYAPP_SERVER_MODE`   |
| `mysql.host`   | `--mysql-host`    | `MYAPP_MYSQL_HOST`    |
| `jwt-key`      | `--jwt-key`       | `MYAPP_JWT_KEY`       |

## Sub-Option Contract

Each sub-option type must follow this contract:

```go
// genericoptions/http.go
type HTTPOptions struct {
    Addr     string `json:"addr"     mapstructure:"addr"`
    BasePath string `json:"basepath" mapstructure:"basepath"`
}

func NewHTTPOptions() *HTTPOptions {
    return &HTTPOptions{Addr: ":8080", BasePath: "/"}
}

func (o *HTTPOptions) AddFlags(fs *pflag.FlagSet) {
    fs.StringVar(&o.Addr, "http-addr", o.Addr, "HTTP server bind address.")
    fs.StringVar(&o.BasePath, "http-basepath", o.BasePath, "HTTP server base path.")
}

func (o *HTTPOptions) Validate() []error {
    var errs []error
    if o.Addr == "" {
        errs = append(errs, errors.New("http-addr cannot be empty"))
    }
    return errs
}
```

The contract: `NewXxxOptions()` + `AddFlags(*pflag.FlagSet)` + `Validate() []error` (returns a slice, not a single error, so the parent can aggregate with `append(errs, o.Sub.Validate()...)`).

## Config Struct

```go
// internal/apiserver/config.go
type Config struct {
    ServerMode   string
    JWTKey       string
    Expiration   time.Duration
    HTTPOptions  *genericoptions.HTTPOptions
    MySQLOptions *genericoptions.MySQLOptions
}

func (c *Config) NewServer() (server.Server, error) {
    db, err := c.MySQLOptions.NewClient()
    if err != nil {
        return nil, fmt.Errorf("connect database: %w", err)
    }
    // Wire or manual DI: construct store → biz → handler → server
    return server, nil
}
```

`Config` fields are plain Go types — **no `mapstructure` tags needed**. Only `ServerOptions` (the CLI-facing struct) needs tags because `viper.Unmarshal` only touches `ServerOptions`.

## logOptions Pattern

Read specific log fields from viper after config is loaded:

```go
func logOptions() *log.Options {
    opts := log.NewOptions()
    if viper.IsSet("log.level") {
        opts.Level = viper.GetString("log.level")
    }
    if viper.IsSet("log.format") {
        opts.Format = viper.GetString("log.format")
    }
    if viper.IsSet("log.output-paths") {
        opts.OutputPaths = viper.GetStringSlice("log.output-paths")
    }
    return opts
}
```

Use `viper.IsSet` guards so that unset keys don't overwrite the `NewOptions()` defaults.
