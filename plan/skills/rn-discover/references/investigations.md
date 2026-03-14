# Investigaciones por Dominio — rn-discover

Ejecutar todas las aplicables según el stack del proyecto.
Para cada sección: ejecutar, analizar output, documentar si hay hallazgo real.

---

## 🌐 i18n — Strings hardcodeados

### 1. Identificar la función de traducción del proyecto

> ▶ Buscando la función i18n que usa el proyecto

Serena MCP: `search_code("useTranslation|i18n|translate|I18n", file_types=["tsx","ts"], exclude=["node_modules","test"])`

Anotar el nombre exacto (t, translate, i18n.t, etc.) — se usa en las búsquedas siguientes.

### 2. Texto visible en JSX sin pasar por i18n

> ▶ Buscando texto hardcodeado entre tags <Text> que no usa la función i18n

Serena MCP: `search_code("<Text[^>]*>[^{<]*[a-zA-ZáéíóúñÁÉÍÓÚÑ][^{<]*</Text>", file_types=["tsx","jsx"], exclude=["node_modules","test"])`

Filtrar: ignorar los que contienen `{t(` o `{translate(`.

### 3. Strings en props de UI sin traducir

> ▶ Buscando placeholder/title/label hardcodeados en componentes

Serena MCP: `search_code('placeholder="|title="|label="|accessibilityLabel="', file_types=["tsx","jsx"], exclude=["node_modules","test"])`

Filtrar: ignorar los que ya usan `{t(`.

**Señales de problema:** texto en español/inglés directamente en props, mensajes de error literales, labels de botones hardcodeados.

---

## 📦 Assets — Tamaño de bundle y límites de stores

### 1. Tamaño total de assets

> ▶ Midiendo tamaño de la carpeta de assets

```bash
du -sh assets/ 2>/dev/null || du -sh src/assets/ 2>/dev/null || du -sh app/assets/ 2>/dev/null
du -sh assets/*/ 2>/dev/null | sort -rh | head -20
```

**Límites de referencia:**
- iOS OTA update: máximo 25 MB
- Google Play APK: máximo 100 MB / AAB: 150 MB
- **Alerta roja:** assets > 100 MB; **Alerta amarilla:** > 50 MB

### 2. Archivos individuales más pesados

> ▶ Encontrando los archivos de media más grandes del proyecto

```bash
find . \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.mp4" -o -name "*.ttf" \) \
  -not -path "*/node_modules/*" -not -path "*/ios/*" -not -path "*/android/*" \
  | xargs du -sh 2>/dev/null | sort -rh | head -20
```

### 3. Conteo total de imágenes

> ▶ Contando imágenes locales totales

```bash
find . \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) \
  -not -path "*/node_modules/*" -not -path "*/ios/*" -not -path "*/android/*" \
  | wc -l
```

---

## 🖼️ Assets — require() estático vs URI dinámico

### 1. require() en props de Image

> ▶ Buscando require() estático en source/src de componentes Image

Serena MCP: `search_code("source={require|src={require", file_types=["tsx","jsx","ts","js"], exclude=["node_modules"])`

### 2. require() con variables interpoladas (patrón roto)

> ▶ Buscando require() con interpolación de variables — esto no funciona en RN

Serena MCP: `search_code('require(.*\${', file_types=["tsx","jsx","ts","js"], exclude=["node_modules"])`

### 3. require() dentro de lógica dinámica

> ▶ Buscando require() con índice variable o concatenación

Serena MCP: `search_code("require(", file_types=["tsx","jsx"], exclude=["node_modules"])` → filtrar líneas con `+` o `[` en el argumento.

**Por qué es problema:** require() con variable no puede resolverse en build time. Metro bundler falla silenciosamente o incluye todas las imágenes del directorio.

---

## 🗄️ Base de datos — Migraciones faltantes

### 1. Identificar ORM y schema

> ▶ Buscando definición del schema de base de datos

Serena MCP: `search_code("CREATE TABLE|ALTER TABLE|appSchema|tableSchema|schemaVersion", file_types=["ts","js"], exclude=["node_modules"])`

### 2. Archivos de migración existentes

> ▶ Buscando archivos de migración definidos

Serena MCP: `find_files("**/*migration*", exclude=["node_modules","ios","android"])`
Serena MCP: `find_files("**/*schema*", exclude=["node_modules","ios","android"])`

### 3. Campos usados en queries que pueden no estar migrados

