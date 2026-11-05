import { HotfixProvider, useHotfix } from 'react-native-hotfix';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <HotfixProvider>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppContent dark={isDarkMode} />
      </SafeAreaProvider>
    </HotfixProvider>
  );
}

function AppContent({ dark }: { dark: boolean }) {
  const safeAreaInsets = useSafeAreaInsets();
  const { state, error, checking, checkForUpdate } = useHotfix();
  const current = state?.currentUpdate;
  const downloaded = state?.downloadedUpdate;

  return (
    <View
      style={[
        styles.container,
        dark ? styles.darkBackground : styles.lightBackground,
        {
          paddingTop: safeAreaInsets.top + 32,
          paddingBottom: safeAreaInsets.bottom + 24,
          paddingLeft: safeAreaInsets.left + 24,
          paddingRight: safeAreaInsets.right + 24,
        },
      ]}>
      <Text style={[styles.eyebrow, dark ? styles.darkMuted : styles.lightMuted]}>
        REACT NATIVE HOTFIX
      </Text>
      <Text style={[styles.title, dark ? styles.darkText : styles.lightText]}>
        Signed updates for the New Architecture
      </Text>
      <View style={[styles.card, dark ? styles.darkCard : styles.lightCard]}>
        <Text style={[styles.label, dark ? styles.darkMuted : styles.lightMuted]}>
          ACTIVE BUNDLE
        </Text>
        <Text style={[styles.value, dark ? styles.darkText : styles.lightText]}>
          {current ? current.id : 'Embedded app bundle'}
        </Text>
        <Text style={[styles.detail, dark ? styles.darkMuted : styles.lightMuted]}>
          {current
            ? `${state?.status ?? 'ready'} · runtime ${current.runtimeVersion}`
            : `runtime 1.0.0 · embedded`}
        </Text>
        {downloaded && downloaded.id !== current?.id ? (
          <Text
            style={[styles.detail, dark ? styles.darkMuted : styles.lightMuted]}>
            {`Downloaded for next launch: ${downloaded.id}`}
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error.message}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={checking}
        onPress={() => {
          checkForUpdate().catch(() => {});
        }}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          checking && styles.buttonDisabled,
        ]}>
        <Text style={styles.buttonText}>
          {checking ? 'Checking…' : 'Check for update'}
        </Text>
      </Pressable>
      <Text style={[styles.note, dark ? styles.darkMuted : styles.lightMuted]}>
        A downloaded update is activated on the next cold launch. Failed
        launches roll back automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkBackground: {
    backgroundColor: '#0b1020',
  },
  lightBackground: {
    backgroundColor: '#f4f6fb',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 43,
    marginTop: 14,
    maxWidth: 520,
  },
  card: {
    borderRadius: 20,
    marginTop: 40,
    padding: 20,
  },
  darkCard: {
    backgroundColor: '#171e35',
  },
  lightCard: {
    backgroundColor: '#ffffff',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  detail: {
    fontSize: 14,
    marginTop: 8,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 13,
    marginTop: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#635bff',
    borderRadius: 14,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 20,
    maxWidth: 520,
  },
  darkText: {
    color: '#ffffff',
  },
  lightText: {
    color: '#111528',
  },
  darkMuted: {
    color: '#9aa5c5',
  },
  lightMuted: {
    color: '#68708a',
  },
});

export default App;
