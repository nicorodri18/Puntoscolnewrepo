import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../supabaseClient';
import { Image } from 'react-native'; 
import Icon from 'react-native-vector-icons/MaterialIcons';
import { db } from '../../firebaseConfig';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface UserData {
  docId: string;
  points: number;
  email: string;
}

interface PurchaseHistory {
  id: string;
  items: CartItem[];
  date: string;
  total: number;
}

// Helpers seguros para URLs
const toSafeHttps = (maybeUrl: string | undefined | null): string => {
  try {
    const raw = (maybeUrl ?? '').toString().trim();
    if (!raw) return '';
    const u = new URL(raw);
    // fuerza https por si guardaron http
    if (u.protocol !== 'https:') u.protocol = 'https:';
    return u.toString();
  } catch {
    return '';
  }
};

export default function MenuScreen() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSection, setActiveSection] = useState('catalog');

  // trackeo de imágenes que fallaron para mostrar placeholder
  const [brokenImage, setBrokenImage] = useState<Record<string, boolean>>({});

  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const HISTORY_STORAGE_KEY = '@LocalPurchaseHistory';

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchProducts();
      loadLocalPurchaseHistory();
    } else {
      setLoading(false);
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedCategory === 'Todas') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(product => product.category === selectedCategory));
    }
  }, [selectedCategory, products]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', user?.email));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('Usuario no encontrado');
      const docSnap = snapshot.docs[0];
      setUserData({
        docId: docSnap.id,
        points: docSnap.data().points,
        email: docSnap.data().email,
      });
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
      Alert.alert('Error', 'No se pudieron obtener los datos del usuario');
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

