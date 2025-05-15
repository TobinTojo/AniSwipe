import React from 'react';
import { motion } from 'framer-motion';
import useAnimeCharacters from './useAnimeCharacters';
import '../hero.css';

const Hero = () => {

const characters = useAnimeCharacters();

  return (
    <section className="hero-section">
      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.h1 
          className="hero-title"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
        >
          AniSwipe
        </motion.h1>
        <motion.p 
          className="hero-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Discover your next favorite anime — swipe to explore, click for more.
        </motion.p>
        <div className="hero-buttons">
           <motion.a
          href="#swipe"  // This is the important part
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="hero-btn primary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Start Swiping
          <span className="arrow">→</span>
        </motion.a>
          <motion.a
            href="#features"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="hero-btn secondary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            Learn More
          </motion.a>
        </div>
      </motion.div>
      <div className="hero-scroll-hint">
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          ↓ Scroll down ↓
        </motion.div>
      </div>
      <div className="floating-elements">
        {characters.map((character, index) => (
          <img
            key={character.id}
            src={character.image.large}
            alt={character.name.full}
            className={`floating-element floating-element-${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;