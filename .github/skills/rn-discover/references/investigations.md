# Comandos de Investigación por Dominio

Ejecutar todos los aplicables según el stack del proyecto.
Para cada sección: correr el comando, analizar el output, documentar si hay hallazgo real.

---

## 🌐 i18n — Strings hardcodeados

### Detectar texto visible en JSX sin pasar por función i18n

```bash
# Primero: identificar la función de traducción que usa el proyecto
grep -rn "useTranslation\|i18n\|t(\|translate\|I18n" \
  --include="*.tsx" --include="*.ts" . \
  | grep -v node_modules | head -5
# Anotar el nombre de la función (t, translate, i18n.t, etc.)
```

```bash
# Texto entre tags <Text> que NO usa función de traducción
# Ajustar la función según lo encontrado arriba (default: t()
grep -rn "<Text[^>]*>[^{<]*[a-zA-ZáéíóúñÁÉÍÓÚÑ][^{<]*<\/Text>" \
  --include="*.tsx" --include="*.jsx" . \
  | grep -v node_modules \
  | grep -v "//.*<Text" \
  | grep -Ev ">\s*\{" \
  | grep -v "\.test\." \
  | head -50
```

```bash
# Strings en props comunes de UI sin traducir (placeholder, title, label, accessibilityLabel)
grep -rn 'placeholder="\|title="\|label="\|accessibilityLabel="' \
  --include="*.tsx" --include="*.jsx" . \
  | grep -v node_modules \
  | grep -v "{t(" \
  | grep -v "test\." \
  | head -40
```

```bash
# Contar total de ocurrencias para calibrar severidad
grep -rn "<Text[^>]*>[^{<]*[a-zA-ZáéíóúñÁÉÍÓÚÑ][^{<]*<\/Text>" \
  --include="*.tsx" --include="*.jsx" . \
  | grep -v node_modules | wc -l
```

**Qué buscar en el output:**
- Texto en español/inglés/otro idioma directamente entre tags
- Mensajes de error hardcodeados: `"Error al cargar"`, `"Something went wrong"`
- Labels de botones: `"Guardar"`, `"Cancelar"`, `"Aceptar"`
- Títulos de pantalla hardcodeados

**Ignorar:**
- Texto dentro de `{t('...')}` o `{translate('...')}`
- Comentarios
- Tests

---

## 📦 Assets — Tamaño de bundle y límites de stores

### Medir tamaño total de assets

```bash
# Tamaño total de la carpeta de assets
du -sh src/assets/ 2>/dev/null \
  || du -sh assets/ 2>/dev/null \
  || du -sh app/assets/ 2>/dev/null

# Desglose por tipo
du -sh src/assets/*/ 2>/dev/null | sort -rh | head -20

# Los archivos más pesados
find . \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \
  -o -name "*.gif" -o -name "*.mp4" -o -name "*.mov" \
  -o -name "*.ttf" -o -name "*.otf" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/ios/*" \
  -not -path "*/android/*" \
  | xargs du -sh 2>/dev/null | sort -rh | head -20
```

```bash
# Contar imágenes locales totales
find . \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/ios/*" \
  -not -path "*/android/*" \
  | wc -l
```

**Límites de referencia:**
- iOS App Store: app descargable máximo ~4GB, pero OTA update máximo 25MB — lo importante es el tamaño del IPA
- Google Play: APK máximo 100MB, AAB (recomendado) máximo 150MB sin expansion files
- **Señal de alerta:** assets > 100MB es riesgo alto; > 50MB merece investigación

---

## 🖼️ Assets — require() estático vs URI dinámico

### Detectar require() en props de imágenes (no puede ser dinámico)

```bash
# require() en source/src de componentes Image
grep -rn "source={require\|src={require" \
  --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" . \
  | grep -v node_modules | head -30
```

```bash
# require() con variables interpoladas (esto es el patrón roto)
grep -rn "require(.*\${" \
  --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" . \
  | grep -v node_modules
```

```bash
# require() dentro de un map o con índice variable — siempre problemático
grep -rn "require(" \
  --include="*.tsx" --include="*.jsx" . \
  | grep -v node_modules \
  | grep -E "require\(.*\+|require\(.*\[" | head -20
```

```bash
# Buscar lógica de selección de imagen con require (antipatrón)
grep -rn "const.*image.*=.*require\|const.*img.*=.*require\|const.*photo.*=.*require" \
  --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" . \
  | grep -v node_modules | head -20
```

**Qué indica el problema:**
Si hay un objeto o array de imágenes con require(), cada imagen está bundled en el JS.
No puede cargarse bajo demanda. Cualquier imagen que no se muestre en el primer render
ya está ocupando espacio en el bundle.

---

## 📊 Base de datos — Migraciones faltantes

### Identificar el ORM/DB y verificar estado de migraciones

```bash
# WatermelonDB
find . -name "*.js" -o -name "*.ts" | xargs grep -l "appSchema\|tableSchema" 2>/dev/null \
  | grep -v node_modules | head -5
# Buscar la versión del schema
grep -rn "version:" --include="*.ts" --include="*.js" . \
  | grep -i "schema\|migration" | grep -v node_modules | head -10
# Ver migraciones definidas
find . -name "*migration*" -not -path "*/node_modules/*" | head -10
```