const fetchProducts = async () => {
  try {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    const data = snapshot.docs.map((doc) => {
      const productData = doc.data();
      let imageUrl = productData.imageUrl || '';

      // 🔧 Si la URL no es completa, la reconstruimos con Supabase Storage
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `https://xfhmqxgbrmpijmwcsgkn.supabase.co/storage/v1/object/public/products/${imageUrl}`;
      }

      return {
        id: doc.id,
        name: productData.name,
        price: productData.price,
        imageUrl,
        category: productData.category || 'Sin categoría',
      };
    }) as Product[];

    setProducts(data);
    setFilteredProducts(data);

    const uniqueCategories = Array.from(new Set(data.map((p) => p.category)));
    setCategories(['Todas', ...uniqueCategories]);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    Alert.alert('Error', 'No se pudieron obtener los productos');
  }
};

  const loadLocalPurchaseHistory = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (jsonValue) {
        const history = JSON.parse(jsonValue) as PurchaseHistory[];
        setPurchaseHistory(history);
      }
    } catch (error) {
      console.error('Error al cargar historial local:', error);
      Alert.alert('Error', 'No se pudo cargar el historial de compras');
    }
  };

  const savePurchaseToHistory = async (newPurchase: PurchaseHistory) => {
    try {
      const updatedHistory = [newPurchase, ...purchaseHistory];
      setPurchaseHistory(updatedHistory);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error al guardar historial:', error);
      throw error;
    }
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    Alert.alert('Éxito', `${product.name} agregado al carrito`);
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRedeemCart = async () => {
    if (!userData) {
      Alert.alert('Error', 'Datos del usuario no encontrados. Intenta iniciar sesión nuevamente.');
      return;
    }
    const totalCost = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (userData.points < totalCost) {
      Alert.alert('Puntos insuficientes', 'No tienes suficientes puntos para canjear estos productos.');
      return;
    }
    try {
      const newPurchase: PurchaseHistory = {
        id: Date.now().toString(),
        items: [...cart],
        date: new Date().toISOString(),
        total: totalCost,
      };
      const updatedPoints = userData.points - totalCost;
      await updateDoc(doc(db, 'users', userData.docId), { points: updatedPoints });
      await savePurchaseToHistory(newPurchase);
      setUserData({ ...userData, points: updatedPoints });
      setCart([]);
      Alert.alert('Compra exitosa', `Tu compra de ${cart.length} productos ha sido procesada.`);
    } catch (error) {
      console.error('Error al procesar el canje:', error);
      Alert.alert('Error', 'No se pudo procesar el canje');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión.');
    }
  };

  const handleProfile = () => {
    setActiveSection('profile');
    router.push('/EditProfile');
  };

  const handleChat = () => {
    setActiveSection('chat');
    router.push('/chat');
  };

  const handleHome = () => {
    setActiveSection('home');
    router.push('/client/MenuScreen');
  };

  const handlePoints = () => {
    setActiveSection('points');
    router.push('/QRPoints');
  };

  const toggleHistory = () => setShowHistory(!showHistory);

const renderProduct = ({ item }: { item: Product }) => {
  // Limpieza de URL para evitar espacios o saltos de línea
  const cleanUrl = item.imageUrl?.trim();

  return (
    <View style={styles.productContainer}>
      <View style={styles.productHeader}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPoints}>{item.price} pts</Text>
      </View>

      {cleanUrl ? (
        <Image
          source={{ uri: cleanUrl }}
          style={styles.productImage}
          resizeMode="cover"
          onError={(e) => console.log("❌ Error cargando imagen:", e.nativeEvent.error)}
          onLoadStart={() => console.log("⏳ Cargando imagen:", cleanUrl)}
          onLoadEnd={() => console.log("✅ Imagen cargada:", cleanUrl)}
        />
      ) : (
        <View style={[styles.productImage, styles.noImage]}>
          <Icon name="image-not-supported" size={40} color="#ccc" />
        </View>
      )}

      <Text style={styles.productCategory}>{item.category}</Text>
      <TouchableOpacity
        style={[
          styles.addButton,
          (!userData || userData.points < item.price) && styles.disabledButton,
        ]}
        onPress={() => handleAddToCart(item)}
        disabled={!userData || userData.points < item.price}
      >
        <Text style={styles.addButtonText}>Canjear</Text>
      </TouchableOpacity>
    </View>
  );
};

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <Text style={styles.cartItemName}>{item.name}</Text>
      <View style={styles.quantityControls}>
        <TouchableOpacity onPress={() => handleRemoveFromCart(item.id)}>
          <Icon name="remove-circle" size={24} color="#D32F2F" />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => handleAddToCart(item)}>
          <Icon name="add-circle" size={24} color="#00A859" />
        </TouchableOpacity>
      </View>
      <Text style={styles.cartItemPrice}>{item.price * item.quantity} pts</Text>
    </View>
  );

  const renderHistoryItem = ({ item }: { item: PurchaseHistory }) => (
    <View style={styles.historyItem}>
      <Text style={styles.historyDate}>
        {new Date(item.date).toLocaleDateString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })}
      </Text>
      <View style={styles.historyItems}>
        {item.items.map((product, index) => (
          <Text key={index} style={styles.historyProduct}>
            {product.quantity}x {product.name} ({product.price * product.quantity} pts)
          </Text>
        ))}
      </View>
      <Text style={styles.historyTotal}>Total: {item.total} pts</Text>
    </View>
  );

  const renderCategoryItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.categoryButton,
        selectedCategory === item && styles.selectedCategoryButton
      ]}
      onPress={() => setSelectedCategory(item)}
    >
      <Text
        style={[
          styles.categoryText,
          selectedCategory === item && styles.selectedCategoryText
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00A859" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CATÁLOGO</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={handleChat} style={styles.iconButton}>
              <Icon name="chat" size={28} color="#2196F3" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleProfile} style={styles.iconButton}>
              <Icon name="person" size={28} color="#00A859" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
              <Icon name="logout" size={28} color="#D32F2F" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Points Card */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Tus Puntos</Text>
          <Text style={styles.pointsValue}>{userData?.points ?? 0}</Text>
          <Text style={styles.expiryText}>Vencen el 31/12/2025</Text>
        </View>

        {/* Categories */}
        <FlatList
          horizontal
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoriesList}
          showsHorizontalScrollIndicator={false}
        />

        {/* Products */}
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productsRow}
          contentContainerStyle={styles.productsList}
          ListHeaderComponent={<Text style={styles.sectionTitle}>Productos Disponibles</Text>}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No hay productos en la categoría {selectedCategory}
            </Text>
          }
        />

        {/* History Toggle */}
        <TouchableOpacity onPress={toggleHistory} style={styles.historyToggle}>
          <Text style={styles.historyToggleText}>
            {showHistory ? 'Ocultar historial' : 'Mostrar historial de canjes'}
          </Text>
          <Icon name={showHistory ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} color="#00A859" />
        </TouchableOpacity>

        {/* Purchase History */}
        {showHistory && (
          <View style={styles.historySection}>
            {purchaseHistory.length === 0 ? (
              <Text style={styles.emptyText}>No hay registros de canjes</Text>
            ) : (
              <FlatList
                data={purchaseHistory}
                keyExtractor={(item) => item.id}
                renderItem={renderHistoryItem}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {/* Shopping Cart */}
        <View style={styles.cartSection}>
          <Text style={styles.sectionTitle}>Carrito</Text>
          {cart.length === 0 ? (
            <Text style={styles.emptyText}>Tu carrito está vacío</Text>
          ) : (
            <>
              <FlatList
                data={cart}
                keyExtractor={(item) => item.id}
                renderItem={renderCartItem}
                scrollEnabled={false}
              />
              <Text style={styles.cartTotal}>
                Total: {cart.reduce((sum, item) => sum + item.price * item.quantity, 0)} pts
              </Text>
              <TouchableOpacity
                style={styles.redeemButton}
                onPress={handleRedeemCart}
                disabled={!userData || userData.points < cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}
              >
                <Text style={styles.redeemButtonText}>Canjear</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

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
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingBottom: 80 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FF9800' },
  headerIcons: { flexDirection: 'row' },
  iconButton: { marginLeft: 15 },

  pointsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointsLabel: { fontSize: 16, color: '#757575' },
  pointsValue: { fontSize: 36, fontWeight: 'bold', color: '#F5C400', marginVertical: 10 },
  expiryText: { fontSize: 14, color: '#757575', marginTop: 6 },

  sectionTitle: {
    fontSize: 20, fontWeight: 'bold', color: '#212121', marginLeft: 15, marginTop: 20, marginBottom: 10,
  },

  categoriesList: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  categoryButton: {
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F0F0F0', marginRight: 10, borderWidth: 1, borderColor: '#E0E0E0',
  },
  selectedCategoryButton: { backgroundColor: '#FF9800', borderColor: '#FF9800' },
  categoryText: { color: '#212121' },
  selectedCategoryText: { color: '#FFFFFF', fontWeight: 'bold' },

  productsList: { paddingHorizontal: 10, paddingBottom: 20 },
  productsRow: { justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 15 },

  productContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 10, width: '48%', padding: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  productName: { fontSize: 16, fontWeight: 'bold', color: '#212121', flex: 1 },
  productPoints: { fontSize: 16, color: '#757575', marginLeft: 10 },

  productImage: {
    width: '100%', height: 140, borderRadius: 8, marginBottom: 10, backgroundColor: '#F2F2F2',
  },
  noImage: { justifyContent: 'center', alignItems: 'center' },
  noImageText: { marginTop: 6, fontSize: 12, color: '#999' },

  productCategory: { fontSize: 14, color: '#757575', marginBottom: 10, fontStyle: 'italic' },
  addButton: { backgroundColor: '#FF9800', borderRadius: 5, padding: 10, alignItems: 'center' },
  disabledButton: { backgroundColor: '#CCCCCC' },
  addButtonText: { color: '#FFFFFF', fontWeight: 'bold' },

  historyToggle: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    padding: 15, backgroundColor: '#FFFFFF', marginTop: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E0E0E0',
  },
  historyToggleText: { fontSize: 16, color: '#FF9800', marginRight: 5 },
  historySection: { backgroundColor: '#FFFFFF', padding: 15 },
  emptyText: { textAlign: 'center', color: '#757575', marginVertical: 20, paddingHorizontal: 20 },

  historyItem: { backgroundColor: '#F9F9F9', borderRadius: 5, padding: 10, marginBottom: 10 },
  historyDate: { fontWeight: 'bold', color: '#212121', marginBottom: 5 },
  historyItems: { marginBottom: 5 },
  historyProduct: { color: '#757575' },
  historyTotal: { fontWeight: 'bold', color: '#FF9800', textAlign: 'right' },

  cartSection: { backgroundColor: '#FFFFFF', padding: 15, marginTop: 20, borderTopWidth: 1, borderColor: '#E0E0E0' },
  cartItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  cartItemName: { flex: 2, color: '#212121' },
  quantityControls: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  quantityText: { marginHorizontal: 10, color: '#212121' },
  cartItemPrice: { flex: 1, textAlign: 'right', color: '#212121' },
  cartTotal: { fontWeight: 'bold', fontSize: 16, color: '#212121', textAlign: 'right', marginTop: 10 },

  redeemButton: { backgroundColor: '#FF9800', borderRadius: 5, padding: 15, alignItems: 'center', marginTop: 15 },
  redeemButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },

  bottomNav: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0',
    paddingVertical: 10, position: 'absolute', bottom: 0, left: 0, right: 0,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  navButton: { alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 25 },
  navButtonActive: { backgroundColor: '#FF9800' },
});