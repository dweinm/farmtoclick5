import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Order, RootStackParamList } from '../types';

type OrdersScreenNavigationProp = StackNavigationProp<RootStackParamList>;

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

const OrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const { user } = useAuth();
  const navigation = useNavigation<OrdersScreenNavigationProp>();

  const loadOrders = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const response = await ordersAPI.getOrders();
      setOrders(response.data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getStatusStyle = (status: string) => {
    const normalized = (status || 'pending').toLowerCase().replace(/[_\s]+/g, '');
    return STATUS_COLORS[normalized] || STATUS_COLORS.pending;
  };

  const formatStatus = (status: string) => {
    return (status || 'pending')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const orderId = item._id || item.id;
    const isExpanded = expandedOrders.has(orderId);
    const statusStyle = getStatusStyle(item.status);
    const total = item.total_amount || item.total || 0;

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          style={styles.orderHeader}
          onPress={() => toggleOrder(orderId)}
          activeOpacity={0.7}
        >
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>
              Order #{item.order_number || orderId.substring(0, 8)}
            </Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.orderHeaderRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {formatStatus(item.status)}
              </Text>
            </View>
            <Text style={styles.orderTotal}>₱{total.toFixed(2)}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.orderDetails}>
            {/* Order Items */}
            {item.items && item.items.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>Items</Text>
                {item.items.map((orderItem, index) => (
                  <View key={index} style={styles.orderItem}>
                    <Text style={styles.itemName}>
                      {orderItem.product_name} x{orderItem.quantity}
                    </Text>
                    <Text style={styles.itemPrice}>
                      ₱{(orderItem.price * orderItem.quantity).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Order Info */}
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Order Details</Text>
              
              {item.payment_method && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payment</Text>
                  <Text style={styles.infoValue}>{item.payment_method}</Text>
                </View>
              )}

              {item.delivery_status && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Delivery Status</Text>
                  <Text style={styles.infoValue}>{formatStatus(item.delivery_status)}</Text>
                </View>
              )}

              {item.delivery_tracking_id && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tracking ID</Text>
                  <Text style={styles.infoValue}>{item.delivery_tracking_id}</Text>
                </View>
              )}

              {item.logistics_provider && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Logistics</Text>
                  <Text style={styles.infoValue}>{item.logistics_provider}</Text>
                </View>
              )}

              {item.shipping_name && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Recipient</Text>
                  <Text style={styles.infoValue}>{item.shipping_name}</Text>
                </View>
              )}

              {item.shipping_phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{item.shipping_phone}</Text>
                </View>
              )}

              {item.shipping_address && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={[styles.infoValue, { flex: 1 }]}>
                    {item.shipping_address}
                  </Text>
                </View>
              )}

              {item.delivery_notes && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Notes</Text>
                  <Text style={[styles.infoValue, { flex: 1 }]}>
                    {item.delivery_notes}
                  </Text>
                </View>
              )}
            </View>

            {/* Delivery Updates */}
            {item.delivery_updates && item.delivery_updates.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>Tracking Updates</Text>
                {item.delivery_updates.map((update, index) => (
                  <View key={index} style={styles.updateItem}>
                    <View style={styles.updateDot} />
                    <View style={styles.updateContent}>
                      <Text style={styles.updateStatus}>{update.status}</Text>
                      <Text style={styles.updateTime}>
                        {formatDate(update.timestamp)}
                      </Text>
                      {update.description && (
                        <Text style={styles.updateDesc}>{update.description}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="lock-closed-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Please Login</Text>
        <Text style={styles.emptyText}>You need to be logged in to view your orders</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Login Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSubtitle}>Track and manage all your orders</Text>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item._id || item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons name="receipt-outline" size={60} color="#ccc" />
            <Text style={styles.emptyListTitle}>No Orders Yet</Text>
            <Text style={styles.emptyListText}>
              Start shopping to see your orders here!
            </Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => navigation.navigate('MainTabs')}
            >
              <Text style={styles.shopButtonText}>Browse Products</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  loginButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 15,
  },
  detailSection: {
    marginBottom: 15,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    width: 100,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  updateItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  updateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginTop: 4,
    marginRight: 10,
  },
  updateContent: {
    flex: 1,
  },
  updateStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  updateTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  updateDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyListTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptyListText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  shopButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OrdersScreen;
