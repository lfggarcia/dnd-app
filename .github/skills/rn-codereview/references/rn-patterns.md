# Patrones React Native — Correcto vs Incorrecto

## Styles

### ❌ Incorrecto — styles inline recreados en cada render
```tsx
// El objeto se crea en cada render, causando re-renders innecesarios en hijos
<View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
```

### ✅ Correcto — StyleSheet.create
```tsx
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 }
})
<View style={styles.container}>
```

**Excepción aceptable:** Styles dinámicos que dependen de props/state — en ese caso,
combinar con StyleSheet: `style={[styles.base, { backgroundColor: color }]}`

---

## Animaciones

### ❌ Incorrecto — animación en JS thread
```tsx
const opacity = useRef(new Animated.Value(0)).current
Animated.timing(opacity, {
  toValue: 1,
  duration: 300,
  // useNativeDriver: false  ← bloquea JS thread durante la animación
}).start()
```

### ✅ Correcto — native driver
```tsx
Animated.timing(opacity, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true,  // ← corre en UI thread nativo
}).start()
```

**Nota:** `useNativeDriver: true` solo funciona con propiedades que no afectan el layout
(`opacity`, `transform`). Para `width`, `height`, `backgroundColor` → usar Reanimated 2.

---

## Safe Area

### ❌ Incorrecto — sin safe area
```tsx
// Se corta en notch de iPhone y en Android con gesture navigation
<View style={{ flex: 1 }}>
  <Text>Contenido</Text>
</View>
```

### ✅ Correcto — con safe area
```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const insets = useSafeAreaInsets()
<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
  <Text>Contenido</Text>
</View>

// O en el componente raíz de cada pantalla:
import { SafeAreaView } from 'react-native-safe-area-context'
<SafeAreaView style={{ flex: 1 }}>
```

---

## Keyboard handling en Forms

### ❌ Incorrecto — teclado tapa el input
```tsx
<View style={{ flex: 1 }}>
  <TextInput placeholder="Email" />
  <TextInput placeholder="Password" />
  <Button title="Login" />
</View>
```

### ✅ Correcto
```tsx
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'

<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    <TextInput placeholder="Email" />
    <TextInput placeholder="Password" />
    <Button title="Login" />
  </ScrollView>
</KeyboardAvoidingView>
```

---

## FlatList

### ❌ Incorrecto
```tsx
<FlatList
  data={items}
  renderItem={({ item }) => (
    <ItemCard  // Se recrea en cada render del padre
      item={item}
      onPress={() => navigate(item.id)}  // Nueva función en cada render
    />
  )}
/>
```

### ✅ Correcto
```tsx
const renderItem = useCallback(({ item }: { item: Item }) => (
  <ItemCard item={item} onPress={handlePress} />
), [handlePress])

const handlePress = useCallback((id: string) => {
  navigate(id)
}, [navigate])

const keyExtractor = useCallback((item: Item) => item.id, [])

<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={10}
  removeClippedSubviews={true}
/>
```

**Y el componente item debe ser memoizado:**
```tsx
const ItemCard = React.memo(({ item, onPress }: Props) => {
  return (
    <Pressable onPress={() => onPress(item.id)}>
      <Text>{item.name}</Text>
    </Pressable>
  )
})
```

---

## Platform-specific code

### ❌ Incorrecto — lógica platform dispersa
```tsx
// Repetido en múltiples componentes
const shadowStyle = Platform.OS === 'ios'
  ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 }
  : { elevation: 4 }
```

### ✅ Correcto — abstraído
```tsx
// src/utils/styles.ts
export const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  android: {
    elevation: 4,
  },
})

// Uso:
<View style={[styles.card, shadow]}>
```

O para componentes completos con gran diferencia:
```
components/
├── Button.ios.tsx
├── Button.android.tsx
└── Button.tsx  (tipos compartidos)
```

---

## Context con re-renders

### ❌ Incorrecto — todo el árbol re-renderiza en cada cambio
```tsx
const AppContext = createContext({})

function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState('light')
  
  // Este objeto se recrea en cada render → todos los consumers re-renderizan
  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme }}>
      {children}
    </AppContext.Provider>
  )
}
```

### ✅ Correcto — separar contexts por dominio
```tsx
const UserContext = createContext<UserContextType | null>(null)
const ThemeContext = createContext<ThemeContextType | null>(null)

function UserProvider({ children }) {
  const [user, setUser] = useState<User | null>(null)
  const value = useMemo(() => ({ user, setUser }), [user])
  
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
```

---

## Cleanup de efectos

### ❌ Incorrecto — memory leak
```tsx
useEffect(() => {
  const subscription = AppState.addEventListener('change', handleAppState)
  const interval = setInterval(fetchData, 5000)
  // Sin cleanup → leak cuando el componente se desmonta
}, [])
```

### ✅ Correcto
```tsx
useEffect(() => {
  const subscription = AppState.addEventListener('change', handleAppState)
  const interval = setInterval(fetchData, 5000)
  
  return () => {
    subscription.remove()
    clearInterval(interval)
  }
}, [fetchData]) // fetchData debe ser estable (useCallback)
```

---

## Navigation params typing

### ❌ Incorrecto — params sin tipar
```tsx
// Puede crashear en runtime si los params no existen
const { userId } = route.params
```

### ✅ Correcto — params tipados con React Navigation
```tsx
// navigation/types.ts
export type RootStackParamList = {
  Home: undefined
  UserProfile: { userId: string; userName: string }
  Settings: undefined
}

// En el componente:
type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>

function UserProfileScreen({ route, navigation }: Props) {
  const { userId, userName } = route.params  // ← tipado y safe
}
```