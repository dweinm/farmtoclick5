import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ordersAPI } from '../services/api';
import Navbar from '../components/Navbar';

const RiderOrders = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flashMessages, setFlashMessages] = useState([]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const res = await ordersAPI.getRiderOrders();
      setOrders(res.data?.orders || []);
    } catch (error) {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user && user.role === 'rider') {
      loadOrders();
    } else {
      navigate('/');
    }
  }, [user, navigate, authLoading]);

  const updateOrderStatus = async (orderId, status) => {
    try {
      const res = await ordersAPI.updateRiderOrderStatus(orderId, { status });
      const data = res.data || {};
      if (data.success) {
        setFlashMessages([{ category: 'success', text: `Order ${status} successfully!` }]);
        loadOrders();
      } else {
        setFlashMessages([{ category: 'error', text: data.message || 'Failed to update order status' }]);
      }
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Failed to update order status' }]);
    }
  };

  const formatStatus = (status) => {
    const value = (status || 'pending').toString().replace(/_/g, ' ').toLowerCase();
    return value.replace(/\b\w/g, (m) => m.toUpperCase());
  };

  return (
    <div className="orders-page">
      <Navbar activePage="rider-orders" />
      <section className="orders-page">
        <div className="container">
          <div className="section-header">
            <h2><i className="fas fa-motorcycle"></i> Assigned Orders</h2>
            <p>Orders assigned to you for delivery.</p>
          </div>
          {flashMessages.length > 0 && (
            <div className="flash-messages">
              {flashMessages.map((message, index) => (
                <div key={index} className={`alert alert-${message.category}`}>
                  {message.text}
                </div>
              ))}
            </div>
          )}
          {isLoading ? (
            <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i> Loading orders...</div>
          ) : orders.length > 0 ? (
            <div className="orders-grid">
              {orders.map((order) => (
                <article key={order.id} className="order-card">
                  {(() => {
                    const statusValue = (order.delivery_status || order.status || 'pending').toLowerCase();
                    return (
                      <>
                        <div className="order-header">
                          <div>
                            <h3>#Order {order.id.substring(0, 8)}</h3>
                            <p className="order-date">
                              {order.created_at ? new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                            </p>
                          </div>
                          <div className="order-summary">
                            <span className={`order-status status-${statusValue.replace(/[_\s]+/g, '-')}`}>
                              {formatStatus(statusValue)}
                            </span>
                            <p className="order-total">₱{(order.total_amount || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="order-details" style={{ display: 'block' }}>
                          <div className="order-meta-grid">
                            <div className="order-meta-item">
                              <span className="meta-label">Buyer</span>
                              <span className="meta-value">{order.buyer_name || 'Customer'}</span>
                            </div>
                            {order.buyer_phone && (
                              <div className="order-meta-item">
                                <span className="meta-label">Buyer Phone</span>
                                <span className="meta-value">{order.buyer_phone}</span>
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
                                <span className="meta-label">Recipient Phone</span>
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
                              <div className="order-meta-item">
                                <span className="meta-label">Notes</span>
                                <span className="meta-value">{order.delivery_notes}</span>
                              </div>
                            )}
                          </div>
                          <div className="order-items">
                            <h4>Items</h4>
                            <ul>
                              {(order.items || []).map((item, idx) => (
                                <li key={idx}>{item.name || 'Item'} × {item.quantity || 1}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="order-actions">
                            {statusValue === 'ready_for_ship' && (
                              <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'picked_up')}>
                                Mark Picked Up
                              </button>
                            )}
                            {statusValue === 'picked_up' && (
                              <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'on_the_way')}>
                                Mark On the Way
                              </button>
                            )}
                            {statusValue === 'on_the_way' && (
                              <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                                Mark Delivered
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">No assigned orders yet.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default RiderOrders;
