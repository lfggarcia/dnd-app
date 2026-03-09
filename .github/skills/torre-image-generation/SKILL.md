# Skill: torre-image-generation

**Cargar cuando:** Se trabaje con generación de retratos ComfyUI, pipelines de imágenes, prompts de personajes, o el servicio `geminiImageService.ts`.

**Docs de referencia:**
- Spec completa: `docs/IMAGE_GENERATION_v10.md`
- Expresiones: `docs/EXPRESSIONS_v1.md`

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `src/services/geminiImageService.ts` | Pipeline runtime (React Native) |
| `scripts/generate-characters.js` | Batch generación de retratos (Node) |
| `scripts/generate-expressions.js` | Batch generación de expresiones (Node) |
| `scripts/generate-pool.js` | Pool de fichas completas (portrait + 9 expresiones) |
| `scripts/comfyui-workflows/news/02-portadas-hires-v8 (1) (1).json` | Workflow canónico retrato v8 |
| `comfyui api/new/03-expression-*.json` | Workflows canónicos expresiones v2 (9 archivos) |

---

## Stack técnico

### ComfyUI connection
```
Android: http://10.0.2.2:8089
iOS/device: http://192.168.0.17:8089
```

### Checkpoint
`perfectdeliberate_v8.safetensors`

### LoRA stack — Flujo 1 (Portrait v8)
| LoRA | strength_model | strength_clip |
|---|---|---|
| 748cmSDXL.safetensors | 0.50 | 0.50 |
| thiccwithaq-artist-richy-v1_ixl.safetensors | **0.55** | 0.55 |
| USNR_STYLE_ILL_V1_lokr3-000024.safetensors | 0.60 | 0.60 |
| Detailer_NoobAI_Incrs_v1.safetensors | **0.70** | 0.70 |

### LoRA stack — Flujo 2 (Expresiones)
| LoRA | strength_model | strength_clip |
|---|---|---|
| 748cmSDXL.safetensors | 0.50 | 0.50 |
| thiccwithaq-artist-richy-v1_ixl.safetensors | 0.70 | 0.70 |
| USNR_STYLE_ILL_V1_lokr3-000024.safetensors | 0.60 | 0.60 |
| Detailer_NoobAI_Incrs_v1.safetensors | **0.50** | 0.50 |

### KSampler — Portrait base
- steps: **38** (INAMOVIBLE)
- cfg: **4.0**
- sampler: dpmpp_2m karras
- denoise: **1.0**

### KSampler — Portrait hires
- steps: **20** (INAMOVIBLE)
- cfg: **4.0**
- denoise: **0.55**

### Resolución
832×1216 base → upscale remacri 4x → scale lanczos → **1248×1824** final

### VAE tiling
`VAEDecodeTiled` / `VAEEncodeTiled` — tile_size: 512, overlap: 32

---

## Node graph — Flujo 1 (Portrait v8)

| Node | Tipo | Descripción |
|---|---|---|
| 1 | CheckpointLoaderSimple | |
| 2 | LoraLoader | 748cm 0.5 |
| 3 | LoraLoader | thiccwithaq 0.55 |
| 4 | LoraLoader | USNR 0.6 |
| 5 | LoraLoader | Detailer 0.70 |
| 6 | CLIPSetLastLayer | clip from 5 |
| 7 | CLIPTextEncode | positive |
| 8 | CLIPTextEncode | negative |
| 9 | EmptyLatentImage | 832×1216 |
| 10 | KSampler base | model from 5 |
| 11 | VAEDecodeTiled | |
| 12 | UpscaleModelLoader | remacri |
| 13 | ImageUpscaleWithModel | |
| 14 | ImageScale | 1248×1824 lanczos |
| 15 | VAEEncodeTiled | |
| 16 | KSampler hires | model from 5 |
| 17 | VAEDecodeTiled | final |
| **18** | **SaveImage** | **← leer de entry.outputs['18']** |

## Node graph — Flujo 2 (Expresiones FaceDetailer)

| Node | Tipo | Descripción |
|---|---|---|
| 1-5 | Loaders + LoRAs | igual que Flujo 1 |
| 6 | CLIPSetLastLayer | clip from 5 |
| 7 | CLIPTextEncode | positive |
| 8 | LoadImage | retrato base |
| 9 | UltralyticsDetectorProvider | face_yolov8n.pt |
| 10 | CLIPTextEncode | negative |
| 11 | FaceDetailer | cfg=4.0, denoise=0.45 |
| **12** | **SaveImage** | **← leer de entry.outputs['12']** |

---

## Estructura del prompt

```
[Bloque 1] BREAK, [Bloque 2] BREAK, [Bloque 3] BREAK, [Bloque 4]
```

### Bloque 1 (fijo)
```
score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres
```

### Bloque 2 (personaje)
```
1girl, sole_girl, [SKIN_TONE], [RACE_VISUAL], large breasts, wide hips, hourglass figure, curvy toned body, [CLASS_VISUAL], [BACKGROUND_VISUAL], [ALIGNMENT_EXPRESSION], [STAT_FLAVOR_1], [STAT_FLAVOR_2]
```

**RACE_VISUAL rule:** NUNCA usar el nombre de la raza como token. Siempre `human woman` + rasgos físicos específicos.

### Bloque 3 — Flujo 1 (retrato)
```
cowboy shot, face large and prominent, face in upper third of image, face fills upper frame, head and shoulders clearly visible, looking at viewer, 3/4 angle slight side view, upper body visible to waist, slight lean forward pose, face fully visible no obstruction, no hair over eyes, expressive detailed eyes, dramatic close-medium shot
```

### Bloque 4 (fijo — estilo e iluminación)
```
perfect face, highly detailed face, sharp defined facial features, sharp nose bridge, defined cheekbones, detailed lips, detailed eyelids, detailed iris texture, crisp clean lineart on face, no soft face, no blurry face, clean bare face, no face markings, no face tattoos, no face jewelry, no forehead mark, no forehead gem, face fully visible no hair over eyes, clean face edges, cinematic portrait lighting, rim light on face, soft key light on skin, face illuminated, dark fantasy RPG character portrait, concept art, highly detailed fantasy illustration, dark atmosphere, blurred background, bokeh depth of field, subject sharp foreground, usnr, 748cmstyle
```

### Trigger words
- `usnr` → USNR_STYLE_ILL
- `748cmstyle` → 748cmSDXL
- `detailed` → Detailer_NoobAI

---

## Reglas críticas

1. **NUNCA** saltos de línea en prompts — usar `BREAK,` para separar bloques
2. `thiccwithaq` a **0.55** en retratos (0.70 solo para expresiones)
3. `Detailer` a **0.70** en retratos, **0.50** en expresiones
4. **38 steps** base y **0.55 denoise** en hires son INAMOVIBLES
5. VAEDecodeTiled/VAEEncodeTiled obligatorios en retrato (evita VRAM OOM en 1248×1824)
6. Acccesorios mágicos SOLO en ropa — `eldritch rune tattoos on skin` genera marcas faciales

---

## Persistencia
- `useGameStore.saveCharacterPortraits(charId, portraitBase64)`
- `useGameStore.saveCharacterExpressions(charId, expressionsRecord)`
- Compresión JPEG q88 antes de almacenar en SQLite
