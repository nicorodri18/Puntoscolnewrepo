import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, orderBy, query, updateDoc, where, increment } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  amount: number;
  isActive: boolean;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usageCount?: number;
  isWelcome?: boolean;
}

type PaymentSummary =
  | { method: 'points'; pointsUsed: number }
  | {
      method: 'card';
      cardBrand: string;
      last4: string;
      cardholderName: string;
      pointsPurchased: number;
      processedAt: string;
    }
  | { method: 'coupon'; couponCode: string; processedAt: string };

type CardPaymentSummary = Extract<PaymentSummary, { method: 'card' }>;

interface PurchaseHistory {
  id: string;
  items: CartItem[];
  date: string;
  total: number;
  subtotal?: number;
  discount?: number;
  couponCode?: string;
  payment?: PaymentSummary;
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
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [processingRedeem, setProcessingRedeem] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pointsToBuyInput, setPointsToBuyInput] = useState('');

  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const HISTORY_STORAGE_KEY = '@LocalPurchaseHistory';

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const couponDiscount = useMemo(
    () => (appliedCoupon ? calculateCouponDiscount(cartSubtotal, appliedCoupon) : 0),
    [cartSubtotal, appliedCoupon],
  );
  const payableTotal = useMemo(
    () => Math.max(0, cartSubtotal - couponDiscount),
    [cartSubtotal, couponDiscount],
  );
  const activeCoupons = useMemo(
    () => availableCoupons.filter((coupon) => coupon.isActive && !isCouponExpired(coupon)),
    [availableCoupons],
  );

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchProducts();
      loadLocalPurchaseHistory();
      fetchCoupons();
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

  const handleCouponCheckout = async () => {
    if (!appliedCoupon) {
      Alert.alert('Cupón requerido', 'Aplica un cupón antes de intentar pagar con él.');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos antes de pagar con el cupón.');
      return;
    }
    const subtotal = cartSubtotal;
    const discount = couponDiscount;
    const total = Math.max(0, payableTotal);
    if (discount <= 0) {
      Alert.alert('Cupón inválido', 'El cupón aplicado no genera descuento sobre el total.');
      return;
    }
    if (total > 0) {
      Alert.alert(
        'Cupón insuficiente',
        'Este cupón no cubre el total del carrito. Completa el pago con tarjeta o puntos.',
      );
      return;
    }

    setProcessingPayment(true);
    try {
      const paymentSummary: PaymentSummary = {
        method: 'coupon',
        couponCode: appliedCoupon.code,
        processedAt: new Date().toISOString(),
      };
      const newPurchase: PurchaseHistory = {
        id: Date.now().toString(),
        items: [...cart],
        date: new Date().toISOString(),
        subtotal,
        discount,
        couponCode: appliedCoupon.code,
        total,
        payment: paymentSummary,
      };
      await savePurchaseToHistory(newPurchase);
      await markCouponAsUsed(appliedCoupon);
      setCart([]);
      handleClearCoupon();
      Alert.alert('Cupón aplicado', 'Tu compra se procesó exitosamente con el cupón.');
    } catch (error) {
      console.error('Error al procesar pago con cupón:', error);
      Alert.alert('Error', 'No se pudo procesar el pago con cupón.');
    } finally {
      setProcessingPayment(false);
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

  const fetchCoupons = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'coupons'));
      const data: Coupon[] = snapshot.docs.map((docSnap) => {
        const couponData = docSnap.data() as any;
        return {
          id: docSnap.id,
          code: (couponData.code || '').toUpperCase(),
          description: couponData.description || '',
          discountType: couponData.discountType === 'fixed' ? 'fixed' : 'percent',
          amount: Number(couponData.amount) || 0,
          isActive: couponData.isActive !== false,
          expiresAt: couponData.expiresAt || null,
          usageLimit: couponData.usageLimit != null ? Number(couponData.usageLimit) : null,
          usageCount: Number(couponData.usageCount || 0),
          isWelcome: couponData.isWelcome ?? false,
        };
      });
      setAvailableCoupons(data);
    } catch (error) {
      console.error('Error al obtener cupones:', error);
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

  function isCouponExpired(coupon: Coupon) {
    if (!coupon.expiresAt) return false;
    const expiresAt = new Date(coupon.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) return false;
    return expiresAt.getTime() < Date.now();
  }

  function calculateCouponDiscount(subtotal: number, coupon: Coupon) {
    if (!coupon || subtotal <= 0) return 0;
    const rawDiscount =
      coupon.discountType === 'percent'
        ? (subtotal * coupon.amount) / 100
        : coupon.amount;
    const normalized = Math.min(subtotal, Math.max(0, rawDiscount));
    return Math.round(normalized);
  }

  const handleApplyCoupon = () => {
    const rawCode = couponCodeInput.trim().toUpperCase();
    if (!rawCode) {
      setCouponError('Ingresa un código de cupón.');
      setCouponSuccess(null);
      return;
    }
    const coupon = availableCoupons.find((c) => c.code === rawCode);
    if (!coupon || !coupon.isActive) {
      setCouponError('Cupón no encontrado o inactivo.');
      setCouponSuccess(null);
      return;
    }
    if (isCouponExpired(coupon)) {
      setCouponError('Este cupón ya expiró.');
      setCouponSuccess(null);
      return;
    }
    if (coupon.usageLimit != null && coupon.usageCount != null && coupon.usageCount >= coupon.usageLimit) {
      setCouponError('Este cupón alcanzó el número máximo de usos.');
      setCouponSuccess(null);
      return;
    }
    if (coupon.isWelcome && purchaseHistory.length > 0) {
      setCouponError('Este cupón es exclusivo para nuevos usuarios.');
      setCouponSuccess(null);
      return;
    }
    setAppliedCoupon(coupon);
    setCouponCodeInput(rawCode);
    setCouponError(null);
    const discountText =
      coupon.discountType === 'percent'
        ? `${coupon.amount}%`
        : `${coupon.amount} pts`;
    setCouponSuccess(`Cupón ${coupon.code} aplicado. Descuento: ${discountText}.`);
  };

  const handleClearCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError(null);
    setCouponSuccess(null);
  };

  const markCouponAsUsed = async (coupon: Coupon | null) => {
    if (!coupon) return;
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), {
        usageCount: increment(1),
      });
      setAvailableCoupons((prev) =>
        prev.map((c) => {
          if (c.id !== coupon.id) return c;
          const nextUsage = (c.usageCount || 0) + 1;
          const reachedLimit = c.usageLimit != null && nextUsage >= c.usageLimit;
          return {
            ...c,
            usageCount: nextUsage,
            isActive: reachedLimit ? false : c.isActive,
          };
        }),
      );
    } catch (error) {
      console.error('Error al actualizar el cupón:', error);
    }
  };

  const sanitizeCardNumber = (value: string) => value.replace(/\D/g, '');

  const detectCardBrand = (value: string) => {
    if (/^4\d{12,18}$/.test(value)) return 'Visa';
    if (/^5[1-5]\d{14}$/.test(value)) return 'Mastercard';
    if (/^3[47]\d{13}$/.test(value)) return 'Amex';
    if (/^6(?:011|5\d{2})\d{12}$/.test(value)) return 'Discover';
    return 'Tarjeta';
  };

  const resetPaymentForm = () => {
    setCardholderName('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setPointsToBuyInput('');
  };

  const handleProcessPayment = async () => {
    const holderName = cardholderName.trim();
    const sanitizedNumber = sanitizeCardNumber(cardNumber);
    const expiryTrimmed = cardExpiry.trim();
    const cvvTrimmed = cardCvv.trim();

    if (!holderName || !sanitizedNumber || !expiryTrimmed || !cvvTrimmed) {
      Alert.alert('Datos incompletos', 'Completa todos los campos para procesar el pago simulado.');
      return;
    }

    if (!userData) {
      Alert.alert('Error', 'No se pudo cargar la información del usuario.');
      return;
    }

    const requestedPoints = Number(pointsToBuyInput);
    if (!Number.isFinite(requestedPoints) || requestedPoints <= 0) {
      Alert.alert('Monto inválido', 'Ingresa una cantidad de puntos válida para comprar.');
      return;
    }
    const pointsToBuy = Math.floor(requestedPoints);

    setProcessingPayment(true);
    try {
      const newPointsBalance = userData.points + pointsToBuy;
      const paymentSummary: PaymentSummary = {
        method: 'card',
        cardBrand: detectCardBrand(sanitizedNumber),
        last4: sanitizedNumber.slice(-4),
        cardholderName: holderName,
        processedAt: new Date().toISOString(),
        pointsPurchased: pointsToBuy,
      };
      const newPurchase: PurchaseHistory = {
        id: Date.now().toString(),
        items: [],
        date: new Date().toISOString(),
        total: pointsToBuy,
        payment: paymentSummary,
      };
      await updateDoc(doc(db, 'users', userData.docId), { points: newPointsBalance });
      await savePurchaseToHistory(newPurchase);
      setUserData({ ...userData, points: newPointsBalance });
      setShowPaymentModal(false);
      resetPaymentForm();
      Alert.alert('Recarga exitosa', `Se añadieron ${pointsToBuy} pts a tu cuenta.`);
    } catch (error) {
      console.error('Error al simular el pago:', error);
      Alert.alert('Error', 'No se pudo procesar el pago simulado.');
    } finally {
      setProcessingPayment(false);
    }
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
    if (cart.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos antes de canjear.');
      return;
    }
    if (processingRedeem) return;

    const totalCost = Math.max(0, payableTotal);
    if (userData.points < totalCost) {
      Alert.alert('Puntos insuficientes', 'No tienes suficientes puntos para canjear estos productos.');
      return;
    }

    setProcessingRedeem(true);
    try {
      const newPurchase: PurchaseHistory = {
        id: Date.now().toString(),
        items: [...cart],
        date: new Date().toISOString(),
        subtotal: cartSubtotal,
        discount: couponDiscount,
        couponCode: appliedCoupon?.code,
        total: totalCost,
        payment: { method: 'points', pointsUsed: totalCost },
      };
      const updatedPoints = userData.points - totalCost;
      await updateDoc(doc(db, 'users', userData.docId), { points: updatedPoints });
      await savePurchaseToHistory(newPurchase);
      await markCouponAsUsed(appliedCoupon);
      setUserData({ ...userData, points: updatedPoints });
      setCart([]);
      handleClearCoupon();
      Alert.alert('Canje exitoso', `Tu canje de ${cart.length} productos ha sido procesado.`);
    } catch (error) {
      console.error('Error al procesar el canje:', error);
      Alert.alert('Error', 'No se pudo procesar el canje');
    } finally {
      setProcessingRedeem(false);
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
    router.push('/EditProfile');
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

  const renderHistoryItem = ({ item }: { item: PurchaseHistory }) => {
    const cardPayment: CardPaymentSummary | null =
      item.payment && item.payment.method === 'card' ? item.payment : null;
    const isPointTopUp =
      cardPayment != null &&
      (!item.items || item.items.length === 0) &&
      cardPayment.pointsPurchased > 0;

    return (
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
        {item.items.length > 0 ? (
          <View style={styles.historyItems}>
            {item.items.map((product, index) => (
              <Text key={index} style={styles.historyProduct}>
                {product.quantity}x {product.name} ({product.price * product.quantity} pts)
              </Text>
            ))}
          </View>
        ) : null}
        {typeof item.subtotal === 'number' ? (
          <Text style={styles.historyMeta}>Subtotal: {item.subtotal} pts</Text>
        ) : null}
        {item.couponCode ? (
          <Text style={styles.historyMeta}>
            Cupón {item.couponCode} aplicado (-{item.discount ?? 0} pts)
          </Text>
        ) : null}
        {cardPayment ? (
          <>
            <Text style={styles.historyPayment}>
              Compra con {cardPayment.cardBrand} ({cardPayment.cardholderName}) terminada en {cardPayment.last4}
            </Text>
            {isPointTopUp ? (
              <Text style={styles.historyMeta}>
                Recarga de puntos: +{cardPayment.pointsPurchased} pts
              </Text>
            ) : null}
          </>
        ) : item.payment?.method === 'points' ? (
          <Text style={styles.historyPayment}>
            Canje con puntos ({item.payment.pointsUsed} pts)
          </Text>
        ) : item.payment?.method === 'coupon' ? (
          <Text style={styles.historyPayment}>
            Pago cubierto con cupón {item.payment.couponCode}
          </Text>
        ) : null}
        <Text style={styles.historyTotal}>
          {isPointTopUp
            ? `Saldo cargado: +${cardPayment?.pointsPurchased ?? 0} pts`
            : `Total: ${item.total} pts`}
        </Text>
      </View>
    );
  };

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

        {activeCoupons.length > 0 && (
          <View style={styles.couponSection}>
            <Text style={styles.couponTitle}>Cupones disponibles</Text>
            {activeCoupons.map((coupon) => (
              <View key={coupon.id} style={styles.couponCard}>
                <Text style={styles.couponCode}>{coupon.code}</Text>
                {coupon.description ? <Text style={styles.couponDescription}>{coupon.description}</Text> : null}
                <Text style={styles.couponMeta}>
                  {coupon.discountType === 'percent'
                    ? `${coupon.amount}% de descuento`
                    : `${coupon.amount} pts de descuento`}
                  {coupon.isWelcome ? ' · Solo nuevos usuarios' : ''}
                  {coupon.expiresAt
                    ? ` · Vence ${new Date(coupon.expiresAt).toLocaleDateString('es-ES')}`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

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
              <View style={styles.couponInputRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Código de cupón"
                  value={couponCodeInput}
                  autoCapitalize="characters"
                  onChangeText={(value) => {
                    setCouponCodeInput(value.toUpperCase());
                    setCouponError(null);
                    setCouponSuccess(null);
                  }}
                />
                <TouchableOpacity
                  style={styles.couponButton}
                  onPress={appliedCoupon ? handleClearCoupon : handleApplyCoupon}
                >
                  <Text style={styles.couponButtonText}>{appliedCoupon ? 'Quitar' : 'Aplicar'}</Text>
                </TouchableOpacity>
              </View>
              {couponError ? <Text style={styles.couponFeedbackError}>{couponError}</Text> : null}
              {couponSuccess ? <Text style={styles.couponFeedbackSuccess}>{couponSuccess}</Text> : null}
              <View style={styles.totalsBox}>
                <Text style={styles.cartSubtotalText}>Subtotal: {cartSubtotal} pts</Text>
                {appliedCoupon ? (
                  <Text style={styles.cartDiscountText}>
                    Descuento ({appliedCoupon.code}): -{couponDiscount} pts
                  </Text>
                ) : null}
                <Text style={styles.cartTotal}>Total: {payableTotal} pts</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.redeemButton,
                  (!userData || userData.points < payableTotal || processingRedeem) && styles.disabledButton,
                ]}
                onPress={handleRedeemCart}
                disabled={
                  processingRedeem ||
                  !userData ||
                  userData.points < payableTotal
                }
              >
                <Text style={styles.redeemButtonText}>
                  {processingRedeem ? 'Procesando...' : 'Canjear con puntos'}
                </Text>
              </TouchableOpacity>
              {appliedCoupon ? (
                <TouchableOpacity
                  style={[
                    styles.couponPayButton,
                    processingPayment && styles.disabledButton,
                  ]}
                  onPress={handleCouponCheckout}
                  disabled={processingPayment}
                >
                  <Text style={styles.couponPayButtonText}>
                    {processingPayment ? 'Procesando...' : 'Pagar con cupón'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
          <TouchableOpacity
            style={[
              styles.payButton,
              processingPayment && styles.disabledButton,
            ]}
            onPress={() => {
              resetPaymentForm();
              const neededPoints = Math.max(
                0,
                Math.ceil(Math.max(0, payableTotal - (userData?.points ?? 0))),
              );
              setPointsToBuyInput(neededPoints > 0 ? String(neededPoints) : '');
              setProcessingPayment(false);
              setShowPaymentModal(true);
            }}
            disabled={processingPayment}
          >
            <Text style={styles.payButtonText}>Recargar puntos con tarjeta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPaymentModal(false);
          setProcessingPayment(false);
          resetPaymentForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Comprar puntos con tarjeta</Text>
              <Text style={styles.modalTotal}>
                Saldo actual: {userData?.points ?? 0} pts
              </Text>
              <Text style={styles.modalInfo}>
                Total del carrito: {cartSubtotal} pts · Falta por cubrir: {Math.max(
                  0,
                  payableTotal - (userData?.points ?? 0),
                )}{' '}
                pts
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Puntos a comprar"
                value={pointsToBuyInput}
                onChangeText={(value) => setPointsToBuyInput(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Nombre del titular"
                value={cardholderName}
                onChangeText={setCardholderName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Número de tarjeta"
                value={cardNumber}
                onChangeText={setCardNumber}
                keyboardType="number-pad"
                maxLength={19}
              />
              <View style={styles.modalRow}>
                <TextInput
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChangeText={setCardExpiry}
                  keyboardType="number-pad"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="CVV"
                  value={cardCvv}
                  onChangeText={setCardCvv}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
              </View>
              {appliedCoupon ? (
                <Text style={styles.modalInfo}>
                  Incluye cupón {appliedCoupon.code}: -{couponDiscount} pts
                </Text>
              ) : null}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowPaymentModal(false);
                    setProcessingPayment(false);
                    resetPaymentForm();
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleProcessPayment}
                  disabled={processingPayment}
                >
                  <Text style={styles.modalConfirmText}>
                    {processingPayment ? 'Procesando...' : 'Comprar puntos'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // Fondo artesanal
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,243,224,0.55)' },

  // Estructura
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

  // Cupones
  couponSection: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0C097',
    padding: 14,
  },
  couponTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#5C4033',
    marginBottom: 8,
    textAlign: 'center',
  },
  couponCard: {
    backgroundColor: '#FFFDF6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0C097',
    padding: 12,
    marginBottom: 8,
  },
  couponCode: { fontSize: 15, fontWeight: '800', color: '#C75B12' },
  couponDescription: { fontSize: 13, color: '#6B4F32', marginTop: 4 },
  couponMeta: { fontSize: 12, color: '#8C6A4B', marginTop: 6 },

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
    height: 220,
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
  historyMeta: { color: '#8C6A4B', fontSize: 12, marginBottom: 4 },
  historyPayment: { color: '#5C4033', fontSize: 12, marginBottom: 4, fontWeight: '600' },
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
  couponInputRow: { flexDirection: 'row', marginTop: 12, marginBottom: 6 },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0C097',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFDF6',
    color: '#5C4033',
    marginRight: 8,
  },
  couponButton: {
    backgroundColor: '#C75B12',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponButtonText: { color: '#FFF8E1', fontWeight: '700' },
  couponFeedbackError: { color: '#D32F2F', fontSize: 13, marginBottom: 4 },
  couponFeedbackSuccess: { color: '#388E3C', fontSize: 13, marginBottom: 4 },
  totalsBox: { marginTop: 6 },
  cartSubtotalText: { color: '#5C4033', fontWeight: '600', textAlign: 'right' },
  cartDiscountText: { color: '#C75B12', fontWeight: '700', textAlign: 'right', marginTop: 4 },
  cartTotal: { fontWeight: '800', fontSize: 16, color: '#5C4033', textAlign: 'right', marginTop: 6 },

  redeemButton: {
    backgroundColor: '#C75B12',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  redeemButtonText: { color: '#FFF8E1', fontWeight: '700', fontSize: 16 },
  couponPayButton: {
    backgroundColor: '#8BC34A',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#7CB342',
  },
  couponPayButtonText: { color: '#264d00', fontWeight: '800', fontSize: 16 },
  payButton: {
    backgroundColor: '#FFD54F',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E0C097',
  },
  payButtonText: { color: '#4E342E', fontWeight: '800', fontSize: 16 },

  // Modal de pago
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: { flex: 1, justifyContent: 'center' },
  modalContent: {
    backgroundColor: '#FFFDF6',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0C097',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5C4033',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C75B12',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0C097',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF8E1',
    color: '#5C4033',
    marginBottom: 12,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalInputHalf: { flex: 1, marginRight: 10 },
  modalInfo: {
    color: '#8C6A4B',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#D32F2F',
    marginRight: 8,
  },
  modalConfirmButton: {
    backgroundColor: '#C75B12',
    marginLeft: 8,
  },
  modalCancelText: { color: '#D32F2F', fontWeight: '700' },
  modalConfirmText: { color: '#FFF8E1', fontWeight: '700' },
});
