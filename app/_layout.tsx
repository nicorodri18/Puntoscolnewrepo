import { Stack } from 'expo-router';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function Layout() {
  // ✅ Tipamos correctamente el usuario
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e60012" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="(tabs)/index" />
      ) : user?.email === 'admin@gmail.com' ? (
        <Stack.Screen name="admin/adminDashboard" />
      ) : (
        <Stack.Screen name="client/MenuScreen" />
      )}
    </Stack>
  );
}