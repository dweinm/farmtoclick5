import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [flashMessages, setFlashMessages] = useState([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(email, password);
    setIsLoading(false);
    if (success) {
      navigate('/products');
    } else {
      setFlashMessages([{ category: 'error', text: 'Invalid email or password. Please try again.' }]);
    }
  };

  return (
    <div className="auth-page">

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

      <section className="auth-section">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <h2><i className="fas fa-sign-in-alt"></i> Welcome Back</h2>
              <p>Login to your FarmtoClick account</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-control"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="form-checkbox"
                  />
                  Remember me
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="auth-footer">
              <p>Don't have an account? <Link to="/register">Register here</Link></p>
              <p><a href="/forgot-password">Forgot password?</a></p>
            </div>
          </div>
        </div>
      </section>

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
                <li><a href="/start-selling">Join as Farmer</a></li>
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

export default Login;