```bash
# Expo SQLite / op-sqlite
grep -rn "CREATE TABLE\|ALTER TABLE\|DROP TABLE" \
  --include="*.ts" --include="*.tsx" --include="*.js" . \
  | grep -v node_modules | head -20
# Buscar archivos de migración
find . \( -name "*migration*" -o -name "*schema*" \) \
  -not -path "*/node_modules/*" -not -path "*/ios/*" -not -path "*/android/*" | head -20
```

```bash
# Realm
grep -rn "schema:" --include="*.ts" --include="*.js" . \
  | grep -v node_modules | head -10
grep -rn "schemaVersion" --include="*.ts" --include="*.js" . \
  | grep -v node_modules
```

**Señales de migración faltante:**
- Schema con columnas que el código asume que existen pero no están en migraciones
- Queries que buscan columnas que no están en el schema inicial
- Diferencia entre campos del modelo y campos de la migración

```bash
# Buscar campos que se usan en queries pero pueden no estar migrados
grep -rn "\.imageUrl\|\.image_url\|\.uri\|\.localPath" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | head -20
# Si hubo un cambio de asset remoto a local (o viceversa), estos campos
# pueden existir en el código pero no en la DB de usuarios existentes
```

---

## 📦 Dependencias — Referencias huérfanas

### Encontrar imports de librerías que ya no están instaladas

```bash
# Obtener lista de dependencias instaladas
node -e "const p=require('./package.json'); console.log(Object.keys({...p.dependencies,...p.devDependencies}).join('\n'))" 2>/dev/null

# Buscar imports de librerías comunes que pueden haber sido removidas
# (ajustar según el historial del proyecto)
grep -rn "from 'react-native-image-picker'\|from 'react-native-camera'\|from '@ai-sdk\|from 'openai'\|from 'replicate'" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | head -20
```

```bash
# Encontrar todos los imports externos únicos del proyecto
grep -rh "^import.*from '" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules \
  | grep -v "^\s*//" \
  | sed "s/.*from '//;s/'.*//" \
  | grep -v "^\." \
  | grep -v "^@/" \
  | grep -v "react-native$\|react$" \
  | sort -u > /tmp/project_imports.txt

# Comparar con lo que está en package.json
node -e "
const p=require('./package.json');
const installed=new Set(Object.keys({...p.dependencies,...p.devDependencies}));
const fs=require('fs');
const imports=fs.readFileSync('/tmp/project_imports.txt','utf8').split('\n').filter(Boolean);
const orphans=imports.filter(i=>{
  const pkg=i.startsWith('@')?i.split('/').slice(0,2).join('/'):i.split('/')[0];
  return !installed.has(pkg);
});
console.log('Imports sin instalar:');
orphans.forEach(o=>console.log(' -',o));
" 2>/dev/null
```

```bash
# Buscar referencias a generación de imágenes con IA (caso específico mencionado)
grep -rn "generateImage\|image_generation\|dalle\|stability\|midjourney\|replicate\|fal\." \
  --include="*.ts" --include="*.tsx" --include="*.js" . \
  | grep -v node_modules | head -20
```

---

## 🗺️ Navegación — Pantallas sin conectar o rutas huérfanas

```bash
# Encontrar todos los componentes de pantalla definidos
find . \( -name "*Screen*" -o -name "*Page*" -o -name "*View*" \) \
  -name "*.tsx" \
  -not -path "*/node_modules/*" \
  -not -path "*/ios/*" \
  -not -path "*/android/*" \
  | sort > /tmp/screen_files.txt
cat /tmp/screen_files.txt
```

```bash
# Encontrar todas las pantallas registradas en el navegador
grep -rn "component={.*Screen\|Screen.*component\|name=.*Screen" \
  --include="*.tsx" --include="*.ts" . \
  | grep -v node_modules | head -30
```

```bash
# Pantallas definidas pero posiblemente no registradas
# (comparar nombres de archivos con registros en navegador)
grep -rn "navigate(\|push(\|replace(" \
  --include="*.tsx" --include="*.ts" . \
  | grep -v node_modules \
  | grep -oP "(?<=navigate\(')[^']+(?=')|(?<=push\(')[^']+(?=')" \
  | sort -u
```

---

## 🔗 Features incompletas — TODOs, FIXMEs y código comentado

```bash
# TODOs y FIXMEs con contexto
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP\|@todo" \
  --include="*.ts" --include="*.tsx" --include="*.js" . \
  | grep -v node_modules \
  | grep -v "\.test\." \
  | head -40
```

```bash
# Contar por tipo
echo "TODOs:" $(grep -rn "TODO" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v test | wc -l)
echo "FIXMEs:" $(grep -rn "FIXME" --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l)
echo "HACKs:" $(grep -rn "HACK" --include="*.ts" --include="*.tsx" . | grep -v node_modules | wc -l)
```

