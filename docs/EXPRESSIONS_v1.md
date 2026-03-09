# TORRE — Flujo 2: Expresiones por Inpainting

## Concepto

El Flujo 2 toma el retrato base del Flujo 1 y regenera **solo el área facial** usando `FaceDetailer` + `face_yolov8n` para detectar automáticamente la cara. El resto de la imagen (cuerpo, ropa, fondo) queda intacto.

---

## Parámetros críticos del FaceDetailer

| Parámetro | Valor | Por qué |
|---|---|---|
| `cfg` | **4.0** | Consistente con el modelo — `cfg=6` cambia el tono de piel dramáticamente |
| `denoise` | **0.45** | Regeneración parcial — preserva identidad, solo cambia expresión |
| `steps` | 20 | Suficiente para inpainting facial |
| `guide_size` | 768 | Resolución del crop facial |
| `bbox_crop_factor` | 3 | Área de contexto alrededor de la cara |
| `noise_mask_feather` | 20 | Suaviza los bordes del inpaint |
| `force_inpaint` | true | Fuerza inpainting incluso si la detección no es perfecta |

> ⚠️ **Problema confirmado:** `cfg=6` + `denoise=0.70` (valores originales) cambia el tono de piel radicalmente. Siempre usar `cfg=4.0` y `denoise=0.45`.

---

## Regla de identidad — anclas obligatorias en el positivo

Cada prompt de expresión DEBE empezar con las anclas físicas del personaje antes del `BREAK`:

```
score_9, score_8_up, score_8, masterpiece, best quality, [TONO_PIEL], [RAZA_BASE], BREAK, [TAGS_EXPRESIÓN], expressive eyes, perfect face, 748cmstyle, usnr
```

**Para la tiefling warlock de prueba:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, [TAGS_EXPRESIÓN], expressive eyes, perfect face, 748cmstyle, usnr
```

> Sin `pale skin, human woman` al inicio, el FaceDetailer elige tono de piel aleatoriamente en cada generación.

---

## Workflows disponibles

| Archivo | Expresión | Energía |
|---|---|---|
| `03-expression-angry.json` | Enojo | Cejas fruncidas, dientes apretados, furia |
| `03-expression-happy.json` | Feliz | Sonrisa amplia, ojos curvos de alegría |
| `03-expression-sad.json` | Triste | Ojos bajos, labios temblorosos, lágrimas |
| `03-expression-surprised.json` | Sorprendida | Ojos muy abiertos, boca abierta, asombro |
| `03-expression-disgusted.json` | Disgustada | Nariz arrugada, labio superior levantado |
| `03-expression-fearful.json` | Asustada | Ojos dilatados, terror, temblor |
| `03-expression-seductive.json` | Seductora | Ojos entrecerrados, sonrisa lenta, labios entreabiertos |
| `03-expression-determined.json` | Decidida | Mandíbula firme, mirada fija, resolve |
| `03-expression-neutral.json` | Neutral | Expresión calmada, base para comparar |

---

## Cómo usar

### Paso 1 — Generar el retrato base
Correr `02-portadas-hires-v8.json`. Guardar el archivo PNG resultante — nombre típico: `dnd_portrait_00001_.png`.

### Paso 2 — Cargar el workflow de expresión
Abrir el workflow deseado (ej: `03-expression-angry.json`).

### Paso 3 — Cambiar el archivo de imagen
En el **nodo 8 (Load Image)**, cambiar `dnd_portrait_00001_.png` al nombre real del retrato generado.

### Paso 4 — Adaptar las anclas al personaje
En el **nodo 7 (Positive)**, reemplazar `pale skin, human woman` con los valores del personaje:

```
pale skin → [TONO_PIEL del personaje]
human woman → human woman (siempre)
```

### Paso 5 — Correr y guardar
El resultado se guarda como `expression_[nombre]_00001_.png`.

---

## Prompts por expresión

### ANGRY — Enojo
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, clenched teeth, furrowed brows, narrowed bloodshot eyes, battle fury, rage, intense glare, (angry expression:1.4), (furrowed brows:1.35), (intense glare:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, closed eyes, happy, sad, disfigured, deformed, extra teeth, bad anatomy, bad teeth, deformed teeth, face markings, forehead mark, skin tattoo
```

---

