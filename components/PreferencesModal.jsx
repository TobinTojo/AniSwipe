import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './Navbar';
import '../PreferencesModal.css';

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
  "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life",
  "Sports", "Supernatural", "Thriller"
];

function PreferencesModal({ onComplete, isOpen }) {  // Changed from showPreferences to isOpen
  const [favoriteAnimes, setFavoriteAnimes] = useState(['', '', '', '', '']);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnimeChange = (index, value) => {
    const newFavorites = [...favoriteAnimes];
    newFavorites[index] = value;
    setFavoriteAnimes(newFavorites);
  };

  const toggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else if (selectedGenres.length < 3) {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'Users', user.uid);
        await updateDoc(userRef, {
          preferences: {
            favoriteAnimes: favoriteAnimes.filter(a => a.trim() !== ''),
            favoriteGenres: selectedGenres
          }
        });
      }
      onComplete();
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className={`preferences-modal ${isOpen ? 'active' : ''}`}>
      <div className="preferences-content">
        <h2>Tell Us Your Preferences</h2>
        <p style={{ 
          color: '#e2e8f0', 
          textAlign: 'center', 
          marginBottom: '1.5rem',
          fontSize: '0.95rem'
        }}>
          Help us recommend better anime (optional)
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="preferences-group">
            <label>Your Favorite Animes (up to 5)</label>
            {[0, 1, 2, 3, 4].map((index) => (
              <input
                key={index}
                type="text"
                className="preferences-input"
                value={favoriteAnimes[index]}
                onChange={(e) => handleAnimeChange(index, e.target.value)}
                placeholder={`Favorite anime #${index + 1}`}
                style={{ marginBottom: '10px' }}
              />
            ))}
          </div>
          
          <div className="preferences-group">
            <label>Favorite Genres (up to 3)</label>
            <div className="genre-select">
              {GENRES.map(genre => (
                <div
                  key={genre}
                  className={`genre-tag ${selectedGenres.includes(genre) ? 'selected' : ''}`}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </div>
              ))}
            </div>
          </div>
          
          <button 
            type="submit" 
            className="preferences-submit"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </button>
          
          <button 
            type="button" 
            className="skip-btn"
            onClick={handleSkip}
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}

export default PreferencesModal;