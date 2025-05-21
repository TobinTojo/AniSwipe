import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AnimeSwiper from './components/AnimeSwiper';
import LearnMore from './components/LearnMore'; 
import WatchList from './components/WatchList';
import ProfilePage from './components/ProfilePage';

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
        <Route path="/watch-list" element={<WatchList />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);