### HAPPY — Feliz
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, bright smile, teeth showing, eyes curved with joy, warm expression, genuine laughter, (happy expression:1.4), (bright smile:1.35), (joyful eyes:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, angry, sad, crying, disfigured, deformed, extra teeth, bad anatomy, bad teeth, deformed teeth, face markings, forehead mark, skin tattoo
```

---

### SAD — Triste
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, downcast eyes, trembling lips, sorrowful expression, tears welling, grief, (sad expression:1.4), (downcast eyes:1.35), (trembling lips:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, angry, happy, smiling, disfigured, deformed, bad anatomy, bad teeth, face markings, forehead mark, skin tattoo
```

---

### SURPRISED — Sorprendida
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, wide open eyes, raised eyebrows, open mouth, shock, astonishment, (surprised expression:1.4), (wide eyes:1.35), (open mouth:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, angry, sad, calm, disfigured, deformed, extra teeth, bad anatomy, bad teeth, face markings, forehead mark, skin tattoo
```

---

### DISGUSTED — Disgustada
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, wrinkled nose, curled upper lip, narrowed eyes, contempt, revulsion, (disgusted expression:1.4), (wrinkled nose:1.35), (curled lip:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, happy, neutral, disfigured, deformed, bad anatomy, bad teeth, face markings, forehead mark, skin tattoo
```

---

### FEARFUL — Asustada
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, wide fearful eyes, pale trembling, pupils dilated, terror, dread, shaking, (fearful expression:1.4), (wide fearful eyes:1.35), (trembling:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, angry, happy, calm, disfigured, deformed, bad anatomy, bad teeth, face markings, forehead mark, skin tattoo
```

---

### SEDUCTIVE — Seductora
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, half-lidded eyes, slow smile, parted lips, smoldering gaze, alluring, magnetic presence, (seductive expression:1.4), (half-lidded eyes:1.35), (parted lips:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, angry, scared, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo
```

---

### DETERMINED — Decidida
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, set jaw, focused gaze, firm lips, resolve, unwavering stare, steely eyes, (determined expression:1.4), (focused gaze:1.35), (set jaw:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, neutral expression, laughing, crying, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo
```

---

### NEUTRAL — Neutral
**Positive:**
```
score_9, score_8_up, score_8, masterpiece, best quality, pale skin, human woman, BREAK, calm neutral expression, relaxed face, soft eyes, composed, serene, (neutral expression:1.4), (calm face:1.3), expressive eyes, perfect face, 748cmstyle, usnr
```
**Negative:**
```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, angry, happy, sad, smiling, crying, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo
```

---

## Troubleshooting expresiones

| Problema | Causa | Solución |
|---|---|---|
| **Tono de piel cambia** | Falta ancla de piel en positivo | Agregar `pale skin, human woman` al inicio del positivo |
| **Parece otro personaje** | `denoise` muy alto | Bajar a `0.40` — mínimo para cambiar expresión |
| **Expresión no se nota** | `denoise` muy bajo | Subir a `0.50` — máximo sin perder identidad |
| **Cara deformada** | `cfg` muy alto | Mantener `cfg=4.0` siempre |
| **YOLO no detecta cara** | Cara muy pequeña o en sombra | Verificar que el retrato base tiene cara grande y bien iluminada |
| **Ornamentos en el rostro** | Prompt con `eldritch`/`arcane` | Agregar al negativo: `face tattoo, face markings, forehead mark, forehead symbol, facial runes` |
| **Cuello/hombros cambian** | `bbox_crop_factor` muy alto | Bajar de `3` a `2.5` |

---

## Integración en `geminiImageService.ts`

El nombre de la imagen base se pasa por parámetro. El servicio genera las 9 expresiones secuencialmente cambiando solo el `filename` en el nodo 8:

```ts
const EXPRESSIONS = ['angry', 'happy', 'sad', 'surprised', 'disgusted', 'fearful', 'seductive', 'determined', 'neutral'];

async function generateExpressions(portraitFilename: string, skinTone: string, raceBase: string) {
  const results: Record<string, string> = {};
  
  for (const expression of EXPRESSIONS) {
    const workflow = await loadWorkflow(`03-expression-${expression}.json`);
    
    // Inject portrait filename
    workflow['8']['inputs']['image'] = portraitFilename;
    
    // Inject character skin anchors
    workflow['7']['inputs']['text'] = workflow['7']['inputs']['text']
      .replace('pale skin, human woman', `${skinTone}, human woman`);
    
    const result = await runWorkflow(workflow);
    results[expression] = await fetchImageAsBase64(result.filename);
  }
  
  return results;
}
```

---

*Documento interno — TORRE · Flujo 2 Expresiones · v1*
