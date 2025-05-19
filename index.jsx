import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AnimeSwiper from './components/AnimeSwiper';
import LearnMore from './components/LearnMore';       // ← make sure this is here


function App() {
  const [preferencesCompleted, setPreferencesCompleted] = useState(false);

  return (
    <BrowserRouter>
      <Navbar onPreferencesComplete={() => setPreferencesCompleted(true)} />

      <Routes>
        <Route
          path="/"
          element={
            <>
              <Hero />
              <div id="swipe">
                <AnimeSwiper hasCompletedPreferences={preferencesCompleted} />
              </div>
            </>
          }
        />
        <Route path="/learn-more" element={<LearnMore />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);



