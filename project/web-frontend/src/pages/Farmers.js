import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { farmersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const Farmers = () => {
  const [farmers, setFarmers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadFarmers();
  }, []);

  const loadFarmers = async () => {
    try {
      setIsLoading(true);
      const response = await farmersAPI.getAll();
      setFarmers(response.data || []);
    } catch (error) {
      console.error('Error loading farmers:', error);
      setFarmers([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="farmers-page">
      <Navbar activePage="farmers" />

      {/* Farmers Section */}
      <section className="farmers-page-main">
        <div className="container">
          {/* Farmer Verification Section */}
          {user && (
            <div className="profile-form-container" style={{ marginBottom: '20px' }}>
              <div className="form-section">
                <h2><i className="fas fa-shield-check"></i> Farmer Verification</h2>
                <p className="section-description">
                  {user.is_farmer
                    ? 'Verify your farm/business to build trust.'
                    : 'Apply to become a farmer by submitting your farm details and verification photo.'}
                </p>

                {user.business_verification_status && (
                  <p className="section-description">
                    Current status: <strong>{user.business_verification_status.charAt(0).toUpperCase() + user.business_verification_status.slice(1)}</strong>
                  </p>
                )}

                {user.farmer_application_status && !user.is_farmer && (
                  <p className="section-description">
                    Application status: <strong>{user.farmer_application_status.charAt(0).toUpperCase() + user.farmer_application_status.slice(1)}</strong>
                  </p>
                )}

                <div className="form-actions" style={{ justifyContent: 'flex-start', paddingLeft: 0, paddingRight: 0 }}>
                  <Link to="/farmer-verify" className="btn btn-primary">
                    Open Verification Form
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Farmers Grid */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#4CAF50' }}></i>
              <p style={{ marginTop: '1rem', color: '#666' }}>Loading farmers...</p>
            </div>
          ) : farmers.length > 0 ? (
            <div className="farmers-grid">
              {farmers.map(farmer => (
                <div key={farmer.id || farmer._id} className="farmer-card-large">
                  <div className="farmer-avatar">
                    {farmer.profile_picture ? (
                      <img
                        src={`/uploads/profiles/${farmer.profile_picture}`}
                        alt={farmer.first_name}
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        <i className="fas fa-user-tie"></i>
                      </div>
                    )}
                  </div>
                  <div className="farmer-info">
                    <h3>{farmer.first_name} {farmer.last_name || ''}</h3>
                    <h4 className="farm-name">{farmer.farm_name || 'Local Farm'}</h4>
                    <p className="location">
                      <i className="fas fa-map-marker-alt"></i> {farmer.farm_location || 'Location not specified'}
                    </p>
                    <p className="farmer-description">
                      {farmer.farm_description || 'Dedicated to growing fresh, quality produce for our community.'}
                    </p>
                    <div className="farmer-stats">
                      <span className="stat">
                        <i className="fas fa-box"></i> {farmer.product_count || 0} Products
                      </span>
                      <span className="stat">
                        <i className="fas fa-phone"></i> {farmer.farm_phone || farmer.phone || 'Contact via email'}
                      </span>
                    </div>
                    <div className="farmer-actions">
                      <Link
                        to={`/farmer/${farmer.id || farmer._id}`}
                        className="btn btn-primary"
                      >
                        View Profile
                      </Link>
                      <a
                        href={`mailto:${farmer.email}`}
                        className="btn btn-outline"
                      >
                        <i className="fas fa-envelope"></i> Contact Farmer
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-farmers" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <i className="fas fa-users" style={{ fontSize: '4rem', color: '#ddd', marginBottom: '1rem' }}></i>
              <h3 style={{ color: '#666' }}>No farmers registered yet</h3>
              <p style={{ color: '#999' }}>Check back soon to meet our local farming partners!</p>
            </div>
          )}
        </div>
      </section>

      {/* Become Farmer Section */}
      <section className="become-farmer">
        <div className="container">
          <div className="become-farmer-content">
            <h2>Want to sell on FarmtoClick?</h2>
            <p>Create an account to browse and buy. Farmer/seller onboarding is handled separately.</p>
            <Link to="/register" className="btn btn-primary btn-large">
              Create Account
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
                <li><a href="/start-selling">Join as Farmer</a></li>
                <li><a href="/farmer-resources">Farmer Resources</a></li>
                <li><a href="/success-stories">Success Stories</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                <a href="https://facebook.com/farmtoclick" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-facebook"></i> Facebook
                </a>
                <a href="https://instagram.com/farmtoclick" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-instagram"></i> Instagram
                </a>
                <a href="https://twitter.com/farmtoclick" target="_blank" rel="noopener noreferrer">
                  <i className="fab fa-twitter"></i> Twitter
                </a>
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

export default Farmers;