---
name: session
description: "Check current session health and generate a handoff document. Use when context feels saturated, before ending a session, or when switching tasks."
disable-model-invocation: true
argument-hint: "[status | handoff | glossary]"
metadata:
  triggers:
    keywords:
      - context full
      - session handoff
      - 上下文满了
      - 交接文档
      - session status
---

# Session

Manage session health and context handoff.

## Usage

```
/session           → same as /session status
/session status    → check session health via proxy signals
/session handoff   → generate handoff document + next-session prompt
/session glossary  → view or update project vocabulary table
```

---

## `/session status`

Run the following checks and output a summary:

**1. Plan file complexity**

Read the most recently modified file in `~/.claude/plans/`. Count:
- Total line count
- Number of fenced code blocks (lines starting with ` ``` `)
- Number of `##` headings

**2. Recent git activity**

Run `git log --oneline --since="2 hours ago" 2>/dev/null` to estimate session duration.  
Run `git diff --stat HEAD 2>/dev/null` to count modified files.

**3. Session breadth**

Based on conversation context, estimate how many distinct topics or tasks have been covered.

**Output format:**

```
📊 Session Status

计划文件:   [N] 行，[N] 个代码块   [🟢 健康 | ⚠️ 中等 | 🔴 复杂]
修改文件:   [N] 个
任务覆盖:   [估算]个主题

综合建议:   🟢 继续工作
            🟡 建议在下个任务完成后执行 /session handoff
            🔴 强烈建议立即执行 /session handoff

判断依据:
- [信号1描述]
- [信号2描述]  (如适用)
```

Thresholds:
- 🟢 Green: plan < 800 lines, < 3 tasks, < 5 modified files
- 🟡 Yellow: plan 800–1500 lines, OR 3–5 tasks, OR 5–10 modified files
- 🔴 Red: plan > 1500 lines, OR > 5 tasks, OR > 10 modified files

---

## `/session handoff`

Generate a structured handoff document and a ready-to-paste next-session prompt.

**Steps:**
1. Run `git diff --stat HEAD 2>/dev/null` for a file-level summary of changes.
2. Read the most recent plan file from `~/.claude/plans/` (if exists).
3. Synthesize from conversation context what was accomplished and what remains.

**Output format:**

```markdown
## 上下文交接

### 已完成
- [具体完成项，每条一行]

### 当前状态
[一段话：当前所在位置，关键决策，未解决的问题]

### 修改文件
[git diff --stat 输出，或"无 git 变更"]

---

### 新会话提示词（复制以下内容到新会话）

继续任务: [任务名称]

背景: [2-3 句：项目背景 + 本次工作目标]
当前进度: [上次停在哪里，具体到文件或函数级别]
下一步: [精确的第一个动作]
关键文件: [逗号分隔的文件路径列表]
注意事项: [需要特别注意的约束或决策，可选]
```

Keep the next-session prompt under 150 words — it must fit in the first user message without dominating the context.

---

## `/session glossary`

**If `.agents/glossary.md` exists:**
- Read and display the full table.
- Ask: "是否需要添加新词汇？"
- If yes, append the new row and confirm.

**If it does not exist:**
- Say: "项目词汇表尚未创建。"
- Ask: "是否现在创建 `.agents/glossary.md`？"
- If yes, create with header and any terms the user provides.

**Glossary format:**
```markdown
# Project Glossary

| 词汇 | 含义 | 上下文/备注 |
|------|------|------------|
| TERM | meaning | where it appears or differs from industry usage |
```
