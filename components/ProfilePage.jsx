import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './Navbar';
import '../ProfilePage.css';

const defaultAvatarUrl = 'https://via.placeholder.com/100?text=Avatar';

function ProfilePage() {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Avatar modal state and character list
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [animeCharacters, setAnimeCharacters] = useState([]);

useEffect(() => {
  setIsLoading(true);

  // Subscribe to auth state changes
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userRef  = doc(db, 'Users', user.uid);
        const snapshot = await getDoc(userRef);
        if (snapshot.exists()) {
          setUserData(snapshot.data());
        } else {
          setError('No user data found');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load profile data');
      }
    } else {
      setError('You must be logged in to see your profile');
    }
    setIsLoading(false);
  });

  // Clean up the listener on unmount
  return () => unsubscribe();
}, []);

  // Fetch top anime characters (MCs) when opening modal
  const fetchCharacters = async () => {
    try {
      const res = await fetch('https://api.jikan.moe/v4/top/characters?limit=20');
      const json = await res.json();
      setAnimeCharacters(json.data || []);
    } catch (err) {
      console.error('Failed to load characters:', err);
    }
  };

  const handleOpenModal = () => {
    setShowAvatarModal(true);
    fetchCharacters();
  };

  const handleSelectAvatar = async (url) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'Users', user.uid);
        await updateDoc(userRef, { avatar: url });
        setUserData(prev => ({ ...prev, avatar: url }));
      }
    } catch (err) {
      console.error('Error updating avatar:', err);
    } finally {
      setShowAvatarModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Your Profile</h1>
      </div>

      <div className="profile-content">
        {/* Avatar Section */}
        <div className="profile-section">
        <h2>Profile Picture</h2>
        <div className="avatar-container">
          <img
            src={userData?.avatar || defaultAvatarUrl}
            alt="Avatar"
            className="avatar-img"
          />
          <button className="avatar-button" onClick={handleOpenModal}>
            Change Avatar
          </button>
        </div>
      </div>

        {/* Basic Info */}
        <div className="profile-section">
          <h2>Basic Info</h2>
          <div className="profile-info">
            <p><strong>Username:</strong> {userData?.username || 'Not set'}</p>
            <p><strong>Email:</strong> {auth.currentUser?.email || 'Not available'}</p>
          </div>
        </div>

        {/* Preferences */}
        <div className="profile-section">
          <h2>Preferences</h2>
          {userData?.preferences ? (
            <>
               <div className="preferences-group">
                <h3>Favorite Anime</h3>
                {userData.preferences.favoriteAnimes?.length > 0 ? (
                  <ul className="anime-list">
                    {userData.preferences.favoriteAnimes.map((anime, index) => (
                      <li key={index}>{anime}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No favorite anime set yet</p>
                )}
              </div>

              <div className="preferences-group">
                <h3>Favorite Genres</h3>
                {userData.preferences.favoriteGenres?.length > 0 ? (
                  <div className="genre-tags">
                    {userData.preferences.favoriteGenres.map((genre, index) => (
                      <span key={index} className="profile-genre-tag">{genre}</span>
                    ))}
                  </div>
                ) : (
                  <p>No favorite genres set yet</p>
                )}
              </div>
            </>
          ) : (
            <p>You haven't set any preferences yet.</p>
          )}
        </div>

        {/* Activity */}
        <div className="profile-section">
          <h2>Activity</h2>
          <div className="activity-stats">
            <div className="stat">
              <span className="stat-number">{userData?.likes?.length || 0}</span>
              <span className="stat-label">Liked Anime</span>
            </div>
            <div className="stat">
              <span className="stat-number">{userData?.dislikes?.length || 0}</span>
              <span className="stat-label">Disliked Anime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="avatar-modal-overlay" onClick={() => setShowAvatarModal(false)}>
          <div className="avatar-modal" onClick={e => e.stopPropagation()}>
            <h3>Select an Avatar (Top MCs)</h3>
           <div className="avatar-grid">
          {animeCharacters.map(char => {
            const isSelected = userData?.avatar === char.images.jpg.image_url;
            return (
              <img
                key={char.mal_id}
                className={`avatar-option${isSelected ? ' selected' : ''}`}
                src={char.images.jpg.image_url}
                alt={char.name}
                title={char.name}               // optional tooltip
                onClick={() => handleSelectAvatar(char.images.jpg.image_url)}
              />
            );
          })}
        </div>

            <button className="avatar-button" onClick={() => setShowAvatarModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
