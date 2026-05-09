#!/usr/bin/env node
// @ts-check
'use strict';

import { readFileSync } from 'fs';
import { mkdir, symlink, unlink, access } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { constants } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SKILLS_DIR = join(homedir(), '.claude', 'skills');

/** @type {{ plugins: Array<{ name: string, source: string, description: string }> }} */
const manifest = JSON.parse(
  readFileSync(join(REPO_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8')
);

const ALL_SKILLS = manifest.plugins;

function usage() {
  console.log(`
Usage: claude-skills <command> [skill-name|category]

Commands:
  list                List all available skills
  add <name>          Install a specific skill
  add <category>      Install all skills in a category (golang, typescript, python, frontend, nodejs, database)
  add --all           Install all skills
  remove <name>       Remove a specific skill
  remove --all        Remove all skills

Available skills:
${ALL_SKILLS.map(s => `  ${s.name.padEnd(30)} ${s.description}`).join('\n')}
`);
}

async function ensureSkillsDir() {
  await mkdir(SKILLS_DIR, { recursive: true });
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function installSkill(skill) {
  const src  = resolve(REPO_ROOT, skill.source);
  const dest = join(SKILLS_DIR, skill.name);

  if (!(await exists(src))) {
    console.error(`  ✗ ${skill.name}: source not found at ${src}`);
    return;
  }

  if (await exists(dest)) {
    await unlink(dest);
  }

  await symlink(src, dest);
  console.log(`  ✓ ${skill.name}`);
}

async function removeSkill(skill) {
  const dest = join(SKILLS_DIR, skill.name);
  if (await exists(dest)) {
    await unlink(dest);
    console.log(`  ✓ removed ${skill.name}`);
  } else {
    console.log(`  - ${skill.name} (not installed)`);
  }
}

async function main() {
  const [,, command, arg] = process.argv;

  if (!command || command === 'help' || command === '--help') {
    usage();
    return;
  }

  if (command === 'list') {
    console.log('\nAvailable skills:\n');
    for (const skill of ALL_SKILLS) {
      const dest = join(SKILLS_DIR, skill.name);
      const installed = await exists(dest) ? '✓' : ' ';
      console.log(`  [${installed}] ${skill.name.padEnd(30)} ${skill.description}`);
    }
    console.log();
    return;
  }

  if (command === 'add') {
    await ensureSkillsDir();

    if (arg === '--all') {
      console.log('\nInstalling all skills:\n');
      for (const skill of ALL_SKILLS) {
        await installSkill(skill);
      }
      console.log(`\nDone. Installed ${ALL_SKILLS.length} skills to ${SKILLS_DIR}\n`);
      return;
    }

    if (!arg) { usage(); process.exit(1); }

    const skill = ALL_SKILLS.find(s => s.name === arg);
    if (!skill) {
      const categorySkills = ALL_SKILLS.filter(s => s.source.replace(/^\.\//, '').split('/')[0] === arg);
      if (categorySkills.length === 0) {
        console.error(`\nUnknown skill or category: "${arg}". Run "claude-skills list" to see available skills.\n`);
        process.exit(1);
      }
      console.log(`\nInstalling ${categorySkills.length} skills in ${arg}:\n`);
      for (const s of categorySkills) {
        await installSkill(s);
      }
      console.log(`\nDone. Installed ${categorySkills.length} skills to ${SKILLS_DIR}\n`);
      return;
    }

    console.log(`\nInstalling ${skill.name}...\n`);
    await installSkill(skill);
    console.log(`\nDone. Symlinked to ${join(SKILLS_DIR, skill.name)}\n`);
    return;
  }

  if (command === 'remove') {
    if (arg === '--all') {
      console.log('\nRemoving all skills:\n');
      for (const skill of ALL_SKILLS) {
        await removeSkill(skill);
      }
      console.log();
      return;
    }

    if (!arg) { usage(); process.exit(1); }

    const skill = ALL_SKILLS.find(s => s.name === arg);
    if (!skill) {
      console.error(`\nUnknown skill: "${arg}"\n`);
      process.exit(1);
    }

    await removeSkill(skill);
    return;
  }

  console.error(`\nUnknown command: "${command}"\n`);
  usage();
  process.exit(1);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
