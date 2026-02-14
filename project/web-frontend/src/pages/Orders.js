import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ordersAPI } from '../services/api';
import Navbar from '../components/Navbar';

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [trackingLoading, setTrackingLoading] = useState({});
  const [confirmLoading, setConfirmLoading] = useState({});

  useEffect(() => {
    if (user) {
      loadOrders();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const pendingOrderId = localStorage.getItem('paymongoPendingOrder');
    if (!pendingOrderId) return;
    ordersAPI.confirmPaymongo(pendingOrderId).then((res) => {
      if (res.data?.status === 'paid') {
        localStorage.removeItem('paymongoPendingOrder');
        loadOrders();
      }
    }).catch(() => {
    });
  }, [user]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const response = await ordersAPI.getOrders();
      setOrders(response.data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOrder = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const getStatusClass = (status) => {
    const statusLower = (status || 'pending').toLowerCase().replace(/[_\s]+/g, '-');
    return `status-${statusLower}`;
  };

  const getStatusLabel = (status) => {
    const value = (status || 'pending').toString().replace(/_/g, ' ').toLowerCase();
    return value.replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const refreshTracking = async (orderId) => {
    try {
      setTrackingLoading(prev => ({ ...prev, [orderId]: true }));
      const res = await ordersAPI.getOrderTracking(orderId);
      const tracking = res.data || {};
      setOrders(prev => prev.map(order => {
        const id = order._id || order.id;
        if (id !== orderId) return order;
        return {
          ...order,
          delivery_status: tracking.delivery_status,
          delivery_tracking_id: tracking.delivery_tracking_id,
          delivery_updates: tracking.delivery_updates || order.delivery_updates,
          logistics_provider: tracking.logistics_provider || order.logistics_provider,
        };
      }));
    } catch (error) {
      console.error('Error refreshing tracking:', error);
    } finally {
      setTrackingLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const confirmPaymongoPayment = async (orderId) => {
    try {
      setConfirmLoading(prev => ({ ...prev, [orderId]: true }));
      const res = await ordersAPI.confirmPaymongo(orderId);
      if (res.data?.status === 'paid') {
        await loadOrders();
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
    } finally {
      setConfirmLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  if (!user) {
    return (
      <div className="orders-page">
        <Navbar />
        <section className="orders-page">
          <div className="container">
            <div className="no-products">
              <h3>Please Login</h3>
              <p>You need to be logged in to view your orders</p>
              <Link to="/login" className="btn btn-primary">Login Now</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <Navbar />

      {/* Orders Section */}
      <section className="orders-page">
        <div className="container">
          <div className="section-header">
            <h2><i className="fas fa-box"></i> My Orders</h2>
            <p>Track and manage all your orders</p>
          </div>
          {isLoading ? (
            <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i> Loading orders...</div>
          ) : orders.length > 0 ? (
            <div className="orders-grid">
              {orders.map(order => {
                const orderId = order._id || order.id;
                const isExpanded = expandedOrders[orderId];
                
                return (
                  <article key={orderId} className={`order-card order-collapsible ${isExpanded ? 'is-open' : ''}`}>
                    <div className="order-header" onClick={() => toggleOrder(orderId)}>
                      <div>
                        <h3>#Order {order.order_number || orderId.substring(0, 8)}</h3>
                        <p className="order-date">
                          {order.created_at ? new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                        </p>
                      </div>
                      <div className="order-summary">
                        <span className={`order-status ${getStatusClass(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                        <p className="order-total">₱{(order.total_amount || 0).toFixed(2)}</p>
                      </div>
                      <button className="order-toggle" type="button" aria-expanded={isExpanded}>
                        <i className={`fas fa-chevron-down ${isExpanded ? 'rotated' : ''}`}></i>
                      </button>
                    </div>

                    <div className="order-details" style={{ display: isExpanded ? 'block' : 'none' }}>
                      <div className="order-meta">
                        <div className="order-meta-grid">
                          {order.order_number && (
                            <div className="order-meta-item">
                              <span className="meta-label">Order Number</span>
                              <span className="meta-value">{order.order_number}</span>
                            </div>
                          )}
                          {orderId && (
                            <div className="order-meta-item">
                              <span className="meta-label">Order ID</span>
                              <span className="meta-value">{orderId}</span>
                            </div>
                          )}
                          {order.payment_method && (
                            <div className="order-meta-item">
                              <span className="meta-label">Payment Method</span>
                              <span className="meta-value">{order.payment_method}</span>
                            </div>
                          )}
                          <div className="order-meta-item">
                            <span className="meta-label">Delivery Status</span>
                            <span className="meta-value">
                              {getStatusLabel(order.delivery_status || order.status)}
                            </span>
                          </div>
                          {order.delivery_tracking_id && (
                            <div className="order-meta-item">
                              <span className="meta-label">Tracking ID</span>
                              <span className="meta-value">{order.delivery_tracking_id}</span>
                            </div>
                          )}
                          {order.logistics_provider && (
                            <div className="order-meta-item">
                              <span className="meta-label">Logistics</span>
                              <span className="meta-value">{order.logistics_provider}</span>
                            </div>
                          )}
                          {order.delivery_proof_url && (
                            <div className="order-meta-item">
                              <span className="meta-label">Delivery Proof</span>
                              <span className="meta-value">
                                <a href={order.delivery_proof_url} target="_blank" rel="noreferrer">View photo</a>
                              </span>
                            </div>
                          )}
                          {order.assigned_rider_name && (
                            <div className="order-meta-item">
                              <span className="meta-label">Rider</span>
                              <span className="meta-value">{order.assigned_rider_name}</span>
                            </div>
                          )}
                          {order.assigned_rider_phone && (
                            <div className="order-meta-item">
                              <span className="meta-label">Rider Phone</span>
                              <span className="meta-value">{order.assigned_rider_phone}</span>
                            </div>
                          )}
                          {(order.assigned_rider_barangay || order.assigned_rider_city || order.assigned_rider_province) && (
                            <div className="order-meta-item">
                              <span className="meta-label">Rider Area</span>
                              <span className="meta-value">
                                {[order.assigned_rider_barangay, order.assigned_rider_city, order.assigned_rider_province].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                          {order.shipping_name && (
                            <div className="order-meta-item">
                              <span className="meta-label">Recipient</span>
                              <span className="meta-value">{order.shipping_name}</span>
                            </div>
                          )}
                          {order.shipping_phone && (
                            <div className="order-meta-item">
                              <span className="meta-label">Phone</span>
                              <span className="meta-value">{order.shipping_phone}</span>
                            </div>
                          )}
                          {(order.shipping_address || order.delivery_address) && (
                            <div className="order-meta-item">
                              <span className="meta-label">Address</span>
                              <span className="meta-value">{order.shipping_address || order.delivery_address}</span>
                            </div>
                          )}
                          {order.delivery_notes && (
                            <div className="order-meta-item order-meta-notes">
                              <span className="meta-label">Delivery Notes</span>
                              <span className="meta-value">{order.delivery_notes}</span>
                            </div>
                          )}
                          {order.tracking_number && (
                            <div className="order-meta-item">
                              <span className="meta-label">Tracking</span>
                              <span className="meta-value">{order.tracking_number}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: '12px' }}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => refreshTracking(orderId)}
                            disabled={trackingLoading[orderId]}
                          >
                            {trackingLoading[orderId] ? 'Refreshing...' : 'Refresh Delivery Status'}
                          </button>
                          {order.payment_provider === 'paymongo' && order.payment_status !== 'paid' && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => confirmPaymongoPayment(orderId)}
                              disabled={confirmLoading[orderId]}
                              style={{ marginLeft: '10px' }}
                            >
                              {confirmLoading[orderId] ? 'Verifying...' : 'Verify Payment'}
                            </button>
                          )}
                        </div>
                      </div>

                      {order.delivery_updates && order.delivery_updates.length > 0 && (
                        <div className="order-meta" style={{ marginTop: '12px' }}>
                          <div className="order-meta-grid">
                            <div className="order-meta-item order-meta-notes">
                              <span className="meta-label">Delivery Updates</span>
                              <span className="meta-value">
                                {order.delivery_updates.map((update, idx) => (
                                  <span key={idx} style={{ display: 'block' }}>
                                    {getStatusLabel(update.status)} · {update.updated_at ? new Date(update.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                                  </span>
                                ))}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {order.items && order.items.length > 0 && (
                        <div className="order-items">
                          <p className="order-items-title">Items</p>
                          <div className="order-items-table">
                            <div className="order-items-row order-items-header">
                              <span>Item</span>
                              <span>Qty</span>
                              <span>Price</span>
                              <span>Total</span>
                            </div>
                            {order.items.map((item, idx) => {
                              const itemName = item.product_name || item.name || 'Item';
                              const itemQty = item.quantity || 1;
                              const itemPrice = item.price || 0;
                              const itemTotal = itemPrice * itemQty;
                              return (
                                <div key={idx} className="order-items-row">
                                  <span className="item-name">{itemName}</span>
                                  <span className="item-qty">{itemQty}</span>
                                  <span className="item-price">₱{itemPrice.toFixed(2)}</span>
                                  <span className="item-total">₱{itemTotal.toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="no-products">
              <h3>No orders yet</h3>
              <p>When you place an order, you'll see it here.</p>
              <Link to="/products" className="btn btn-primary">Browse Products</Link>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3><i className="fas fa-seedling"></i> FarmtoClick</h3>
              <p>Connecting communities with fresh, local produce since 2024.</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/products">Products</Link></li>
                <li><Link to="/farmers">Farmers</Link></li>
                <li><a href="/about">About Us</a></li>
                <li><a href="/faq">FAQ</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>For Farmers</h4>
              <ul>
                <li><Link to="/start-selling">Join as Farmer</Link></li>
                <li><a href="/farmer-resources">Farmer Resources</a></li>
                <li><a href="/success-stories">Success Stories</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                <a href="https://facebook.com/farmtoclick" target="_blank" rel="noopener noreferrer"><i className="fab fa-facebook"></i> Facebook</a>
                <a href="https://instagram.com/farmtoclick" target="_blank" rel="noopener noreferrer"><i className="fab fa-instagram"></i> Instagram</a>
                <a href="https://twitter.com/farmtoclick" target="_blank" rel="noopener noreferrer"><i className="fab fa-twitter"></i> Twitter</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 FarmtoClick. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Orders;