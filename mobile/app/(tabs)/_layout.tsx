import { Redirect, Tabs } from 'expo-router';
import { useSelector } from 'react-redux';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { RootState } from '../../src/store';
import { colors } from '../../src/theme';
import { ActivityIndicator, View } from 'react-native';
import { FEATURE_MANUFACTURING } from '../../src/services/config';

function TabIcon({ name, color }: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={22} name={name} color={color} />;
}

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgBase }}>
        <ActivityIndicator size="large" color={colors.cyan} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.cyanSubtle,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Generate',
          tabBarIcon: ({ color }) => <TabIcon name="magic" color={color} />,
        }}
      />
      <Tabs.Screen
        name="fulfill"
        options={{
          title: 'Fulfill',
          tabBarIcon: ({ color }) => <TabIcon name="industry" color={color} />,
          href: FEATURE_MANUFACTURING ? '/fulfill' : null,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color }) => <TabIcon name="th-large" color={color} />,
          href: FEATURE_MANUFACTURING ? '/catalog' : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
