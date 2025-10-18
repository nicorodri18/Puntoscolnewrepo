import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ImageBackground,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { supabase } from '../../supabaseClient';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  category: string;
  description?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  points: number;
  approved?: boolean;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'products' | 'users'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // crear producto
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // usuarios
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pointsToAdd, setPointsToAdd] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  const categories = ['Arepas', 'Bebidas', 'Salsas', 'Combos', 'Postres', 'Merch', 'Otros'];

  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
    else fetchUsers();
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo cerrar sesión');
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data: Product[] = snapshot.docs.map((d) => {
        const p = d.data() as Product;
        let imageUrl = (p.imageUrl || '') as string;

        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://xfhmqxgbrmpijmwcsgkn.supabase.co/storage/v1/object/public/products/${imageUrl}`;
        }

        return {
          id: d.id,
          name: p.name,
          price: p.price,
          category: p.category || 'Otros',
          imageUrl: imageUrl || null,
          description: p.description || '',
        };
      });
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'No se pudieron obtener los productos');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) })) as User[];
      setUsers(data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron obtener los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesitan permisos para acceder a las imágenes.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const uploadImageToSupabase = async (): Promise<string | null> => {
    if (!imageUri) return null;
    setUploading(true);
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const fileName = `product_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('products')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

      if (error) {
        Alert.alert('Error', `No se pudo subir la imagen: ${error.message}`);
        return null;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(fileName);
      return data?.publicUrl ?? null;
    } catch (error: any) {
      Alert.alert('Error', `Error al subir la imagen: ${error.message}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName || !newProductPrice || !newProductCategory) {
      Alert.alert('Error', 'Completa nombre, precio y categoría.');
      return;
    }

    const price = parseFloat(newProductPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Ingresa un precio válido.');
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        imageUrl = await uploadImageToSupabase();
      }

      await addDoc(collection(db, 'products'), {
        name: newProductName.trim(),
        price,
        imageUrl: imageUrl ?? null,
        category: newProductCategory,
        description: newProductDescription?.trim() || '',
      });

      setNewProductName('');
      setNewProductPrice('');
      setNewProductCategory('');
      setNewProductDescription('');
      setImageUri(null);

      await fetchProducts();
      Alert.alert('Éxito', 'Producto agregado correctamente');
    } catch (error) {
      console.error('Error al agregar producto:', error);
      Alert.alert('Error', 'No se pudo agregar el producto');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      await fetchProducts();
      Alert.alert('Eliminado', 'Producto eliminado correctamente');
    } catch (error) {
      console.error('Error eliminando producto:', error);
      Alert.alert('Error', 'No se pudo eliminar el producto');
    }
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail) {
      Alert.alert('Error', 'Completa nombre y correo');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'users'), {
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        points: 0,
        approved: true,
      });
      setUsers((prev) => [
        ...prev,
        { id: docRef.id, name: newUserName, email: newUserEmail, points: 0, approved: true },
      ]);
      setNewUserName('');
      setNewUserEmail('');
      setAddingUser(false);
      Alert.alert('Éxito', 'Usuario creado correctamente');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo crear el usuario');
    }
  };

  const handleAddPoints = async () => {
    if (!selectedUser || isNaN(Number(pointsToAdd))) {
      Alert.alert('Error', 'Selecciona un usuario y pon un número válido');
      return;
    }

    const newTotal = (selectedUser.points ?? 0) + Number(pointsToAdd);
    try {
      const ref = doc(db, 'users', selectedUser.id);
      await updateDoc(ref, { points: newTotal });
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, points: newTotal } : u)));
      setSelectedUser(null);
      setPointsToAdd('');
      Alert.alert('Éxito', 'Puntos asignados correctamente');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo asignar puntos');
    }
  };

  const handleToggleApproved = async (user: User) => {
    try {
      const ref = doc(db, 'users', user.id);
      const next = !user.approved;
      await updateDoc(ref, { approved: next });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, approved: next } : u)));
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo cambiar el estado del usuario');
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.itemContainer}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.noImage]}>
          <MaterialIcons name="image-not-supported" size={28} color="#9CA3AF" />
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
        <Text style={styles.price}>{item.price} puntos</Text>
        <Text style={styles.category}>Categoría: {item.category}</Text>
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteProduct(item.id)}>
        <Text style={styles.deleteButtonText}>Eliminar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => setSelectedUser(item)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.userName}>{item.name}</Text>
        <View style={[styles.badge, item.approved ? styles.badgeOk : styles.badgeWarn]}>
          <Text style={styles.badgeText}>{item.approved ? 'Aprobado' : 'Pendiente'}</Text>
        </View>
      </View>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={styles.userPoints}>Puntos: {item.points ?? 0}</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          style={[styles.smallBtn, styles.approveBtn]}
          onPress={() => handleToggleApproved(item)}
        >
          <Text style={styles.smallBtnText}>{item.approved ? 'Revocar' : 'Aprobar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, styles.pointsBtn]}
          onPress={() => {
            setSelectedUser(item);
            setPointsToAdd('');
          }}
        >
          <Text style={styles.smallBtnText}>Asignar puntos</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('../../assets/images/fondo-arepabuelas.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <View style={styles.header}>
        <Image source={require('../../assets/images/arepabuelas1.png')} style={styles.logo} />
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialIcons name="logout" size={26} color="#C75B12" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Panel de Administración</Text>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            Productos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Usuarios</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#C75B12" style={styles.loader} />
      ) : (
        <ScrollView style={styles.contentContainer} keyboardShouldPersistTaps="handled">
          {activeTab === 'products'
            ? <>
                <Text style={styles.sectionTitle}>Gestión de Productos</Text>
                {/* Formulario */}
                <TextInput style={styles.input} placeholder="Nombre del producto" value={newProductName} onChangeText={setNewProductName} />
                <TextInput style={styles.input} placeholder="Precio en puntos" keyboardType="numeric" value={newProductPrice} onChangeText={setNewProductPrice} />
                <Picker selectedValue={newProductCategory} onValueChange={(v) => setNewProductCategory(v)} style={styles.picker}>
                  <Picker.Item label="Selecciona una categoría" value="" />
                  {categories.map((c) => <Picker.Item key={c} label={c} value={c} />)}
                </Picker>
                <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} placeholder="Descripción (opcional)" value={newProductDescription} multiline onChangeText={setNewProductDescription} />
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                  <Text style={styles.imagePickerText}>
                    {imageUri ? 'Cambiar imagen seleccionada' : 'Seleccionar imagen'}
                  </Text>
                </TouchableOpacity>
                {imageUri && (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.preview} />
                    {uploading && <ActivityIndicator size="small" color="#C75B12" />}
                  </View>
                )}
                <TouchableOpacity style={styles.addButton} onPress={handleAddProduct} disabled={uploading}>
                  <Text style={styles.addButtonText}>{uploading ? 'Subiendo...' : 'Agregar Producto'}</Text>
                </TouchableOpacity>
                <FlatList data={products} keyExtractor={(item) => item.id} renderItem={renderProductItem} scrollEnabled={false} contentContainerStyle={styles.list} />
              </>
            : <>
                <Text style={styles.sectionTitle}>Gestión de Usuarios</Text>
                <FlatList data={users} keyExtractor={(item) => item.id} renderItem={renderUserItem} scrollEnabled={false} contentContainerStyle={styles.list} />
                <TouchableOpacity style={styles.addButton} onPress={() => setAddingUser(true)}>
                  <Text style={styles.addButtonText}>+ Agregar nuevo usuario</Text>
                </TouchableOpacity>
                {addingUser && (
                  <View style={styles.form}>
                    <Text style={styles.subtitle}>Nuevo Usuario</Text>
                    <TextInput style={styles.input} placeholder="Nombre" value={newUserName} onChangeText={setNewUserName} />
                    <TextInput style={styles.input} placeholder="Correo" value={newUserEmail} onChangeText={setNewUserEmail} keyboardType="email-address" autoCapitalize="none" />
                    <TouchableOpacity style={styles.button} onPress={handleAddUser}>
                      <Text style={styles.buttonText}>Guardar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setAddingUser(false)}>
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {selectedUser && (
                  <View style={styles.form}>
                    <Text style={styles.subtitle}>Asignar puntos a {selectedUser.name}</Text>
                    <TextInput style={styles.input} placeholder="Puntos a agregar" value={pointsToAdd} onChangeText={setPointsToAdd} keyboardType="numeric" />
                    <TouchableOpacity style={styles.button} onPress={handleAddPoints}>
                      <Text style={styles.buttonText}>Asignar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedUser(null)}>
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>}
        </ScrollView>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,243,224,0.55)' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  logo: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#D7A86E',
  },
  logoutBtn: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#C75B12',
    textAlign: 'center',
    marginVertical: 10,
    letterSpacing: 0.5,
  },

  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3E5AB',
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#C75B12',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B4F32',
  },
  activeTabText: {
    color: '#FFF8E1',
    fontWeight: '700',
  },

  contentContainer: { paddingHorizontal: 18 },
  loader: { marginTop: 40 },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5C4033',
    marginBottom: 18,
    textAlign: 'center',
  },

  input: {
    borderWidth: 1,
    borderColor: '#E0C097',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: '#FFFDF6',
    fontSize: 16,
    color: '#4E342E',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#E0C097',
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: '#FFFDF6',
    color: '#4E342E',
  },
  imagePicker: {
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D7A86E',
  },
  imagePickerText: {
    color: '#C75B12',
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#C75B12',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 26,
  },
  addButtonText: {
    color: '#FFF8E1',
    fontSize: 16,
    fontWeight: '700',
  },
  previewWrap: { alignItems: 'center', marginBottom: 14 },
  preview: {
    width: 180,
    height: 130,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0C097',
  },
  list: { paddingBottom: 30 },

  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF6',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  image: {
    width: 80,
    height: 80,
    marginRight: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0C097',
    backgroundColor: '#FFF3E0',
  },
  noImage: { justifyContent: 'center', alignItems: 'center' },
  infoContainer: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#5C4033' },
  desc: { fontSize: 13, color: '#8C6A4B', marginTop: 2 },
  price: { fontSize: 14, color: '#4E342E', marginTop: 4, fontWeight: '700' },
  category: { fontSize: 13, color: '#8C6A4B', marginTop: 4 },
  deleteButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: '#FFFDF6',
    fontSize: 14,
    fontWeight: '700',
  },

  userItem: {
    backgroundColor: '#FFFDF6',
    padding: 18,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  userName: { fontSize: 16, fontWeight: '700', color: '#5C4033' },
  userEmail: { fontSize: 14, color: '#8C6A4B', marginTop: 4 },
  userPoints: { fontSize: 14, color: '#C75B12', marginTop: 4, fontWeight: '700' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeOk: { backgroundColor: '#E8F5E9' },
  badgeWarn: { backgroundColor: '#FFF8E1' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#4E342E' },

  smallBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  approveBtn: { backgroundColor: '#FFE0B2' },
  pointsBtn: { backgroundColor: '#FFD54F' },
  smallBtnText: { fontSize: 12, fontWeight: '800', color: '#4E342E' },

  form: {
    backgroundColor: '#FFFDF6',
    padding: 18,
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5C4033',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FFD54F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#4E342E', fontSize: 16, fontWeight: '800' },
  cancelButton: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D32F2F',
  },
  cancelButtonText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: '700',
  },
});