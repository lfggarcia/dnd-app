---
name: torre-doc-sync
description: Updates TORRE project documentation after completing work. Syncs PROJECT_PLAN.md, PROJECT_STATUS.md, HANDOFF.md, and CHANGELOG.md to reflect current state. Use after completing a sprint task, fixing a bug, or ending a work session. Keywords: docs, documentation, update, sync, sprint, handoff, changelog, status.
argument-hint: [what was completed] [optional: new sprint tasks]
---

# TORRE — Documentation Sync

Use this skill at the end of a work session or after completing a significant task.

---

## When to invoke

- ✅ After completing a sprint task or group of tasks
- ✅ After fixing a critical bug
- ✅ After adding a new service, screen, or feature
- ✅ When starting a new sprint
- ✅ Before ending a session (handoff)

---

## Step 1 — Gather current state

Read these files to understand what changed:
1. `PROJECT_PLAN.md` — current sprint tasks (check which are done)
2. `PROJECT_STATUS.md` — look at the "En Progreso / Pendiente" section
3. `CHANGELOG.md` — last entry to know where to add
4. Check any files modified in the session via git or file timestamps

```bash
git diff --name-only HEAD~1 HEAD 2>/dev/null || git status --short
```

---

## Step 2 — Update `PROJECT_PLAN.md`

- Mark completed tasks with `[x]` in the active sprint
- Update "Sprint activo" in the header table if sprint changed
- Update "Última actualización" date
- Update "Próxima Acción Inmediata" section
- Add new bugs to the bugs table if discovered
- Remove bugs from table if fixed

---

## Step 3 — Update `PROJECT_STATUS.md`

- Move completed items from "En Progreso / Pendiente" to "✅ Completado" table
- Update "Estado general" summary at the top
- Update the sprint checkboxes (mark `[x]`)
- Add any new risks discovered to "Riesgos Técnicos" table

Format for new completed item:
```markdown
| **Feature Name** | Description of what was implemented | 
```

---

## Step 4 — Update `CHANGELOG.md`

Add a new entry at the top under `## [Unreleased]` or create a new version block:

```markdown
## [YYYY-MM-DD] — Sprint XY Task Description

### Added
- [feat] Description of new feature

### Fixed  
- [fix] Description of bug fix

### Changed
- [chore] Description of refactor or change
```

---

## Step 5 — Update `HANDOFF.md`

Update the TL;DR section and "Lo más urgente" to reflect:
- New current state description (1-2 sentences)
- What was just completed
- What the absolute next task is

The HANDOFF.md must be **self-sufficient** — someone reading it cold should know exactly where to continue.

---

## Output checklist

After sync, confirm:
- [ ] `PROJECT_PLAN.md` — sprint tasks updated with [x] for done items
- [ ] `PROJECT_PLAN.md` — "Próxima Acción Inmediata" updated
- [ ] `PROJECT_STATUS.md` — completed items moved to ✅ table
- [ ] `CHANGELOG.md` — new entry added
- [ ] `HANDOFF.md` — TL;DR and "Lo más urgente" updated
