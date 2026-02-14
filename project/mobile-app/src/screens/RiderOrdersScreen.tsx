import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types';

type RiderOrdersNavigationProp = StackNavigationProp<RootStackParamList>;

type RiderOrder = {
  id: string;
  status?: string;
  delivery_status?: string;
  created_at?: string;
  buyer_name?: string;
  buyer_phone?: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  delivery_address?: string;
  delivery_notes?: string;
  items?: Array<{ name?: string; quantity?: number }>;
  total_amount?: number;
  delivery_proof_url?: string;
};

const RiderOrdersScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<RiderOrdersNavigationProp>();
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proofs, setProofs] = useState<Record<string, any>>({});

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await ordersAPI.getRiderOrders();
      setOrders(res.data?.orders || []);
    } catch (error) {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user || user.role !== 'rider') {
        navigation.navigate('MainTabs');
        return;
      }
      loadOrders();
    }, [user, navigation, loadOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const pickProof = async (orderId: string, useCamera: boolean) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera permissions to upload proof.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          });

      if (!result.canceled && result.assets?.length) {
        setProofs((prev) => ({ ...prev, [orderId]: result.assets[0] }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      if (status === 'delivered' && !proofs[orderId]) {
        Alert.alert('Proof Required', 'Please upload a delivery proof photo.');
        return;
      }

      let payload: any = { status };
      if (status === 'delivered' && proofs[orderId]) {
        const formData = new FormData();
        formData.append('status', status);

        const uri = proofs[orderId].uri;
        const filename = uri.split('/').pop() || `delivery_${orderId}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('delivery_proof', {
          uri,
          name: filename,
          type,
        } as any);
        payload = formData;
      }

      const res = await ordersAPI.updateRiderOrderStatus(orderId, payload);
      const data = res.data || {};
      if (data.success) {
        setProofs((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        Alert.alert('Success', `Order ${status} successfully!`);
        loadOrders();
      } else {
        Alert.alert('Error', data.message || 'Failed to update order status');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update order status');
    }
  };

  const formatStatus = (status?: string) => {
    return (status || 'pending')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (!user || user.role !== 'rider') {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bicycle-outline" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>Rider Access Only</Text>
        <Text style={styles.emptyText}>You do not have access to rider orders.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assigned Orders</Text>
        <Text style={styles.headerSubtitle}>Upload proof before marking delivered.</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No orders assigned</Text>
          <Text style={styles.emptyText}>Assigned orders will show up here.</Text>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {orders.map((order) => {
            const statusValue = (order.delivery_status || order.status || 'pending').toLowerCase();
            const proof = proofs[order.id];
            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNumber}>Order #{order.id.slice(0, 8)}</Text>
                    <Text style={styles.orderDate}>
                      {order.created_at
                        ? new Date(order.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.orderStatus}>{formatStatus(statusValue)}</Text>
                </View>

                <View style={styles.orderMeta}>
                  <Text style={styles.metaLabel}>Buyer</Text>
                  <Text style={styles.metaValue}>{order.buyer_name || 'Customer'}</Text>
                  {order.buyer_phone && (
                    <Text style={styles.metaValue}>{order.buyer_phone}</Text>
                  )}
                </View>

                {(order.shipping_address || order.delivery_address) && (
                  <View style={styles.orderMeta}>
                    <Text style={styles.metaLabel}>Address</Text>
                    <Text style={styles.metaValue}>
                      {order.shipping_address || order.delivery_address}
                    </Text>
                  </View>
                )}

                {order.delivery_notes && (
                  <View style={styles.orderMeta}>
                    <Text style={styles.metaLabel}>Notes</Text>
                    <Text style={styles.metaValue}>{order.delivery_notes}</Text>
                  </View>
                )}

                {order.items && order.items.length > 0 && (
                  <View style={styles.orderItems}>
                    <Text style={styles.metaLabel}>Items</Text>
                    {order.items.map((item, idx) => (
                      <Text key={idx} style={styles.metaValue}>
                        • {item.name || 'Item'} x{item.quantity || 1}
                      </Text>
                    ))}
                  </View>
                )}

                {order.delivery_proof_url && (
                  <View style={styles.orderItems}>
                    <Text style={styles.metaLabel}>Delivery Proof</Text>
                    <Image
                      source={{ uri: order.delivery_proof_url }}
                      style={styles.proofImage}
                    />
                  </View>
                )}

                {statusValue === 'ready_for_ship' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => updateStatus(order.id, 'picked_up')}
                  >
                    <Text style={styles.actionText}>Mark Picked Up</Text>
                  </TouchableOpacity>
                )}

                {statusValue === 'picked_up' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => updateStatus(order.id, 'on_the_way')}
                  >
                    <Text style={styles.actionText}>Mark On the Way</Text>
                  </TouchableOpacity>
                )}

                {statusValue === 'on_the_way' && (
                  <View style={styles.proofSection}>
                    <Text style={styles.metaLabel}>Delivery Proof</Text>
                    {proof ? (
                      <Image source={{ uri: proof.uri }} style={styles.proofImage} />
                    ) : (
                      <Text style={styles.metaValue}>No proof selected</Text>
                    )}
                    <View style={styles.proofActions}>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => pickProof(order.id, true)}
                      >
                        <Text style={styles.secondaryText}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => pickProof(order.id, false)}
                      >
                        <Text style={styles.secondaryText}>Choose File</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.actionButton, !proof && styles.disabledButton]}
                      onPress={() => updateStatus(order.id, 'delivered')}
                      disabled={!proof}
                    >
                      <Text style={styles.actionText}>Mark Delivered</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#E8F5E9',
    marginTop: 6,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  ordersList: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  orderMeta: {
    marginTop: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    color: '#333',
  },
  orderItems: {
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  proofSection: {
    marginTop: 10,
  },
  proofActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  secondaryText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  proofImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default RiderOrdersScreen;
