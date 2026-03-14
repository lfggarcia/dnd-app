# Sistema de Expresiones — TORRE
**Documento unificado** · ComfyUI · SDXL · Super Workflow · FaceDetailer × 22

> Complemento de `IMAGE_GENERATION_v10.md`.  
> Cubre exclusivamente el **Flujo 2 — Super Workflow de Expresiones** (`SUPER-expressions-all.json`).  
> **Fuente de verdad única** para la generación y el ajuste de expresiones faciales.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Arquitectura del workflow](#2-arquitectura-del-workflow)
3. [Nodos compartidos — base del pipeline](#3-nodos-compartidos--base-del-pipeline)
4. [Stack de LoRAs](#4-stack-de-loras)
5. [Filosofía de prompts de expresión](#5-filosofía-de-prompts-de-expresión)
6. [Estructura de cada expresión](#6-estructura-de-cada-expresión)
7. [Catálogo completo de expresiones](#7-catálogo-completo-de-expresiones)
8. [Parámetros de FaceDetailer por expresión](#8-parámetros-de-facedetailer-por-expresión)
9. [Cómo adaptar el workflow a un personaje nuevo](#9-cómo-adaptar-el-workflow-a-un-personaje-nuevo)
10. [Ejemplo completo — Elfa Ranger](#10-ejemplo-completo--elfa-ranger)
11. [Reglas de escritura de prompts de expresión](#11-reglas-de-escritura-de-prompts-de-expresión)
12. [Checklist antes de ejecutar](#12-checklist-antes-de-ejecutar)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Visión general

El Super Workflow genera las **22 expresiones del sistema en una sola ejecución de ComfyUI**, procesando todos los FaceDetailer en paralelo sobre el mismo retrato base. Tiempo total: ~20 segundos (guide_size=512).

```
Retrato base (PNG del Flujo 1)
    │
    └─► LoadImage (Nodo 10)
            │
            ├─► FaceDetailer × 22 (Nodos 102–182, 186)
            │       ├─ Positive individual por expresión
            │       ├─ Negative individual por expresión
            │       └─ Denoise calibrado por expresión
            │
            └─► SaveImage × 22 → outputs/
```

### Diferencia entre el workflow de 9 y el Super Workflow

| Parámetro | Workflow original (9 expresiones) | Super Workflow (22 expresiones) |
|---|---|---|
| Expresiones | 9 | 22 |
| Tiempo estimado | ~4-5 min secuencial (vía código) | ~20 seg paralelo (ComfyUI nativo) |
| Modo de ejecución | `img2img` encadenado desde código TS | FaceDetailer directo en ComfyUI |
| `guide_size` | 1024 | **512** — más rápido, suficiente para rostro |
| Prompts | Presets en código TS | Prompts embebidos directamente en nodos |
| Denoise estándar | 0.55 | 0.55 – 0.68 según expresión |

> ⚠️ El Super Workflow no requiere código TypeScript para ejecutarse. Se carga directamente en ComfyUI y se ejecuta con Queue Prompt. El único campo que se cambia manualmente es el nombre del archivo de imagen en el Nodo 10.

---

## 2. Arquitectura del workflow

```
[Nodo 1]  CheckpointLoaderSimple — perfectdeliberate_v8.safetensors
    │
    ├─► [Nodo 2]  LoRA 748cmSDXL (0.50)
    │       └─► [Nodo 3]  LoRA thiccwithaq (0.70)
    │               └─► [Nodo 4]  LoRA USNR_STYLE_ILL (0.60)
    │                       └─► [Nodo 5]  LoRA Detailer_NoobAI_Incrs_v1 (0.50)
    │                               └─► [Nodo 6]  LoRA face_enhancer_illustrious (0.45)
    │                                       └─► [Nodo 14] LoRA kaogei expression helper (0.35)
    │                                                │
    │                                                └─► MODEL → FaceDetailer × 22
    │
    └─► CLIP → [Nodo 7] CLIPSetLastLayer (layer -2) → CLIP → CLIPTextEncode × 44
                                                               (22 positivos + 22 negativos)

[Nodo 10] LoadImage (retrato base PNG)  ─────────────────────────► FaceDetailer × 22
[Nodo 11] UltralyticsDetectorProvider (face_yolov8n.pt) ─────────► FaceDetailer × 22
```

### Grupos de nodos por expresión

Cada expresión ocupa exactamente **4 nodos consecutivos**:

| Nodo N | Nodo N+1 | Nodo N+2 | Nodo N+3 |
|---|---|---|---|
| CLIPTextEncode **Positive** | CLIPTextEncode **Negative** | **FaceDetailer** | **SaveImage** |

| Expresión | Nodos |
|---|---|
| angry | 100 – 103 |
| confident | 104 – 107 |
| confused | 108 – 111 |
| despondent | 112 – 115 |
| determined | 116 – 119 |
| disgusted | 120 – 123 |
| fearful | 124 – 127 |
| fierce | 128 – 131 |
| flirty | 132 – 135 |
| happy | 136 – 139 |
| hollow | 140 – 143 |
| incredulous | 144 – 147 |
| neutral | 148 – 151 |
| rage | 152 – 155 |
| sad | 156 – 159 |
| sarcastic | 160 – 163 |
| seductive | 164 – 167 |
| serious | 168 – 171 |
| shocked | 172 – 175 |
| surprised | 176 – 179 |
| tired | 180 – 183 |
| triumph | 184 – 187 |

---

## 3. Nodos compartidos — base del pipeline

Estos nodos son **idénticos para las 22 expresiones**. No se tocan salvo para cambiar el personaje.

### Nodo 1 — Checkpoint

```
ckpt_name: perfectdeliberate_v8.safetensors
```

### Nodo 7 — CLIP Set Last Layer

```
stop_at_clip_layer: -2
```

> Capa -2 estándar del sistema. Cambiarlo rompe la coherencia con los Flujos 1 y 3.

### Nodo 10 — Load Image ⚠️ ÚNICO CAMPO QUE SE CAMBIA POR PERSONAJE

```
image: "dnd_portrait_00001_.png"   ← reemplazar con el nombre exacto del retrato base
```

El archivo debe existir en la carpeta `output` de ComfyUI (donde Flujo 1 lo guarda).

### Nodo 11 — Detector de rostros

```
model_name: bbox/face_yolov8n.pt
```

El detector localiza el bounding box del rostro en el retrato base. FaceDetailer aplica inpainting solo dentro del bbox + dilación. No tocar.

---

## 4. Stack de LoRAs

| Nodo | LoRA | Peso modelo | Peso clip | Rol |
|---|---|---|---|---|
| 2 | `748cmSDXL.safetensors` | 0.50 | 0.50 | Estilo artístico base — trigger: `748cmstyle` |
| 3 | `thiccwithaq-artist-richy-v1_ixl.safetensors` | 0.70 | 0.70 | Proporciones y presencia |
| 4 | `USNR_STYLE_ILL_V1_lokr3-000024.safetensors` | 0.60 | 0.60 | Ilustración estilo USNR — trigger: `usnr` |
| 5 | `Detailer_NoobAI_Incrs_v1.safetensors` | 0.50 | 0.50 | Detalle general — trigger: `detailed` |
| 6 | `face_enhancer_illustrious.safetensors` | 0.45 | 0.45 | Amplificador de expresión facial |
| 14 | `best_facial_expression_helper_xtreme_illu_v1.safetensors` | 0.35 | 0.35 | Geometría de expresión — trigger: `kaogei` |

> **LoRA 6 (face_enhancer):** A 0.45 amplifica la expresión sin exagerar proporciones del rostro. Subir de 0.55 genera deformaciones en expresiones extremas (fierce, rage, shocked).
>
> **LoRA 14 (kaogei):** A 0.35 fuerza la geometría exacta descrita en el prompt. Subir de 0.45 rompe la identidad del personaje — el modelo prioriza la expresión sobre los rasgos del retrato base.

---

## 5. Filosofía de prompts de expresión

### Regla fundamental: geometría, no concepto

Los prompts de expresión describen **posiciones físicas de músculos y geometría de la cara**, no el estado emocional abstracto.

| ❌ Conceptual (débil) | ✅ Anatómico (fuerte) |
|---|---|
| `angry` | `inner brow corners sharply pulled down and together, deep vertical furrow between eyebrows` |
| `surprised` | `both eyes blown wide open into huge perfect circles, eyebrows shooting up arching high` |
| `confused` | `head tilted hard to the left shoulder, LEFT eyebrow arched to maximum, RIGHT eyebrow pulled into frown` |
| `seductive` | `one eye slightly more closed than the other in lazy wink, tip of tongue barely touching upper lip corner` |

### Regla de asimetría

La mayoría de las expresiones genuinas son **asimétricas**. El modelo tiende a simetría — la asimetría debe forzarse explícitamente:

- `LEFT eye wide, RIGHT eye slit` — no `one eye open one eye closed`
- `one corner of mouth pulled up` — no `half smile`
- `one eyebrow raised, other flat and low` — no `asymmetric eyebrows`

### Regla de la boca abierta

Para expresiones con boca abierta usar solo:
- ✅ `jaw dropped naturally`
- ✅ `mouth hanging open`
- ✅ `jaw dropped chin down mouth fully open`
- ❌ `O shape` — genera labios deformados en círculo
- ❌ `square mouth` — genera distorsión geométrica
- ❌ `inside of mouth visible` — genera artefactos dentales

### Tokens de anclaje obligatorios en todos los positivos

```
perfect face, 748cmstyle, usnr, kaogei
```

Estos garantizan que el FaceDetailer mantiene el estilo del retrato base y que el LoRA kaogei activa.

---

## 6. Estructura de cada expresión

Cada expresión tiene el mismo esqueleto de prompt:

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK,
[EYE_COLOR] eyes,
[DESCRIPTOR_ANATÓMICO_1],
[DESCRIPTOR_ANATÓMICO_2],
[DESCRIPTOR_ANATÓMICO_3],
([NOMBRE_EXPRESION] expression:1.15), ([RASGO_1]:1.1), ([RASGO_2]:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, [low res,] blurry face, different person,
[EXPRESIONES_A_BLOQUEAR],
deformed face, distorted face, [melting face,] asymmetrical face, [bad anatomy,]
[face markings, forehead mark,]
deformed lips, distorted lips, deformed mouth, distorted mouth,
toothpick, object in mouth, drool, extra teeth, broken teeth,
melting lips, lip artifact, mouth artifact, asymmetrical lips
```

> **`[EYE_COLOR]`** — placeholder que se reemplaza con el token de ojos del personaje antes de ejecutar. Ver sección 9.
>
> **Negative base siempre incluye:** `different person` — crítico para que FaceDetailer no cambie la identidad. Sin esto, el inpainting puede generar un rostro completamente diferente.

---

## 7. Catálogo completo de expresiones

### angry — Nodos 100-103
**Descripción:** Cólera contenida — ceño fruncido, ojos entrecerrados, mandíbula apretada.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
inner brow corners sharply pulled down and together, deep vertical furrow between eyebrows,
eyes narrowed to slits, jaw clenched, lips pressed tight, face tense,
(angry expression:1.15), (furrowed inner brows:1.1), (narrowed eyes:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, low res, blurry face, different person,
neutral expression, happy, sad, open eyes, raised eyebrows,
disfigured, deformed, deformed face, distorted face, melting face, asymmetrical face, bad anatomy,
face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### confident — Nodos 104-107
**Descripción:** Confianza serena — ojos cerrados con satisfacción, sonrisa suave de quien no necesita demostrarse nada.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
eyes closed serenely with small satisfied smile, eyebrows relaxed and high,
face glowing with inner confidence, small serene smile, supremely self-assured expression,
(confident expression:1.15), (serene smile:1.1), (self-assured face:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
uncertain, sad, angry, open wide eyes, deformed face, distorted face, melting face, asymmetrical face,
face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### confused — Nodos 108-111
**Descripción:** Desconcierto total — cabeza muy ladeada, cejas completamente asimétricas, boca torcida.

> ⚠️ Este prompt **no usa `[EYE_COLOR]`** — tiene el color de ojos hardcodeado. Ver sección 9 para cómo adaptar.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
head tilted hard to the left shoulder, LEFT eyebrow arched to maximum,
RIGHT eyebrow pulled into frown, mouth twisted hard to one side half open with uncertainty,
deep forehead furrow left side only,
(head sharply tilted left:1.15), (extreme asymmetric brows left high right low:1.1), (mouth twisted sideways:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral expression, confident, head straight, symmetrical eyebrows, closed mouth,
deformed face, distorted face, asymmetrical face, face markings, blood, liquid on face,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, pencil in mouth,
object between lips, stick in mouth, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### despondent — Nodos 112-115
**Descripción:** Desesperación a punto de llorar — puchero prominente, cejas internas muy elevadas, ojos brillantes de lágrimas reprimidas.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
lower lip pushed WAY out forming prominent visible pout, inner corners of eyebrows raised steeply creating sad brow angle,
chin slightly dimpled and trembling, cheeks soft and full with pout,
glossy wet eyes from held-back tears,
(prominent visible pout lower lip:1.15), (sad inner brow raised steeply:1.1), (glossy restrained-tears eyes:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
happy, smiling, neutral, angry, flat lips,
deformed face, distorted face, asymmetrical face, face markings, blood, liquid on face,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### determined — Nodos 116-119
**Descripción:** Voluntad de hierro — mirada intensa con ojos entrecerrados, mandíbula firme, labios en línea recta.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
eyes narrowed with intense focused gaze, jaw set firmly forward,
lips pressed into thin straight line, slight flare of nostrils,
brow low and serious, face radiating iron will,
(determined expression:1.15), (intense narrowed gaze:1.1), (set jaw:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, low res, blurry face, different person,
neutral expression, laughing, crying, wide eyes,
disfigured, deformed, deformed face, distorted face, melting face, asymmetrical face, bad anatomy,
face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### disgusted — Nodos 120-123
**Descripción:** Asco genuino — ojos bien abiertos mirando hacia abajo, nariz arrugada con líneas bunny, boca completamente cerrada y tensa.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.  
> ⚠️ **Trampa de latent:** `eyes closed + head tilted back + mouth open` activa conceptos de placer/éxtasis en el espacio latente. Por eso el negativo bloquea explícitamente `eyes closed, head tilted back, pleasure, ecstasy`.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes OPEN staring downward at something repulsive,
eyes wide open directed DOWN with visible disgust in iris,
nose bridge wrinkling with horizontal creases bunny lines,
mouth firmly pressed closed lips tight shut, one cheek raised from nose wrinkle,
eyebrows pulled together and slightly down,
(eyes open staring down disgust:1.15), (nose wrinkled horizontal creases bunny lines:1.1), (mouth firmly closed tight lips:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
eyes closed, eyes half closed, head tilted back, pleasure, ecstasy,
open mouth, parted lips, teeth showing, tongue, sad, crying, pain, neutral, relaxed nose,
deformed face, distorted face, deformed lips, distorted mouth, mouth artifact, lip artifact,
liquid on face, blood on face, face markings
```

---

### fearful — Nodos 124-127
**Descripción:** Terror puro — ojos desorbitados, cejas juntas hacia arriba generando arrugas, boca entreabierta con labio inferior temblando.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
eyes stretched extremely wide whites showing above and below iris,
eyebrows raised and pulled together creating forehead wrinkles,
mouth slightly open, lower lip trembling, face pale and frozen in terror,
(fearful expression:1.15), (extreme wide eyes:1.1), (forehead wrinkles terror:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, low res, blurry face, different person,
neutral expression, calm, happy, closed eyes,
disfigured, deformed, deformed face, distorted face, melting face, asymmetrical face, bad anatomy,
face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### fierce — Nodos 128-131
**Descripción:** Peligro desatado — un ojo al máximo, el otro casi cerrado, grin villana asimétrica con todos los dientes.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.  
> ⚠️ Expresión de alta complejidad — denoise 0.68. Sin la asimetría LEFT/RIGHT explícita el modelo genera expresión neutral o tímida.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
LEFT eye stretched wide open to maximum showing whites all around,
RIGHT eye narrowed to predatory slit almost closed,
wide unhinged villain grin showing all upper AND lower teeth fully,
grin stretching far to both sides of face,
eyebrows pulling in opposite directions left up right down,
face of unhinged dangerous excitement,
(one eye wide one eye slit:1.15), (wide unhinged grin all teeth showing:1.1), (eyebrows extreme asymmetry:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral expression, sad, timid, scared, closed mouth, symmetrical eyes, both eyes same, both eyebrows same, soft expression,
deformed face, distorted face, deformed lips, distorted mouth, liquid on face, blood on face, face markings
```

---

### flirty — Nodos 132-135
**Descripción:** Coqueteo con clase — una ceja arqueada, ojos pesados y cómplices, media sonrisa de boca cerrada con comisura levantada.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
one eyebrow raised high in playful arch, eyes heavy lidded and knowing,
slight closed-mouth smile with one corner lifted into smirk,
lips closed and defined, gentle head tilt, teasing confident expression,
(playful arched eyebrow:1.15), (knowing heavy-lidded eyes:1.1), (one-sided closed smirk:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral, sad, open mouth, teeth showing, tongue, both eyebrows same,
deformed face, distorted face, asymmetrical face, face markings,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### happy — Nodos 136-139
**Descripción:** Alegría genuina — mejillas levantadas, ojos en media luna, sonrisa amplia con dientes superiores visibles.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
cheeks raised and rounded pushing lower eyelids up,
eyes curved into crescents, wide open smile showing upper teeth,
corners of mouth pulled far back and up, face radiant with joy,
(happy expression:1.15), (crescent eyes:1.1), (wide smile:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, low res, blurry face, different person,
neutral expression, sad, angry, closed mouth,
disfigured, deformed, deformed face, distorted face, melting face, asymmetrical face, bad anatomy,
face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### hollow — Nodos 140-143
**Descripción:** Disociación — ojos abiertos pero sin mirada, músculos faciales completamente sueltos, mandíbula caída sin tensión.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes with iris faded and dull,
eyes open but staring through everything unseeing,
pupils slightly dilated not focused on anything,
face muscles completely slack and dropped, jaw hanging slightly open from zero muscle tone,
face like nobody is home,
(unfocused staring-through eyes:1.15), (completely slack dropped face muscles:1.1), (jaw hanging open zero tension:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
emotional expression, focused eyes, alert, angry, happy, tense face, closed mouth, clenched jaw,
deformed face, distorted face, asymmetrical face, face markings, blood, tears, liquid on face,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### incredulous — Nodos 144-147
**Descripción:** Incredulidad extrema — una ceja casi en el nacimiento del pelo, la otra en ceño, ojos asimétricos, comisuras hacia abajo.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
one eyebrow raised to absolute maximum nearly touching hairline,
opposite eyebrow aggressively pulled down in scowl,
eyes wide on raised side, squinted on low side,
mouth corners pulled sharply down, face screaming disbelief,
(extreme asymmetric eyebrows:1.15), (one eyebrow at hairline:1.1), (mouth corners down in disbelief:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral expression, happy, symmetrical eyebrows, both eyebrows same height,
deformed face, distorted face, asymmetrical face, face markings, blood, liquid on face,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### neutral — Nodos 148-151
**Descripción:** Descanso — músculos completamente relajados, mirada directa sin tensión, boca cerrada natural.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
completely relaxed facial muscles, soft steady gaze directly forward,
mouth closed naturally, no tension anywhere in face,
(neutral expression:1.1), (relaxed face:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, low res, blurry face, different person,
angry, happy, sad, smiling, crying,
disfigured, deformed, deformed face, distorted face, melting face, asymmetrical face, bad anatomy,
face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### rage — Nodos 152-155
**Descripción:** Furia máxima — contradicción simultánea: cejas completamente fruncidas hacia adentro **mientras** la boca forma una grin de todos los dientes. Ojos abiertos con venas visibles.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.  
> ⚠️ La clave de esta expresión es la **contradicción interna**: ceños de enojo + grin de dientes al mismo tiempo. Sin los dos elementos el modelo genera `angry` básico.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
mouth stretched into WIDE unhinged grin showing every single tooth upper and lower rows fully bared,
grin so wide it reaches near ears, eyes wide open with veins visible in whites from fury,
eyebrows slanting sharply inward over nose in extreme frown WHILE mouth grins,
face of terrifying unhinged fury-grin contradiction,
(wide unhinged full-teeth fury grin:1.15), (eyes wide with visible veins:1.1), (eyebrows sharply inward in frown:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
calm, neutral, sad, closed mouth, tight lips, snarl only, no smile,
deformed face, distorted face, deformed lips, distorted mouth, liquid on face, blood on face, face markings
```

---

### sad — Nodos 156-159
**Descripción:** Tristeza — comisuras internas de cejas levantadas, labio inferior temblando, ojos brillantes, comisuras de boca hacia abajo.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
inner brow corners pulled upward making arch, lower lip jutting out trembling,
eyes glistening with unshed tears, corners of mouth pulled sharply downward,
face crumpled in sorrow,
(sad expression:1.15), (upward inner brows:1.1), (trembling lower lip:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, low res, blurry face, different person,
neutral expression, happy, smiling,
disfigured, deformed, deformed face, distorted face, melting face, droopy face, asymmetrical face, bad anatomy,
face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### sarcastic — Nodos 160-163
**Descripción:** Desdén y superioridad — media sonrisa burlona unilateral, una ceja levantada lentamente con desprecio, ojos pesados y fríos.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
one corner of mouth pulled up in sharp mocking smirk,
one eyebrow raised slowly in contempt, other eyebrow flat and low,
eyes heavy lidded with disdain, face radiating mockery and superiority,
(sharp unilateral smirk:1.15), (contemptuous raised eyebrow:1.1), (heavy lidded mocking eyes:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral expression, sincere smile, sad, full smile, symmetrical mouth,
blood on face, liquid on face, drool, tears,
deformed face, distorted face, asymmetrical face, face markings,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### seductive — Nodos 164-167
**Descripción:** Seducción deliberada — guiño perezoso asimétrico, punta de lengua rozando la comisura, barbilla baja, ojos mirando hacia arriba entre pestañas.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
one eye slightly more closed than the other in lazy wink,
tip of tongue barely touching upper lip corner,
chin slightly lowered, eyes looking up at viewer through lowered lashes,
slow dangerous smile corner of mouth lifted,
(asymmetric lazy one-eye wink:1.15), (tongue tip touching lip corner:1.1), (looking up through lowered lashes:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral expression, wide open eyes, teeth showing, open mouth wide,
deformed face, distorted face, asymmetrical face, face markings,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips,
both eyes same, no tongue, closed mouth, symmetrical face
```

---

### serious — Nodos 168-171
**Descripción:** Control absoluto — labios en línea recta sin curvatura alguna, ojos directos y fríos, mandíbula firme, ceño ligero.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
lips closed in thin straight neutral line no curve up or down,
slight brow furrow, eyes direct and cold, jaw set firmly,
face composed with zero expression beyond controlled intensity,
(lips in thin flat neutral line:1.15), (cold direct eyes slight furrow:1.1), (jaw firmly set face controlled:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
smiling, happy, open mouth, pouty lips, curved lips, caprichous,
deformed face, distorted face, asymmetrical face, face markings,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### shocked — Nodos 172-175
**Descripción:** Impacto total — ojos en círculos perfectos con blancos visibles en todo el perímetro, cejas disparadas al nacimiento del pelo, mandíbula caída al máximo.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.  
> ⚠️ Expresión de alta complejidad — denoise 0.68.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
eyes blown to maximum perfectly round circles with whites visible fully surrounding small iris in center,
eyebrows shot straight up to absolute hairline,
face frozen completely blank with terror,
mouth hanging all the way open jaw dropped fully chin near chest,
face drained of all color,
(perfectly round wide circle eyes whites all around:1.15), (eyebrows at hairline face blank:1.1), (jaw dropped chin down mouth fully open:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
calm, neutral, half open eyes, closed mouth, teeth showing, tongue, low eyebrows, small mouth opening,
deformed face, distorted face, deformed lips, distorted mouth, liquid on face, blood on face, face markings
```

---

### surprised — Nodos 176-179
**Descripción:** Sorpresa agradable — ojos muy abiertos, cejas arqueadas con frente arrugada, mandíbula caída de forma natural y relajada.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
both eyes blown wide open into huge perfect circles,
eyebrows shooting up arching high above normal position,
forehead creased horizontal from raised eyebrows,
jaw dropped naturally mouth open relaxed,
face expression of pure delighted surprise,
(eyes huge wide perfect circles:1.15), (eyebrows high arched forehead creased:1.1), (jaw dropped open relaxed natural:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral, calm, closed mouth, teeth deformed, tongue, low eyebrows, small eyes, squinting,
O shape, round lips, square mouth,
deformed face, distorted face, deformed lips, distorted mouth, mouth artifact, lip artifact,
extra teeth, liquid on face, blood on face, face markings
```

---

### tired — Nodos 180-183
**Descripción:** Agotamiento total — párpados caídos casi cerrando los ojos, cabeza inclinada hacia adelante, cara relajada y flácida, boca entreabierta.

> ⚠️ Color de ojos hardcodeado. Ver sección 9.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing red eyes,
eyelids drooping so heavy eyes are barely visible as thin slits,
head tilted forward with fatigue,
face muscles completely relaxed and sagging, dark undereye shadows,
mouth hanging open slightly from exhaustion,
(heavily drooping eyelids barely open:1.15), (head sagging from fatigue:1.1), (exhausted drooping face:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
wide open eyes, alert, energetic, happy, tense, upright head,
deformed face, distorted face, asymmetrical face, face markings, blood, liquid on face,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

### triumph — Nodos 184-187
**Descripción:** Victoria — sonrisa amplia con dientes, ojos brillantes muy abiertos, cejas elevadas por elación, barbilla ligeramente arriba.

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, [EYE_COLOR] eyes,
wide triumphant grin showing teeth, eyes bright and wide with victory,
eyebrows raised in elation, chin slightly up, face radiating pride and power,
(triumph expression:1.15), (triumphant grin:1.1), (victorious face:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

```
NEGATIVE:
score_6, score_5, score_4, ugly face, blurry face, different person,
neutral expression, sad, tired, closed mouth,
deformed face, distorted face, melting face, asymmetrical face, face markings, forehead mark,
deformed lips, distorted lips, deformed mouth, distorted mouth, toothpick, object in mouth,
drool, extra teeth, broken teeth, melting lips, lip artifact, mouth artifact, asymmetrical lips
```

---

## 8. Parámetros de FaceDetailer por expresión

Todos los FaceDetailer comparten los mismos parámetros base salvo `denoise`. Los parámetros que **nunca se modifican**:

| Parámetro | Valor | Razón |
|---|---|---|
| `guide_size` | 512 | Suficiente para el rostro, mucho más rápido que 1024 |
| `max_size` | 1024 | Límite de upscale interno |
| `steps` | 20 | Igual que Flujos 1 y 3 |
| `cfg` | 4.0 | Por encima de 5.5 genera dientes/manos deformadas |
| `sampler_name` | `dpmpp_2m` | Estándar del sistema |
| `scheduler` | `karras` | Estándar del sistema |
| `feather` | 5 | Borde suave del inpaint mask |
| `noise_mask` | true | Estándar |
| `force_inpaint` | true | Fuerza inpainting incluso si la cara ya es buena |
| `bbox_threshold` | 0.5 | Confianza mínima del detector |
| `bbox_dilation` | 10 | Expansión del bbox del rostro en px |
| `bbox_crop_factor` | 3 | Factor de crop del contexto del rostro |

### Tabla de denoise por expresión

El denoise controla cuánto cambia el rostro respecto al retrato base. **Más denoise = más libertad para la expresión = más riesgo de perder identidad.**

| Denoise | Expresiones | Criterio de agrupación |
|---|---|---|
| **0.55** | neutral, angry, confident, determined, flirty, happy*, sad, sarcastic, serious, tired | Expresiones donde la geometría base se mantiene cerca del retrato |
| **0.60** | disgusted | Nariz arrugada requiere algo más de libertad |
| **0.62** | confused, despondent, happy, hollow, incredulous, triumph | Asimetría fuerte o cambios de cejas amplios |
| **0.65** | disgusted*, surprised | Combinación de múltiples cambios simultáneos |
| **0.68** | fierce, rage, shocked | Expresiones extremas con contradicciones internas — máxima libertad necesaria |

> ⚠️ **Nunca superar 0.68** en expresiones. Por encima de ese valor el modelo pierde la identidad del personaje y genera otro rostro.

---

## 9. Cómo adaptar el workflow a un personaje nuevo

### Paso 1 — Sustituir el token de color de ojos

Hay dos tipos de nodos en el workflow:

**Tipo A** — Usan el placeholder `[EYE_COLOR]`:
`angry`, `confident`, `determined`, `fearful`, `happy`, `neutral`, `sad`, `triumph`

**Tipo B** — Tienen el color hardcodeado como `solid glowing red eyes`:
`confused`, `despondent`, `disgusted`, `fierce`, `flirty`, `hollow`, `incredulous`, `rage`, `sarcastic`, `seductive`, `serious`, `shocked`, `surprised`, `tired`

Para un nuevo personaje, reemplazar en **todos los nodos Tipo A y B** el token de ojos con el del personaje:

| Personaje | Token de ojos |
|---|---|
| Tiefling (rojo) | `solid glowing red eyes` |
| Elfa (plata) | `solid glowing silver eyes` |
| Tiefling (dorado) | `solid glowing golden eyes` |
| Humano genérico | `bright [COLOR] eyes` |

### Paso 2 — Cambiar el nombre del retrato base

En el **Nodo 10**:
```
image: "nombre_exacto_del_retrato.png"
```

El archivo debe estar en la carpeta `output` de ComfyUI.

### Paso 3 — Verificar

Ejecutar `Queue Prompt` en ComfyUI. Los 22 FaceDetailer corren en paralelo. Revisar el primer output — si la identidad se mantiene, el resto seguirá igual.

---

## 10. Ejemplo completo — Elfa Ranger

**Personaje:** Elfa Ranger · Ojos plateados luminosos · Pelo blanco plata · Armadura de cuero verde oscuro

### Token de ojos

```
solid glowing silver eyes
```

### Nodo 10 — Retrato base

```
image: "elfa_ranger_portrait_00001_.png"
```

### Prompts de referencia adaptados (primeras 3 expresiones)

#### neutral (Nodo 148)

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing silver eyes,
completely relaxed facial muscles, soft steady gaze directly forward,
mouth closed naturally, no tension anywhere in face,
(neutral expression:1.1), (relaxed face:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

#### angry (Nodo 100)

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing silver eyes,
inner brow corners sharply pulled down and together, deep vertical furrow between eyebrows,
eyes narrowed to slits, jaw clenched, lips pressed tight, face tense,
(angry expression:1.15), (furrowed inner brows:1.1), (narrowed eyes:1.05),
expressive eyes, perfect face, 748cmstyle, usnr, kaogei
```

#### fierce (Nodo 128)

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, BREAK, solid glowing silver eyes,
LEFT eye stretched wide open to maximum showing whites all around,
RIGHT eye narrowed to predatory slit almost closed,
wide unhinged villain grin showing all upper AND lower teeth fully,
grin stretching far to both sides of face,
eyebrows pulling in opposite directions left up right down,
face of unhinged dangerous excitement,
(one eye wide one eye slit:1.15), (wide unhinged grin all teeth showing:1.1), (eyebrows extreme asymmetry:1.05),
perfect face, 748cmstyle, usnr, kaogei
```

### Retrato base — Prompt de referencia (Flujo 1)

```
POSITIVE:
score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres, BREAK,
1girl, sole_girl, elf woman, long elegant pointed ears, no horns, no tail,
solid glowing silver eyes, forest ranger archer, medium breasts, lean athletic build,
toned arms, form-fitting dark forest green leather armor, fitted chest piece with buckles,
dark hood pushed back off head, bracers on forearms, quiver strap across chest,
bare neck and collarbone visible, silver white long hair, windswept strands framing face,
sharp angular elven facial features, calm predatory alertness, hunter quiet confidence, watchful dangerous stillness, BREAK,
leaning against stone wall, one knee slightly bent, hip shifted, arms loosely at sides,
three-quarter view, from hips up, torso shot, face and chest prominent, face in upper half of frame,
looking at viewer, steady calculating gaze, slight knowing smirk, alluring magnetic presence,
feminine silhouette, curves visible, ancient stone ruins background moss covered, BREAK,
perfect face, highly detailed face, sharp angular elven features, expressive glowing eyes,
face fully visible no hair over eyes, clean face edges, cinematic portrait lighting,
rim light on face, cool blue-green key light on skin, face illuminated,
dark fantasy RPG character portrait, concept art, highly detailed fantasy illustration,
dark atmosphere, blurred background, bokeh depth of field, subject sharp foreground, usnr, 748cmstyle
```

```
NEGATIVE:
score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, bad hands,
poorly drawn hands, extra limbs, missing fingers, fused fingers, watermark, text, logo, signature,
photorealistic, photograph, 3d render, explicit nudity, genitals, nipples, multiple people, crowd,
long robes, floor length dress, covering robe, shapeless clothing, baggy clothes, flat chest, shapeless body,
modest clothing, fully covered, portrait only, close-up face, face dominant, crouching, squatting,
sitting curled up, knees blocking body, full body to feet, t-pose, standing straight stiff,
face hidden, face small, face far away, face in shadow, dark face, obscured eyes, hair over eyes,
ugly, poorly drawn, barefoot, sandals, shoes, round ears, human ears, tiefling, horns, tail,
warm tones, orange light, red light, demonic, corrupted
```

---

## 11. Reglas de escritura de prompts de expresión

Para crear o ajustar un prompt de expresión:

### ✅ Hacer

- Describir posiciones físicas exactas: `inner brow corners sharply pulled down`, `cheeks raised pushing lower eyelids up`
- Usar lateralidad explícita: `LEFT eye`, `RIGHT eyebrow`
- Describir la geometría de la boca sin formas: `jaw dropped naturally`, `lips pressed tight`, `one corner pulled up`
- Agregar `different person` siempre en el negativo
- Terminar siempre con `perfect face, 748cmstyle, usnr, kaogei`
- Usar pesos de énfasis `(:1.15)` para el rasgo principal, `(:1.1)` y `(:1.05)` para los secundarios
- Bloquear en el negativo las expresiones contrarias a la que se quiere generar

### ❌ No hacer

- Usar conceptos abstractos como token único: `angry`, `sad`, `happy` sin descriptores anatómicos
- Describir formas geométricas de boca: `O shape`, `square mouth`
- Pedir `inside of mouth`, `teeth rows`, `inside cheek`
- Subir denoise por encima de 0.68
- Cambiar `cfg` por encima de 5.5
- Olvidar `[EYE_COLOR]` / hardcodear el color de otro personaje
- Agregar descriptores de ropa o cuerpo — FaceDetailer solo trabaja el rostro, el resto genera ruido

---

## 12. Checklist antes de ejecutar

- [ ] Nodo 10: nombre de archivo correcto del retrato base
- [ ] Todos los nodos `[EYE_COLOR]`: reemplazado con el token del personaje
- [ ] Todos los nodos con color hardcodeado: color correcto del personaje
- [ ] LoRA kaogei (Nodo 14): peso `0.35` — no subir
- [ ] LoRA face_enhancer (Nodo 6): peso `0.45` — no subir
- [ ] FaceDetailer `cfg`: `4.0` en todas las expresiones
- [ ] FaceDetailer `steps`: `20` en todas las expresiones
- [ ] FaceDetailer `guide_size`: `512` — no subir a 1024
- [ ] Expresiones extremas (fierce, rage, shocked): denoise `0.68`
- [ ] Ningún prompt con `O shape`, `square mouth` ni `inside of mouth`
- [ ] `different person` presente en todos los negativos

---

## 13. Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| **Expresión no se entiende / parece neutral** | Prompt describe concepto, no geometría | Reescribir con posiciones anatómicas exactas. Ver sección 5 |
| **Identidad perdida — parece otro personaje** | Denoise demasiado alto o kaogei muy alto | Max denoise `0.68`. Kaogei a `0.35` |
| **`disgusted` genera placer/éxtasis** | Activación del concepto opuesto en latent | `eyes OPEN staring downward` + negativo: `eyes closed, head tilted back, pleasure, ecstasy` |
| **`fierce` parece neutral o tímido** | Falta asimetría LEFT/RIGHT explícita | `LEFT eye wide RIGHT eye slit` + `wide unhinged villain grin all teeth` |
| **`rage` parece angry básico** | Solo ceño fruncido sin la grin | La rabia real necesita la contradicción: `eyebrows inward frown WHILE mouth grins all teeth` |
| **Boca/labios deformados** | Descriptores de forma geométrica | Eliminar `O shape`, `square mouth`, `inside of mouth`. Usar solo `jaw dropped naturally` |
| **Pelo tapando los ojos después del FaceDetailer** | Retrato base tiene pelo sobre ojos | Agregar `face fully visible no hair over eyes` en el Bloque 4 del Flujo 1 y regenerar el retrato base |
| **FaceDetailer no detecta el rostro** | Cara muy pequeña o en ángulo extremo | Retrato base necesita cara grande (`face large and prominent` en Flujo 1). O bajar `bbox_threshold` a `0.3` |
| **22 outputs con cara muy diferente al retrato** | LoRA kaogei demasiado alto | Bajar a `0.30`. Si sigue, bajar `face_enhancer` a `0.40` |
| **Expresión correcta pero cara plana/sin detalle** | Detailer bajo o face_enhancer bajo | Subir Detailer (Nodo 5) a `0.55`. Face enhancer a `0.50` (máximo recomendado) |
| **Color de ojos cambia entre expresiones** | Token de color inconsistente entre nodos | Revisar todos los nodos — tanto Tipo A (`[EYE_COLOR]`) como Tipo B (hardcodeado) |
| **Outputs sobrescriben otro personaje** | `filename_prefix` en SaveImage no diferenciado | Agregar prefijo de personaje en los 22 nodos SaveImage |

---

*Documento interno — TORRE · Sistema de expresiones IA · v1*  
*Complementa: `IMAGE_GENERATION_v10.md`*
