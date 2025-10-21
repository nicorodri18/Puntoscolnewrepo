import { Stack } from 'expo-router';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import { auth, db } from '../firebaseConfig';

interface UserData {
  role?: 'admin' | 'user';
  approved?: boolean;
}

export default function Layout() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        try {
          const ref = doc(db, 'users', user.uid);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            const data = snap.data() as UserData;
            setApproved(data.approved ?? false);
            setRole(data.role ?? 'user');
          } else {
            // Si no existe en Firestore, asumimos user común pendiente
            setApproved(false);
            setRole('user');
          }
        } catch (e) {
          console.error('Error leyendo user:', e);
          setApproved(false);
        }
      } else {
        setApproved(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setApproved(null);
      setRole(null);
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#C75B12" />
      </View>
    );
  }

  // No hay usuario autenticado → Login
  if (!firebaseUser) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)/index" />
      </Stack>
    );
  }

  const isAdmin =
    firebaseUser.email === 'admin@gmail.com' ||
    role === 'admin';

  // Si no es admin y no está aprobado → mensaje y botón
  if (!isAdmin && approved === false) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFF8E1',
          paddingHorizontal: 20,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: '#C75B12',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Tu cuenta está pendiente de aprobación por el administrador.
        </Text>

        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: '#C75B12',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#FFF8E1', fontWeight: '700', fontSize: 16 }}>
            Volver al inicio de sesión
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Admin → dashboard
  if (isAdmin) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="admin/adminDashboard" />
      </Stack>
    );
  }

  // Usuario aprobado → menú cliente
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="client/MenuScreen" />
    </Stack>
  );
}