#!/usr/bin/env node
// @ts-check
'use strict';

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Models ────────────────────────────────────────────────────────────────────

const MODELS = [
  { name: 'Gemini 2.0 Flash',    usdPerMToken: 0.5  },
  { name: 'GPT-4o mini',         usdPerMToken: 0.6  },
  { name: 'Claude Haiku 4.5',    usdPerMToken: 0.8  },
  { name: 'Claude Sonnet 4.5',   usdPerMToken: 3.0  },
];

const BASELINES = {
  light: 1449,
  heavy: 3656,
};

// ── Token helpers ─────────────────────────────────────────────────────────────

/** @param {string} text */
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * @param {number} tokens
 * @param {number} usdPerMToken
 * @returns {string}
 */
function costUSD(tokens, usdPerMToken) {
  return (tokens / 1_000_000 * usdPerMToken).toFixed(6);
}

// ── Quality scoring ───────────────────────────────────────────────────────────

/**
 * Score a SKILL.md content 0–10:
 *   bullets ≥3         (2 pts)
 *   Anti-Patterns sec  (2 pts)
 *   reference links    (2 pts)
 *   ≤500 lines         (2 pts)
 *   eval coverage      (2 pts — passed in as param)
 *
 * @param {string} skill     SKILL.md content
 * @param {number} evalPts   0 or 2
 */
function scoreQuality(skill, evalPts) {
  let score = 0;
  const lines = skill.split('\n');

  const bulletCount = lines.filter(l => /^\s*[-*]/.test(l)).length;
  if (bulletCount >= 3) score += 2;

  if (/anti.pattern/i.test(skill)) score += 2;

  if (/\[.+\]\(.+\)/.test(skill)) score += 2;

  if (lines.length <= 500) score += 2;

  score += evalPts;

  return score;
}

// ── Eval alignment ────────────────────────────────────────────────────────────

/**
 * Returns the fraction of "contains" assertion values found in SKILL.md.
 * @param {string} skillContent
 * @param {any[]}  evals
 */
function evalAlignment(skillContent, evals) {
  const assertions = evals.flatMap(e =>
    (e.assertions || []).filter(a => a.type === 'contains').map(a => a.value)
  );
  if (assertions.length === 0) return 1;
  const hits = assertions.filter(v => skillContent.includes(v)).length;
  return hits / assertions.length;
}

// ── Skill loader ──────────────────────────────────────────────────────────────

/**
 * @param {string} category
 * @param {string} skillName
 */
function loadSkill(category, skillName) {
  const base = join(ROOT, category, skillName);
  const skillPath = join(base, 'SKILL.md');
  const evalsPath = join(base, 'evals', 'evals.json');

  if (!existsSync(skillPath)) return null;

  const skillContent = readFileSync(skillPath, 'utf8');
  const evalsData    = existsSync(evalsPath)
    ? JSON.parse(readFileSync(evalsPath, 'utf8'))
    : null;

  const tokens     = countTokens(skillContent);
  const evalPts    = evalsData ? 2 : 0;
  const quality    = scoreQuality(skillContent, evalPts);
  const alignment  = evalsData ? evalAlignment(skillContent, evalsData.evals ?? []) : null;

  return { skillName, tokens, quality, alignment, hasEvals: !!evalsData };
}

// ── Report builder ────────────────────────────────────────────────────────────

/**
 * @param {string} date
 * @param {{ [cat: string]: ReturnType<typeof loadSkill>[] }} results
 */
function buildMarkdownReport(date, results) {
  const lines = [];
  lines.push(`# Benchmark Report — ${date}\n`);

  // Per-category tables
  for (const [cat, skills] of Object.entries(results)) {
    const valid = skills.filter(Boolean);
    lines.push(`## ${cat}\n`);

    lines.push('| Skill | Tokens | Light cost | Heavy cost | Quality/10 | Eval align |');
    lines.push('|-------|-------:|:----------:|:----------:|:----------:|:----------:|');

    for (const s of valid) {
      const lightCost = costUSD(BASELINES.light + s.tokens, MODELS[3].usdPerMToken);
      const heavyCost = costUSD(BASELINES.heavy + s.tokens, MODELS[3].usdPerMToken);
      const align     = s.alignment !== null ? `${Math.round(s.alignment * 100)}%` : '—';
      lines.push(`| ${s.skillName} | ${s.tokens} | $${lightCost} | $${heavyCost} | ${s.quality}/10 | ${align} |`);
    }

    lines.push('');
  }

  // Cost comparison table across models
  lines.push('## Cost per invocation (all skills loaded)\n');
  const allSkills = Object.values(results).flat().filter(Boolean);
  const totalTokens = allSkills.reduce((sum, s) => sum + s.tokens, 0);

  lines.push('| Model | USD/1M tokens | Light session | Heavy session |');
  lines.push('|-------|:-------------:|:-------------:|:-------------:|');
  for (const m of MODELS) {
    const light = costUSD(BASELINES.light + totalTokens, m.usdPerMToken);
    const heavy = costUSD(BASELINES.heavy + totalTokens, m.usdPerMToken);
    lines.push(`| ${m.name} | $${m.usdPerMToken} | $${light} | $${heavy} |`);
  }
  lines.push('');

  // Summary stats
  const withEvals   = allSkills.filter(s => s.hasEvals).length;
  const avgQuality  = (allSkills.reduce((s, x) => s + x.quality, 0) / allSkills.length).toFixed(1);
  const avgAlign    = allSkills.filter(s => s.alignment !== null);
  const avgAlignPct = avgAlign.length
    ? Math.round(avgAlign.reduce((s, x) => s + x.alignment, 0) / avgAlign.length * 100)
    : 0;

  lines.push('## Summary\n');
  lines.push(`- **Total skills**: ${allSkills.length}`);
  lines.push(`- **Skills with evals**: ${withEvals} / ${allSkills.length}`);
  lines.push(`- **Average quality score**: ${avgQuality} / 10`);
  lines.push(`- **Average eval alignment**: ${avgAlignPct}%`);
  lines.push(`- **Total tokens (all skills)**: ${totalTokens}`);
  lines.push('');

  return lines.join('\n');
}

