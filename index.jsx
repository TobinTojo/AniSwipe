import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AnimeSwiper from './components/AnimeSwiper';

function App() {
  const [preferencesCompleted, setPreferencesCompleted] = useState(false);

  return (
    <div>
      <Navbar onPreferencesComplete={() => setPreferencesCompleted(true)} />
      <Hero />
      <div id="swipe">
        <AnimeSwiper hasCompletedPreferences={preferencesCompleted} />
      </div>
    </div>
  );
}

export default App;

ReactDOM.createRoot(document.getElementById('root')).render(<App />);


