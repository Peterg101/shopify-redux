import { useEffect } from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../src/store';
import { fitdNavigationTheme } from '../src/theme';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider value={fitdNavigationTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" options={{ headerShown: true, title: 'Order Detail' }} />
            <Stack.Screen name="catalog/[partId]" options={{ headerShown: true, title: 'Part Detail' }} />
            <Stack.Screen name="claim/[id]" options={{ headerShown: true, title: 'Manage Claim' }} />
            <Stack.Screen name="fulfiller-settings" options={{ headerShown: true, title: 'Fulfiller Settings', presentation: 'modal' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}
