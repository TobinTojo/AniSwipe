import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import '../LearnMore.css';

const LearnMore = () => {
  return (
    <motion.div 
      className="learn-more-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="learn-more-content">
        <h1>About AniSwipe</h1>
        
        <section className="about-section">
          <h2>What is AniSwipe?</h2>
          <p>
            AniSwipe is a modern anime discovery platform that helps you find your next favorite show 
            through an intuitive swipe interface. Like Tinder but for anime! Our smart recommendation 
            system learns your preferences to suggest anime you'll love.
          </p>
        </section>

        <section className="features-section">
          <h2>Key Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💖</div>
              <h3>Personalized Recommendations</h3>
              <p>
                Our AI analyzes your likes and dislikes to suggest anime tailored to your taste.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Easy Discovery</h3>
              <p>
                Swipe right to save anime to your watch list, left to pass. Simple and intuitive!
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Smart Filters</h3>
              <p>
                Set your favorite genres and get recommendations that match your preferences.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📺</div>
              <h3>Streaming Info</h3>
              <p>
                See where each anime is available to stream so you can start watching immediately.
              </p>
            </div>
          </div>
        </section>

        <section className="how-it-works">
          <h2>How It Works</h2>
          <ol className="steps-list">
            <li>Create an account and set your preferences</li>
            <li>Swipe through anime recommendations</li>
            <li>Save your favorites to your watch list</li>
            <li>Check where to watch and enjoy!</li>
          </ol>
        </section>

        <section className="team-section">
          <h2>About the Team</h2>
          <p>
            AniSwipe was created by anime fans, for anime fans. We wanted to build a better way 
            to discover new shows without the overwhelm of endless browsing.
          </p>
        </section>

        <div className="cta-section">
          <p>Ready to start discovering your next favorite anime?</p>
          <Link to="/" className="cta-button">
            Start Swiping Now
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default LearnMore;
