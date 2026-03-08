---
name: torre-sprint
description: Sprint management for TORRE project. Shows current sprint status, pending tasks, and helps plan the next sprint. Use when asking "what's next?", starting a new work session, or planning a sprint. Keywords: sprint, planning, next task, roadmap, what to do, priorities, game loop, combat.
argument-hint: [sprint number or name, e.g. "4A" or "combat engine"]
---

# TORRE — Sprint Manager

Use this skill to understand the current work state and decide what to do next.

---

## Step 1 — Read current plan

Always start by reading `PROJECT_PLAN.md`:
- Identify the "Sprint activo"
- Read the sprint's task list — find any `[ ]` (pending) tasks
- Check the "🐛 Bugs Críticos" section

---

## Step 2 — Report status

Report the following in a **concise table**:

```
Sprint activo: 4A — Cerrar el Game Loop
─────────────────────────────────────────
✅ Done    | [list completed tasks]
🔴 Pending | [list remaining tasks in order]
🐛 Bugs    | [critical bugs blocking progress]
```

---

## Step 3 — Recommend next action

Based on the task list, recommend the **single most impactful next task**. Evaluate:
1. Does it unblock other tasks? (prefer yes)
2. Is it a critical bug fix? (prefer yes)
3. Is it a small/medium task that can be done in one session? (prefer yes)
4. Does it affect core gameplay? (prefer yes)

State the recommendation as:
```
🎯 NEXT: [task description]
File(s): [src/file.tsx, src/file2.ts]
Why: [1 sentence reason]
```

---

## Sprint Priority Order

When multiple tasks are available, prioritize in this order:
1. 🔴 Critical bugs that block the game loop
2. 🔴 Sprint 4A tasks (game loop closure) — blocks all future work
3. 🟡 Sprint 4B (combat engine) — core gameplay
4. 🟡 Stability improvements (iOS bug, error handling)
5. 🟢 Sprint 5+ (world simulation, social layer)
6. 🔵 Sprint 7 (optimization, release)

---

## Sprint 4A — Task Execution Order

This is the current sprint. Tasks MUST be done in this order (dependencies):

```
1. src/navigation/types.ts
   → Add: Battle: { roomId: string; roomType: RoomType }
   → Add: Report: { roomId: string; roomWasCleared: boolean }

2. src/screens/MapScreen.tsx  
   → Pass roomId + roomType when navigating to BattleScreen

3. src/screens/BattleScreen.tsx
   → Read route params
   → On combat end (mock victory) → navigate to Report with params

4. src/screens/ReportScreen.tsx
   → Read route params
   → "Continuar" → navigate BACK to MapScreen (not to Extraction)

5. src/screens/MapScreen.tsx (second edit)
   → On return from Report, mark room as visited: true
   → Persist mapState to store

6. Verify isBossCleared triggers floor advance panel

7. Manual test: full dungeon loop
```

---

## Sprint 4B — Task Overview (after 4A is done)

```
Priority | Task
---------|-----
1        | Combat initiative system (DEX + seeded d20)
2        | Hit roll formula against EnemyAC
3        | Damage calculation with critical hits
4        | Dynamic HP for all actors
5        | Turn structure (Action/Bonus/Reaction)
6        | Combat log via TypewriterText
7        | Enemy generation from monsterEvolutionService
8        | XP + gold post-combat
9        | ReportScreen with real results
```

---

## When sprint changes

When all Sprint 4A tasks are `[x]`:
1. Update `PROJECT_PLAN.md` — mark sprint 4A complete, set sprint 4B as active
2. Run `/torre-doc-sync` to update all docs
3. Report Sprint 4B kickoff plan
