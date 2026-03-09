# Sistema de Generación de Imágenes — TORRE
**Documento unificado** · ComfyUI · SDXL · LoRA Stack · React Native

> Fusión de `IMAGE_GENERATION.md` y `guia-prompts-personajes-dnd.md`.  
> **Fuente de verdad única.** Cualquier cambio al pipeline parte de aquí.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Arquitectura del pipeline](#2-arquitectura-del-pipeline)
3. [Archivo principal del servicio](#3-archivo-principal-del-servicio)
4. [ComfyUI — configuración de conexión](#4-comfyui--configuración-de-conexión)
5. [Regla fundamental — sin saltos de línea](#5-regla-fundamental--sin-saltos-de-línea)
6. [Anatomía del prompt positivo](#6-anatomía-del-prompt-positivo)
7. [Prompt negativo](#7-prompt-negativo)
8. [Lookup tables](#8-lookup-tables)
9. [Flujo 1 — Retrato base](#9-flujo-1--retrato-base)
10. [Flujo 2 — Variantes de expresión](#10-flujo-2--variantes-de-expresión)
11. [Flujo 3 — Poses con carácter](#11-flujo-3--poses-con-carácter)
12. [Stack de LoRAs y parámetros técnicos](#12-stack-de-loras-y-parámetros-técnicos)
13. [Peso de imágenes y compresión](#13-peso-de-imágenes-y-compresión)
14. [Persistencia en el store](#14-persistencia-en-el-store)
15. [Puntos de entrada en UI](#15-puntos-de-entrada-en-ui)
16. [Checklist antes de generar](#16-checklist-antes-de-generar)
17. [Troubleshooting](#17-troubleshooting)
18. [Limitaciones conocidas y mejoras propuestas](#18-limitaciones-conocidas-y-mejoras-propuestas)

---

## 1. Visión general

TORRE genera imágenes de personajes de forma **offline-first**, enviando workflows a un servidor ComfyUI local en la red del usuario. No hay llamadas a APIs externas de pago.

```
App React Native
    │
    ├─ generateCharacterPortrait()   ──► ComfyUI (Flujo 1 — retrato base txt2img + hires)
    │                                        └─► PNG → compresión JPEG q88 → base64 → SQLite
    │
    ├─ generateCharacterExpressions() ──► ComfyUI (Flujo 2 — img2img × 9 expresiones)
    │                                        └─► 9 variantes → compresión → SQLite
    │
    └─ generateCharacterPose()  [NUEVO] ──► ComfyUI (Flujo 3 — pose con carácter)
                                             └─► PNG → compresión JPEG q88 → base64 → SQLite
```

### Filosofía visual

| Flujo | Foco principal | Foco secundario |
|---|---|---|
| Retrato base | **Rostro** — conexión emocional, debe ser grande y detallado | Clase y equipo |
| Expresiones | **Rostro** — estado emocional puntual, inpainting sobre retrato base | Misma expresión |
| Poses | **Rostro visible + cuerpo** — el jugador se enamora del personaje, no solo del físico | Silueta y actitud |

> **Regla del rostro:** En los tres flujos el rostro debe ser **siempre visible, bien iluminado y sin oclusiones**. El flujo de inpainting trabaja sobre el rostro — necesita cara grande, margen limpio y sin pelo tapando los ojos. En pantalla de teléfono, un rostro pequeño impide distinguir variaciones de expresión.

> **Línea seductivo/SFW:** El personaje sabe que es atractivo pero está pensando en otra cosa. La tensión viene del carácter, no de un ángulo diseñado para mostrar el cuerpo.

---

## 2. Arquitectura del pipeline

```
CharacterPortraitInput
    │
    ├─► buildCharacterPrompt()
    │       └─ positive + negative text
    │
    ├─► buildWorkflow()
    │       └─ JSON workflow ComfyUI
    │
    └─► queuePrompt() → pollHistory() → fetchImageAsBase64() → compressToJPEG()
                │                                                      │
                └──── uploadImageToComfy() ◄──────────────────────────┘
                              │                    (solo para expresiones)
                          buildExpressionWorkflow() (img2img × 9)
```

---

## 3. Archivo principal del servicio

```
src/services/geminiImageService.ts
```

> El nombre es histórico (fue inicialmente un servicio Gemini). Hoy es 100% ComfyUI.

| Símbolo | Tipo | Descripción |
|---|---|---|
| `CharacterPortraitInput` | `type` | Input mínimo para generar un retrato |
| `generateCharacterPortrait` | `async function` | Genera el retrato base txt2img |
| `generateCharacterExpressions` | `async function` | Genera 9 variantes de expresión img2img |
| `generateCharacterPose` | `async function` | Genera pose con carácter (Flujo 3) — **NUEVO** |

---

## 4. ComfyUI — configuración de conexión

```ts
const COMFY_HOST      = Platform.OS === 'android' ? '10.0.2.2' : '192.168.0.17';
const COMFY_BASE_URL  = `http://${COMFY_HOST}:8089`;
const COMFY_CLIENT_ID = 'torre-rn-client';

const POLL_INTERVAL_MS  = 2000;
const POLL_MAX_ATTEMPTS = 150;   // timeout máximo = 5 minutos
```

| Endpoint | Método | Uso |
|---|---|---|
| `POST /prompt` | POST | Encola un workflow |
| `GET /history/{promptId}` | GET | Consulta si terminó |
| `GET /view?filename&subfolder&type=output` | GET | Descarga la imagen |
| `POST /upload/image` | POST | Sube el retrato base para img2img |

---

## 5. Regla fundamental — sin saltos de línea

> ⚠️ **NUNCA uses `Enter` dentro del prompt.**

Los campos Positive y Negative de ComfyUI son **una sola línea continua**. Para separar bloques usa `BREAK,` (mayúsculas, con coma).

| ❌ Incorrecto | ✅ Correcto |
|---|---|
| `score_9, masterpiece,` *(Enter)* `1girl, tiefling` | `score_9, masterpiece, BREAK, 1girl, tiefling` |

---

## 6. Anatomía del prompt positivo

```
[Bloque 1 — Calidad]  BREAK,  [Bloque 2 — Personaje]  BREAK,  [Bloque 3 — Composición]  BREAK,  [Bloque 4 — Estilo]
```

El **Bloque 2** cambia por personaje. El **Bloque 3** cambia por flujo. Los Bloques 1 y 4 son fijos.

---

### Bloque 1 — Calidad `FIJO`

```
score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres, BREAK,
```

---

### Bloque 2 — Identidad del personaje `CAMBIAR POR PERSONAJE`

Se construye desde `buildCharacterPrompt()` combinando las lookup tables:

```
1girl, sole_girl, [RACE_VISUAL], [ATRIBUTOS_FÍSICOS], [OUTFIT_CLASE], [BACKGROUND_VISUAL], [ALIGNMENT_EXPRESSION], [STAT_FLAVOR_1], [STAT_FLAVOR_2], BREAK,
```

> **`[ATRIBUTOS_FÍSICOS]`** es un campo nuevo obligatorio para Flujos 1 y 3. Define proporciones y nivel de piel expuesta. Ver tabla abajo.

#### `ATRIBUTOS_FÍSICOS` — proporciones y ropa gastada

| Nivel | Tags | Uso |
|---|---|---|
| **Base** | `large breasts, wide hips, hourglass figure, curvy toned body` | Todas las clases |
| **Ropa gastada** | `torn worn [MATERIAL] clothing, exposed collarbone, slight cleavage, weathered ripped fabric, bare shoulders` | Reemplaza `[MATERIAL]` con `leather / cloth / robe` según la clase |
| **Detalle de piel** | `eldritch rune tattoos on skin` / `battle scars on skin` / `tribal markings on skin` | Justifica piel expuesta con lore |

#### `OUTFIT_CLASE` — reemplaza CLASS_VISUAL en Flujo 3

Para el Flujo 3 (poses), el outfit base de CLASS_VISUAL se reemplaza con versión que muestra silueta:

| Clase | OUTFIT_CLASE para Flujo 3 |
|---|---|
| `warlock` | `form-fitting dark corset top, tight dark pants, dark flowing open coat, bare shoulders, eldritch rune accessories` |
| `rogue` | `form-fitting dark leather vest, tight leather pants, open jacket, bare midriff, daggers at belt` |
| `ranger` | `form-fitting leather scout top, tight leather leggings, open travel cloak, bare arms` |
| `barbarian` | `minimal fur-trimmed top, tight war pants, worn hide armor pieces, bare midriff` |
| `bard` | `fitted performer corset, tight colorful pants, open decorative cape, bare shoulders` |
| `sorcerer` | `form-fitting arcane top, tight otherworldly pants, open arcane coat, bare collarbone` |
| `paladin` | `fitted half-plate chest, tight dark pants, open cloak, bare arms` |
| `wizard` | `fitted arcane corset, tight scholarly pants, open robe coat, bare collarbone, ink-stained skin` |
| `fighter` | `form-fitting battle top, tight armored pants, open coat, bare arms, battle-worn` |
| `druid` | `fitted nature top, tight leaf-woven leggings, open nature cloak, bare midriff` |
| `monk` | `fitted cloth top, tight training pants, open gi jacket, bare midriff` |
| `cleric` | `fitted holy vestment top, tight divine pants, open sacred coat, bare shoulders` |

---

### Bloque 3 — Composición `VARÍA POR FLUJO`

#### Flujo 1 — Retrato base

```
cowboy shot, face large and prominent, face in upper third of image, face fills upper frame, head and shoulders clearly visible, looking at viewer, 3/4 angle slight side view, upper body visible to waist, slight lean forward pose, face fully visible no obstruction, no hair over eyes, expressive detailed eyes, dramatic close-medium shot, BREAK,
```

> `face large and prominent` + `face in upper third` — doble ancla para garantizar cara grande en pantalla de teléfono. El flujo de inpainting de expresiones necesita este margen.

#### Flujo 2 — Expresiones (img2img)

Mismo Bloque 3 que Flujo 1. El inpainting trabaja sobre el rostro ya generado.

#### Flujo 3 — Poses con carácter

```
[POSE_TAG], three-quarter view, from hips up, torso shot, face and chest prominent, face in upper half of frame, looking at viewer, smoldering confident gaze, slight smirk, alluring magnetic presence, feminine silhouette, curves visible, [ENTORNO_TAG], BREAK,
```

> **Encuadre:** De justo debajo de la cadera hacia arriba. Ni retrato cerrado ni cuerpo completo. La cara ocupa el tercio superior naturalmente, las curvas del torso son visibles sin necesidad de mostrar piernas completas.
>
> **El outfit en Bloque 2 es crítico.** `dark eldritch robes` genera túnica que tapa la silueta. Siempre definir outfit explícito con silueta visible: `form-fitting dark corset top, tight dark pants, dark open coat, bare shoulders`.

---

### Bloque 4 — Iluminación y estilo `FIJO`

```
perfect face, highly detailed face, detailed, sharp defined facial features, sharp nose bridge, defined cheekbones, detailed lips, detailed eyelids, detailed iris texture, crisp clean lineart on face, no soft face, no blurry face, clean bare face, no face markings, no face tattoos, no face jewelry, no forehead mark, no forehead gem, face fully visible no hair over eyes, clean face edges, cinematic portrait lighting, rim light on face, soft key light on skin, face illuminated, dark fantasy RPG character portrait, concept art, highly detailed fantasy illustration, dark atmosphere, blurred background, bokeh depth of field, subject sharp foreground, usnr, 748cmstyle
```

> ⚠️ **Regla de ornamentos faciales:** Los tags `eldritch`, `warlock`, `shadowy magic`, `arcane` en el Bloque 2 tienen una asociación fuerte con marcas faciales en el training data de fantasy art. El modelo las genera casi siempre si no se bloquean explícitamente. `clean bare face, no face markings, no forehead mark` en el Bloque 4 y el negativo son los únicos frenos confiables.
>
> **Los accesorios mágicos van SOLO en la ropa**, nunca en la piel ni en la cara:
> - ✅ `eldritch rune accessories on clothing`
> - ✅ `arcane symbols embroidered on coat`
> - ❌ `eldritch rune tattoos on skin` — siempre genera marcas en cara o brazos visibles
> - ❌ `arcane markings` — el modelo los pone en la frente

| Trigger word | LoRA |
|---|---|
| `usnr` | `USNR_STYLE_ILL_V1_lokr3-000024` |
| `748cmstyle` | `748cmSDXL` |
| `detailed` | `Detailer_NoobAI_Incrs_v1` |
| *(sin trigger)* | `thiccwithaq` — activa por peso |

---

## 7. Prompt negativo

### Flujos 1 y 2 — Retrato y expresiones

```
score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, extra limbs, missing fingers, fused fingers, watermark, text, logo, signature, photorealistic, photograph, 3d render, explicit nudity, genitals, nipples, multiple people, crowd, cleavage, deep cleavage, bare chest, topless, strapless, off shoulder, excessive skin, bare midriff, bare abdomen, full body shot, zoomed out, distant shot, cut off head, cropped face, face far away, small face, face secondary, face in shadow, dark face, obscured eyes, hair over eyes, face tattoo, face markings, face paint, face jewelry, nose ring, face piercing, forehead gem, forehead mark, forehead tattoo, forehead symbol, facial runes, facial ornaments, skin markings, skin tattoos, flat chest, shapeless body, soft face, blurry face, flat face, undefined features, painterly face, ugly, poorly drawn
```

### Flujo 3 — Poses

```
score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, bad hands, poorly drawn hands, extra limbs, missing fingers, fused fingers, watermark, text, logo, signature, photorealistic, photograph, 3d render, explicit nudity, genitals, nipples, multiple people, crowd, long robes, floor length dress, covering robe, shapeless clothing, baggy clothes, flat chest, shapeless body, modest clothing, fully covered, portrait only, close-up face, face dominant, crouching, squatting, sitting curled up, knees blocking body, full body to feet, t-pose, standing straight stiff, face hidden, face small, face far away, face in shadow, dark face, obscured eyes, hair over eyes, face tattoo, face markings, face paint, face jewelry, forehead gem, forehead mark, forehead tattoo, forehead symbol, facial runes, facial ornaments, skin markings, ugly, poorly drawn, barefoot, sandals, shoes
```

---

## 8. Lookup tables

### RACE_VISUAL

> **Regla crítica:** Nunca usar el nombre de la raza como token directo (ej: `tiefling`, `orc`, `elf`). El modelo fantasy art los interpreta como conceptos visuales extremos — piel verde, piel roja, aspecto demoníaco — y borra la apariencia humanoide. En cambio, siempre usar `human woman` + los rasgos físicos específicos que definen la raza.

**Estructura:**
```
human woman, [TONO_PIEL], [RASGO_RACIAL_1], [RASGO_RACIAL_2], [RASGO_RACIAL_3]
```

| Raza D&D | Token completo para el prompt |
|---|---|
| `human` | `human woman, [TONO_PIEL]` |
| `tiefling` | `human woman, [TONO_PIEL], small curved black horns on forehead, long slender pointed tail, solid glowing [COLOR] eyes, slightly pointed ears` |
| `elf` | `human woman, [TONO_PIEL], long elegant pointed ears, ethereal refined features, delicate bone structure` |
| `half-elf` | `human woman, [TONO_PIEL], slightly pointed ears, delicate mixed features` |
| `drow` | `human woman, dark grey skin, white silver hair, long elegant pointed ears, bright [COLOR] eyes` |
| `half-orc` | `human woman, [TONO_PIEL], slightly green-tinted complexion, strong jaw, subtle lower canines, powerful build` |
| `aasimar` | `human woman, [TONO_PIEL], faint golden glow on skin, luminous [COLOR] eyes, small feathered wings optional` |
| `dragonborn` | `human woman, [TONO_PIEL], subtle reptilian scale pattern on neck and shoulders, slit pupils, small curved horns` |
| `gnome` | `human woman, [TONO_PIEL], petite delicate stature, large bright eyes, small upturned nose` |
| `halfling` | `human woman, [TONO_PIEL], petite short stature, curly hair, small nimble frame` |
| `dwarf` | `human woman, [TONO_PIEL], stocky sturdy build, braided hair, wide shoulders` |

**TONO_PIEL — valores recomendados:**

| Token | Resultado |
|---|---|
| `pale skin` | Piel muy clara, dramática — ideal warlock, necromancer |
| `fair skin` | Piel clara natural |
| `light skin` | Piel clara cálida |
| `olive skin` | Piel mediterránea |
| `tan skin` | Piel bronceada |
| `brown skin` | Piel morena |
| `dark skin` | Piel oscura |

> ⚠️ Sin `[TONO_PIEL]` el modelo elige aleatoriamente — puede quedar rojo, verde o azul según el contexto fantasy. Siempre especificarlo.

### CLASS_VISUAL

| Clase | Token |
|---|---|
| `barbarian` | minimal hide armor, brutal weapon, tribal paint |
| `bard` | colorful outfit, lute, decorative cape |
| `cleric` | holy symbol, chainmail or robes, mace, divine glow |
| `druid` | nature robes, carved wooden staff, leaf motifs |
| `fighter` | plate armor, sword and shield, battle-worn |
| `monk` | cloth gi, barefoot, rope belt, fighting stance |
| `paladin` | shining full plate, holy symbol, radiant aura |
| `ranger` | leather armor, longbow, dark travel cloak |
| `rogue` | dark leather, twin daggers, hood or mask |
| `sorcerer` | otherworldly robes, arcane energy, arcane orb |
| `warlock` | dark eldritch robes, pact weapon, shadowy magic |
| `wizard` | arcane robes, spellbook, staff, glowing sigils |

### BACKGROUND_VISUAL

| Background | Token |
|---|---|
| `acolyte` | temple robes, holy symbol, devoted expression |
| `charlatan` | flashy disguise, wry smile |
| `criminal` | dark street clothing, concealed blades |
| `entertainer` | theatrical costume, stage makeup |
| `folk-hero` | simple peasant clothing, determined look |
| `guild-artisan` | craftsperson attire, artisan tools |
| `hermit` | simple meditation robes, serene expression |
| `noble` | fine embroidered clothing, signet ring |
| `outlander` | primitive outdoor clothing, animal pelts |
| `sage` | ink-stained robes, quill |
| `sailor` | weathered sea clothing, wind-worn |
| `soldier` | military gear, disciplined bearing |
| `urchin` | ragged clothing, street-survivor look |

### ALIGNMENT_EXPRESSION

| Alineamiento | Token |
|---|---|
| `lawful-good` | noble confident heroic expression |
| `neutral-good` | kind warm compassionate smile |
| `chaotic-good` | wild free-spirited brave grin |
| `lawful-neutral` | stoic disciplined determined expression |
| `neutral` | calm balanced composed neutral |
| `chaotic-neutral` | unpredictable carefree independent smirk |
| `lawful-evil` | cold calculating ruthless expression |
| `neutral-evil` | sinister cunning ambitious smirk |
| `chaotic-evil` | wild unhinged menacing snarl |

### STAT_FLAVOR

| Stat | Token |
|---|---|
| `STR` | powerfully muscular built |
| `DEX` | lithe agile graceful |
| `CON` | hardy sturdy resilient |
| `INT` | sharp intelligent-looking scholarly |
| `WIS` | wise perceptive calm gaze |
| `CHA` | striking charismatic magnetic presence |

### EXPRESSION_PRESETS (Flujo 2)

| Clave | Tokens de expresión |
|---|---|
| `neutral` | calm relaxed expression, soft gaze |
| `angry` | clenched teeth, furrowed brows, battle rage |
| `sad` | tears, downcast eyes, trembling chin |
| `surprised` | wide open eyes, open mouth, shock |
| `determined` | focused eyes, firm jaw, intensity |
| `scared` | terrified eyes, cold sweat, trembling lips |
| `smug` | half-lidded eyes, crooked smile, arrogance |
| `happy` | genuine smile, bright eyes |
| `wounded` | pain expression, clenched teeth, exhaustion |

### POSE_TAG (Flujo 3)

> Todas las poses son **paradas o apoyadas** — nunca agachadas o sentadas en el suelo. Las poses bajas hacen la cara pequeña y tapan la silueta.

| POSE_TAG | Energía | Mejor con |
|---|---|---|
| `leaning against wall, one knee slightly bent, hip shifted` | Confianza, presencia | Warlock, Rogue |
| `arms loosely crossed under chest, slight lean forward` | Poder, actitud | Barbarian, Fighter |
| `hand resting on hip, weight on one leg, contrapposto` | Seducción natural | Bard, Sorcerer |
| `leaning on surface with one arm, turned slightly` | Casual, magnética | Rogue, Ranger |
| `hand raised touching wall or surface, head tilted` | Intensa, misteriosa | Warlock, Wizard |
| `arms at sides, chest forward, chin slightly up` | Dominante, segura | Paladin, Fighter |

---

### Pool de variación — ángulos, encuadres e iluminación

Combinar **un tag de cada columna** para crear variaciones distintas entre generaciones del mismo personaje.

#### ANGLE_TAG — ángulo de cámara

| Tag | Efecto visual |
|---|---|
| `3/4 angle slight side view` | Estándar — muestra profundidad y silueta |
| `slight low angle looking up` | Hace al personaje imponente y dominante |
| `slight high angle looking down` | Más íntimo, cara más grande en frame |
| `front facing straight on` | Directo, confrontacional |
| `side profile 90 degrees` | Dramático, resalta silueta y jawline |

#### FRAME_TAG — encuadre

| Tag | Qué incluye | Uso |
|---|---|---|
| `cowboy shot` | Cabeza hasta media muslo | Flujo 1 — retrato principal |
| `from hips up, torso shot` | Caderas hacia arriba | Flujo 3 — poses |
| `bust shot, chest and face` | Busto y cara, muy cercano | Alternativa retrato íntimo |
| `medium shot, head to knees` | Cabeza hasta rodillas | Flujo 3 alternativo cuerpo completo |
| `close-up face and shoulders` | Solo cara y hombros | Flujo 2 — expresiones |

#### LIGHT_TAG — iluminación dramática

| Tag | Efecto | Ambiente |
|---|---|---|
| `rim light on face, soft key light on skin` | Estándar del sistema | Todos |
| `dramatic side lighting, half face in shadow` | Misterioso, villano | Warlock, Rogue |
| `warm golden candlelight from below, face lit` | Íntimo, cálido | Bard, Cleric |
| `cold blue moonlight, sharp shadows` | Frío, sobrenatural | Ranger, Druid |
| `arcane glowing light from hands, face lit green` | Mágico, inquietante | Wizard, Sorcerer |
| `harsh red backlight, face softly lit front` | Peligroso, épico | Barbarian, Warlock |
| `volumetric god rays from above, divine` | Heroico, divino | Paladin, Cleric |

#### Ejemplos de combinaciones

| Personaje | ANGLE_TAG | FRAME_TAG | LIGHT_TAG |
|---|---|---|---|
| Tiefling Warlock (dominante) | `slight low angle looking up` | `from hips up, torso shot` | `harsh red backlight, face softly lit front` |
| Wood Elf Ranger (misteriosa) | `3/4 angle slight side view` | `cowboy shot` | `cold blue moonlight, sharp shadows` |
| Human Rogue (íntima) | `slight high angle looking down` | `bust shot, chest and face` | `dramatic side lighting, half face in shadow` |
| Halfling Bard (carismática) | `front facing straight on` | `medium shot, head to knees` | `warm golden candlelight from below, face lit` |

### ACCION_TAG (Flujo 3)

| ACCION_TAG | Clase ideal |
|---|---|
| `checking arrow fletching, focused gaze` | Ranger |
| `reading a glowing spell scroll` | Wizard, Warlock |
| `sharpening blade quietly, not looking up` | Rogue, Fighter |
| `listening to distant sounds, head slightly tilted` | Druid, Ranger |
| `fastening armor straps, mid-preparation` | Paladin, Barbarian |
| `counting gold coins from a pouch, slight smirk` | Rogue, Bard |
| `channeling arcane energy, hand glowing` | Sorcerer, Warlock |

### ENTORNO_TAG (Flujo 3)

| ENTORNO_TAG | Lore |
|---|---|
| `dark fantasy tavern interior background` | Rogue, Bard |
| `gothic dungeon stone wall background` | Warlock, Necromancer |
| `forest clearing dappled light background` | Ranger, Druid |
| `royal throne room marble floor background` | Paladin, Sorcerer |
| `arcane library bookshelf background` | Wizard, Artificer |
| `gladiator arena sand floor background` | Barbarian, Fighter |

---

## 9. Flujo 1 — Retrato base

**Función:** `generateCharacterPortrait(char: CharacterPortraitInput): Promise<string>`

```
1. buildCharacterPrompt(char)       → { positive, negative }
2. seed = random uint32
3. buildWorkflow(positive, negative, seed)
4. queuePrompt(workflow)            → promptId
5. pollHistory(promptId)            → entry (cada 2s, max 5min)
6. entry.outputs['17'].images[0]    → { filename, subfolder }
7. fetchImageAsBase64(filename)     → raw base64
8. compressToJPEG(raw, 0.88)        → data:image/jpeg;base64,...  ← NUEVO
```

### Nodo de salida: `"17"` (SaveImage)

### Pipeline buildWorkflow

```
Nodo 1   CheckpointLoaderSimple   perfectdeliberate_v8.safetensors
Nodo 2   LoraLoader               748cmSDXL.safetensors            (0.50 / 0.50)
Nodo 3   LoraLoader               thiccwithaq-artist-richy-v1_ixl  (0.70 / 0.70)
Nodo 4   LoraLoader               USNR_STYLE_ILL_V1_lokr3-000024   (0.60 / 0.60)
Nodo 5   CLIPSetLastLayer         stop_at_clip_layer: -2
Nodo 6   CLIPTextEncode           → positive
Nodo 7   CLIPTextEncode           → negative
Nodo 8   EmptyLatentImage         832×1216, batch 1
Nodo 9   KSampler (base)          38 steps, CFG 4.0, dpmpp_2m karras, denoise 1.0  [INAMOVIBLE]
Nodo 10  VAEDecodeTiled           tile=512, overlap=32
Nodo 11  UpscaleModelLoader       remacri_original.safetensors
Nodo 12  ImageUpscaleWithModel
Nodo 13  ImageScale               1248×1824, lanczos
Nodo 14  VAEEncodeTiled           tile=512, overlap=32
Nodo 15  KSampler (hires)         20 steps, CFG 4.0, dpmpp_2m karras, denoise 0.55  [INAMOVIBLE]
Nodo 16  VAEDecodeTiled           tile=512, overlap=32
Nodo 17  SaveImage                prefix: "dnd3-portrait"
```

**Resolución final:** 1248×1824 px

---

## 10. Flujo 2 — Variantes de expresión

**Función:** `generateCharacterExpressions(char, portraitBase64): Promise<Record<string, string>>`

```
1. uploadImageToComfy(portraitBase64)    → uploadedFilename
2. Para cada expresión en EXPRESSION_PRESETS (9 total):
   a. buildExpressionPrompt(char, tokens) → { positive, negative }
   b. seed = random uint32
   c. buildExpressionWorkflow(positive, negative, seed, uploadedFilename)
   d. queuePrompt()  → pollHistory()  → fetchImageAsBase64()
   e. compressToJPEG(raw, 0.88)           → base64
3. Retorna Record<expressionKey, base64>
```

### Nodo de salida: `"12"` (SaveImage)

### Pipeline buildExpressionWorkflow (img2img)

```
Nodo 1   CheckpointLoaderSimple   perfectdeliberate_v8.safetensors
Nodo 2-4 LoraLoader × 3          idéntico al Flujo 1
Nodo 5   CLIPSetLastLayer         stop_at_clip_layer: -2
Nodo 6   CLIPTextEncode           → positive (con expressionTokens + "same character, same face, same outfit, expression change only")
Nodo 7   CLIPTextEncode           → negative
Nodo 8   LoadImage                uploadedFilename ← retrato base como input
Nodo 9   VAEEncode
Nodo 10  KSampler                 20 steps, CFG 4.0, dpmpp_2m karras, denoise 0.35  [INAMOVIBLE]
Nodo 11  VAEDecode
Nodo 12  SaveImage                prefix: "dnd3-expression"
```

> `denoise 0.35` — valor bajo para preservar identidad del personaje mientras cambia la expresión.

---

## 11. Flujo 3 — Poses con carácter

**Función:** `generateCharacterPose(char, poseTag, accionTag, entornoTag): Promise<string>`

```
1. buildCharacterPrompt(char) con Bloque 3 de poses
2. seed = random uint32
3. buildPoseWorkflow(positive, negative, seed)
4. queuePrompt()  → pollHistory()
5. entry.outputs['17'].images[0]
6. fetchImageAsBase64() → compressToJPEG(raw, 0.88)
```

### Nodo de salida: `"17"` (SaveImage)

### Pipeline buildPoseWorkflow

```
Nodo 1   CheckpointLoaderSimple   perfectdeliberate_v8.safetensors
Nodo 2   LoraLoader               748cmSDXL.safetensors            (0.50 / 0.50)
Nodo 3   LoraLoader               thiccwithaq-artist-richy-v1_ixl  (0.75 / 0.75)  ← sube a 0.75
Nodo 4   LoraLoader               USNR_STYLE_ILL_V1_lokr3-000024   (0.60 / 0.60)
Nodo 5   CLIPSetLastLayer         stop_at_clip_layer: -2
Nodo 6   CLIPTextEncode           → positive (Bloque 3 de poses)
Nodo 7   CLIPTextEncode           → negative (negativo de poses)
Nodo 8   EmptyLatentImage         832×1216, batch 1
Nodo 9   KSampler (base)          38 steps, CFG 4.0, dpmpp_2m karras, denoise 1.0  [INAMOVIBLE]
Nodo 10  VAEDecodeTiled           tile=512, overlap=32
Nodo 11  UpscaleModelLoader       remacri_original.safetensors
Nodo 12  ImageUpscaleWithModel
Nodo 13  ImageScale               1248×1824, lanczos
Nodo 14  VAEEncodeTiled           tile=512, overlap=32
Nodo 15  KSampler (hires)         20 steps, CFG 4.0, dpmpp_2m karras, denoise 0.55  [INAMOVIBLE]
Nodo 16  VAEDecodeTiled           tile=512, overlap=32
Nodo 17  SaveImage                prefix: "dnd_pose"
```

> `thiccwithaq` sube a `0.75` en poses para forzar que el modelo genere torso completo con proporciones correctas.
>
> **Outfit en Bloque 2 para Flujo 3:** No usar `dark eldritch robes` — genera túnica larga que tapa la silueta. Reemplazar siempre con outfit definido: `form-fitting dark corset top, tight dark pants, dark open coat, bare shoulders`.

---

## 12. Stack de LoRAs y parámetros técnicos

### LoRAs — orden obligatorio

| # | Archivo | Flujo 1 | Flujo 2 | Flujo 3 | Función |
|---|---|---|---|---|---|
| 1° | `748cmSDXL.safetensors` | `0.50/0.50` | `0.50/0.50` | `0.50/0.50` | Estilo artístico, paleta |
| 2° | `thiccwithaq-artist-richy-v1_ixl.safetensors` | **`0.55/0.55`** | `0.70/0.70` | **`0.75/0.75`** | Proporciones — peso distinto por flujo |
| 3° | `USNR_STYLE_ILL_V1_lokr3-000024.safetensors` | `0.60/0.60` | `0.60/0.60` | `0.60/0.60` | Líneas y shading |
| 4° | `Detailer_NoobAI_Incrs_v1.safetensors` | `0.50/0.50` | `0.50/0.50` | `0.40/0.40` | Detalle facial — **NUEVO** |

> **Por qué `thiccwithaq` varía por flujo:** En Flujo 1 a `0.70+` la LoRA pelea contra los tags de cara y gana — el cuerpo domina el frame. Bajarlo a `0.55` en retratos permite que `face dominant composition` funcione correctamente.
>
> **Detailer NoobAI Incrs v1:** entrenado sobre Illustrious XL (mismo base que `perfectdeliberate_v8`). Se activa con el trigger word `detailed` ya presente en el Bloque 4. No tiene trigger word adicional. Peso `0.50` en retratos, `0.40` en poses para no sobrecargar el stack existente.

#### LoRA a descargar
> **Nombre:** Detailer NoobAI Incrs v1  
> **Archivo:** `Detailer_NoobAI_Incrs_v1.safetensors`  
> **Destino:** `ComfyUI/models/loras/`  
> **Trigger word:** `detailed` (ya está en el Bloque 4 fijo)

---

### Reglas de atributos físicos — cómo exagerar sin desnudar

El objetivo es que los atributos sean visibles y llamativos a través de la ropa, no por ausencia de ropa.

| Atributo | Tags que funcionan | Tags a evitar |
|---|---|---|
| **Busto** | `large breasts, form-fitting top, visible bust shape` | `cleavage, bare chest, topless, strapless` |
| **Caderas** | `wide hips, hip-hugging pants, curvy hips visible through clothing` | `exposed hips, bikini bottom` |
| **Cintura** | `hourglass figure, belted waist, corseted silhouette` | `bare midriff` (genera ombligo expuesto siempre) |
| **Silueta** | `curvy silhouette, form-fitting outfit, feminine figure emphasized` | `baggy, shapeless, covering robe` |
| **Piel permitida** | `bare shoulders, exposed collarbone, bare arms` | `bare torso, exposed abdomen, low cut` |

> **Regla general:** Los atributos se exageran en el Bloque 2. La ropa los contiene pero no los oculta. El negativo bloquea los términos que hacen que el modelo genere piel en exceso.

**Template de ATRIBUTOS_FÍSICOS recomendado:**
```
large breasts, wide hips, hourglass figure, curvy toned body, visible bust shape, corseted silhouette
```

**Outfit base para Flujo 1 (cerrado pero con forma):**
```
high collar dark eldritch jacket fitted at waist, hip-hugging dark pants, form-fitting closed front, bare shoulders
```

### Parámetros de nodos

| Nodo | Parámetro | Flujo 1/3 | Flujo 2 | Notas |
|---|---|---|---|---|
| EmptyLatentImage | width × height | 832×1216 | — (usa LoadImage) | |
| EmptyLatentImage | batch_size | 1 | — | |
| KSampler 1 | steps | 38 | 20 | **INAMOVIBLE** |
| KSampler 1 | CFG | 4.0 | 4.0 | **INAMOVIBLE — no subir de 5.5** |
| KSampler 1 | denoise | 1.0 | 0.35 | |
| KSampler 2 (hires) | steps | 20 | — | **INAMOVIBLE** |
| KSampler 2 (hires) | CFG | 4.0 | — | |
| KSampler 2 (hires) | denoise | 0.55 | — | No subir — redibuja la composición |
| VAETiled (todos) | tile_size | 512 | 512 | Obligatorio para 8GB VRAM |
| VAETiled (todos) | overlap | 32 | 32 | Optimizado desde 64 — ahorra ~9s |
| ImageScale | width × height | 1248×1824 | — | |

> ⚠️ `CFG 4.0` es crítico. `perfectdeliberate_v8` fue entrenado para CFG 4.0-5.0. Con CFG > 5.5 aparecen dientes mal dibujados, dedos fusionados y ojos asimétricos.

---

## 13. Peso de imágenes y compresión

### El problema

ComfyUI guarda las imágenes como PNG (~3-5 MB). Guardadas como base64 en SQLite, una party de 4 personajes con 9 expresiones cada uno puede pesar **~180 MB solo en la DB**.

### La solución — compresión en `fetchImageAsBase64()`

La compresión ocurre en la app, justo después de descargar la imagen y **antes** de guardarla en el store. No requiere plugins en ComfyUI.

```ts
// src/services/geminiImageService.ts
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

async function fetchImageAsBase64(filename: string, subfolder: string): Promise<string> {
  const url = `${COMFY_BASE_URL}/view?filename=${filename}&subfolder=${subfolder}&type=output`;
  
  // 1. Descargar PNG a archivo temporal
  const tempUri = FileSystem.cacheDirectory + filename;
  await FileSystem.downloadAsync(url, tempUri);
  
  // 2. Comprimir a JPEG q88
  const compressed = await manipulateAsync(
    tempUri,
    [],
    { compress: 0.88, format: SaveFormat.JPEG }
  );
  
  // 3. Leer como base64
  const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  // 4. Limpiar temporales
  await FileSystem.deleteAsync(tempUri, { idempotent: true });
  await FileSystem.deleteAsync(compressed.uri, { idempotent: true });
  
  return `data:image/jpeg;base64,${base64}`;
}
```

### ¿Por qué JPEG y no WebP?

| Formato | iOS < 14 | iOS 14+ | Android | Peso (~1248×1824) |
|---|---|---|---|---|
| PNG | ✅ | ✅ | ✅ | ~3.5 MB |
| WebP | ❌ falla silencioso | ✅ | ✅ | ~0.45 MB |
| **JPEG q88** | **✅** | **✅** | **✅** | **~0.50 MB** |

JPEG q88 es compatible universalmente. Para ilustraciones con fondos oscuros y bokeh, el banding de JPEG es imperceptible.

### Reducción estimada de la DB

| Escenario | Sin compresión | Con JPEG q88 | Reducción |
|---|---|---|---|
| 1 personaje (retrato + 9 expr.) | ~40 MB | ~5 MB | -87% |
| 4 personajes completos | ~160 MB | ~20 MB | -87% |

### Dependencia a instalar

```bash
npx expo install expo-image-manipulator expo-file-system
```

---

## 14. Persistencia en el store

Los resultados se guardan en Zustand (`src/stores/gameStore.ts`) y se persisten en SQLite.

### `saveCharacterPortraits(portraits: Record<string, string>)`
- Recibe `{ "0": base64, "1": base64, ... }` (índice de slot → data URI JPEG)
- Merge con `activeGame.portraitsJson` existente
- Persiste con `updateSavedGame()`

### `saveCharacterExpressions(expressions: Record<string, Record<string, string>>)`
- Recibe `{ "0": { neutral: base64, angry: base64, ... }, ... }`
- Deep merge por índice — preserva expresiones existentes al actualizar batch parcial
- Persiste con `updateSavedGame()`

---

## 15. Puntos de entrada en UI

### A) Launch desde PartyScreen — `handleLaunch`

```
1. Si hay personajes sin retrato → modal de confirmación
2. startNewGame() en el store
3. Loop 1: genera retratos base para personajes SIN portrait
   └─ por cada uno, genera también las 9 expresiones (non-blocking)
4. Loop 2: genera expresiones para personajes que YA tenían portrait
5. saveCharacterPortraits() con los retratos nuevos
6. navigation.reset → VillageScreen
```

### B) Botón manual — `handleGeneratePortrait`

```
1. Límite: MAX_PORTRAIT_ROLLS intentos por personaje
2. generateCharacterPortrait(char)         → uri JPEG base64
3. saveCharacterPortraits({ [slot]: uri })
4. generateCharacterExpressions(char, uri) → expressions (non-blocking)
5. saveCharacterExpressions({ [slot]: expressions })
```

---

## 16. Checklist antes de generar

### Flujo 1 — Retrato base
- [ ] Prompt en una sola línea (sin Enter, solo `BREAK,`)
- [ ] LoRA 748cmSDXL: `0.50`
- [ ] LoRA thiccwithaq: `0.70`
- [ ] LoRA USNR: `0.60`
- [ ] EmptyLatentImage: `832 × 1216`
- [ ] KSampler 1: `38 steps`, `CFG 4.0`, `denoise 1.0`
- [ ] KSampler 2: `20 steps`, `CFG 4.0`, `denoise 0.55`
- [ ] VAETiled: `overlap = 32` en todos los nodos
- [ ] ImageScale: `1248 × 1824`
- [ ] Bloque 3 con `face large and prominent`, `face in upper third`

### Flujo 2 — Expresiones
- [ ] `same character, same face, same outfit, expression change only` en prompt
- [ ] KSampler: `20 steps`, `CFG 4.0`, `denoise 0.35`
- [ ] Nodo de salida: `"12"`

### Flujo 3 — Poses
- [ ] LoRA thiccwithaq: `0.75` (no 0.70)
- [ ] `POSE_TAG` de la tabla — no repetir para el mismo personaje
- [ ] `ACCION_TAG` coherente con la clase
- [ ] `ENTORNO_TAG` coherente con el lore
- [ ] Bloque 3 de poses (no el de retratos)
- [ ] Negativo específico de poses
- [ ] `face large and visible`, `face in upper third` presentes en Bloque 3
- [ ] KSampler 2: `20 steps`, `denoise 0.55`
- [ ] VAETiled: `overlap = 32`

---

## 17. Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| **Imagen negra** | OOM en VAE normal | Usar VAEDecodeTiled / VAEEncodeTiled con `tile=512` |
| **Dientes/manos deformados** | CFG muy alto | `CFG = 4.0` — nunca subir de 5.5 |
| **Rostro pequeño en teléfono** | Bloque 3 sin anclas de cara | Verificar `face large and prominent` + `face in upper third` |
| **Hires-fix destruye composición** | Denoise muy alto | `denoise 0.55` flujo 1/3 — `denoise 0.35` flujo 2 |
| **Flujo 3 demasiado inocente** | Falta `smoldering gaze`, `slight smirk` | Verificar Bloque 3 de poses completo |
| **Expresiones no preservan identidad** | Denoise muy alto en flujo 2 | `denoise = 0.35` inamovible |
| **Pelo tapando ojos** | Falta tag | `face fully visible no hair over eyes` en Bloque 4 |
| **Ornamento/marca en el rostro** | `eldritch`/`warlock`/`arcane` generan marcas faciales automáticamente | Ver regla Bloque 4 — usar negativo completo con `forehead mark, forehead gem, face tattoo, facial runes` |
| **Rostro opaco/flat** | Detailer muy bajo | Subir Detailer a `0.70` nodo 5 — agregar tags de definición en Bloque 4 |
| **Tono de piel incorrecto (rojo/verde)** | Nombre de raza como token directo | Nunca usar `tiefling`, `orc` — usar `human woman, [TONO_PIEL]` + rasgos físicos individuales |
| **Cuerpo domina el frame en Flujo 1** | `thiccwithaq` demasiado alto | Bajar a `0.55` en Flujo 1 — solo subir a `0.75` en Flujo 3 |
| **JPEG no carga en React Native** | Prefijo incorrecto | `data:image/jpeg;base64,` — no `data:image/png` |
| **expo-image-manipulator no encontrado** | No instalado | `npx expo install expo-image-manipulator expo-file-system` |
| **OOM en generación** | VAE normal activo | Verificar nodos Tiled activos en los 3 puntos del pipeline |

---

## 18. Limitaciones conocidas y mejoras propuestas

| # | Problema | Impacto | Estado |
|---|---|---|---|
| L1 | **Sin soporte sexo/género** — siempre genera `1girl, sole_girl` | Todos los personajes son mujeres | Abierto |
| L2 | **ComfyUI host hardcodeado** — `192.168.0.17` | No funciona fuera de la red del dev | Abierto |
| L3 | **9 expresiones secuenciales** — ~9 × 30s = ~4-5 min por personaje | Lento | Abierto |
| L4 | **Sin caché de workflows** — reconstruye JSON en cada llamada | Overhead menor | Abierto |
| L5 | **Sin retry en expresiones fallidas** — error silencioso | Expresiones incompletas | Abierto |
| L6 | **base64 PNG en SQLite** — sin compresión | DB muy grande | **Resuelto** — JPEG q88 en `fetchImageAsBase64()` |

### P1 — Soporte de sexo (fácil, alto impacto)
```ts
sex: 'female' | 'male';
const genderToken = char.sex === 'male' ? '1boy, solo' : '1girl, sole_girl';
```

### P2 — IP configurable (fácil)
```ts
COMFY_HOST = process.env.COMFY_HOST ?? '192.168.0.17';
```

### P3 — Expresiones paralelas (medio, alto impacto)
```ts
const results = await Promise.allSettled(
  Object.entries(EXPRESSION_PRESETS).map(([key, tokens]) =>
    generateSingleExpression(char, uploadedFilename, key, tokens)
  )
);
```
> ⚠️ Requiere que ComfyUI tenga queue capacity para múltiples jobs simultáneos.

### P4 — Filesystem en lugar de SQLite para imágenes (medio)
```ts
// Guardar en filesystem, solo la ruta en SQLite
import * as FileSystem from 'expo-file-system';
const path = `${FileSystem.documentDirectory}portraits/${char.id}.jpg`;
await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
// En SQLite: guardar path, no base64
```

### P5 — Seed determinista (fácil)
```ts
const seed = hashToU32(seedHash + char.name);
// Mismo personaje → mismo retrato al regenerar
```

---

## Ejemplo de prompt completo — listo para copiar

**Personaje:** Tiefling Warlock (Pact of the Chain) · Background Criminal · Alineamiento Chaotic Neutral · Stats CHA 18 / DEX 14

### POSITIVE — Flujo 1 (Retrato base) ✅ confirmado
```
score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres, BREAK, 1girl, sole_girl, human woman, pale skin, small curved black horns on forehead, long slender pointed tail, solid glowing red eyes, slightly pointed ears, dark warlock, large breasts, wide hips, hourglass figure, curvy toned body, visible bust shape, corseted silhouette, high collar dark eldritch jacket fitted at waist, hip-hugging dark pants, form-fitting closed front, bare shoulders, eldritch rune accessories on clothing, shadowy void magic aura, unpredictable carefree independent smirk, striking charismatic magnetic presence, BREAK, eye level, tight cowboy shot, face dominant composition, face fills upper half of frame, chin slightly down, face toward viewer, eyes to camera, looking at viewer, 3/4 angle slight side view, head and upper chest visible, slight lean forward pose, face fully visible no obstruction, no hair over eyes, expressive detailed eyes, BREAK, perfect face, highly detailed face, detailed, sharp defined facial features, sharp nose bridge, defined cheekbones, detailed lips, detailed eyelids, detailed iris texture, crisp clean lineart on face, no soft face, no blurry face, clean bare face, no face markings, no face tattoos, no face jewelry, no forehead mark, no forehead gem, face fully visible no hair over eyes, clean face edges, cinematic portrait lighting, rim light on face, soft key light on skin, face illuminated, dark fantasy RPG character portrait, concept art, highly detailed fantasy illustration, dark atmosphere, blurred gothic background, bokeh depth of field, subject sharp foreground, usnr, 748cmstyle
```

### NEGATIVE — Flujo 1 ✅ confirmado
```
score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, extra limbs, missing fingers, fused fingers, watermark, text, logo, signature, photorealistic, photograph, 3d render, explicit nudity, genitals, nipples, multiple people, crowd, cleavage, deep cleavage, bare chest, topless, strapless, off shoulder, excessive skin, bare midriff, bare abdomen, full body shot, zoomed out, distant shot, cut off head, cropped face, face far away, small face, face secondary, face in shadow, dark face, obscured eyes, hair over eyes, face tattoo, face markings, face paint, face jewelry, nose ring, face piercing, forehead gem, forehead mark, forehead tattoo, forehead symbol, facial runes, facial ornaments, skin markings, skin tattoos, flat chest, shapeless body, soft face, blurry face, flat face, undefined features, painterly face, ugly, poorly drawn
```

### POSITIVE — Flujo 3 (Pose) ✅ confirmado
```
score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres, BREAK, 1girl, sole_girl, human woman, pale skin, small curved black horns on forehead, long slender pointed tail, solid glowing red eyes, slightly pointed ears, dark warlock, large breasts, wide hips, hourglass figure, curvy toned body, visible bust shape, corseted silhouette, form-fitting dark corset top, tight dark pants, dark flowing open coat, bare shoulders, eldritch rune accessories on clothing, shadowy void magic aura, unpredictable carefree independent smirk, striking charismatic magnetic presence, BREAK, leaning against stone wall, one knee slightly bent, hip shifted, arms loosely at sides, three-quarter view, from hips up, torso shot, face and chest prominent, face in upper half of frame, looking at viewer, smoldering confident gaze, slight smirk, alluring magnetic presence, feminine silhouette, curves visible, gothic dungeon stone wall background, BREAK, perfect face, highly detailed face, detailed, sharp defined facial features, sharp nose bridge, defined cheekbones, detailed lips, detailed eyelids, detailed iris texture, crisp clean lineart on face, no soft face, no blurry face, clean bare face, no face markings, no face tattoos, no face jewelry, no forehead mark, no forehead gem, face fully visible no hair over eyes, clean face edges, cinematic portrait lighting, rim light on face, soft key light on skin, face illuminated, dark fantasy RPG character portrait, concept art, highly detailed fantasy illustration, dark atmosphere, blurred background, bokeh depth of field, subject sharp foreground, usnr, 748cmstyle
```

### NEGATIVE — Flujo 3 ✅ confirmado
```
score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, bad hands, poorly drawn hands, extra limbs, missing fingers, fused fingers, watermark, text, logo, signature, photorealistic, photograph, 3d render, explicit nudity, genitals, nipples, multiple people, crowd, long robes, floor length dress, covering robe, shapeless clothing, baggy clothes, flat chest, shapeless body, modest clothing, fully covered, portrait only, close-up face, face dominant, crouching, squatting, sitting curled up, knees blocking body, full body to feet, t-pose, standing straight stiff, face hidden, face small, face far away, face in shadow, dark face, obscured eyes, hair over eyes, face tattoo, face markings, face paint, face jewelry, forehead gem, forehead mark, forehead tattoo, forehead symbol, facial runes, facial ornaments, skin markings, ugly, poorly drawn, barefoot, sandals, shoes
```

---

*Documento interno — TORRE · Sistema de generación IA · v10*
