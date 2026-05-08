# Makefile Patterns Reference

## Full common.mk

```makefile
SHELL := /bin/bash

COMMON_SELF_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
PROJ_ROOT_DIR   := $(abspath $(shell cd $(COMMON_SELF_DIR)/../../ && pwd -P))
OUTPUT_DIR      := $(PROJ_ROOT_DIR)/_output

ROOT_PACKAGE    := github.com/yourorg/yourapp
VERSION_PACKAGE := $(ROOT_PACKAGE)/pkg/version

# Version from git tag; falls back to commit hash
ifeq ($(origin VERSION),undefined)
  VERSION := $(shell git describe --tags --always --match='v*')
endif

GIT_TREE_STATE := "dirty"
ifeq (, $(shell git status --porcelain 2>/dev/null))
  GIT_TREE_STATE = "clean"
endif
GIT_COMMIT := $(shell git rev-parse HEAD)

GO_LDFLAGS += \
  -X $(VERSION_PACKAGE).gitVersion=$(VERSION) \
  -X $(VERSION_PACKAGE).gitCommit=$(GIT_COMMIT) \
  -X $(VERSION_PACKAGE).gitTreeState=$(GIT_TREE_STATE) \
  -X $(VERSION_PACKAGE).buildDate=$(shell date -u +'%Y-%m-%dT%H:%M:%SZ')

# Platform detection (override with PLATFORM=linux_amd64)
ifeq ($(origin PLATFORM),undefined)
  GOOS   := $(shell go env GOOS)
  GOARCH := $(shell go env GOARCH)
  PLATFORM := $(GOOS)_$(GOARCH)
else
  GOOS   := $(word 1,$(subst _, ,$(PLATFORM)))
  GOARCH := $(word 2,$(subst _, ,$(PLATFORM)))
endif

# Coverage threshold (override with COVERAGE=80)
ifeq ($(origin COVERAGE),undefined)
  COVERAGE := 60
endif

# Silence make's "Entering directory" noise unless V=1
ifndef V
  MAKEFLAGS += --no-print-directory
endif

FIND  := find . ! -path './third_party/*' ! -path './vendor/*'
XARGS := xargs --no-run-if-empty
```

## Full golang.mk

```makefile
GO             := go
GOPATH         := $(shell go env GOPATH)
GOBIN          := $(GOPATH)/bin
GO_BUILD_FLAGS += -ldflags "$(GO_LDFLAGS)"

COMMANDS ?= $(filter-out %.md,$(wildcard $(PROJ_ROOT_DIR)/cmd/*))
BINS     ?= $(foreach cmd,$(COMMANDS),$(notdir $(cmd)))

# Single-binary shorthand: go.build
go.build: go.build.verify $(addprefix go.build.,$(addprefix $(PLATFORM).,$(BINS)))

# Per-platform/binary rule: go.build.<platform>.<binary>
go.build.%:
	$(eval COMMAND  := $(word 2,$(subst ., ,$*)))
	$(eval PLATFORM := $(word 1,$(subst ., ,$*)))
	$(eval OS       := $(word 1,$(subst _, ,$(PLATFORM))))
	$(eval ARCH     := $(word 2,$(subst _, ,$(PLATFORM))))
	@echo "===========> Building $(COMMAND) $(VERSION) for $(OS)/$(ARCH)"
	@mkdir -p $(OUTPUT_DIR)/platforms/$(OS)/$(ARCH)
	@CGO_ENABLED=0 GOOS=$(OS) GOARCH=$(ARCH) $(GO) build $(GO_BUILD_FLAGS) \
		-o $(OUTPUT_DIR)/platforms/$(OS)/$(ARCH)/$(COMMAND) \
		$(ROOT_PACKAGE)/cmd/$(COMMAND)

go.build.verify:
	@if ! which go &>/dev/null; then echo "go not found — install Go first"; exit 1; fi

go.tidy:
	@$(GO) mod tidy

go.format: tools.verify.goimports
	@$(FIND) -type f -name '*.go' | $(XARGS) gofmt -s -w
	@$(FIND) -type f -name '*.go' | $(XARGS) goimports -w -local $(ROOT_PACKAGE)
	@$(GO) mod edit -fmt

go.test:
	@mkdir -p $(OUTPUT_DIR)
	@$(GO) test -race -cover \
		-coverprofile=$(OUTPUT_DIR)/coverage.out \
		-timeout=10m -shuffle=on -short \
		-v $$(go list ./... | grep -v 'vendor\|third_party')

go.cover: go.test
	@$(GO) tool cover -func=$(OUTPUT_DIR)/coverage.out \
		| awk -v target=$(COVERAGE) \
		  'END { pct=substr($$3,1,length($$3)-1)+0; if(pct<target) {print "coverage "$pct"% < "$target"%"; exit 1} }'

go.lint: tools.verify.golangci-lint
	@golangci-lint run -c $(PROJ_ROOT_DIR)/.golangci.yaml ./...

.PHONY: go.build go.build.% go.build.verify go.tidy go.format go.test go.cover go.lint
```

## Full tools.mk

```makefile
TOOLS ?= golangci-lint goimports

tools.verify: $(addprefix tools.verify.,$(TOOLS))
tools.install: $(addprefix tools.install.,$(TOOLS))

tools.install.%:
	@echo "===========> Installing $*"
	@$(MAKE) install.$*

tools.verify.%:
	@if ! which $* &>/dev/null; then $(MAKE) tools.install.$*; fi

install.golangci-lint:
	@$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.63.2
	@golangci-lint completion bash > $(HOME)/.golangci-lint.bash
	@grep -q .golangci-lint.bash $(HOME)/.bashrc || \
		echo "source \$$HOME/.golangci-lint.bash" >> $(HOME)/.bashrc

install.goimports:
	@$(GO) install golang.org/x/tools/cmd/goimports@latest

install.mockgen:
	@$(GO) install go.uber.org/mock/mockgen@latest

install.wire:
	@$(GO) install github.com/google/wire/cmd/wire@latest

.PHONY: tools.verify tools.install tools.verify.% tools.install.%
```

## Multi-Binary Build

When `cmd/` contains multiple binaries:

```makefile
# Builds all binaries for current platform
make build

# Build a specific binary
make build BINS=apiserver

# Cross-compile for Linux AMD64
make build PLATFORM=linux_amd64

# Build all platforms
PLATFORMS ?= darwin_amd64 linux_amd64 linux_arm64
build-all:
	@for platform in $(PLATFORMS); do \
		$(MAKE) go.build PLATFORM=$$platform; \
	done
```

## Version Package (pkg/version/version.go)

```go
package version

var (
	gitVersion   = "v0.0.0-unset"
	gitCommit    = "unknown"
	gitTreeState = "unknown"
	buildDate    = "unknown"
)

type Info struct {
	GitVersion   string `json:"gitVersion"`
	GitCommit    string `json:"gitCommit"`
	GitTreeState string `json:"gitTreeState"`
	BuildDate    string `json:"buildDate"`
}

func Get() Info {
	return Info{
		GitVersion:   gitVersion,
		GitCommit:    gitCommit,
		GitTreeState: gitTreeState,
		BuildDate:    buildDate,
	}
}
```

## GitHub Actions Integration

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # needed for git describe
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - run: make build
      - run: make cover
      - run: make lint
```

`fetch-depth: 0` is required so `git describe --tags` can walk the full tag history.
