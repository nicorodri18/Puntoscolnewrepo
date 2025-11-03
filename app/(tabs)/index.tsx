import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  ImageBackground,
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

export default function HomeScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    setIsLoading(true);
    try {
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });

        await setDoc(doc(db, 'users', userCred.user.uid), {
          name,
          email,
          points: 0,
        });

        Alert.alert('Cuenta creada', 'Ya puedes iniciar sesión');
        setIsRegistering(false);
        setEmail('');
        setPassword('');
        setName('');
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const user = userCred.user;

        if (user.email === 'admin@gmail.com') {
          router.replace('/admin/adminDashboard');
        } else {
          router.replace('/client/MenuScreen');
        }
      }
    } catch (error: any) {
      let message = 'Ocurrió un error. Intenta de nuevo.';
      if (error?.code === 'auth/weak-password') {
        message = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (error?.code === 'auth/email-already-in-use') {
        message = 'Ya existe una cuenta con este correo.';
      } else if (error?.code === 'auth/invalid-email') {
        message = 'El correo electrónico no es válido.';
      } else if (error?.message) {
        message = error.message;
      }
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/fondo-arepabuelas.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.card}>
        <Image
          source={require('../../assets/images/arepabuelas1.png')}
          style={styles.logo}
        />

        <Text style={styles.title}>
          {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </Text>

        {isRegistering && (
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor="#8C6A4B"
            value={name}
            onChangeText={setName}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#8C6A4B"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {isRegistering && (
          <Text style={styles.formHint}>No escriba su correo con mayúsculas</Text>
        )}

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#8C6A4B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {isRegistering && (
          <Text style={styles.formHint}>
            La contraseña debe tener al menos 6 caracteres.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, isLoading && { opacity: 0.7 }]}
          onPress={handleAuth}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF8E1" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
          <Text style={styles.linkText}>
            {isRegistering
              ? '¿Ya tienes cuenta? Inicia sesión'
              : '¿No tienes cuenta? Regístrate'}
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHint: {
    width: '90%',
    color: '#C75B12',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 243, 224, 0.5)', // capa cálida transparente
  },
  card: {
    width: '88%',
    backgroundColor: 'rgba(255, 248, 225, 0.92)',
    borderRadius: 28,
    paddingVertical: 30,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.2,
    borderColor: '#E0C097',
  },
  logo: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
    borderRadius: 110,
    marginBottom: 20,
    borderWidth: 2.5,
    borderColor: '#D7A86E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  title: {
    fontSize: 28,
    color: '#C75B12',
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    marginBottom: 20,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  input: {
    width: '90%',
    backgroundColor: '#FFF3E0',
    color: '#4E342E',
    padding: 14,
    marginBottom: 14,
    borderRadius: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D7CCC8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  button: {
    backgroundColor: '#C75B12',
    padding: 15,
    borderRadius: 16,
    width: '90%',
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#FFF8E1',
    fontSize: 17,
    fontWeight: '700',
  },
  linkText: {
    color: '#8C6A4B',
    marginTop: 14,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
