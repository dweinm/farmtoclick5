import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import { RootStackParamList } from '../types';

type AdminDashboardScreenNavigationProp = StackNavigationProp<RootStackParamList>;

interface DashboardStats {
  totalProducts: number;
  totalFarmers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingVerifications: number;
  totalUsers: number;
}

interface Order {
  id: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
}

const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<AdminDashboardScreenNavigationProp>();
  const { user } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalFarmers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingVerifications: 0,
    totalUsers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'verifications'>('overview');

  const loadDashboardData = useCallback(async () => {
    try {
      const [productsRes, farmersRes, ordersRes, verificationsRes] = await Promise.allSettled([
        adminAPI.getProducts(),
        adminAPI.getFarmers(),
        adminAPI.getOrders(),
        adminAPI.getVerifications(),
      ]);

      let totalProducts = 0, totalFarmers = 0, totalOrders = 0, totalRevenue = 0, pendingVerifications = 0;
      let orders: Order[] = [];

      if (productsRes.status === 'fulfilled') {
        totalProducts = (productsRes.value.data.products || []).length;
      }
      if (farmersRes.status === 'fulfilled') {
        totalFarmers = (farmersRes.value.data.farmers || []).length;
      }
      if (ordersRes.status === 'fulfilled') {
        orders = ordersRes.value.data.orders || [];
        totalOrders = orders.length;
        totalRevenue = orders.reduce(
          (sum: number, o: any) => sum + (parseFloat(o.total) || parseFloat(o.total_amount) || 0),
          0
        );
      }
      if (verificationsRes.status === 'fulfilled' && verificationsRes.value.data.stats) {
        const vStats = verificationsRes.value.data.stats;
        pendingVerifications = Math.max(
          0,
          (vStats.total || 0) - (vStats.verified || 0) - (vStats.rejected || 0)
        );
      }

      setStats({
        totalProducts,
        totalFarmers,
        totalOrders,
        totalRevenue,
        pendingVerifications,
        totalUsers: 0, // Can be fetched separately if available
      });

      // Set recent orders (last 5)
      setRecentOrders(orders.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#FF9800',
      confirmed: '#2196F3',
      preparing: '#9C27B0',
      ready: '#00BCD4',
      completed: '#4CAF50',
      delivered: '#2E7D32',
      cancelled: '#F44336',
    };
    return colors[status?.toLowerCase()] || '#9E9E9E';
  };

  if (!user?.is_admin) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={60} color="#ccc" />
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedText}>
          You don't have permission to access this page.
        </Text>
        <TouchableOpacity
          style={styles.goBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#4CAF50']}
          tintColor="#4CAF50"
        />
      }
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, Admin</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#1565C0' }]}>
            <Ionicons name="cash" size={24} color="#fff" />
          </View>
          <Text style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#2E7D32' }]}>
            <Ionicons name="receipt" size={24} color="#fff" />
          </View>
          <Text style={styles.statValue}>{stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#E65100' }]}>
            <Ionicons name="cube" size={24} color="#fff" />
          </View>
          <Text style={styles.statValue}>{stats.totalProducts}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#F3E5F5' }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#7B1FA2' }]}>
            <Ionicons name="people" size={24} color="#fff" />
          </View>
          <Text style={styles.statValue}>{stats.totalFarmers}</Text>
          <Text style={styles.statLabel}>Farmers</Text>
        </View>
      </View>

      {/* Pending Verifications Alert */}
      {stats.pendingVerifications > 0 && (
        <TouchableOpacity
          style={styles.alertCard}
          onPress={() => navigation.navigate('VerificationDashboard')}
        >
          <View style={styles.alertIconContainer}>
            <Ionicons name="alert-circle" size={28} color="#FF9800" />
          </View>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Pending Verifications</Text>
            <Text style={styles.alertText}>
              {stats.pendingVerifications} farmer{stats.pendingVerifications > 1 ? 's' : ''} waiting for verification
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('VerificationDashboard')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.actionText}>Verifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => Alert.alert('Coming Soon', 'This feature is coming soon!')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="people" size={24} color="#1565C0" />
            </View>
            <Text style={styles.actionText}>Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => Alert.alert('Coming Soon', 'This feature is coming soon!')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="cube" size={24} color="#E65100" />
            </View>
            <Text style={styles.actionText}>Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => Alert.alert('Coming Soon', 'This feature is coming soon!')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FCE4EC' }]}>
              <Ionicons name="analytics" size={24} color="#C2185B" />
            </View>
            <Text style={styles.actionText}>Reports</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity
            onPress={() => Alert.alert('Coming Soon', 'Order management coming soon!')}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length > 0 ? (
          recentOrders.map((order, index) => (
            <View key={order.id || index} style={styles.orderCard}>
              <View style={styles.orderInfo}>
                <Text style={styles.orderCustomer} numberOfLines={1}>
                  {order.customer_name || `Order #${order.id?.slice(-6)}`}
                </Text>
                <Text style={styles.orderDate}>
                  {order.created_at
                    ? new Date(order.created_at).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'}
                </Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>
                  {formatCurrency(order.total || 0)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(order.status) + '20' },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: getStatusColor(order.status) }]}
                  >
                    {order.status || 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyOrders}>
            <Ionicons name="receipt-outline" size={40} color="#ddd" />
            <Text style={styles.emptyText}>No recent orders</Text>
          </View>
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  accessDeniedTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  goBackButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateText: {
    fontSize: 14,
    color: '#E8F5E9',
    marginTop: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 10,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    margin: 15,
    marginBottom: 0,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertIconContainer: {
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65100',
  },
  alertText: {
    fontSize: 13,
    color: '#F57C00',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    marginBottom: 0,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  viewAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderInfo: {
    flex: 1,
  },
  orderCustomer: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  orderDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
});

export default AdminDashboardScreen;