```bash
# Bloques de código comentado (señal de feature removida o a medio hacer)
grep -rn "^\s*\/\/ .*[A-Za-z].*[A-Za-z].*[A-Za-z]" \
  --include="*.tsx" --include="*.ts" . \
  | grep -v node_modules \
  | grep -v "^.*\/\/ import\|^.*\/\/ export\|^.*\/\/ const\|^.*\/\/ eslint" \
  | wc -l
```

---

## 🔑 Configuración — Variables de entorno faltantes o inconsistentes

```bash
# Variables usadas en código
grep -rn "process\.env\.\|Config\.\|@env" \
  --include="*.ts" --include="*.tsx" --include="*.js" . \
  | grep -v node_modules \
  | grep -oP "(?<=process\.env\.)[A-Z_]+" \
  | sort -u
```

```bash
# Variables definidas en .env.example (si existe)
cat .env.example 2>/dev/null | grep -v "^#" | grep "=" | cut -d= -f1 | sort -u

# Variables en el .env real (solo las keys, no los valores)
cat .env 2>/dev/null | grep -v "^#" | grep "=" | cut -d= -f1 | sort -u
```

**Qué buscar:**
- Variables usadas en código que no están en `.env.example`
- Variables en `.env.example` que no están en el código (cleanup)
- Inconsistencias entre `.env` y `.env.example`

---

## 🎨 Temas y estilos — Valores hardcodeados

```bash
# Colores hexadecimales hardcodeados (deberían venir de un tema)
grep -rn "#[0-9A-Fa-f]\{3,6\}" \
  --include="*.tsx" --include="*.ts" . \
  | grep -v node_modules \
  | grep -v "\.test\." \
  | wc -l
```

```bash
# Los más frecuentes
grep -roh "#[0-9A-Fa-f]\{6\}\|#[0-9A-Fa-f]\{3\}" \
  --include="*.tsx" --include="*.ts" \
  $(find . -not -path "*/node_modules/*" -name "*.tsx" -o -name "*.ts" 2>/dev/null) \
  2>/dev/null | sort | uniq -c | sort -rn | head -15
```

---

## 🧪 Tests — Cobertura real

```bash
# Contar archivos de tests vs archivos de código
echo "Archivos de código:"
find . \( -name "*.tsx" -o -name "*.ts" \) \
  -not -path "*/node_modules/*" \
  -not -name "*.test.*" \
  -not -name "*.spec.*" \
  -not -path "*/ios/*" -not -path "*/android/*" \
  | wc -l

echo "Archivos de test:"
find . \( -name "*.test.ts" -o -name "*.test.tsx" \
  -o -name "*.spec.ts" -o -name "*.spec.tsx" \) \
  -not -path "*/node_modules/*" | wc -l
```

```bash
# Módulos críticos sin ningún test
for dir in src/services src/hooks src/store src/utils src/api; do
  if [ -d "$dir" ]; then
    files=$(find $dir -name "*.ts" -o -name "*.tsx" | grep -v test | grep -v spec | wc -l)
    tests=$(find $dir -name "*.test.*" -o -name "*.spec.*" | wc -l)
    echo "$dir: $files archivos, $tests tests"
  fi
done
```

---

## 📱 Plataforma — Inconsistencias iOS/Android

```bash
# Código platform-specific sin abstracción
grep -rn "Platform\.OS === 'ios'\|Platform\.OS === 'android'" \
  --include="*.tsx" --include="*.ts" . \
  | grep -v node_modules | wc -l
```

```bash
# Archivos platform-specific definidos
find . \( -name "*.ios.tsx" -o -name "*.android.tsx" \
  -o -name "*.ios.ts" -o -name "*.android.ts" \) \
  -not -path "*/node_modules/*" | head -20
```

---

## 🔒 Seguridad adicional — Verificaciones específicas

```bash
# URLs de API en producción hardcodeadas (deberían estar en env)
grep -rn "https://api\.\|http://api\.\|https://.*\.com/api\|https://.*\.io/api" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules \
  | grep -v "\.test\.\|placeholder\|example\|dummy" \
  | head -20
```

```bash
# console.log con datos que pueden ser sensibles
grep -rn "console\.log" \
  --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules \
  | grep -iE "token|password|secret|user|auth|key|credential" \
  | head -20
```

---

## 📋 Post-procesamiento — Correlaciones

Después de correr todas las investigaciones, buscar correlaciones entre hallazgos:

**Ejemplo de correlación assets + require() + DB:**
- Si hay muchas imágenes locales (>50) Y hay require() estático en listas/maps
  → Confirmar: las imágenes no pueden cargarse dinámicamente, el bundle es enorme
  → Buscar en el schema de DB campos como `imageUrl` o `localImage` para ver si hay migración pendiente
  → Esto confirma un issue de arquitectura sistémico, no tres issues separados

**Ejemplo de correlación dependencia removida + DB:**
- Si se removió una librería de generación de imágenes Y hay campos `generatedImageUrl` en el schema
  → Esos campos ahora apuntan a imágenes que ya no se pueden generar
  → El fix no es solo el campo de DB — es toda la lógica de fallback