// ── History helpers ───────────────────────────────────────────────────────────

const HISTORY_PATH = join(ROOT, 'benchmarks', 'history.json');

function loadHistory() {
  if (!existsSync(HISTORY_PATH)) return [];
  return JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
}

/**
 * @param {string} date
 * @param {{ [cat: string]: ReturnType<typeof loadSkill>[] }} results
 */
function buildHistoryEntry(date, results) {
  const allSkills  = Object.values(results).flat().filter(Boolean);
  const totalTokens = allSkills.reduce((s, x) => s + x.tokens, 0);
  const avgQuality  = allSkills.reduce((s, x) => s + x.quality, 0) / allSkills.length;
  return {
    date,
    totalSkills:  allSkills.length,
    totalTokens,
    avgQuality:   parseFloat(avgQuality.toFixed(2)),
  };
}

// ── metadata.json updater ─────────────────────────────────────────────────────

const METADATA_PATH = join(ROOT, 'metadata.json');

/**
 * @param {{ [cat: string]: ReturnType<typeof loadSkill>[] }} results
 */
function updateMetadata(results) {
  const meta = JSON.parse(readFileSync(METADATA_PATH, 'utf8'));
  for (const [cat, skills] of Object.entries(results)) {
    const valid = skills.filter(Boolean);
    if (!meta.categories[cat]) continue;
    meta.categories[cat].token_metrics = {
      total_tokens:    valid.reduce((s, x) => s + x.tokens, 0),
      avg_tokens:      Math.round(valid.reduce((s, x) => s + x.tokens, 0) / valid.length),
      avg_quality:     parseFloat((valid.reduce((s, x) => s + x.quality, 0) / valid.length).toFixed(2)),
      skills_with_evals: valid.filter(s => s.hasEvals).length,
    };
    meta.categories[cat].last_updated = new Date().toISOString().slice(0, 10);
  }
  writeFileSync(METADATA_PATH, JSON.stringify(meta, null, 2) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const meta     = JSON.parse(readFileSync(METADATA_PATH, 'utf8'));
  const date     = new Date().toISOString().slice(0, 10);

  console.log(`\nRunning benchmark — ${date}\n`);

  /** @type {{ [cat: string]: ReturnType<typeof loadSkill>[] }} */
  const results = {};

  for (const [cat, catMeta] of Object.entries(meta.categories)) {
    const skills = catMeta.skills ?? [];
    results[cat] = skills.map(name => {
      const s = loadSkill(cat, name);
      if (s) {
        console.log(`  ✓ ${cat}/${name}  (${s.tokens} tokens, quality ${s.quality}/10)`);
      } else {
        console.warn(`  ✗ ${cat}/${name}  (SKILL.md not found)`);
      }
      return s;
    });
  }

  // Write report
  const report = buildMarkdownReport(date, results);
  await mkdir(join(ROOT, 'benchmarks', 'archive'), { recursive: true });

  const reportPath   = join(ROOT, 'benchmarks', 'benchmark-report.md');
  const archivePath  = join(ROOT, 'benchmarks', 'archive', `${date}.md`);

  await writeFile(reportPath, report);
  await writeFile(archivePath, report);
  console.log(`\nReport written → benchmarks/benchmark-report.md`);
  console.log(`Archived       → benchmarks/archive/${date}.md`);

  // Update history
  const history = loadHistory();
  history.push(buildHistoryEntry(date, results));
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
  console.log(`History updated → benchmarks/history.json  (${history.length} entries)`);

  // Update metadata.json token_metrics
  updateMetadata(results);
  console.log(`Metrics updated → metadata.json\n`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
