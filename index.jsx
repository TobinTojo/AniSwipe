import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AnimeSwiper from './components/AnimeSwiper';

function App() {
  return (
    <div>
      <Navbar />
      <Hero />
      <div id="swipe">
        <AnimeSwiper />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
