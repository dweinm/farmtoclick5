import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const Landing = () => {
  const { user } = useAuth();
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "What is FarmtoClick?",
      answer: "FarmtoClick is a capstone research project that explores how web and mobile technology can bridge the gap between local farmers and consumers. It provides a platform for direct farm-to-consumer transactions, real-time product listings, and integrated delivery logistics."
    },
    {
      question: "What technologies were used?",
      answer: "The system was built using React.js for the web frontend, React Native (Expo) for the mobile app, Flask (Python) for the backend API, and SQLite/PostgreSQL for the database. Additional integrations include PayMongo for payments, Lalamove for delivery, and machine learning for permit verification."
    },
    {
      question: "Can I use the platform?",
      answer: "Yes! The platform is live for demonstration and testing. You can register as a consumer to browse products, or apply as a farmer to list your own produce. The system demonstrates the full lifecycle of a farm-to-consumer marketplace."
    },
    {
      question: "How does the AI permit verification work?",
      answer: "The system uses a trained machine learning model to analyze uploaded farmer permits. It extracts key features from permit images and classifies them as authentic or non-authentic, streamlining the farmer verification process for administrators."
    },
    {
      question: "What is the DTI Price Engine?",
      answer: "The DTI Price Engine integrates suggested retail prices from the Department of Trade and Industry. It helps ensure fair pricing for consumers by providing reference price ranges for common agricultural products."
    },
    {
      question: "Is this project open source?",
      answer: "This project was developed as an academic capstone. The source code and documentation are available to the research panel and academic institution. Please contact the development team for collaboration inquiries."
    }
  ];

  const teamMembers = [
    { name: 'Member 1', role: 'Full-Stack Developer', icon: 'fa-user-graduate' },
    { name: 'Member 2', role: 'Frontend Developer', icon: 'fa-user-graduate' },
    { name: 'Member 3', role: 'Backend Developer', icon: 'fa-user-graduate' },
    { name: 'Member 4', role: 'UI/UX & QA', icon: 'fa-user-graduate' },
  ];

  const publications = [
    {
      title: 'Digital Marketplaces and Agricultural Supply Chains',
      authors: 'Smith, J. & Lee, K.',
      venue: 'Journal of Rural Studies',
      year: '2022',
      type: 'Related Literature',
      abstract: 'This paper explores how digital platforms transform agricultural supply chains by reducing intermediaries, improving price transparency, and increasing farmer income.',
      icon: 'fa-globe'
    },
    {
      title: 'Mobile Applications for Smallholder Farmers',
      authors: 'Garcia, M. et al.',
      venue: 'Computers and Electronics in Agriculture',
      year: '2021',
      type: 'Related Literature',
      abstract: 'A review of mobile app solutions that empower smallholder farmers with market access, weather information, and digital payments, highlighting adoption challenges in developing countries.',
      icon: 'fa-mobile-alt'
    },
    {
      title: 'AI in Document Verification: A Survey',
      authors: 'Patel, R. & Singh, A.',
      venue: 'IEEE Access',
      year: '2023',
      type: 'Related Literature',
      abstract: 'A comprehensive survey of artificial intelligence techniques for document image verification, with applications in e-government, banking, and agricultural vendor authentication.',
      icon: 'fa-robot'
    }
  ];

  const techStack = [
    { name: 'React.js', category: 'Web Frontend', icon: 'fa-brands fa-react', color: '#61DAFB' },
    { name: 'React Native', category: 'Mobile App', icon: 'fa-mobile-alt', color: '#61DAFB' },
    { name: 'Flask (Python)', category: 'Backend API', icon: 'fa-brands fa-python', color: '#306998' },
    { name: 'SQLite / PostgreSQL', category: 'Database', icon: 'fa-database', color: '#336791' },
    { name: 'PayMongo', category: 'Payments', icon: 'fa-credit-card', color: '#5B21B6' },
    { name: 'Lalamove', category: 'Delivery', icon: 'fa-truck-fast', color: '#F97316' },
    { name: 'Scikit-learn', category: 'ML / AI', icon: 'fa-brain', color: '#F7931E' },
    { name: 'Expo', category: 'Mobile Framework', icon: 'fa-mobile-screen', color: '#000020' },
  ];

  return (
    <div className="landing">
      <Navbar activePage="home" />

      {/* Hero - Project Showcase */}
      <section id="home" className="hero">
        <div className="hero-background">
          <img src="/images/farm.jpg" alt="FarmtoClick - Capstone Research Project" className="hero-bg-img" />
          <div className="hero-overlay"></div>
        </div>
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-text">

              <h1>FarmtoClick</h1>
              <p>A full-stack web and mobile platform that connects local farmers directly with consumers, featuring AI-powered permit verification, integrated logistics, and real-time marketplace capabilities.</p>
              <div className="hero-buttons">
                <a href="#about" className="btn btn-primary btn-large">Explore the Project</a>
                <a href="#publications" className="btn btn-outline btn-large">View Publications</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About the Project */}
      <section id="about" className="about-project">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">About</span>
            <h2>About the Project</h2>
            <p>Understanding the problem, the solution, and the impact</p>
          </div>
          <div className="about-grid">
            <div className="about-card">
              <div className="about-icon"><i className="fas fa-exclamation-triangle"></i></div>
              <h3>The Problem</h3>
              <p>Local farmers in the Philippines struggle to reach consumers directly. Traditional supply chains involve multiple intermediaries, increasing costs and reducing produce freshness. Farmers earn less while consumers pay more.</p>
            </div>
            <div className="about-card">
              <div className="about-icon"><i className="fas fa-lightbulb"></i></div>
              <h3>The Solution</h3>
              <p>FarmtoClick is a digital marketplace that eliminates middlemen by connecting farmers and consumers on a unified platform. It provides tools for product listing, order management, digital payments, and delivery coordination.</p>
            </div>
            <div className="about-card">
              <div className="about-icon"><i className="fas fa-chart-line"></i></div>
              <h3>The Impact</h3>
              <p>By enabling direct transactions, FarmtoClick increases farmer income, ensures fresher produce for consumers, and promotes sustainable local agriculture. The platform also uses AI to streamline vendor verification.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Project Objectives */}
      <section className="project-objectives">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Goals</span>
            <h2>Project Objectives</h2>
            <p>The specific aims this research project set out to achieve</p>
          </div>
          <div className="objectives-list">
            <div className="objective-item">
              <div className="objective-number">1</div>
              <div className="objective-content">
                <h3>Develop a Multi-Platform Marketplace</h3>
                <p>Design and implement a responsive web application and a cross-platform mobile app that allow farmers to list products and consumers to browse, order, and pay seamlessly.</p>
              </div>
            </div>
            <div className="objective-item">
              <div className="objective-number">2</div>
              <div className="objective-content">
                <h3>Integrate AI-Powered Permit Verification</h3>
                <p>Build a machine learning model to automatically verify farmer business permits, reducing manual administrative effort and speeding up the farmer onboarding process.</p>
              </div>
            </div>
            <div className="objective-item">
              <div className="objective-number">3</div>
              <div className="objective-content">
                <h3>Implement Fair Pricing via DTI Integration</h3>
                <p>Incorporate Department of Trade and Industry (DTI) suggested retail prices to promote pricing transparency and protect consumers from overpricing.</p>
              </div>
            </div>
            <div className="objective-item">
              <div className="objective-number">4</div>
              <div className="objective-content">
                <h3>Enable End-to-End Order Fulfillment</h3>
                <p>Integrate PayMongo for digital payments and Lalamove for last-mile delivery, creating a complete transaction pipeline from order placement to doorstep delivery.</p>
              </div>
            </div>
            <div className="objective-item">
              <div className="objective-number">5</div>
              <div className="objective-content">
                <h3>Evaluate Usability and Effectiveness</h3>
                <p>Assess the platform's usability through user testing and measure its effectiveness in reducing costs and improving accessibility for both farmers and consumers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="features">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Features</span>
            <h2>Key System Features</h2>
            <p>The core capabilities that power the FarmtoClick platform</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-store"></i></div>
              <h3>Farmer Dashboard</h3>
              <p>Farmers can manage their profile, list products with images and pricing, track orders, and monitor sales — all from a dedicated dashboard.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-robot"></i></div>
              <h3>AI Permit Verification</h3>
              <p>Machine learning model analyzes uploaded business permits to verify farmer authenticity, automating what was previously a manual review process.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-money-bill-wave"></i></div>
              <h3>Digital Payments</h3>
              <p>Secure online payments powered by PayMongo, supporting multiple payment methods including GCash, card payments, and bank transfers.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-truck-fast"></i></div>
              <h3>Delivery Integration</h3>
              <p>Real-time delivery booking and tracking through Lalamove API, with automatic fare estimation based on pickup and drop-off locations.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-tags"></i></div>
              <h3>DTI Price Engine</h3>
              <p>Integrated suggested retail prices from DTI to help consumers compare and ensure fair market-rate pricing on agricultural products.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-shield-alt"></i></div>
              <h3>Role-Based Access</h3>
              <p>Distinct roles for consumers, farmers, and administrators — each with tailored permissions, dashboards, and functionality.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Publications (Related Literature) */}
      <section id="publications" className="publications">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Related Literature</span>
            <h2>Related Literatures</h2>
            <p>Selected works that inform the FarmtoClick project</p>
          </div>
          <div className="publications-list">
            {publications.map((pub, index) => (
              <div key={index} className="publication-card">
                <div className="pub-icon"><i className={`fas ${pub.icon}`}></i></div>
                <div className="pub-content">
                  <span className="pub-type">{pub.type} &middot; {pub.year}</span>
                  <h3>{pub.title}</h3>
                  <p className="pub-authors"><i className="fas fa-user"></i> {pub.authors}</p>
                  <p className="pub-venue"><i className="fas fa-university"></i> {pub.venue}</p>
                  <p className="pub-abstract">{pub.abstract}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Team */}
      <section className="team-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Team</span>
            <h2>The Development Team</h2>
            <p>The people behind FarmtoClick</p>
          </div>
          <div className="team-grid">
            {teamMembers.map((member, index) => (
              <div key={index} className="team-card">
                <div className="team-avatar">
                  <i className={`fas ${member.icon}`}></i>
                </div>
                <h3>{member.name}</h3>
                <p className="team-role">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Educational Resources */}
      <section className="educational-resources">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Learn</span>
            <h2>Related Resources</h2>
            <p>Videos and materials related to our research domain</p>
          </div>

          <div className="resources-grid">
            <div className="resource-card">
              <div className="resource-video">
                <div className="video-container">
                  <iframe
                    src="https://www.youtube.com/embed/dBnniua6-oM"
                    title="How to grow food in the desert"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen>
                  </iframe>
                </div>
              </div>
              <div className="resource-content">
                <h3>Sustainable Farming Practices</h3>
                <p>Discover how to grow food sustainably and efficiently, even in challenging environments.</p>
              </div>
            </div>

            <div className="resource-card">
              <div className="resource-video">
                <div className="video-container">
                  <iframe
                    src="https://www.youtube.com/embed/B2lspKVrHmY"
                    title="The future of food"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen>
                  </iframe>
                </div>
              </div>
              <div className="resource-content">
                <h3>The Future of Food Technology</h3>
                <p>Explore how technology is transforming agriculture and food distribution systems.</p>
              </div>
            </div>

            <div className="resource-card">
              <div className="resource-video">
                <div className="video-container">
                  <iframe
                    src="https://www.youtube.com/embed/DkZ7BJlFWY8"
                    title="Local food systems"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen>
                  </iframe>
                </div>
              </div>
              <div className="resource-content">
                <h3>Local Food Systems &amp; Direct Commerce</h3>
                <p>Understand how local food systems connect farmers directly with consumers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">FAQ</span>
            <h2>Frequently Asked Questions</h2>
            <p>Common questions about the FarmtoClick project</p>
          </div>

          <div className="faq-container">
            {faqs.map((faq, index) => (
              <div key={index} className={`faq-item ${activeFaq === index ? 'active' : ''}`}>
                <div className="faq-question" onClick={() => toggleFaq(index)}>
                  <h3>{faq.question}</h3>
                  <i className={`fas fa-chevron-down ${activeFaq === index ? 'active' : ''}`}></i>
                </div>
                <div className={`faq-answer ${activeFaq === index ? 'active' : ''}`}>
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="cta-banner">
        <div className="container">
          <div className="cta-content">
            <h2>Try the Platform</h2>
            <p>Experience the FarmtoClick system firsthand. Register as a consumer or farmer to explore the full feature set.</p>
            <div className="cta-buttons">
              <Link to="/products" className="btn btn-primary btn-large">Browse Products</Link>
              <Link to="/register" className="btn btn-outline-light btn-large">Create Account</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="contact">
        <div className="container">
          <div className="section-header section-header-light">
            <span className="section-badge section-badge-light">Contact</span>
            <h2>Get in Touch</h2>
            <p>Questions about the project or interested in collaboration? Reach out to the team.</p>
          </div>
          <div className="contact-content">
            <div className="contact-info">
              <div className="contact-info-card">
                <div className="contact-icon"><i className="fas fa-envelope"></i></div>
                <div>
                  <h4>Email</h4>
                  <p>farmtoclick.capstone@gmail.com</p>
                </div>
              </div>
              <div className="contact-info-card">
                <div className="contact-icon"><i className="fas fa-university"></i></div>
                <div>
                  <h4>Institution</h4>
                  <p>BSIT Department</p>
                </div>
              </div>
              <div className="contact-info-card">
                <div className="contact-icon"><i className="fas fa-code-branch"></i></div>
                <div>
                  <h4>Repository</h4>
                  <p>github.com/farmtoclick</p>
                </div>
              </div>
            </div>
            <div className="contact-form">
              <form>
                <div className="form-row">
                  <input type="text" placeholder="Your Name" required />
                  <input type="email" placeholder="Your Email" required />
                </div>
                <textarea placeholder="Your Message or Feedback" rows="5" required></textarea>
                <button type="submit" className="btn btn-primary btn-large">Send Message <i className="fas fa-paper-plane"></i></button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section footer-brand">
              <h3><i className="fas fa-seedling"></i> FarmtoClick</h3>
              <p>A BSIT capstone research project exploring technology-driven solutions for direct farm-to-consumer agricultural commerce.</p>
              <div className="social-links">
                <a href="https://github.com" aria-label="GitHub"><i className="fab fa-github"></i></a>
                <a href="https://www.facebook.com" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
                <a href="https://www.linkedin.com" aria-label="LinkedIn"><i className="fab fa-linkedin-in"></i></a>
              </div>
            </div>
            <div className="footer-section">
              <h4>Project</h4>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#publications">Publications</a></li>
                <li><Link to="/products">Live Demo</Link></li>
                <li><Link to="/farmers">Farmers</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Resources</h4>
              <ul>
                <li><a href="#contact">Contact Team</a></li>
                <li><Link to="/start-selling">Farmer Onboarding</Link></li>
                <li><Link to="/register">Try the Platform</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Academic</h4>
              <ul>
                <li><a href="#publications">Research Papers</a></li>
                <li><a href="#about">Project Scope</a></li>
                <li><a href="#contact">Feedback</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 FarmtoClick &mdash; BSIT Capstone Project. Built with <i className="fas fa-heart" style={{color: '#e74c3c', fontSize: '0.85em'}}></i> by the development team.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;