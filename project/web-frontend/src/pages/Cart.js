import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cartAPI } from '../services/api';
import Navbar from '../components/Navbar';

const Cart = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flashMessages, setFlashMessages] = useState([]);

  useEffect(() => {
    if (user) {
      loadCart();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadCart = async () => {
    try {
      setIsLoading(true);
      const response = await cartAPI.getCart();
      setCartItems(response.data.items || []);
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) return;
    try {
      await cartAPI.updateQuantity(productId, newQuantity);
      loadCart();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: error.response?.data?.message || 'Error updating cart' }]);
    }
  };

  const removeItem = async (productId) => {
    if (!window.confirm('Remove this item from cart?')) return;
    try {
      await cartAPI.removeItem(productId);
      loadCart();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Error removing item. Please try again.' }]);
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!paymentMethod) {
      setFlashMessages([{ category: 'error', text: 'Please select a payment method' }]);
      return;
    }
    if (!user?.shipping_address) {
      setFlashMessages([{ category: 'error', text: 'Please add your shipping address in your profile' }]);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await cartAPI.checkout({
        shipping_name: `${user.first_name} ${user.last_name}`,
        shipping_phone: user.phone,
        shipping_address: user.shipping_address,
        payment_method: paymentMethod,
      });
      const checkoutUrl = response?.data?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      setFlashMessages([{ category: 'success', text: 'Order placed successfully! Redirecting...' }]);
      setTimeout(() => navigate('/orders'), 2000);
    } catch (error) {
      setFlashMessages([{ category: 'error', text: error.response?.data?.message || 'Checkout failed. Please try again.' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = cartItems.reduce((sum, item) => sum + (item.product?.price || 0) * (item.quantity || 0), 0);



  if (!user) {
    return (
      <div className="cart-page">
        <Navbar />
        <section className="cart-section">
          <div className="container">
            <div className="empty-cart">
              <i className="fas fa-lock"></i>
              <h2>Please Login</h2>
              <p>You need to be logged in to view your cart</p>
              <Link to="/login" className="btn btn-primary">Login Now</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <Navbar />

      {/* Flash Messages */}
      {flashMessages.length > 0 && (
        <div className="flash-messages">
          {flashMessages.map((message, index) => (
            <div key={index} className={`flash-message flash-${message.category}`}>
              <i className={`fas fa-${message.category === 'success' ? 'check-circle' : message.category === 'error' ? 'exclamation-circle' : 'info-circle'}`}></i>
              {message.text}
              <button className="flash-close" onClick={() => {
                const newMessages = [...flashMessages];
                newMessages.splice(index, 1);
                setFlashMessages(newMessages);
              }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cart Section */}
      <section className="cart-section">
        <div className="container">
          {isLoading ? (
            <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i> Loading cart...</div>
          ) : cartItems.length > 0 ? (
            <div className="cart-layout">
              <div className="cart-items">
                {cartItems.map(item => (
                  <div key={item.product?.id} className="cart-item" data-product-id={item.product?.id}>
                    <div className="cart-item-image">
                      {item.product?.image_url ? (
                        <img src={item.product.image_url} alt={item.product?.name} />
                      ) : (
                        <div className="product-placeholder"><i className="fas fa-leaf"></i></div>
                      )}
                    </div>
                    <div className="cart-item-details">
                      <h3><Link to={`/product/${item.product?.id}`}>{item.product?.name}</Link></h3>
                      {item.product?.farmer && (
                        <p className="farmer">Sold by: {item.product.farmer.farm_name || item.product.farmer.full_name}</p>
                      )}
                      <p className="price">₱{(item.product?.price || 0).toFixed(2)}/{item.product?.unit}</p>
                    </div>
                    <div className="cart-item-quantity">
                      <label>Quantity:</label>
                      <div className="quantity-controls">
                        <button onClick={() => updateQuantity(item.product?.id, item.quantity - 1)}>-</button>
                        <input type="number" value={item.quantity} min="1" max={item.product?.quantity} readOnly />
                        <button onClick={() => updateQuantity(item.product?.id, item.quantity + 1)}>+</button>
                      </div>
                    </div>
                    <div className="cart-item-total">
                      <p className="total-label">Total:</p>
                      <p className="total-price">₱{((item.product?.price || 0) * item.quantity).toFixed(2)}</p>
                    </div>
                    <button className="cart-item-remove" onClick={() => removeItem(item.product?.id)}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <h3>Order Summary</h3>
                <div className="summary-line">
                  <span>Subtotal:</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>
                <div className="summary-line">
                  <span>Delivery Fee:</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-line total">
                  <span>Total:</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>

                <form onSubmit={handleCheckout} className="checkout-form" style={{ marginTop: '18px', display: 'grid', gap: '12px' }}>
                  <div>
                    <label htmlFor="shipping_name" style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Full Name</label>
                    {user.first_name && user.last_name ? (
                      <input id="shipping_name" name="shipping_name" type="text" required readOnly value={`${user.first_name} ${user.last_name}`} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', background: '#f9f9f9' }} />
                    ) : (
                      <div style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontWeight: 500, textAlign: 'center' }}>
                        <i className="fas fa-exclamation-triangle"></i> Please add your full name in your <Link to="/profile" style={{ color: '#dc2626', textDecoration: 'underline' }}>profile page</Link>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="shipping_phone" style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Phone</label>
                    {user.phone ? (
                      <input id="shipping_phone" name="shipping_phone" type="tel" required readOnly value={user.phone} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', background: '#f9f9f9' }} />
                    ) : (
                      <div style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontWeight: 500, textAlign: 'center' }}>
                        <i className="fas fa-exclamation-triangle"></i> Please add your phone number in your <Link to="/profile" style={{ color: '#dc2626', textDecoration: 'underline' }}>profile page</Link>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="shipping_address" style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Exact Location</label>
                    {user.shipping_address ? (
                      <input id="shipping_address" name="shipping_address" type="text" required readOnly value={user.shipping_address} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', background: '#f9f9f9' }} />
                    ) : (
                      <div style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontWeight: 500, textAlign: 'center' }}>
                        <i className="fas fa-exclamation-triangle"></i> Please add your exact location in your <Link to="/profile" style={{ color: '#dc2626', textDecoration: 'underline' }}>profile page</Link>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="payment_method" style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Payment Method</label>
                    <select id="payment_method" name="payment_method" required value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff' }}>
                      <option value="" disabled>Select payment method</option>
                      <option value="cash">Cash on Delivery</option>
                      <option value="card">Card</option>
                      <option value="mobile">Mobile Money</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary btn-large" disabled={isSubmitting}>
                    <i className="fas fa-lock"></i> {isSubmitting ? 'Processing...' : 'Proceed to Checkout'}
                  </button>
                </form>
                <Link to="/products" className="btn btn-outline" style={{ marginTop: '10px' }}>
                  <i className="fas fa-arrow-left"></i> Continue Shopping
                </Link>
              </div>
            </div>
          ) : (
            <div className="empty-cart">
              <i className="fas fa-shopping-cart"></i>
              <h2>Your cart is empty</h2>
              <p>Start shopping to add items to your cart</p>
              <Link to="/products" className="btn btn-primary">
                <i className="fas fa-store"></i> Browse Products
              </Link>
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

export default Cart;