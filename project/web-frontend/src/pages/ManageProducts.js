import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { productsAPI, dtiAPI } from '../services/api';
import Navbar from '../components/Navbar';

const ManageProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Form data for adding new product
  const [addFormData, setAddFormData] = useState({
    name: '',
    category: '',
    price: '',
    quantity: '',
    unit: '',
    description: '',
    available: true,
    audience: ['customers'],
    image: null,
  });

  // Form data for editing product
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: '',
    price: '',
    quantity: '',
    unit: '',
    description: '',
    available: true,
    audience: ['customers'],
    image: null,
  });

  // DTI SRP Price Suggestion state
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [editPriceSuggestion, setEditPriceSuggestion] = useState(null);
  const [editSuggestionLoading, setEditSuggestionLoading] = useState(false);

  // Product name suggestions state (Add modal)
  const [addProductSuggestions, setAddProductSuggestions] = useState([]);
  const [addSuggestionsLoading, setAddSuggestionsLoading] = useState(false);
  const [showAddSuggestions, setShowAddSuggestions] = useState(false);
  const [addSuggestionsTimer, setAddSuggestionsTimer] = useState(null);

  // Product name suggestions state (Edit modal)
  const [editProductSuggestions, setEditProductSuggestions] = useState([]);
  const [editSuggestionsLoading, setEditSuggestionsLoading] = useState(false);
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);
  const [editSuggestionsTimer, setEditSuggestionsTimer] = useState(null);

  const categories = [
    'Vegetables', 'Fruits', 'Grains & Cereals', 'Dairy & Eggs',
    'Meat & Poultry', 'Herbs & Spices', 'Nuts & Seeds', 'Honey & Jams',
    'Oils & Condiments', 'Baked Goods', 'Beverages', 'Organic Products', 'Flowers'
  ];

  const units = ['kg', 'g', 'lb', 'lbs', 'piece', 'pack', 'bunch', 'bundle', 'box', 'tray', 'liter', 'ml'];

  // DTI auto-pricing lookup for Add modal (button-triggered)
  // Fills the price field with DTI price + 20% markup when user clicks the button
  const fetchPriceSuggestion = useCallback(async (name, unit, category) => {
    if (!name || name.length < 2) {
      setPriceSuggestion({ found: false, message: 'Please enter a product name first.' });
      return;
    }
    setSuggestionLoading(true);
    setPriceSuggestion(null);
    try {
      // Determine audience for markup: if co-vendors is checked and customers not selected, use co-vendors
      const audienceParam = (addFormData.audience || []).includes('co-vendors') && !(addFormData.audience || []).includes('customers') ? 'co-vendors' : '';
      const res = await dtiAPI.suggestPrice(name, unit || 'kg', category || '', audienceParam);
      const data = res.data;
      setPriceSuggestion(data);
      // Auto-fill the price field when a match is found
      if (data?.found && data.auto_price) {
        setAddFormData(prev => ({ ...prev, price: data.auto_price.toFixed(2) }));
      }
    } catch {
      setPriceSuggestion({ found: false, message: 'Failed to fetch DTI price. Try again.' });
    } finally {
      setSuggestionLoading(false);
    }
  }, []);

  // DTI auto-pricing lookup for Edit modal (button-triggered)
  const fetchEditPriceSuggestion = useCallback(async (name, unit, category) => {
    if (!name || name.length < 2) {
      setEditPriceSuggestion({ found: false, message: 'Please enter a product name first.' });
      return;
    }
    setEditSuggestionLoading(true);
    setEditPriceSuggestion(null);
    try {
      const audienceParam = (editFormData.audience || []).includes('co-vendors') && !(editFormData.audience || []).includes('customers') ? 'co-vendors' : '';
      const res = await dtiAPI.suggestPrice(name, unit || 'kg', category || '', audienceParam);
      const data = res.data;
      setEditPriceSuggestion(data);
      // Auto-fill the price field when a match is found
      if (data?.found && data.auto_price) {
        setEditFormData(prev => ({ ...prev, price: data.auto_price.toFixed(2) }));
      }
    } catch {
      setEditPriceSuggestion({ found: false, message: 'Failed to fetch DTI price. Try again.' });
    } finally {
      setEditSuggestionLoading(false);
    }
  }, []);

  // Fetch product name suggestions for Add modal (with debounce)
  const fetchAddProductSuggestions = useCallback(async (name) => {
    if (!name || name.length < 2) {
      setAddProductSuggestions([]);
      setShowAddSuggestions(false);
      return;
    }
    
    setAddSuggestionsLoading(true);
    try {
      const res = await dtiAPI.suggestProductNames(name, 10);
      setAddProductSuggestions(res.data?.suggestions || []);
      setShowAddSuggestions(true);
    } catch {
      setAddProductSuggestions([]);
    } finally {
      setAddSuggestionsLoading(false);
    }
  }, []);

  // Fetch product name suggestions for Edit modal (with debounce)
  const fetchEditProductSuggestions = useCallback(async (name) => {
    if (!name || name.length < 2) {
      setEditProductSuggestions([]);
      setShowEditSuggestions(false);
      return;
    }
    
    setEditSuggestionsLoading(true);
    try {
      const res = await dtiAPI.suggestProductNames(name, 10);
      setEditProductSuggestions(res.data?.suggestions || []);
      setShowEditSuggestions(true);
    } catch {
      setEditProductSuggestions([]);
    } finally {
      setEditSuggestionsLoading(false);
    }
  }, []);

  // Handle product name change for Add modal with debounce
  const handleAddProductNameChange = (value) => {
    setAddFormData({ ...addFormData, name: value });
    setPriceSuggestion(null);
    
    // Clear existing timer
    if (addSuggestionsTimer) {
      clearTimeout(addSuggestionsTimer);
    }
    
    // Set new timer for debounced search
    const timer = setTimeout(() => {
      fetchAddProductSuggestions(value);
    }, 300);
    
    setAddSuggestionsTimer(timer);
  };

  // Handle product name change for Edit modal with debounce
  const handleEditProductNameChange = (value) => {
    setEditFormData({ ...editFormData, name: value });
    setEditPriceSuggestion(null);
    
    // Clear existing timer
    if (editSuggestionsTimer) {
      clearTimeout(editSuggestionsTimer);
    }
    
    // Set new timer for debounced search
    const timer = setTimeout(() => {
      fetchEditProductSuggestions(value);
    }, 300);
    
    setEditSuggestionsTimer(timer);
  };

  // Handle selecting a product suggestion in Add modal
  const handleAddProductSuggestionSelect = (suggestion) => {
    setAddFormData({ ...addFormData, name: suggestion.name });
    setShowAddSuggestions(false);
    setAddProductSuggestions([]);
  };

  // Handle selecting a product suggestion in Edit modal
  const handleEditProductSuggestionSelect = (suggestion) => {
    setEditFormData({ ...editFormData, name: suggestion.name });
    setShowEditSuggestions(false);
    setEditProductSuggestions([]);
  };

  const loadProducts = useCallback(async () => {
    try {
      const res = await productsAPI.getProducts();
      setProducts(res.data?.products || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.is_farmer) {
      loadProducts();
    }
  }, [user, loadProducts]);

  const openAddModal = () => {
    setAddFormData({
      name: '', category: '', price: '', quantity: '', unit: '', description: '', available: true, image: null
    });
    setPriceSuggestion(null);
    setShowAddModal(true);
    document.body.classList.add('modal-open');
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    document.body.classList.remove('modal-open');
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name || '',
      category: product.category || '',
      price: product.price || '',
      quantity: product.quantity || '',
      unit: product.unit || '',
      description: product.description || '',
      available: product.available !== false,
      audience: product.audience && product.audience.length ? product.audience : ['customers'],
      image: null,
    });
    setEditPriceSuggestion(null);
    setShowEditModal(true);
    document.body.classList.add('modal-open');
    // Don't auto-fetch - let user click the button
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingProduct(null);
    document.body.classList.remove('modal-open');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(addFormData).forEach(key => {
        if (key === 'image' && addFormData.image) {
          formData.append('image', addFormData.image);
        } else if (key === 'available') {
          formData.append('available', addFormData.available ? 'true' : 'false');
        } else if (key === 'audience') {
          (addFormData.audience || []).forEach(val => formData.append('audience', val));
        } else {
          formData.append(key, addFormData[key]);
        }
      });

      await productsAPI.addProduct(formData);
      setFlashMessages([{ category: 'success', text: 'Product added successfully!' }]);
      closeAddModal();
      loadProducts();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Failed to add product. Please try again.' }]);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const formData = new FormData();
      Object.keys(editFormData).forEach(key => {
        if (key === 'image' && editFormData.image) {
          formData.append('image', editFormData.image);
        } else if (key === 'available') {
          formData.append('available', editFormData.available ? 'true' : 'false');
        } else if (key === 'audience') {
          (editFormData.audience || []).forEach(val => formData.append('audience', val));
        } else {
          formData.append(key, editFormData[key]);
        }
      });

      await productsAPI.updateProduct(editingProduct.id || editingProduct._id, formData);
      setFlashMessages([{ category: 'success', text: 'Product updated successfully!' }]);
      closeEditModal();
      loadProducts();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Failed to update product. Please try again.' }]);
    }
  };

  const deleteProduct = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"?`)) return;

    try {
      await productsAPI.deleteProduct(productId);
      setFlashMessages([{ category: 'success', text: 'Product deleted successfully!' }]);
      loadProducts();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Failed to delete product.' }]);
    }
  };

  useEffect(() => {
    // Close modal on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showAddModal) closeAddModal();
        if (showEditModal) closeEditModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showAddModal, showEditModal]);

  // Filter products based on search term, category, and availability
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || product.category === filterCategory;
    const matchesAvailability = !filterAvailability || 
      (filterAvailability === 'available' && product.available !== false) ||
      (filterAvailability === 'out-of-stock' && product.available === false);
    
    return matchesSearch && matchesCategory && matchesAvailability;
  });

  if (!user || !user.is_farmer) {
    return (
      <div className="manage-products-page">
        <Navbar />

        <section className="products-page">
          <div className="container">
            <div className="no-products">
              <h3>Become a Seller</h3>
              <p>Start selling on FarmtoClick to manage your products.</p>
              <Link to="/start-selling" className="btn btn-primary btn-large">
                <i className="fas fa-seedling"></i> Start Selling
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="manage-products-page">
      {/* Navigation */}
      <Navbar activePage="myshop" />

      <section className="products-page">
        <div className="container">
          {/* Flash Messages */}
          {flashMessages.length > 0 && (
            <div className="flash-messages">
              {flashMessages.map((message, index) => (
                <div key={index} className={`alert alert-${message.category}`}>
                  {message.text}
                </div>
              ))}
            </div>
          )}

          {/* Page Header */}
          <div className="manage-products-page-header">
            <h2>
              <i className="fas fa-store"></i> My Products
              <span className="manage-products-count">{products.length} item{products.length !== 1 ? 's' : ''}</span>
            </h2>
            <button className="btn btn-primary" onClick={openAddModal}>
              <i className="fas fa-plus"></i> Add Product
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="manage-products-toolbar">
            <div className="manage-products-search">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="manage-products-filter">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="manage-products-filter">
              <select
                value={filterAvailability}
                onChange={(e) => setFilterAvailability(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>

            {(searchTerm || filterCategory || filterAvailability) && (
              <button
                className="manage-products-clear-btn"
                onClick={() => {
                  setSearchTerm('');
                  setFilterCategory('');
                  setFilterAvailability('');
                }}
              >
                <i className="fas fa-times"></i> Clear
              </button>
            )}

            {(searchTerm || filterCategory || filterAvailability) && (
              <span className="manage-products-filter-info">
                <i className="fas fa-filter"></i> {filteredProducts.length} of {products.length} shown
              </span>
            )}
          </div>

          {/* Products Table */}
          {filteredProducts.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="manage-products-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Audience</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id || product._id}>
                      <td className="table-image-cell">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <div style={{ width: 60, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 6 }}>
                            <i className="fas fa-seedling" style={{ color: '#9CA3AF' }}></i>
                          </div>
                        )}
                      </td>
                      <td className="table-name-cell">{product.name}</td>
                      <td>{product.category}</td>
                      <td>₱{product.price?.toFixed(2)}</td>
                      <td>{product.quantity} {product.unit}</td>
                      <td>
                        <span className={`manage-product-status ${product.available !== false ? 'status-available' : 'status-out'}`}>
                          {product.available !== false ? 'Available' : 'Out of Stock'}
                        </span>
                      </td>
                      <td>{(product.audience && product.audience.length) ? product.audience.map(a => a.charAt(0).toUpperCase()+a.slice(1)).join(', ') : 'Customers'}</td>
                      <td>
                        <button className="btn btn-outline btn-small" onClick={() => openEditModal(product)} style={{ marginRight: 8 }}>
                          <i className="fas fa-pen"></i>
                        </button>
                        <button className="btn btn-danger btn-small" onClick={() => deleteProduct(product.id || product._id, product.name)}>
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="manage-products-empty">
              <div className="manage-products-empty-icon">
                <i className={products.length === 0 ? 'fas fa-seedling' : 'fas fa-search'}></i>
              </div>
              {products.length === 0 ? (
                <>
                  <h3>No products yet</h3>
                  <p>Click "Add Product" above to start listing your farm goods!</p>
                </>
              ) : (
                <>
                  <h3>No matching products</h3>
                  <p>Try adjusting your search or filters, or{' '}
                    <button onClick={() => { setSearchTerm(''); setFilterCategory(''); setFilterAvailability(''); }} style={{ background: 'none', border: 'none', color: '#2c7a2c', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', fontWeight: '600', padding: 0 }}>
                      clear all filters
                    </button>.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) closeAddModal(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-plus-circle"></i> Add New Product</h2>
              <button type="button" className="modal-close" onClick={closeAddModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={{ width: '100%' }}>
              <div className="form-grid">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label htmlFor="modal_name">Product Name</label>
                  <input 
                    type="text" 
                    id="modal_name" 
                    placeholder="e.g., Fresh Tomatoes" 
                    value={addFormData.name} 
                    onChange={(e) => handleAddProductNameChange(e.target.value)}
                    onFocus={() => addProductSuggestions.length > 0 && setShowAddSuggestions(true)}
                    required 
                  />
                  {/* Product Name Suggestions Dropdown */}
                  {showAddSuggestions && addProductSuggestions.length > 0 && (
                    <ul style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderTop: 'none',
                      borderRadius: '0 0 6px 6px',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      margin: 0,
                      padding: '8px 0',
                      listStyle: 'none',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      {addProductSuggestions.map((suggestion, index) => (
                        <li 
                          key={index}
                          onClick={() => handleAddProductSuggestionSelect(suggestion)}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: index < addProductSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                            transition: 'background-color 0.2s',
                            fontSize: '0.95rem',
                            color: '#333'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fas fa-apple-alt" style={{ color: '#2e7d32', fontSize: '0.9rem' }}></i>
                            <span>{suggestion.name}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="modal_category">Category</label>
                  <input type="text" id="modal_category" list="modal_category_options" placeholder="e.g., Vegetables" value={addFormData.category} onChange={(e) => { setAddFormData({ ...addFormData, category: e.target.value }); }} required />
                  <datalist id="modal_category_options">
                    {categories.map(cat => <option key={cat} value={cat}></option>)}
                  </datalist>
                </div>

                <div className="form-group">
                  <label htmlFor="modal_price" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Price (₱)
                    {!suggestionLoading && priceSuggestion?.found && (
                      <span style={{ fontSize: '0.75rem', color: '#2e7d32', background: '#e8f5e9', padding: '2px 8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fas fa-check-circle"></i> DTI Auto-Priced (+{priceSuggestion.markup_pct || priceSuggestion.markup_max_pct || 20}%)
                      </span>
                    )}
                    {/* If co-vendors was checked, show a note that pricing uses different markup */}
                    {(addFormData.audience || []).includes('co-vendors') && (
                      <small style={{ display: 'block', marginTop: '6px', color: '#6b7280' }}>
                        Note: Vendors marketplace uses a lower markup (15%) — prices may differ from customer listings.
                      </small>
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <input type="number" id="modal_price" step="0.01" min="0.01" placeholder="e.g., 4.99" value={addFormData.price}
                      onChange={(e) => setAddFormData({ ...addFormData, price: e.target.value })}
                      style={priceSuggestion?.found ? { borderColor: '#4CAF50', boxShadow: '0 0 0 2px rgba(76,175,80,0.15)', flex: 1 } : { flex: 1 }}
                      required />
                    <button
                      type="button"
                      disabled={suggestionLoading || !addFormData.name}
                      onClick={() => fetchPriceSuggestion(addFormData.name, addFormData.unit, addFormData.category)}
                      style={{
                        padding: '10px 14px',
                        background: suggestionLoading ? '#ccc' : 'linear-gradient(135deg, #2e7d32, #43a047)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: suggestionLoading || !addFormData.name ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        opacity: !addFormData.name ? 0.6 : 1,
                        boxShadow: '0 2px 4px rgba(46,125,50,0.3)',
                      }}
                      title="Get suggested price from DTI records with 20% markup"
                    >
                      {suggestionLoading ? (
                        <><i className="fas fa-spinner fa-spin"></i> Checking...</>
                      ) : (
                        <><i className="fas fa-robot"></i> DTI Auto-Price</>
                      )}
                    </button>
                  </div>
                  {priceSuggestion?.found && (
                    <small style={{ color: '#2e7d32', display: 'block', marginTop: '6px', background: '#e8f5e9', padding: '6px 10px', borderRadius: '6px', lineHeight: '1.4' }}>
                      <i className="fas fa-info-circle"></i> DTI SRP: ₱{priceSuggestion.dti_avg_price?.toFixed(2)}/{priceSuggestion.unit || 'kg'} → Auto-Price: <strong>₱{priceSuggestion.auto_price?.toFixed(2)}</strong> (+20% markup)
                      {priceSuggestion.confidence && <span style={{ marginLeft: '8px', fontSize: '0.75rem', opacity: 0.8 }}>({Math.round(priceSuggestion.confidence * 100)}% match)</span>}
                    </small>
                  )}
                  {priceSuggestion && !priceSuggestion.found && (
                    <small style={{ color: '#e65100', display: 'block', marginTop: '6px', background: '#fff3e0', padding: '6px 10px', borderRadius: '6px' }}>
                      <i className="fas fa-exclamation-triangle"></i> {priceSuggestion.message || 'No DTI price record found for this product. Please set price manually.'}
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="modal_quantity">Quantity</label>
                  <input type="number" id="modal_quantity" min="0" placeholder="e.g., 50" value={addFormData.quantity} onChange={(e) => setAddFormData({ ...addFormData, quantity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label htmlFor="modal_unit">Unit of Measure</label>
                  <input type="text" id="modal_unit" list="modal_unit_options" placeholder="e.g., kg, lbs, piece" value={addFormData.unit} onChange={(e) => { setAddFormData({ ...addFormData, unit: e.target.value }); }} required />
                  <datalist id="modal_unit_options">
                    {units.map(unit => <option key={unit} value={unit}></option>)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label htmlFor="modal_image">Product Image (optional)</label>
                  <input type="file" id="modal_image" accept="image/*" onChange={(e) => setAddFormData({ ...addFormData, image: e.target.files[0] })} />
                  <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>Max 5MB. JPG, PNG, GIF, or WebP</small>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="modal_description">Product Description</label>
                  <textarea id="modal_description" rows="4" placeholder="Describe your product, its quality, origin, etc." value={addFormData.description} onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })} required />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Visible To</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: 8 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={(addFormData.audience || []).includes('customers')} onChange={(e) => {
                        const checked = e.target.checked;
                        const next = new Set(addFormData.audience || []);
                        if (checked) next.add('customers'); else next.delete('customers');
                        setAddFormData({ ...addFormData, audience: Array.from(next) });
                      }} />
                      <span>Customers</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={(addFormData.audience || []).includes('co-vendors')} onChange={(e) => {
                        const checked = e.target.checked;
                        const next = new Set(addFormData.audience || []);
                        if (checked) next.add('co-vendors'); else next.delete('co-vendors');
                        setAddFormData({ ...addFormData, audience: Array.from(next) });
                      }} />
                      <span>Co-vendors</span>
                    </label>
                  </div>
                  <small style={{ display: 'block', marginTop: 8, color: '#666' }}>Choose who can see this product. Farmers can use "Co-vendors" to share with other farmers.</small>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={addFormData.available} onChange={(e) => setAddFormData({ ...addFormData, available: e.target.checked })} />
                    <span>This product is available for sale</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary"><i className="fas fa-plus"></i> Add Product</button>
                <button type="button" className="btn btn-outline" onClick={closeAddModal}><i className="fas fa-times"></i> Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditModal && (
        <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-pen"></i> Edit Product</h2>
              <button type="button" className="modal-close" onClick={closeEditModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ width: '100%' }}>
              <div className="form-grid">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label htmlFor="edit_name">Product Name</label>
                  <input 
                    type="text" 
                    id="edit_name" 
                    value={editFormData.name} 
                    onChange={(e) => handleEditProductNameChange(e.target.value)}
                    onFocus={() => editProductSuggestions.length > 0 && setShowEditSuggestions(true)}
                    required 
                  />
                  {/* Product Name Suggestions Dropdown */}
                  {showEditSuggestions && editProductSuggestions.length > 0 && (
                    <ul style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderTop: 'none',
                      borderRadius: '0 0 6px 6px',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      margin: 0,
                      padding: '8px 0',
                      listStyle: 'none',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      {editProductSuggestions.map((suggestion, index) => (
                        <li 
                          key={index}
                          onClick={() => handleEditProductSuggestionSelect(suggestion)}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: index < editProductSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                            transition: 'background-color 0.2s',
                            fontSize: '0.95rem',
                            color: '#333'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fas fa-apple-alt" style={{ color: '#2e7d32', fontSize: '0.9rem' }}></i>
                            <span>{suggestion.name}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="edit_category">Category</label>
                  <input type="text" id="edit_category" list="modal_category_options" value={editFormData.category} onChange={(e) => { setEditFormData({ ...editFormData, category: e.target.value }); }} required />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_price" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Price (₱)
                    {!editSuggestionLoading && editPriceSuggestion?.found && (
                      <span style={{ fontSize: '0.75rem', color: '#2e7d32', background: '#e8f5e9', padding: '2px 8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fas fa-check-circle"></i> DTI Auto-Priced (+{editPriceSuggestion.markup_pct || editPriceSuggestion.markup_max_pct || 20}%)
                      </span>
                    )}
                    {(editFormData.audience || []).includes('co-vendors') && (
                      <small style={{ display: 'block', marginTop: '6px', color: '#6b7280' }}>
                        Note: Vendors marketplace uses a lower markup (15%) — prices may differ from customer listings.
                      </small>
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <input type="number" id="edit_price" step="0.01" min="0.01" value={editFormData.price}
                      onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                      style={editPriceSuggestion?.found ? { borderColor: '#4CAF50', boxShadow: '0 0 0 2px rgba(76,175,80,0.15)', flex: 1 } : { flex: 1 }}
                      required />
                    <button
                      type="button"
                      disabled={editSuggestionLoading || !editFormData.name}
                      onClick={() => fetchEditPriceSuggestion(editFormData.name, editFormData.unit, editFormData.category)}
                      style={{
                        padding: '10px 14px',
                        background: editSuggestionLoading ? '#ccc' : 'linear-gradient(135deg, #2e7d32, #43a047)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: editSuggestionLoading || !editFormData.name ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                        opacity: !editFormData.name ? 0.6 : 1,
                        boxShadow: '0 2px 4px rgba(46,125,50,0.3)',
                      }}
                      title="Get suggested price from DTI records with 20% markup"
                    >
                      {editSuggestionLoading ? (
                        <><i className="fas fa-spinner fa-spin"></i> Checking...</>
                      ) : (
                        <><i className="fas fa-robot"></i> DTI Auto-Price</>
                      )}
                    </button>
                  </div>
                  {editPriceSuggestion?.found && (
                    <small style={{ color: '#2e7d32', display: 'block', marginTop: '6px', background: '#e8f5e9', padding: '6px 10px', borderRadius: '6px', lineHeight: '1.4' }}>
                      <i className="fas fa-info-circle"></i> DTI SRP: ₱{editPriceSuggestion.dti_avg_price?.toFixed(2)}/{editPriceSuggestion.unit || 'kg'} → Auto-Price: <strong>₱{editPriceSuggestion.auto_price?.toFixed(2)}</strong> (+20% markup)
                      {editPriceSuggestion.confidence && <span style={{ marginLeft: '8px', fontSize: '0.75rem', opacity: 0.8 }}>({Math.round(editPriceSuggestion.confidence * 100)}% match)</span>}
                    </small>
                  )}
                  {editPriceSuggestion && !editPriceSuggestion.found && (
                    <small style={{ color: '#e65100', display: 'block', marginTop: '6px', background: '#fff3e0', padding: '6px 10px', borderRadius: '6px' }}>
                      <i className="fas fa-exclamation-triangle"></i> {editPriceSuggestion.message || 'No DTI price record found for this product. Please set price manually.'}
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="edit_quantity">Quantity</label>
                  <input type="number" id="edit_quantity" min="0" value={editFormData.quantity} onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label htmlFor="edit_unit">Unit of Measure</label>
                  <input type="text" id="edit_unit" list="modal_unit_options" value={editFormData.unit} onChange={(e) => { setEditFormData({ ...editFormData, unit: e.target.value }); }} required />
                </div>
                <div className="form-group">
                  <label htmlFor="edit_image">Product Image (optional)</label>
                  <input type="file" id="edit_image" accept="image/*" onChange={(e) => setEditFormData({ ...editFormData, image: e.target.files[0] })} />
                  <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>Leave empty to keep current image.</small>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="edit_description">Product Description</label>
                  <textarea id="edit_description" rows="4" value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} required />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Visible To</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: 8 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={(editFormData.audience || []).includes('customers')} onChange={(e) => {
                        const checked = e.target.checked;
                        const next = new Set(editFormData.audience || []);
                        if (checked) next.add('customers'); else next.delete('customers');
                        setEditFormData({ ...editFormData, audience: Array.from(next) });
                      }} />
                      <span>Customers</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={(editFormData.audience || []).includes('co-vendors')} onChange={(e) => {
                        const checked = e.target.checked;
                        const next = new Set(editFormData.audience || []);
                        if (checked) next.add('co-vendors'); else next.delete('co-vendors');
                        setEditFormData({ ...editFormData, audience: Array.from(next) });
                      }} />
                      <span>Co-vendors</span>
                    </label>
                  </div>
                  <small style={{ display: 'block', marginTop: 8, color: '#666' }}>Choose who can see this product. Farmers can use "Co-vendors" to share with other farmers.</small>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={editFormData.available} onChange={(e) => setEditFormData({ ...editFormData, available: e.target.checked })} />
                    <span>This product is available for sale</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary"><i className="fas fa-save"></i> Save Changes</button>
                <button type="button" className="btn btn-outline" onClick={closeEditModal}><i className="fas fa-times"></i> Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Modal CSS */}
      <style>{`
        .modal {
          display: none;
          position: fixed;
          z-index: 1000;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          animation: fadeIn 0.25s ease-out;
          overflow: hidden;
        }
        .modal.show {
          display: flex !important;
          align-items: center;
          justify-content: center;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .modal-content {
          background-color: white;
          padding: 32px;
          border-radius: 16px;
          width: 92%;
          max-width: 620px;
          max-height: 88vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          animation: slideIn 0.3s ease-out;
          position: relative;
          z-index: 1001;
        }
        .modal-content::-webkit-scrollbar {
          width: 6px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        @keyframes slideIn {
          from { transform: translateY(-30px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 16px;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.35rem;
          font-weight: 800;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .modal-header h2 i {
          color: #2c7a2c;
          font-size: 1.1rem;
        }
        .modal-close {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          font-size: 1.1rem;
          cursor: pointer;
          color: #6b7280;
          padding: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          transition: all 0.2s;
        }
        .modal-close:hover {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fecaca;
        }
        body.modal-open { overflow: hidden; }
      `}</style>
    </div>
  );
};

export default ManageProducts;