> ▶ Buscando campos de assets/imágenes que podrían no estar en el schema

Serena MCP: `search_code("\.imageUrl|\.image_url|\.localPath|\.uri", file_types=["ts","tsx"], exclude=["node_modules"])`

**Señal de migración faltante:** campo usado en código que no aparece en el schema inicial ni en ninguna migración.

---

## 📦 Dependencias — Referencias huérfanas

### 1. Lista de dependencias instaladas

> ▶ Leyendo dependencias instaladas desde package.json

Serena MCP: `read_file("package.json")` → extraer `dependencies` + `devDependencies`

### 2. Todos los imports externos del proyecto

> ▶ Buscando todos los imports de librerías externas en el código

Serena MCP: `search_code("^import.*from '[^./]", file_types=["ts","tsx"], exclude=["node_modules"])`

Comparar imports encontrados contra la lista de instaladas. Los imports cuyo paquete base no aparece en package.json son huérfanos.

### 3. Librerías de IA/imagen que pueden haber sido removidas

> ▶ Buscando referencias a librerías de generación de imagen o IA

Serena MCP: `search_code("generateImage|dalle|replicate|fal\.|stability|midjourney|openai|@ai-sdk", file_types=["ts","tsx"], exclude=["node_modules"])`

---

## 🗺️ Navegación — Pantallas sin conectar

### 1. Pantallas definidas como archivos

> ▶ Listando todos los archivos de pantalla del proyecto

Serena MCP: `find_files("src/**/*Screen*.tsx", exclude=["node_modules","ios","android"])`

### 2. Pantallas registradas en el navegador

> ▶ Buscando pantallas registradas en el stack de navegación

Serena MCP: `search_code("component={|Screen.*name=|name=.*Screen", file_types=["tsx","ts"], exclude=["node_modules"])`

### 3. Destinos de navigate() usados en el código

> ▶ Buscando todos los destinos de navegación usados en el código

Serena MCP: `search_code("navigate(|push(|replace(", file_types=["tsx","ts"], exclude=["node_modules"])` → extraer los string literals entre comillas.

Comparar archivos de pantalla vs pantallas registradas vs destinos usados. Discrepancias = pantallas huérfanas o rutas rotas.

---

## 🚧 Features incompletas — TODOs, FIXMEs, código comentado

### 1. TODOs y FIXMEs con contexto

> ▶ Buscando TODOs, FIXMEs y marcadores de deuda técnica

Serena MCP: `search_code("TODO|FIXME|HACK|XXX|TEMP|@todo", file_types=["ts","tsx","js"], exclude=["node_modules","test"])`

### 2. Conteo por tipo

> ▶ Contando marcadores de deuda técnica por tipo

```bash
echo "TODOs: $(grep -rn 'TODO' --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v test | wc -l)"
echo "FIXMEs: $(grep -rn 'FIXME' --include='*.ts' --include='*.tsx' . | grep -v node_modules | wc -l)"
echo "HACKs: $(grep -rn 'HACK' --include='*.ts' --include='*.tsx' . | grep -v node_modules | wc -l)"
```

---

## ⚙️ Configuración — Variables de entorno

### 1. Variables usadas en el código

> ▶ Buscando variables de entorno referenciadas en el código

Serena MCP: `search_code("process\.env\.|Config\.|@env", file_types=["ts","tsx","js"], exclude=["node_modules"])`

### 2. Variables definidas vs usadas

> ▶ Leyendo variables declaradas en .env.example y .env

Serena MCP: `read_file(".env.example")` (si existe)
Serena MCP: `read_file(".env")` → mostrar solo las keys, no los valores

Comparar: variables usadas en código que no están definidas en .env.example = posible variable de entorno faltante en otros entornos.

---

## 🔐 Seguridad — API keys en el bundle

### 1. API keys hardcodeadas

> ▶ Buscando API keys y secrets hardcodeados en el código

Serena MCP: `search_code("sk-|api_key|apiKey|SECRET|PASSWORD|TOKEN|Bearer ", file_types=["ts","tsx","js"], exclude=["node_modules",".env"])`

### 2. Configuración de react-native-dotenv

> ▶ Verificando configuración de variables de entorno en babel.config

Serena MCP: `read_file("babel.config.js")`
Serena MCP: `find_files("src/types/env.d.ts")` → leer si existe

Variables declaradas en env.d.ts se inyectan en el bundle JS como literales — son extraíbles del APK/IPA.
