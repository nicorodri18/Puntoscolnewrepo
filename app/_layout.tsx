// app/_layout.tsx
import { Stack } from 'expo-router';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
          // 🔍 Buscar al usuario por su email en la colección "users"
          const q = query(collection(db, 'users'), where('email', '==', user.email));
          const snap = await getDocs(q);

          if (!snap.empty) {
            const data = snap.docs[0].data() as UserData;
            setApproved(data.approved ?? false);
            setRole(data.role ?? 'user');
          } else {
            // Si no se encuentra, se asume usuario pendiente
            setApproved(false);
            setRole('user');
          }
        } catch (e) {
          console.error('Error leyendo usuario en Firestore:', e);
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

  // 🔐 No hay usuario autenticado → pantalla de login
  if (!firebaseUser) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)/index" />
      </Stack>
    );
  }

  // 👑 Determinar si el usuario es admin
  const isAdmin =
    firebaseUser.email === 'admin@gmail.com' ||
    role === 'admin';

  // ⛔ Usuario no aprobado
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

  // 👨‍💼 Si es admin → dashboard de administración
  if (isAdmin) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="admin/adminDashboard" />
      </Stack>
    );
  }

  // 👤 Usuario aprobado → menú de cliente
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="client/MenuScreen" />
    </Stack>
  );
}