import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const StartSelling = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [flashMessages, setFlashMessages] = useState([]);

  const handleActivateSeller = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const success = await updateProfile({ is_farmer: true });

    setIsLoading(false);

    if (success) {
      setFlashMessages([{ category: 'success', text: 'Congratulations! Your seller account has been activated. You can now access My Shop to manage your farm profile and products.' }]);
      setTimeout(() => navigate('/farmer-dashboard'), 2000);
    } else {
      setFlashMessages([{ category: 'error', text: 'Failed to activate seller account. Please try again.' }]);
    }
  };



  // If user is already a farmer, redirect or show message
  if (user && user.is_farmer) {
    return (
      <div className="start-selling-page">
        <Navbar activePage="myshop" />

        <section className="products-page">
          <div className="container">
            <div className="no-products">
              <h3>You're Already a Seller!</h3>
              <p>Manage your shop and products from your dashboard.</p>
              <Link to="/farmer-dashboard" className="btn btn-primary btn-large">
                <i className="fas fa-store"></i> Go to My Shop
              </Link>
            </div>
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
  }

  return (
    <div className="start-selling-page">
      <Navbar />

      <section className="products-page">
        <div className="container">
          {/* Flash Messages */}
          {flashMessages.length > 0 && (
            <div className="flash-messages">
              {flashMessages.map((message, index) => (
                <div key={index} className={`alert alert-${message.category}`}>
                  <i className={`fas fa-${message.category === 'success' ? 'check-circle' : 'exclamation-circle'}`}></i>
                  {message.text}
                </div>
              ))}
            </div>
          )}

          {!user ? (
            <div className="no-products">
              <h3>Login Required</h3>
              <p>Please login or create an account to start selling on FarmtoClick.</p>
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <Link to="/login" className="btn btn-primary">Login</Link>
                <Link to="/register" className="btn btn-outline">Create Account</Link>
              </div>
            </div>
          ) : (
            <div className="no-products">
              <h3>Become a Seller</h3>
              <p>Once activated, you'll get access to My Shop where you can manage your farm profile and products.</p>

              <form onSubmit={handleActivateSeller} style={{ marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary btn-large" disabled={isLoading}>
                  <i className="fas fa-check"></i> {isLoading ? 'Activating...' : 'Activate Seller Account'}
                </button>
              </form>

              <div style={{ marginTop: '14px' }}>
                <Link to="/profile" className="btn btn-outline">
                  <i className="fas fa-arrow-left"></i> Back to Profile
                </Link>
              </div>
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

export default StartSelling;