# Skill: torre-expressions

**Cargar cuando:** Se trabaje con el sistema de expresiones (Flujo 2), FaceDetailer, prompts de expresión, o se agreguen/modifiquen variantes emocionales.

**Doc de referencia:** `docs/EXPRESSIONS_v1.md`

---

## Lista de expresiones (v2 — 9 variantes)

| Key | Label | Tags clave |
|---|---|---|
| `neutral` | Neutral | calm neutral expression, relaxed face, soft eyes, serene |
| `angry` | Angry | clenched teeth, furrowed brows, narrowed bloodshot eyes, battle fury |
| `sad` | Sad | downcast eyes, trembling lips, sorrowful expression, tears welling |
| `surprised` | Surprised | wide open eyes, raised eyebrows, open mouth, shock |
| `determined` | Determined | set jaw, focused gaze, firm lips, resolve, steely eyes |
| `fearful` | Fearful | wide fearful eyes, pupils dilated, terror, dread, shaking |
| `disgusted` | Disgusted | wrinkled nose, curled upper lip, narrowed eyes, contempt |
| `seductive` | Seductive | half-lidded eyes, slow smile, parted lips, smoldering gaze |
| `happy` | Happy | bright smile, teeth showing, eyes curved with joy, genuine laughter |

> **Versión 1 tenía:** neutral, angry, sad, surprised, determined, scared, smug, happy, wounded
> **Cambios v2:** `scared`→`fearful`, `smug`→`seductive`, se eliminaron `wounded`/`menacing`/`pain`, se agregó `disgusted`

---

## FaceDetailer — parámetros

| Parámetro | Valor | Regla |
|---|---|---|
| `cfg` | **4.0** | NUNCA subir — cfg>4.5 cambia tono de piel |
| `denoise` | **0.45** | Rango seguro: 0.40–0.50. Fuera del rango: pierde identidad o no cambia expresión |
| `steps` | 20 | Suficiente para inpainting facial |
| `guide_size` | 768 | Resolución del crop facial |
| `bbox_crop_factor` | 3 | Área de contexto alrededor de la cara |
| `noise_mask_feather` | 20 | Suaviza bordes del inpaint |
| `force_inpaint` | true | Fuerza inpainting aunque la detección sea imperfecta |
| `sampler` | dpmpp_2m karras | Consistente con retrato base |

---

## Estructura del prompt de expresión

```
score_9, score_8_up, score_8, masterpiece, best quality, [SKIN_TONE], human woman, BREAK, [expression_tags], expressive eyes, perfect face, 748cmstyle, usnr
```

### Anclas obligatorias (ANTES del BREAK)
- `[SKIN_TONE]` — tono de piel explícito (ver tabla abajo)
- `human woman` — SIEMPRE, independientemente de la raza

> Sin anclas: el FaceDetailer elige tono de piel aleatoriamente en cada generación.

### Tabla RACE → SKIN_TONE

| Raza | SKIN_TONE |
|---|---|
| tiefling | `pale skin` |
| drow | `dark grey skin` |
| half-orc | `olive skin` |
| human, elf, half-elf, dwarf, gnome, halfling, halfling | `fair skin` |
| dragonborn, draconido | `fair skin` |

---

## Negative de expresión

```
score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo
```
Agregar exclusiones específicas por expresión (ej: `angry, happy, sad` en neutral; `neutral expression` en expresiones activas).

---

## Node graph — Flujo 2 en `geminiImageService.ts` y `generate-expressions.js`

```
'1'  CheckpointLoaderSimple  perfectdeliberate_v8
'2'  LoraLoader              748cmSDXL 0.50
'3'  LoraLoader              thiccwithaq 0.70
'4'  LoraLoader              USNR 0.60
'5'  LoraLoader              Detailer_NoobAI 0.50   ← NUEVO en v2
'6'  CLIPSetLastLayer        clip from ['5',1]
'7'  CLIPTextEncode          positive, clip from ['6',0]
'8'  LoadImage               retrato base subido
'9'  UltralyticsDetector     face_yolov8n.pt
'10' CLIPTextEncode          negative, clip from ['6',0]
'11' FaceDetailer            model from ['5',0] | cfg=4.0 | denoise=0.45
'12' SaveImage               images from ['11',0]   ← leer de entry.outputs['12']
```

---

## Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| Tono de piel cambia | Falta ancla de piel en positivo | Agregar `[SKIN_TONE], human woman` antes del BREAK |
| Parece otro personaje | `denoise` muy alto | Bajar a 0.40 |
| Expresión no se nota | `denoise` muy bajo | Subir a 0.50 |
| Cara deformada | `cfg` muy alto | Mantener `cfg=4.0` |
| YOLO no detecta cara | Cara pequeña o en sombra | El retrato base necesita cara grande y bien iluminada |
| Marcas en la frente | Tags eldritch/arcane sin negativo | Agregar `no face markings, forehead mark` al negativo |

---

## Puntos de entrada en código

| Función | Archivo |
|---|---|
| `generateCharacterExpressions()` | `src/services/geminiImageService.ts` |
| `buildExpressionWorkflow()` | `src/services/geminiImageService.ts` |
| `buildExpressionPrompt()` | `src/services/geminiImageService.ts` |
| `EXPRESSION_PRESETS` | `src/services/geminiImageService.ts` |
| CLI batch | `scripts/generate-expressions.js` |
| Pool completa | `scripts/generate-pool.js` |
