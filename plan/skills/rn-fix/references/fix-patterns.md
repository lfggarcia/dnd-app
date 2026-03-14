# Patrones Comunes de Aplicación de Fixes

Referencia rápida de cómo aplicar los tipos de fix más frecuentes en proyectos RN.

---

## Instalar una dependencia

```bash
# Con npm
npm install react-native-keychain
npm install --save-dev @types/react-native-keychain

# Con yarn
yarn add react-native-keychain

# Si tiene módulos nativos (requiere pod install para iOS)
npx pod-install
```

Después de instalar, verificar que quedó en `package.json`.

---

## Mover un secret de hardcoded a variable de entorno

### Antes (hardcoded):
```ts
const API_URL = 'https://api.miapp.com'
const API_KEY = 'sk-abc123xyz'
```

### Pasos:

**1. Agregar al `.env`:**
```bash
echo "API_URL=https://api.miapp.com" >> .env
echo "API_KEY=sk-abc123xyz" >> .env
```

**2. Agregar al `.env.example` (sin el valor real):**
```bash
echo "API_URL=" >> .env.example
echo "API_KEY=" >> .env.example
```

**3. Verificar que `.env` está en `.gitignore`:**
```bash
grep ".env" .gitignore || echo ".env" >> .gitignore
```

**4. Instalar react-native-dotenv si no está:**
```bash
npm install react-native-dotenv --save-dev
```

**5. Reemplazar en el código:**
```ts
import { API_URL, API_KEY } from '@env'
```

**6. Configurar babel.config.js:**
```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['module:react-native-dotenv', {
      moduleName: '@env',
      path: '.env',
    }]
  ]
}
```

---

## Agregar cleanup a un useEffect

### Patrón general:
```tsx
// Antes
useEffect(() => {
  const subscription = SomeAPI.subscribe(handler)
}, [])

// Después
useEffect(() => {
  const subscription = SomeAPI.subscribe(handler)
  
  return () => {
    subscription.unsubscribe()   // o .remove() según la API
  }
}, [])
```

### Cleanup según la API usada:

```tsx
// AppState
const sub = AppState.addEventListener('change', handler)
return () => sub.remove()

// NetInfo
const unsub = NetInfo.addEventListener(handler)
return () => unsub()

// Keyboard
const sub = Keyboard.addListener('keyboardDidShow', handler)
return () => sub.remove()

// setInterval
const id = setInterval(fn, 1000)
return () => clearInterval(id)

// setTimeout
const id = setTimeout(fn, 1000)
return () => clearTimeout(id)

// Custom EventEmitter
emitter.on('event', handler)
return () => emitter.off('event', handler)
```

---

## Reemplazar AsyncStorage por Keychain (datos sensibles)

```bash
npm install react-native-keychain
npx pod-install
```

```tsx
import * as Keychain from 'react-native-keychain'

// Guardar token (antes: AsyncStorage.setItem('token', token))
await Keychain.setGenericPassword('token', token, {
  service: 'com.miapp.auth',
})

// Leer token (antes: AsyncStorage.getItem('token'))
const credentials = await Keychain.getGenericPassword({
  service: 'com.miapp.auth',
})
const token = credentials ? credentials.password : null

// Borrar token (antes: AsyncStorage.removeItem('token'))
await Keychain.resetGenericPassword({ service: 'com.miapp.auth' })
```

---

## Agregar React.memo a un componente

```tsx
// Antes
function ItemCard({ item, onPress }: Props) {
  return (
    <Pressable onPress={() => onPress(item.id)}>
      <Text>{item.name}</Text>
    </Pressable>
  )
}

export default ItemCard

// Después
import React, { memo } from 'react'

function ItemCard({ item, onPress }: Props) {
  return (
    <Pressable onPress={() => onPress(item.id)}>
      <Text>{item.name}</Text>
    </Pressable>
  )
}

export default memo(ItemCard)
```

**Nota:** React.memo solo es efectivo si las props no cambian. Si `onPress` se pasa
inline `() => fn(id)`, también hay que envolver esa función en `useCallback` en el padre.

---

## Agregar useCallback a un handler

```tsx
// Antes — nueva función en cada render
function ParentScreen() {
  const handlePress = (id: string) => {
    navigation.navigate('Detail', { id })
  }
  
  return <ItemList onPress={handlePress} />
}

// Después — función estable con useCallback
function ParentScreen() {
  const handlePress = useCallback((id: string) => {
    navigation.navigate('Detail', { id })
  }, [navigation])  // ← navigation es estable en React Navigation
  
  return <ItemList onPress={handlePress} />
}
```

---

## Reemplazar ScrollView por FlatList

```tsx
// Antes
<ScrollView>
  {items.map(item => (
    <ItemCard key={item.id} item={item} />
  ))}
</ScrollView>

// Después
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemCard item={item} />}
  initialNumToRender={10}
/>
```

---

## Agregar ErrorBoundary

Crear `src/components/ErrorBoundary.tsx`:

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log al servicio de errores (Sentry, Bugsnag, etc.)
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <View style={styles.container}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.message}>{this.state.error?.message}</Text>
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  message: { color: '#666', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
})

export default ErrorBoundary
```

Luego en `App.tsx`:
```tsx
import ErrorBoundary from './src/components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <NavigationContainer>
        {/* ... */}
      </NavigationContainer>
    </ErrorBoundary>
  )
}
```

---

## Tipar params de navegación

```tsx
// src/navigation/types.ts (crear si no existe)
import { NativeStackScreenProps } from '@react-navigation/native-stack'

export type RootStackParamList = {
  Home: undefined
  Detail: { id: string; title: string }
  Profile: { userId: string }
}

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>
export type DetailScreenProps = NativeStackScreenProps<RootStackParamList, 'Detail'>
export type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>

// En el navegador (App.tsx o Navigator.tsx)
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

// En cada screen
import { DetailScreenProps } from '../navigation/types'

export default function DetailScreen({ route, navigation }: DetailScreenProps) {
  const { id, title } = route.params  // ← ahora está tipado
}
```
