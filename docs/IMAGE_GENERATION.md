# Sistema de Generación de Imágenes — TORRE

> **Archivo de referencia** para entender cómo funciona el pipeline completo de generación de retratos y expresiones de personajes en TORRE.  
> Cualquier propuesta de cambio debe partir de aquí.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Arquitectura del pipeline](#2-arquitectura-del-pipeline)
3. [Archivo principal](#3-archivo-principal)
4. [ComfyUI: configuración de conexión](#4-comfyui-configuración-de-conexión)
5. [Flujo 1 — Retrato base](#5-flujo-1--retrato-base)
6. [Flujo 2 — Variantes de expresión](#6-flujo-2--variantes-de-expresión)
7. [Construcción de prompts](#7-construcción-de-prompts)
8. [Persistencia en el store](#8-persistencia-en-el-store)
9. [Puntos de entrada en UI](#9-puntos-de-entrada-en-ui)
10. [Limitaciones actuales y mejoras propuestas](#10-limitaciones-actuales-y-mejoras-propuestas)

---

## 1. Visión general

TORRE genera imágenes de personajes (retratos y expresiones) de forma **offline-first**, enviando workflows a un servidor [ComfyUI](https://github.com/comfyanonymous/ComfyUI) local en la red del usuario. **No hay llamadas a APIs externas de pago.**

```
App React Native
    │
    ├─ generateCharacterPortrait()  ──► ComfyUI (workflow retrato base)
    │                                       │
    │                                       └─► imagen PNG → base64 en Zustand/SQLite
    │
    └─ generateCharacterExpressions() ──► ComfyUI (workflow img2img × 9 expresiones)
                                              │
                                              └─► 9 variantes base64 en Zustand/SQLite
```

---

## 2. Arquitectura del pipeline

```
CharacterPortraitInput
    │
    ├─► buildCharacterPrompt()
    │       └─ positive + negative text
    │
    ├─► buildWorkflow()
    │       └─ JSON workflow ComfyUI (txt2img + hires-fix)
    │
    └─► queuePrompt()  →  pollHistory()  →  fetchImageAsBase64()
            │                                      │
            └──────── uploadImageToComfy() ◄────── │  (solo para expresiones)
                            │
                        buildExpressionWorkflow()  (img2img × 9 expresiones)
```

---

## 3. Archivo principal

Toda la lógica reside en un único servicio:

```
src/services/geminiImageService.ts
```

> El nombre es histórico (fue inicialmente un servicio Gemini). Hoy es 100% ComfyUI.

### Símbolos exportados públicamente

| Símbolo | Tipo | Descripción |
|---|---|---|
| `CharacterPortraitInput` | `type` | Input mínimo para generar un retrato |
| `generateCharacterPortrait` | `async function` | Genera el retrato base txt2img |
| `generateCharacterExpressions` | `async function` | Genera 9 variantes de expresión img2img |

---

## 4. ComfyUI: configuración de conexión

```ts
// Detecta plataforma automáticamente:
// Android emulator → 10.0.2.2
// iOS / dispositivo físico → 192.168.0.17
const COMFY_HOST      = Platform.OS === 'android' ? '10.0.2.2' : '192.168.0.17';
const COMFY_BASE_URL  = `http://${COMFY_HOST}:8089`;
const COMFY_CLIENT_ID = 'torre-rn-client';

const POLL_INTERVAL_MS  = 2000;   // polling cada 2 segundos
const POLL_MAX_ATTEMPTS = 150;    // timeout máximo = 5 minutos
```

### Endpoints utilizados

| Endpoint | Método | Uso |
|---|---|---|
| `POST /prompt` | POST | Encola un workflow |
| `GET /history/{promptId}` | GET | Consulta si terminó |
| `GET /view?filename&subfolder&type=output` | GET | Descarga la imagen |
| `POST /upload/image` | POST | Sube el retrato base para img2img |

---

## 5. Flujo 1 — Retrato base

**Función:** `generateCharacterPortrait(char: CharacterPortraitInput): Promise<string>`

### Pasos

```
1. buildCharacterPrompt(char)       → { positive, negative }
2. seed = random uint32
3. buildWorkflow(positive, negative, seed)
4. queuePrompt(workflow)            → promptId
5. pollHistory(promptId)            → entry (pooling cada 2s, max 5min)
6. entry.outputs['17'].images[0]    → { filename, subfolder }
7. fetchImageAsBase64(filename)     → data URI base64
```

### Nodo de salida esperado: `"17"` (SaveImage)

### Modelo y pipeline (buildWorkflow)

```
Nodo 1  CheckpointLoaderSimple  perfectdeliberate_v8.safetensors
Nodo 2  LoraLoader              748cmSDXL.safetensors            (0.5 / 0.5)
Nodo 3  LoraLoader              thiccwithaq-artist-richy-v1_ixl  (0.7 / 0.7)
Nodo 4  LoraLoader              USNR_STYLE_ILL_V1_lokr3-000024   (0.6 / 0.6)
Nodo 5  CLIPSetLastLayer        stop_at_clip_layer: -2
Nodo 6  CLIPTextEncode          → positive
Nodo 7  CLIPTextEncode          → negative
Nodo 8  EmptyLatentImage        832×1216, batch 1
Nodo 9  KSampler (base)         38 steps, CFG 4.0, dpmpp_2m karras, denoise 1.0
Nodo 10 VAEDecode
Nodo 11 UpscaleModelLoader      remacri_original.safetensors
Nodo 12 ImageUpscaleWithModel
Nodo 13 ImageScale              1248×1824, lanczos
Nodo 14 VAEEncode
Nodo 15 KSampler (hires)        20 steps, CFG 4.0, dpmpp_2m karras, denoise 0.55
Nodo 16 VAEDecode
Nodo 17 SaveImage               prefix: "dnd3-portrait"
```

**Resolución final:** 1248×1824 px (proporción 2:3).

---

## 6. Flujo 2 — Variantes de expresión

**Función:** `generateCharacterExpressions(char, portraitBase64): Promise<Record<string, string>>`

### Pasos

```
1. uploadImageToComfy(portraitBase64)    → uploadedFilename (en servidor ComfyUI)
2. Para cada expresión en EXPRESSION_PRESETS (9 total):
   a. buildExpressionPrompt(char, tokens) → { positive, negative }
   b. seed = random uint32
   c. buildExpressionWorkflow(positive, negative, seed, uploadedFilename)
   d. queuePrompt(workflow)              → promptId
   e. pollHistory(promptId)              → entry
   f. entry.outputs['12'].images[0]      → { filename, subfolder }
   g. fetchImageAsBase64(filename)       → base64
3. Retorna Record<expressionKey, base64>
```

### Nodo de salida esperado: `"12"` (SaveImage)

### Pipeline img2img (buildExpressionWorkflow)

```
Nodo 1   CheckpointLoaderSimple  perfectdeliberate_v8.safetensors
Nodo 2-4 LoraLoader × 3         (idéntico al flujo base)
Nodo 5   CLIPSetLastLayer        stop_at_clip_layer: -2
Nodo 6   CLIPTextEncode          → positive
Nodo 7   CLIPTextEncode          → negative
Nodo 8   LoadImage               uploadedFilename  ← retrato base como input
Nodo 9   VAEEncode
Nodo 10  KSampler                20 steps, CFG 4.0, dpmpp_2m karras, denoise 0.35
Nodo 11  VAEDecode
Nodo 12  SaveImage               prefix: "dnd3-expression"
```

> **denoise 0.35** — valor bajo para preservar identidad del personaje mientras cambia la expresión.

### Expresiones disponibles: `EXPRESSION_PRESETS`

| Clave | Descripción visual |
|---|---|
| `neutral` | Cara calmada, expresión relajada |
| `angry` | Dientes apretados, cejas fruncidas, furia de batalla |
| `sad` | Lágrimas, ojos caídos, mentón tembloroso |
| `surprised` | Ojos bien abiertos, boca abierta, shock |
| `determined` | Ojos enfocados, mandíbula firme, intensidad |
| `scared` | Ojos aterrados, sudor frío, labios temblorosos |
| `smug` | Ojos a media asta, sonrisa torcida, arrogancia |
| `happy` | Sonrisa genuina, ojos brillantes |
| `wounded` | Expresión de dolor, dientes apretados, agotamiento |

---

## 7. Construcción de prompts

### `buildCharacterPrompt(char)` → retrato base

Combina 8 fuentes de tokens:

```
1. Quality tokens          score_9, masterpiece, best quality...
2. "BREAK"                 separador semántico para ControlNet / SDXL
3. RACE_VISUAL[race]       descripción física de la raza
4. (subclass +) CLASS_VISUAL[charClass]  equipamiento y armas de la clase
5. BACKGROUND_VISUAL[background]         ropa y accesorios del background
6. ALIGNMENT_EXPRESSION[alignment]       tipo de expresión facial
7. STAT_FLAVOR[top stat]                 flavor físico del stat más alto
8. STAT_FLAVOR[2nd stat]                 flavor físico del segundo stat
9. Framing tokens          "cowboy shot, from head to knees, 3/4 body visible..."
10. LoRA triggers          "usnr, 748cmstyle"
```

#### Lookup tables disponibles

**`RACE_VISUAL`** — Descriptores físicos por raza:

| Raza | Token principal |
|---|---|
| `dragonborn` / `draconido` | humanoid body, human face, reptilian scale texture, slit pupils, small curved horns |
| `dwarf` | stocky powerful build, braided hair, wide shoulders |
| `elf` | long pointed ears, ethereal graceful, lithe slender |
| `gnome` | tiny stature, large bright eyes, button nose |
| `half-elf` | slightly pointed ears, delicate mixed-heritage |
| `halfling` | very short petite, curly hair, nimble |
| `half-orc` | grey-green skin, lower canines, strong build |
| `human` | human woman |
| `tiefling` | small curved horns, long slender tail, solid-color eyes |

**`CLASS_VISUAL`** — Equipo y armas por clase:

| Clase | Visual |
|---|---|
| `barbarian` | minimal hide armor, brutal weapon, tribal paint |
| `bard` | colorful outfit, lute, decorative cape |
| `cleric` | holy symbol, chainmail or robes, mace, divine glow |
| `druid` | nature robes, carved wooden staff, leaf motifs |
| `fighter` | plate armor, sword & shield, battle-worn |
| `monk` | cloth gi, barefoot, rope belt, fighting stance |
| `paladin` | shining full plate, holy symbol, radiant aura |
| `ranger` | leather armor, longbow, dark travel cloak |
| `rogue` | dark leather, twin daggers, hood or mask |
| `sorcerer` | otherworldly robes, arcane energy, arcane orb |
| `warlock` | dark eldritch robes, pact weapon, shadowy magic |
| `wizard` | arcane robes, spellbook, staff, glowing sigils |

**`BACKGROUND_VISUAL`** — Ropa y actitud por background:

| Background | Visual |
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

**`ALIGNMENT_EXPRESSION`** — Expresión facial base por alineamiento:

| Alineamiento | Expresión |
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

**`STAT_FLAVOR`** — Flavor físico/presencia por stat:

| Stat | Flavor |
|---|---|
| `STR` | powerfully muscular built |
| `DEX` | lithe agile graceful |
| `CON` | hardy sturdy resilient |
| `INT` | sharp intelligent-looking scholarly |
| `WIS` | wise perceptive calm gaze |
| `CHA` | striking charismatic magnetic presence |

#### Negative prompt (buildCharacterPrompt)

```
score_6, score_5, score_4, low quality, worst quality,
[raceNegative — solo dragonborn: dragon head, monster face...],
blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature,
photorealistic, photograph, 3d render, nsfw, multiple people, crowd,
full body shot, full length, head to toe, zoomed out, distant shot,
cut off head, cropped face, bust only, head shot, close-up face only
```

---

### `buildExpressionPrompt(char, expressionTokens)` → variantes

Similar a `buildCharacterPrompt` pero más ligero:
- Misma raza + clase base
- Incluye `expressionTokens` del `EXPRESSION_PRESETS[key]`
- Añade `"same character, same face, same outfit, expression change only"` para anclar identidad

---

## 8. Persistencia en el store

Los resultados se guardan en Zustand (`src/stores/gameStore.ts`) y se persisten en SQLite.

### `saveCharacterPortraits(portraits: Record<string, string>)`
- Recibe `{ "0": base64, "1": base64, ... }` (índice de slot → data URI)
- Hace merge con `activeGame.portraitsJson` existente
- Persiste con `updateSavedGame()`

### `saveCharacterExpressions(expressions: Record<string, Record<string, string>>)`
- Recibe `{ "0": { neutral: base64, angry: base64, ... }, ... }`
- Deep merge por índice de personaje: preserva expresiones existentes al actualizar batch parcial
- Persiste con `updateSavedGame()`

---

## 9. Puntos de entrada en UI

### A) Launch desde PartyScreen — `handleLaunch` (src/screens/PartyScreen.tsx)

Se ejecuta al presionar "Lanzar partida". Flujo:

```
1. Si hay personajes sin retrato → muestra modal de confirmación
2. Hace startNewGame() en el store
3. Loop 1: genera retratos base para personajes SIN portrait
   └─ por cada uno, genera también las 9 expresiones (no-blocking)
4. Loop 2: genera expresiones para personajes que YA tenían portrait
5. saveCharacterPortraits() con los retratos nuevos
6. navigation.reset → VillageScreen
```

### B) Botón manual — `handleGeneratePortrait` (src/hooks/usePartyRoster.ts)

Se ejecuta en la pantalla de creación de party al presionar el botón de retrato individual.

```
1. Límite: MAX_PORTRAIT_ROLLS intentos por personaje
2. generateCharacterPortrait(char)         → uri base64
3. saveCharacterPortraits({ [slot]: uri })
4. generateCharacterExpressions(char, uri) → expressions (no-blocking)
5. saveCharacterExpressions({ [slot]: expressions })
```

---

## 10. Limitaciones actuales y mejoras propuestas

### Limitaciones conocidas

| # | Problema | Impacto |
|---|---|---|
| L1 | **Sin soporte de sexo/género** — `CharacterPortraitInput` no tiene campo `sex`. Todos los personajes generan siempre `1girl, sole_girl` y `woman` en la raza. | Máquinas siempre generan mujeres |
| L2 | **ComfyUI host hardcodeado** — `192.168.0.17` es una IP local fija | No funciona fuera de la red del desarrollador |
| L3 | **Las 9 expresiones son secuenciales** — Se generan una a una, no en paralelo | Lento: ~9 × ~30s = ~4-5 min por personaje |
| L4 | **Sin caché de workflows** — Cada llamada reconstruye el JSON del workflow | Overhead menor pero evitable |
| L5 | **Sin retry en expresiones fallidas** — Si una expresión falla, se omite silenciosamente | Personajes con expresiones incompletas |
| L6 | **base64 en SQLite** — Las imágenes se guardan como data URIs en la base de datos | Base de datos crece mucho con party grande |

### Mejoras propuestas

#### P1 — Soporte de sexo (fácil, alto impacto)
```ts
// Agregar a CharacterPortraitInput:
sex: 'female' | 'male';

// En buildCharacterPrompt:
const genderToken = char.sex === 'male' ? '1boy, solo' : '1girl, sole_girl';
const raceVisual   = RACE_VISUAL[char.race]?.[char.sex] ?? fallback;
```

#### P2 — IP configurable vía env/config (fácil)
```ts
// En .env o src/constants/config.ts:
COMFY_HOST = process.env.COMFY_HOST ?? '192.168.0.17';
```

#### P3 — Generación paralela de expresiones (medio, alto impacto)
```ts
// En generateCharacterExpressions():
const results = await Promise.allSettled(
  Object.entries(EXPRESSION_PRESETS).map(([key, tokens]) =>
    generateSingleExpression(char, uploadedFilename, key, tokens)
  )
);
```
> ⚠️ Requiere que ComfyUI tenga queue capacity para múltiples jobs simultáneos.

#### P4 — Guardar imágenes en filesystem (medio, impacto en DB size)
Usar `react-native-fs` o `expo-file-system` para guardar las imágenes como archivos PNG y solo almacenar la ruta en SQLite.

#### P5 — Seed determinista (fácil)
Usar el `seedHash` del juego + `characterName` para derivar un seed, produciendo el mismo retrato si se regenera.
```ts
const seed = hashToU32(seedHash + char.name);
```

---

## Ejemplo de prompt completo

**Personaje:** Tiefling Warlock (Pact of the Chain), background Criminal, alineamiento Chaotic Neutral, stats CHA 18 / DEX 14.

### Positive
```
score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres,
BREAK,
1girl, sole_girl, tiefling woman, small curved horns on forehead, long slender tail, solid-color eyes,
pact-of-the-chain warlock, dark eldritch robes, pact weapon, occult runes and symbols, shadowy void magic,
rough dark street clothing, concealed blades, weathered street-worn look,
unpredictable carefree independent smirk,
striking charismatic magnetic presence,
lithe agile graceful,
cowboy shot, from head to knees, 3/4 body visible, dynamic confident pose, outfit and weapon clearly shown,
perfect face, detailed face, expressive eyes, dramatic cinematic lighting,
dark fantasy RPG, concept art, highly detailed fantasy illustration,
dark atmosphere, gothic background, volumetric lighting,
usnr, 748cmstyle
```

### Negative
```
score_6, score_5, score_4, low quality, worst quality,
blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature,
photorealistic, photograph, 3d render, nsfw, multiple people, crowd,
full body shot, full length, head to toe, zoomed out, distant shot,
cut off head, cropped face, bust only, head shot, close-up face only
```
