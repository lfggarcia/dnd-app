# Comandos Rápidos

Referencia de cómo invocar cada skill. Requiere Claude Code CLI con Serena MCP activo.

## Pipeline completo (recomendado)

Lee CLAUDE.md automáticamente. Solo ejecutar:
```
ejecuta el pipeline completo de calidad
```

O invocar explícitamente:
```
#file:plan/skills/PIPELINE.md  #file:plan/skills/rn-pipeline/SKILL.md  ejecuta el pipeline completo
```

## Skills individuales

### Solo discovery
```
#file:plan/skills/rn-discover/SKILL.md  #file:plan/skills/rn-discover/references/investigations.md  investiga el proyecto
```

### Solo audit
```
#file:plan/skills/rn-audit/SKILL.md  #file:plan/skills/rn-audit/references/categories.md  audita el proyecto
```

### Solo code review
```
#file:plan/skills/rn-codereview/SKILL.md  #file:plan/skills/rn-codereview/references/review-criteria.md  #file:plan/skills/rn-codereview/references/rn-patterns.md  haz un code review completo
```

### Aplicar todos los fixes
```
#file:plan/skills/rn-fix/SKILL.md  aplica el roadmap completo
```

### Solo Phase 1 (críticos)
```
#file:plan/skills/rn-fix/SKILL.md  aplica solo la fase 1
```

### Fix específico
```
#file:plan/skills/rn-fix/SKILL.md  aplica CR-007
```

## Notas

- El estado del pipeline vive en `plan/` — si el contexto se compacta, Claude lo restaura solo
- Serena MCP reemplaza grep/cat para búsquedas en código
- bash queda solo para: mkdir, npm install, npx tsc, npm test, du
