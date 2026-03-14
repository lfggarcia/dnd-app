# Comandos Rápidos — VS Code

Referencia rápida de cómo invocar cada skill desde el chat de Claude en VS Code.

---

## Pipeline completo (recomendado)

```
#file:plan/skills/PIPELINE.md  #file:plan/skills/rn-pipeline/SKILL.md  audita el proyecto completo y aplica los fixes
```

---

## Skills individuales

### Solo descubrimiento profundo
```
#file:plan/skills/rn-discover/SKILL.md  #file:plan/skills/rn-discover/references/investigations.md  investiga el proyecto y genera el briefing
```

### Solo audit por categorías
```
#file:plan/skills/rn-audit/SKILL.md  audita el proyecto
```

### Solo code review (archivo por archivo)
```
#file:plan/skills/rn-codereview/SKILL.md  #file:plan/skills/rn-codereview/references/review-criteria.md  #file:plan/skills/rn-codereview/references/rn-patterns.md  haz un code review completo del proyecto
```

### Solo aplicar fixes
```
#file:plan/skills/rn-fix/SKILL.md  #file:plan/skills/rn-fix/references/fix-patterns.md  aplica los fixes del roadmap
```

### Fixes solo de fase crítica
```
#file:plan/skills/rn-fix/SKILL.md  aplica solo la fase 1 del roadmap
```

### Fix de un issue específico
```
#file:plan/skills/rn-fix/SKILL.md  aplica el fix CR-007
```

---

## Notas

- Siempre incluir `#file:` **antes** del texto del comando
- Los archivos de referencia son opcionales pero mejoran la calidad del output
- Si el contexto de la conversación se vuelve muy largo, abrir una nueva conversación
  y referenciar los archivos de nuevo — Claude no tiene memoria entre sesiones en VS Code
- El estado del pipeline vive en los archivos del proyecto (`plan/`), no en la conversación
