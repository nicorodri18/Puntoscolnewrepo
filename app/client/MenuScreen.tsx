import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { db } from '../../firebaseConfig';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  description?: string;
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
  const [activeSection, setActiveSection] = useState<'catalog' | 'home' | 'points' | 'profile'>('catalog');

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

      const data = snapshot.docs.map((docSnap) => {
        const productData = docSnap.data() as any;
        let imageUrl = productData.imageUrl || '';
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://xfhmqxgbrmpijmwcsgkn.supabase.co/storage/v1/object/public/products/${imageUrl}`;
        }
        return {
          id: docSnap.id,
          name: productData.name,
          price: productData.price,
          imageUrl,
          category: productData.category || 'Sin categoría',
          description: typeof productData.description === 'string' ? productData.description : '',
        } as Product;
      });

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
      if (jsonValue) setPurchaseHistory(JSON.parse(jsonValue) as PurchaseHistory[]);
    } catch (error) {
      console.error('Error al cargar historial local:', error);
      Alert.alert('Error', 'No se pudo cargar el historial de compras');
    }
  };

  const savePurchaseToHistory = async (newPurchase: PurchaseHistory) => {
    const updatedHistory = [newPurchase, ...purchaseHistory];
    setPurchaseHistory(updatedHistory);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { ...product, quantity: 1 }];
    });
    Alert.alert('Éxito', `${product.name} agregado al carrito`);
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
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
    const cleanUrl = item.imageUrl?.trim();
    return (
      <View style={styles.productContainer}>
        <View style={styles.productHeader}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productPoints}>{item.price} pts</Text>
        </View>

        {item.description ? (
          <Text style={styles.productDesc} numberOfLines={2} ellipsizeMode="tail">
            {item.description}
          </Text>
        ) : null}

        {cleanUrl ? (
          <Image
            source={{ uri: cleanUrl }}
            style={styles.productImage}
            resizeMode="cover"
            onError={(e) => console.log('Error cargando imagen:', e.nativeEvent.error)}
          />
        ) : (
          <View style={[styles.productImage, styles.noImage]}>
            <Icon name="image-not-supported" size={40} color="#BCAAA4" />
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
      <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
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
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
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
        selectedCategory === item && styles.selectedCategoryButton,
      ]}
      onPress={() => setSelectedCategory(item)}
    >
      <Text
        style={[
          styles.categoryText,
          selectedCategory === item && styles.selectedCategoryText,
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C75B12" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/images/fondo-arepabuelas.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Marca */}
        <View style={styles.brand}>
          <Image source={require('../../assets/images/arepabuelas1.png')} style={styles.brandLogo} />
          <Text style={styles.brandTitle}>Arepabuelas de la Esquina</Text>
        </View>

        {/* Header funcional */}
        <View style={styles.header}>
          <Text style={styles.title}>Catálogo</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={handleProfile} style={styles.iconButton} accessibilityLabel="Perfil">
              <Icon name="person" size={28} color="#C75B12" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton} accessibilityLabel="Cerrar sesión">
              <Icon name="logout" size={28} color="#D32F2F" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjeta de puntos */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Tus puntos</Text>
          <Text style={styles.pointsValue}>{userData?.points ?? 0}</Text>
          <Text style={styles.expiryText}>Vencen el 31/12/2025</Text>
        </View>

        {/* Categorías */}
        <FlatList
          horizontal
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoriesList}
          showsHorizontalScrollIndicator={false}
        />

        {/* Productos */}
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
          scrollEnabled={false}
        />

        {/* Historial */}
        <TouchableOpacity onPress={() => setShowHistory(!showHistory)} style={styles.historyToggle}>
          <Text style={styles.historyToggleText}>
            {showHistory ? 'Ocultar historial' : 'Mostrar historial de canjes'}
          </Text>
          <Icon
            name={showHistory ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={24}
            color="#C75B12"
          />
        </TouchableOpacity>

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

        {/* Carrito */}
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
                disabled={
                  !userData ||
                  userData.points < cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
                }
              >
                <Text style={styles.redeemButtonText}>Canjear</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Nav (misma funcionalidad) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navButton, activeSection === 'points' && styles.navButtonActive]}
          onPress={handlePoints}
        >
          <Icon name="attach-money" size={28} color={activeSection === 'points' ? '#FFF8E1' : '#6B4F32'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, activeSection === 'home' && styles.navButtonActive]}
          onPress={handleHome}
        >
          <Icon name="home" size={28} color={activeSection === 'home' ? '#FFF8E1' : '#6B4F32'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, activeSection === 'profile' && styles.navButtonActive]}
          onPress={handleProfile}
        >
          <Icon name="person" size={28} color={activeSection === 'profile' ? '#FFF8E1' : '#6B4F32'} />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // Fondo artesanal
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,243,224,0.55)' },

  // Estructura
  container: { flex: 1, backgroundColor: '#FFF8E1' },
  scrollContent: { paddingBottom: 110 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Marca superior
  brand: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 8,
  },
  brandLogo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#D7A86E',
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 16,
    color: '#8C6A4B',
    letterSpacing: 0.6,
  },

  // Header funcional
  header: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0C097',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#C75B12',
    letterSpacing: 0.4,
  },
  headerIcons: { flexDirection: 'row' },
  iconButton: { marginLeft: 10, padding: 6, borderRadius: 10, backgroundColor: '#FFF8E1' },

  // Tarjeta de puntos
  pointsCard: {
    margin: 16,
    backgroundColor: '#FFFDF6',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0C097',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  pointsLabel: { fontSize: 14, color: '#8C6A4B' },
  pointsValue: { fontSize: 36, fontWeight: '800', color: '#C75B12', marginVertical: 6 },
  expiryText: { fontSize: 12, color: '#8C6A4B' },

  // Secciones
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5C4033',
    marginLeft: 16,
    marginTop: 10,
    marginBottom: 12,
  },

  // Chips categorías
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF8E1',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  selectedCategoryButton: { backgroundColor: '#C75B12', borderColor: '#C75B12' },
  categoryText: { color: '#6B4F32', fontSize: 13, fontWeight: '600' },
  selectedCategoryText: { color: '#FFF8E1', fontWeight: '700' },

  // Productos
  productsList: { paddingHorizontal: 12, paddingBottom: 20 },
  productsRow: { justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 14 },

  productContainer: {
    backgroundColor: '#FFFDF6',
    borderRadius: 16,
    width: '48%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0C097',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  productName: { fontSize: 15, fontWeight: '700', color: '#5C4033', flex: 1 },
  productPoints: { fontSize: 14, color: '#8C6A4B', marginLeft: 8 },

  productDesc: { fontSize: 12, color: '#8C6A4B', marginBottom: 8 },

  productImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  noImage: { justifyContent: 'center', alignItems: 'center' },

  productCategory: { fontSize: 12, color: '#8C6A4B', marginBottom: 10, fontStyle: 'italic' },
  addButton: {
    backgroundColor: '#C75B12',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disabledButton: { backgroundColor: '#E0BBA4' },
  addButtonText: { color: '#FFF8E1', fontWeight: '700' },

  // Historial
  historyToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  historyToggleText: { fontSize: 14, color: '#C75B12', marginRight: 6, fontWeight: '700' },
  historySection: {
    backgroundColor: '#FFFDF6',
    margin: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  emptyText: { textAlign: 'center', color: '#8C6A4B', marginVertical: 16, paddingHorizontal: 20 },

  historyItem: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  historyDate: { fontWeight: '700', color: '#5C4033', marginBottom: 4 },
  historyItems: { marginBottom: 6 },
  historyProduct: { color: '#6B4F32' },
  historyTotal: { fontWeight: '800', color: '#C75B12', textAlign: 'right' },

  // Carrito
  cartSection: {
    backgroundColor: '#FFFDF6',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E4D7',
  },
  cartItemName: { flex: 2, color: '#5C4033', fontWeight: '600' },
  quantityControls: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  quantityText: { marginHorizontal: 10, color: '#5C4033', fontWeight: '700' },
  cartItemPrice: { flex: 1, textAlign: 'right', color: '#5C4033', fontWeight: '700' },
  cartTotal: { fontWeight: '800', fontSize: 16, color: '#5C4033', textAlign: 'right', marginTop: 10 },

  redeemButton: {
    backgroundColor: '#C75B12',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  redeemButtonText: { color: '#FFF8E1', fontWeight: '700', fontSize: 16 },

  // Bottom nav (misma lógica)
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderTopWidth: 1,
    borderTopColor: '#E0C097',
    paddingVertical: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navButton: { alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 24 },
  navButtonActive: { backgroundColor: '#C75B12' },
});