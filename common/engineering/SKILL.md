---
name: engineering
description: "Always-on engineering habits: CodeGraph-first exploration, ADR capture, vocabulary recording, context-saturation handoff, timeout handling, GitHub-first reference lookup, and test gate between subtasks. Apply silently in every session."
metadata:
  triggers:
    keywords:
      - codegraph
      - adr
      - architecture
      - architectural
      - glossary
      - timeout
      - context
      - 词汇
      - 决策
      - 架构
      - 上下文
---

# Session Patterns

Five always-on rules. Apply proactively — never wait for the user to ask.

---

## 1. CodeGraph First

When the working directory contains `.codegraph/`:

- **ALWAYS** call `codegraph_explore` before any grep, find, Bash search, or Read-for-discovery.
- One `codegraph_explore` call returns verbatim source + call paths — it replaces a grep+Read loop.
- Query can be a symbol name, file name, or natural-language question.

**Never substitute:**
```
# Wrong — do not do these when .codegraph/ exists
grep -r "symbolName" .
find . -name "*.go" | xargs grep ...
cat file.go  # to discover where something is defined
```

**Correct:**
```
codegraph_explore("symbolName functionName")
codegraph_explore("how does the auth flow work")
```

If `.codegraph/` does not exist, use normal tools — do not run `codegraph init` yourself.

---

## 2. ADR — Architecture Decision Records

Trigger an ADR suggestion when you observe any of:
- Adding a new package, module, or service boundary
- Choosing a design pattern (event sourcing, saga, CQRS, repository, etc.)
- Making an API shape decision with cross-team impact
- Rejecting an alternative that was seriously considered
- Choosing a dependency with significant trade-offs

**Say:**
> 这是一个架构决策，建议在 `.agents/adr/` 记录。我可以帮你起草。

**ADR file path:** `.agents/adr/NNNN-kebab-title.md`  
**Number:** next integer after existing files (pad to 4 digits: `0001`, `0042`)

**Template:**
```markdown
# ADR NNNN: Title

**状态**: Proposed | Accepted | Superseded
**日期**: YYYY-MM-DD

## 决策
[一句话描述]

## 原因
[为什么这样决策，约束条件]

## 后果
[带来的影响，包括权衡和已知缺点]

## 替代方案
[考虑过但放弃的方案及原因]
```

---

## 3. Vocabulary — Project Glossary

When you encounter a term that is:
- A project-specific abbreviation (e.g. `SCI`, `TCC`, `MUW`)
- A domain concept with a non-obvious meaning in this project
- A name that conflicts with a common industry term

**Ask:**
> "**[TERM]** 是项目专有词汇吗？要记录到词汇表吗？"

If the user confirms, create or append to `.agents/glossary.md`:

```markdown
# Project Glossary

| 词汇 | 含义 | 上下文/备注 |
|------|------|------------|
| TCC  | Two-Phase Commit Controller | 分布式事务模块，见 pkg/tcc |
| SCI  | Service Capacity Index | 容量规划指标，非 IT 行业通用含义 |
```

Do not add common industry terms (REST, JSON, ORM, etc.) — only project-specific meanings.

---

## 4. Context Saturation — Proactive Handoff

Monitor these proxy signals. When **any two** are true, proactively offer a handoff:

| Signal | Threshold |
|--------|-----------|
| Plan file size | > 1500 lines |
| Consecutive tool calls without user reply | > 15 |
| Distinct unrelated tasks covered | ≥ 3 |
| Session covers a large refactor or migration | subjective judgment |

**Say:**
> 我们的上下文快满了，建议现在执行交接，避免后续响应质量下降。

Then immediately output the handoff block (do not wait for user to ask):

```
## 上下文交接

### 已完成
- [bullet list]

### 当前状态
[一段话：当前位置，已做的关键决策]

### 新会话提示词（可直接复制）
---
继续任务: [具体任务名称]

背景: [2-3 句上下文]
当前进度: [具体到哪一步]
下一步: [精确的下一个动作]
关键文件: [file1, file2, ...]
---
```

---

## 5. Timeout Handling

When a Bash tool call times out OR the description suggests it will take > 30 seconds:

1. **Immediately** output:
   > 命令可能超时，建议在终端手动执行：
   > ```
   > <exact command>
   > ```

2. **Do not** retry the same command automatically.
3. **Do not** wait — give the manual command in the same response as the timeout notice.

Commands that commonly time out: `npm test`, `npm run build`, `cargo test`, `go test ./...`, `gradle`, `mvn`, `docker build`, `pytest`, long migrations.

---

## 6. Reference Projects — GitHub First

When needing to reference an existing project, look up an implementation example, or inspect a third-party repo:

1. **Prefer `gh` CLI** over browser or WebFetch: `gh repo clone owner/repo` or `gh api repos/owner/repo/contents/path`.
2. Clone locally if you need to browse multiple files; use `gh api` for single-file lookups.
3. Do not guess at repo URLs — confirm the repo exists first with `gh repo view owner/repo`.

```bash
# Single file
gh api repos/owner/repo/contents/path/to/file --jq '.content' | base64 -d

# Clone full repo
gh repo clone owner/repo /tmp/owner-repo
```

---

## 7. Test Gate — Subtask Completion

After marking any todo as `completed` in TodoWrite, before setting the next todo to `in_progress`:

1. Write or update tests that cover the behavior just implemented.
2. Run the tests and confirm they pass.
3. Only then advance to the next subtask.

If tests fail, keep the current task `in_progress`, fix the issue, rerun — do not skip ahead.

**This applies whenever TodoWrite is active in the session.** No need for the user to ask — enforce silently as part of the workflow.
