import { MaterialIcons } from '@expo/vector-icons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Picker,
  ScrollView, StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../../firebaseConfig';
import { supabase } from '../../supabaseClient';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  category: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  points: number;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'products' | 'users'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pointsToAdd, setPointsToAdd] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

 
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedUserId, setScannedUserId] = useState<string | null>(null);


  const categories = ['Electrónica', 'Ropa', 'Hogar', 'Juguetes', 'Otros'];

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    } else {
      fetchUsers();
    }

   
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, [activeTab]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data: Product[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
      setUsers(data);
    } catch (error) {
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
        quality: 0.7,
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
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const fileName = `product_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('products')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) {
        Alert.alert('Error', `No se pudo subir la imagen: ${error.message}`);
        return null;
      }

      const { data } = supabase.storage.from('products').getPublicUrl(fileName);
      return data?.publicUrl ?? null;
    } catch (error: any) {
      Alert.alert('Error', `Error al subir la imagen: ${error.message}`);
      return null;
    }
  };

  const handleAddProduct = async () => {
    if (!newProductName || !newProductPrice || !newProductCategory) {
      Alert.alert('Error', 'Por favor completa todos los campos, incluyendo la categoría');
      return;
    }

    const price = parseFloat(newProductPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Ingresa un precio válido');
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        imageUrl = await uploadImageToSupabase();
      }

      await addDoc(collection(db, 'products'), {
        name: newProductName,
        price,
        imageUrl,
        category: newProductCategory,
      });

      setNewProductName('');
      setNewProductPrice('');
      setNewProductCategory('');
      setImageUri(null);
      fetchProducts();
      Alert.alert('Éxito', 'Producto agregado correctamente');
    } catch (error) {
      console.error('Error al agregar producto:', error);
      Alert.alert('Error', 'No se pudo agregar el producto');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      fetchProducts();
      Alert.alert('Eliminado', 'Producto eliminado correctamente');
    } catch (error) {
      console.error('Error eliminando producto:', error);
      Alert.alert('Error', 'No se pudo eliminar el producto');
    }
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'users'), {
        name: newUserName,
        email: newUserEmail,
        points: 0,
      });
      setUsers([...users, { id: docRef.id, name: newUserName, email: newUserEmail, points: 0 }]);
      setNewUserName('');
      setNewUserEmail('');
      setAddingUser(false);
      Alert.alert('Éxito', 'Usuario creado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el usuario');
    }
  };

  const handleAddPoints = async () => {
    if (!selectedUser || isNaN(Number(pointsToAdd))) {
      Alert.alert('Error', 'Selecciona un usuario y pon un número válido');
      return;
    }

    const newTotal = selectedUser.points + Number(pointsToAdd);
    try {
      const ref = doc(db, 'users', selectedUser.id);
      await updateDoc(ref, { points: newTotal });
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, points: newTotal } : u));
      setSelectedUser(null);
      setPointsToAdd('');
      Alert.alert('Éxito', 'Puntos asignados correctamente');
    } catch (e) {
      Alert.alert('Error', 'No se pudo asignar puntos');
    }
  };

 
  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    
    try {
      
      if (type === BarCodeScanner.Constants.BarCodeType.qr && data.startsWith('add-points:')) {
        const userId = data.split(':')[1];
        setScannedUserId(userId);
        
        // Buscar el usuario en la lista
        const user = users.find(u => u.id === userId);
        
        if (user) {
          setSelectedUser(user);
          setPointsToAdd('125'); // Valor predeterminado
          Alert.alert('QR Escaneado', `Usuario encontrado: ${user.name}`);
        } else {
          Alert.alert('Error', 'Usuario no encontrado en la base de datos');
        }
      } else {
        Alert.alert('Error', 'Código QR no válido');
      }
    } catch (error) {
      console.error('Error al procesar QR:', error);
      Alert.alert('Error', 'Error al procesar el código QR');
    } finally {
      setShowScanner(false);
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.itemContainer}>
      {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.image} />}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{item.price} puntos</Text>
        <Text style={styles.category}>Categoría: {item.category}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteProduct(item.id)}>
        <Text style={styles.deleteButtonText}>Eliminar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => setSelectedUser(item)}
    >
      <Text style={styles.userName}>{item.name}</Text>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={styles.userPoints}>Puntos: {item.points}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panel de Administración</Text>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Productos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Usuarios</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#00A859" style={styles.loader} />
      ) : (
        <ScrollView style={styles.contentContainer}>
          {activeTab === 'products' ? (
            <>
              <Text style={styles.sectionTitle}>Gestión de Productos</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Nombre del producto"
                value={newProductName}
                onChangeText={setNewProductName}
              />
              <TextInput
                style={styles.input}
                placeholder="Precio en puntos"
                keyboardType="numeric"
                value={newProductPrice}
                onChangeText={setNewProductPrice}
              />
              <Picker
                selectedValue={newProductCategory}
                onValueChange={(itemValue) => setNewProductCategory(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Selecciona una categoría" value="" />
                {categories.map((category) => (
                  <Picker.Item key={category} label={category} value={category} />
                ))}
              </Picker>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                <Text style={styles.imagePickerText}>
                  {imageUri ? 'Imagen seleccionada' : 'Seleccionar imagen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addButton} onPress={handleAddProduct}>
                <Text style={styles.addButtonText}>Agregar Producto</Text>
              </TouchableOpacity>

              <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                renderItem={renderProductItem}
                scrollEnabled={false}
                contentContainerStyle={styles.list}
              />
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Gestión de Usuarios</Text>
              
              {/* Botón para escanear QR */}
              <TouchableOpacity 
                style={styles.qrButton} 
                onPress={() => setShowScanner(true)}
                disabled={hasPermission === false}
              >
                <MaterialIcons name="qr-code-scanner" size={24} color="white" />
                <Text style={styles.qrButtonText}>Escanear QR de Usuario</Text>
              </TouchableOpacity>

              {hasPermission === false && (
                <Text style={styles.errorText}>No se otorgaron permisos para la cámara</Text>
              )}

              {users.length === 0 ? (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.emptyText}>No hay usuarios registrados.</Text>
                  <TouchableOpacity style={styles.button} onPress={() => setAddingUser(true)}>
                    <Text style={styles.buttonText}>Agregar Usuario</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <FlatList
                    data={users}
                    keyExtractor={(item) => item.id}
                    renderItem={renderUserItem}
                    scrollEnabled={false}
                    contentContainerStyle={styles.list}
                  />
                  <TouchableOpacity style={styles.addButton} onPress={() => setAddingUser(true)}>
                    <Text style={styles.addButtonText}>+ Agregar nuevo usuario</Text>
                  </TouchableOpacity>
                </>
              )}

              {addingUser && (
                <View style={styles.form}>
                  <Text style={styles.subtitle}>Nuevo Usuario</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre"
                    value={newUserName}
                    onChangeText={setNewUserName}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Correo"
                    value={newUserEmail}
                    onChangeText={setNewUserEmail}
                    keyboardType="email-address"
                  />
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
                  <TextInput
                    style={styles.input}
                    placeholder="Puntos a agregar"
                    value={pointsToAdd}
                    onChangeText={setPointsToAdd}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.button} onPress={handleAddPoints}>
                    <Text style={styles.buttonText}>Asignar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedUser(null)}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Modal del escáner QR */}
      <Modal
        visible={showScanner}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerText}>Escanea el código QR del usuario</Text>
          </View>
          <TouchableOpacity 
            style={styles.closeScannerButton} 
            onPress={() => {
              setScanned(false);
              setShowScanner(false);
            }}
          >
            <Text style={styles.closeScannerButtonText}>Cerrar Escáner</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00A859',
    textAlign: 'center',
    marginVertical: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#00A859',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  loader: {
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#333333',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#333333',
    padding: 12,
  },
  imagePicker: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00A859',
  },
  imagePickerText: {
    color: '#00A859',
    fontSize: 16,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#FFC107',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  addButtonText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#00A859',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D32F2F',
  },
  cancelButtonText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: 70,
    height: 70,
    marginRight: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  price: {
    fontSize: 14,
    color: '#666666',
  },
  category: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  userItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  userPoints: {
    fontSize: 14,
    color: '#00A859',
    marginTop: 4,
    fontWeight: '500',
  },
  form: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    elevation: 2,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginVertical: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
  },
  qrButton: {
    flexDirection: 'row',
    backgroundColor: '#00A859',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  scannerContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00A859',
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: 'white',
    fontSize: 18,
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  closeScannerButton: {
    backgroundColor: '#D32F2F',
    padding: 15,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeScannerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});