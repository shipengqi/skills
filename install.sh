#!/usr/bin/env bash
# install.sh — install all skills via git clone + symlinks
# Usage: ./install.sh [--all | <skill-name> ...]
# Example: ./install.sh
#          ./install.sh golang-gin golang-architecture
#          ./install.sh --all

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="${HOME}/.claude/skills"

# All available skills in order: <category>/<skill-name>
ALL_SKILLS=(
  golang/golang-language
  golang/golang-error-handling
  golang/golang-logging
  golang/golang-architecture
  golang/golang-testing
  golang/golang-api-server
  golang/golang-gin
  golang/golang-echo
  golang/golang-fiber
  golang/golang-nethttp
  golang/golang-makefile
  golang/golang-app
  golang/golang-database
  typescript/typescript-language
  typescript/typescript-best-practices
  typescript/typescript-tooling
  typescript/typescript-security
  python/python-language
  python/python-architecture
  python/python-error-handling
  python/python-logging
  python/python-testing
  python/python-async
  python/python-fastapi
  python/python-data
  python/python-cli
  frontend/react-language
  frontend/react-patterns
  frontend/react-forms
  frontend/react-state
  frontend/react-testing
  frontend/angular-language
  frontend/angular-services
  frontend/angular-forms
  frontend/angular-testing
  frontend/nextjs-app-router
  frontend/nextjs-data
  frontend/nextjs-api
  frontend/cypress-e2e
  nodejs/nestjs-architecture
  nodejs/nestjs-guards
  nodejs/nestjs-testing
  nodejs/nestjs-database
)

install_skill() {
  local path="$1"
  local name
  name="$(basename "$path")"
  local src="${REPO_ROOT}/${path}"
  local dest="${SKILLS_DIR}/${name}"

  if [[ ! -d "$src" ]]; then
    echo "  ✗ ${name}: source not found at ${src}" >&2
    return 1
  fi

  # Remove existing symlink or directory
  [[ -L "$dest" ]] && rm "$dest"
  [[ -d "$dest" ]] && rm -rf "$dest"

  ln -s "$src" "$dest"
  echo "  ✓ ${name}"
}

list_skills() {
  echo ""
  echo "Available skills:"
  echo ""
  for path in "${ALL_SKILLS[@]}"; do
    local name
    name="$(basename "$path")"
    local dest="${SKILLS_DIR}/${name}"
    local mark=" "
    [[ -L "$dest" ]] && mark="✓"
    printf "  [%s] %s\n" "$mark" "$name"
  done
  echo ""
}

main() {
  mkdir -p "$SKILLS_DIR"

  local args=("$@")

  # No args or --all → install everything
  if [[ ${#args[@]} -eq 0 ]] || [[ "${args[0]:-}" == "--all" ]]; then
    echo ""
    echo "Installing all skills to ${SKILLS_DIR}:"
    echo ""
    for path in "${ALL_SKILLS[@]}"; do
      install_skill "$path"
    done
    echo ""
    echo "Done. ${#ALL_SKILLS[@]} skills installed."
    echo "Restart Claude Code to load new skills."
    echo ""
    return
  fi

  if [[ "${args[0]}" == "list" ]]; then
    list_skills
    return
  fi

  # Install named skills
  echo ""
  echo "Installing to ${SKILLS_DIR}:"
  echo ""
  for name in "${args[@]}"; do
    local found=0
    for path in "${ALL_SKILLS[@]}"; do
      if [[ "$(basename "$path")" == "$name" ]]; then
        install_skill "$path"
        found=1
        break
      fi
    done
    if [[ $found -eq 0 ]]; then
      echo "  ✗ unknown skill: ${name}" >&2
    fi
  done
  echo ""
  echo "Done. Restart Claude Code to load new skills."
  echo ""
}

main "$@"
