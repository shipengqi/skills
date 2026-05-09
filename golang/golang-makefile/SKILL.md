---
name: golang-makefile
description: Makefile patterns for Go projects — layered include structure, version injection from git, tools auto-install, and ##@ help system. Use when setting up or extending a Go project's build system. Apply whenever user writes Makefile targets, asks about ldflags version injection, golangci-lint auto-install, or asks how to structure a Go project's build system.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - makefile
      - make target
      - hack/include
      - ldflags
      - build target
      - golangci-lint install
---

# Go Makefile

## Include Structure

Top-level `Makefile` is a thin dispatcher; all logic lives in `hack/include/*.mk`.

```makefile
# Makefile
.DEFAULT_GOAL := all
include hack/include/common.mk
include hack/include/golang.mk
include hack/include/tools.mk

all: tidy format build cover

build: ## Build binaries
	@$(MAKE) go.build

test: ## Run unit tests
	@$(MAKE) go.test

.PHONY: all build test
```

## Version Injection (common.mk)

```makefile
ROOT_PACKAGE    := github.com/yourorg/yourapp
VERSION_PACKAGE := $(ROOT_PACKAGE)/pkg/version
OUTPUT_DIR      := $(PROJ_ROOT_DIR)/_output

ifeq ($(origin VERSION),undefined)
  VERSION := $(shell git describe --tags --always --match='v*')
endif
GIT_COMMIT     := $(shell git rev-parse HEAD)
GIT_TREE_STATE := "dirty"
ifeq (, $(shell git status --porcelain 2>/dev/null))
  GIT_TREE_STATE = "clean"
endif

GO_LDFLAGS += \
  -X $(VERSION_PACKAGE).gitVersion=$(VERSION) \
  -X $(VERSION_PACKAGE).gitCommit=$(GIT_COMMIT) \
  -X $(VERSION_PACKAGE).gitTreeState=$(GIT_TREE_STATE) \
  -X $(VERSION_PACKAGE).buildDate=$(shell date -u +'%Y-%m-%dT%H:%M:%SZ')
```

## Tools Auto-Install (tools.mk)

```makefile
tools.verify.%:
	@if ! which $* &>/dev/null; then $(MAKE) tools.install.$*; fi

tools.install.golangci-lint:
	@$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.63.2

tools.install.goimports:
	@$(GO) install golang.org/x/tools/cmd/goimports@latest
```

Declare `tools.verify.<tool>` as a prerequisite of any target that needs the tool — it auto-installs on first use.

## `##@` Help System

```makefile
help: Makefile ## Print help
	@awk 'BEGIN {FS=":.*##"} /^[a-zA-Z._-]+:.*?##/ \
		{ printf "  \033[36m%-20s\033[0m %s\n",$$1,$$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n",substr($$0,5) }' Makefile
```

Annotate targets with `## description` and group with `##@ Section Name`.

## Anti-Patterns

- ❌ Logic in top-level `Makefile` — keep it as a thin dispatcher
- ❌ Hardcoding version — always derive from `git describe --tags --always --match='v*'`
- ❌ Missing `tools.verify.%` prerequisite — CI fails when tool not installed
- ❌ No `.PHONY` for non-file targets — `make` skips if a file of the same name exists

## References

- [Makefile Patterns](references/makefile-patterns.md) — full common.mk, golang.mk, tools.mk, multi-binary build
