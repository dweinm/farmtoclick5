import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [flashMessages, setFlashMessages] = useState([]);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setFlashMessages([{ category: 'error', text: 'Passwords do not match.' }]);
      return;
    }
    if (formData.password.length < 6) {
      setFlashMessages([{ category: 'error', text: 'Password must be at least 6 characters long.' }]);
      return;
    }
    setIsLoading(true);
    const result = await register({
      email: formData.email,
      password: formData.password,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone,
      is_farmer: false,
    });
    setIsLoading(false);
    if (result.success) {
      setFlashMessages([{ category: 'success', text: 'Account created successfully! Welcome to FarmtoClick.' }]);
      setTimeout(() => navigate('/products'), 2000);
    } else {
      setFlashMessages([{ category: 'error', text: result.message }]);
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
              <h2><i className="fas fa-user-plus"></i> Create Account</h2>
              <p>Join FarmtoClick to connect with local farmers</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="password-field">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="form-control"
                      required
                      minLength="6"
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

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="password-field">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="form-control"
                      required
                      minLength="6"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirm(s => !s)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      <i className={`fas fa-${showConfirm ? 'eye-slash' : 'eye'}`}></i>
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div className="auth-footer">
              <p>Already have an account? <Link to="/login">Login here</Link></p>
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

export default Register;