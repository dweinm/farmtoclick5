import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { productsAPI, ordersAPI } from '../services/api';
import { Product, SellerOrder, RootStackParamList } from '../types';

type FarmerDashboardNavigationProp = StackNavigationProp<RootStackParamList>;

const LALAMOVE_BOOKING_URL = 'https://web.lalamove.com/?shortlink=of9j9igz&c=ROW_ROW_USR-ALL_OWN_ACQ_WEB_ALL_Button&pid=WEB&af_xp=custom&source_caller=ui';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FFF3E0', text: '#E65100' },
  confirmed: { bg: '#E3F2FD', text: '#1565C0' },
  preparing: { bg: '#F3E5F5', text: '#7B1FA2' },
  ready: { bg: '#E0F7FA', text: '#00838F' },
  completed: { bg: '#E8F5E9', text: '#2E7D32' },
  delivered: { bg: '#E8F5E9', text: '#1B5E20' },
  cancelled: { bg: '#FFEBEE', text: '#C62828' },
  rejected: { bg: '#FFEBEE', text: '#C62828' },
};

const FarmerDashboardScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectionOrderId, setRejectionOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  const { user } = useAuth();
  const navigation = useNavigation<FarmerDashboardNavigationProp>();

  const loadFarmerData = useCallback(async () => {
    if (!user?.is_farmer) {
      setIsLoading(false);
      return;
    }
    try {
      const [productsRes, ordersRes] = await Promise.all([
        productsAPI.getProducts(),
        ordersAPI.getSellerOrders(),
      ]);
      setProducts(productsRes.data?.products || []);
      setSellerOrders(ordersRes.data?.orders || []);
    } catch (error) {
      console.error('Error loading farmer data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadFarmerData();
    }, [loadFarmerData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadFarmerData();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (status === 'rejected') {
      // Note: Alert.prompt is iOS-only - on Android, use a different approach
      Alert.prompt(
        'Reject Order',
        'Please provide a reason for rejection:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async (reason: string | undefined) => {
              if (!reason?.trim()) {
                Alert.alert('Error', 'Rejection reason is required');
                return;
              }
              setIsUpdatingOrder(true);
              try {
                await ordersAPI.updateSellerOrderStatus(orderId, {
                  status: 'rejected',
                  reason,
                });
                Alert.alert('Success', 'Order rejected successfully');
                loadFarmerData();
              } catch (error) {
                Alert.alert('Error', 'Failed to reject order');
              } finally {
                setIsUpdatingOrder(false);
              }
            },
          },
        ],
        'plain-text'
      );
      return;
    }

    setIsUpdatingOrder(true);
    try {
      await ordersAPI.updateSellerOrderStatus(orderId, { status });
      Alert.alert('Success', `Order ${status} successfully!`);
      loadFarmerData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const openLalamoveBooking = () => {
    Linking.openURL(LALAMOVE_BOOKING_URL);
  };

  const formatStatus = (status: string) => {
    return (status || 'pending')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getStatusStyle = (status: string) => {
    const normalized = (status || 'pending').toLowerCase().replace(/[_\s]+/g, '');
    return STATUS_COLORS[normalized] || STATUS_COLORS.pending;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Calculate stats
  const availableCount = products.filter((p) => p.available !== false && p.quantity > 0).length;
  const outOfStockCount = products.length - availableCount;
  const pendingOrders = sellerOrders.filter(
    (o) => o.status === 'pending' || o.status === 'confirmed'
  ).length;
  const totalRevenue = sellerOrders
    .filter((o) => o.status === 'completed' || o.status === 'delivered')
    .reduce((sum, o) => sum + (o.total_amount || o.total || 0), 0);

  if (!user?.is_farmer) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="storefront-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Not a Seller</Text>
        <Text style={styles.emptyText}>
          You need to be a verified seller to access this dashboard
        </Text>
        <TouchableOpacity
          style={styles.startSellingButton}
          onPress={() => navigation.navigate('StartSelling')}
        >
          <Text style={styles.startSellingButtonText}>Start Selling</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Shop</Text>
        <Text style={styles.headerSubtitle}>
          {user.farm_name || `${user.first_name}'s Farm`}
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => navigation.navigate('ManageProducts')}
        >
          <Ionicons name="cube" size={28} color="#4CAF50" />
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>Total Products</Text>
        </TouchableOpacity>

        <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
          <Ionicons name="checkmark-circle" size={28} color="#2E7D32" />
          <Text style={styles.statNumber}>{availableCount}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FFEBEE' }]}>
          <Ionicons name="alert-circle" size={28} color="#C62828" />
          <Text style={styles.statNumber}>{outOfStockCount}</Text>
          <Text style={styles.statLabel}>Out of Stock</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
          <Ionicons name="time" size={28} color="#E65100" />
          <Text style={styles.statNumber}>{pendingOrders}</Text>
          <Text style={styles.statLabel}>Pending Orders</Text>
        </View>
      </View>

      {/* Revenue Card */}
      <View style={styles.revenueCard}>
        <View style={styles.revenueInfo}>
          <Text style={styles.revenueLabel}>Total Revenue</Text>
          <Text style={styles.revenueAmount}>₱{totalRevenue.toFixed(2)}</Text>
        </View>
        <Ionicons name="trending-up" size={40} color="#4CAF50" />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ManageProducts')}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Manage Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
            onPress={openLalamoveBooking}
          >
            <Ionicons name="bicycle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Book Delivery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Text style={styles.orderCount}>{sellerOrders.length} orders</Text>
        </View>

        {sellerOrders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Ionicons name="receipt-outline" size={50} color="#ccc" />
            <Text style={styles.emptyOrdersText}>No orders yet</Text>
          </View>
        ) : (
          sellerOrders.slice(0, 5).map((order) => {
            const orderId = order._id || order.id;
            const statusStyle = getStatusStyle(order.status);
            const total = order.total_amount || order.total || 0;

            return (
              <View key={orderId} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNumber}>
                      #{order.order_number || orderId.substring(0, 8)}
                    </Text>
                    <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                    {order.buyer_name && (
                      <Text style={styles.buyerName}>by {order.buyer_name}</Text>
                    )}
                  </View>
                  <View style={styles.orderRight}>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusText, { color: statusStyle.text }]}>
                        {formatStatus(order.status)}
                      </Text>
                    </View>
                    <Text style={styles.orderTotal}>₱{total.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <View style={styles.orderItems}>
                    {order.items.map((item, idx) => (
                      <Text key={idx} style={styles.orderItem}>
                        • {item.product_name} x{item.quantity}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Order Actions */}
                {(order.status === 'pending' || order.status === 'confirmed') && (
                  <View style={styles.orderActions}>
                    {order.status === 'pending' && (
                      <>
                        <TouchableOpacity
                          style={[styles.orderActionBtn, styles.confirmBtn]}
                          onPress={() => updateOrderStatus(orderId, 'confirmed')}
                          disabled={isUpdatingOrder}
                        >
                          <Text style={styles.orderActionText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.orderActionBtn, styles.rejectBtn]}
                          onPress={() => updateOrderStatus(orderId, 'rejected')}
                          disabled={isUpdatingOrder}
                        >
                          <Text style={styles.orderActionTextDanger}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <>
                        <TouchableOpacity
                          style={[styles.orderActionBtn, styles.prepareBtn]}
                          onPress={() => updateOrderStatus(orderId, 'preparing')}
                          disabled={isUpdatingOrder}
                        >
                          <Text style={styles.orderActionText}>Start Preparing</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.orderActionBtn, styles.readyBtn]}
                          onPress={() => updateOrderStatus(orderId, 'ready')}
                          disabled={isUpdatingOrder}
                        >
                          <Text style={styles.orderActionText}>Mark Ready</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  startSellingButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startSellingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E8F5E9',
    marginTop: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  revenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueInfo: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#666',
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderCount: {
    fontSize: 14,
    color: '#666',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyOrdersText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  orderCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  buyerName: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  orderItems: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  orderItem: {
    fontSize: 13,
    color: '#555',
    marginBottom: 3,
  },
  orderActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  orderActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtn: {
    backgroundColor: '#4CAF50',
  },
  rejectBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  prepareBtn: {
    backgroundColor: '#9C27B0',
  },
  readyBtn: {
    backgroundColor: '#00BCD4',
  },
  orderActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  orderActionTextDanger: {
    color: '#dc3545',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 30,
  },
});

export default FarmerDashboardScreen;
