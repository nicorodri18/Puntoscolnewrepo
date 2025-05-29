import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { db } from '../firebaseConfig';

export default function EditProfile() {
  const auth = getAuth();
  const router = useRouter();
  const user = auth.currentUser;
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [docId, setDocId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [points, setPoints] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('profile');

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    fetchUserData(user.email);
  }, []);

  const fetchUserData = async (email: string | null) => {
    if (!email) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('Usuario no encontrado');

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      setDocId(docSnap.id);
      setName(data.name);
      setEmail(data.email);
      setPhotoURL(data.photoURL || '');
      setPoints(data.points || 0);
    } catch (error) {
      Alert.alert('Error al obtener datos', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!docId) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', docId), {
        name,
        email,
        photoURL,
      });
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      router.back();
    } catch (error) {
      Alert.alert('Error al actualizar', (error as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePoints = () => {
    setActiveSection('points');
    router.push('/QRPoints');
  };

  const handleHome = () => {
    setActiveSection('home');
    router.push('/client/MenuScreen');
  };

  const handleChat = () => {
    setActiveSection('chat');
    router.push('/chat');
  };

  const handleProfile = () => {
    setActiveSection('profile');
    router.push('/EditProfile');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.avatarContainer}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <MaterialIcons name="person" size={80} color="#999" />
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Email</Text>
        <TextInput 
          style={styles.input} 
          value={email} 
          onChangeText={setEmail} 
          keyboardType="email-address" 
          editable={false} // Email no debería ser editable normalmente
        />

        <Text style={styles.label}>Foto (URL)</Text>
        <TextInput style={styles.input} value={photoURL} onChangeText={setPhotoURL} />

        <Text style={styles.points}>Puntos: {points}</Text>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSave} 
          disabled={updating}
        >
          <Text style={styles.buttonText}>
            {updating ? 'Guardando...' : 'Guardar Cambios'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[
            styles.navButton,
            activeSection === 'points' && styles.navButtonActive,
          ]}
          onPress={handlePoints}
        >
          <Icon
            name="attach-money"
            size={28}
            color={activeSection === 'points' ? '#fff' : '#666'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.navButton,
            activeSection === 'home' && styles.navButtonActive,
          ]}
          onPress={handleHome}
        >
          <Icon
            name="home"
            size={28}
            color={activeSection === 'home' ? '#fff' : '#666'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.navButton,
            activeSection === 'chat' && styles.navButtonActive,
          ]}
          onPress={handleChat}
        >
          <Icon
            name="build"
            size={28}
            color={activeSection === 'chat' ? '#fff' : '#666'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.navButton,
            activeSection === 'profile' && styles.navButtonActive,
          ]}
          onPress={handleProfile}
        >
          <Icon
            name="person"
            size={28}
            color={activeSection === 'profile' ? '#fff' : '#666'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingBottom: 70, // Para que el contenido no quede detrás de la barra de navegación
  },
  content: {
    padding: 20,
    flex: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  label: {
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  points: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF9800', // Naranja
    padding: 15,
    marginTop: 30,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 25,
  },
  navButtonActive: {
    backgroundColor: '#FF9800',
  },
});