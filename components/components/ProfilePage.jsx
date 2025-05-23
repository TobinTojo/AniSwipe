import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './Navbar';
import '../ProfilePage.css';

function ProfilePage() {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userRef = doc(db, 'Users', user.uid);
          const docSnap = await getDoc(userRef);
          
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            setError('No user data found');
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

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
        <div className="profile-section">
          <h2>Basic Info</h2>
          <div className="profile-info">
            <p><strong>Username:</strong> {userData?.username || 'Not set'}</p>
            <p><strong>Email:</strong> {auth.currentUser?.email || 'Not available'}</p>
          </div>
        </div>

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
                      <span key={index} className="genre-tag">{genre}</span>
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
    </div>
  );
}

export default ProfilePage;