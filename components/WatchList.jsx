import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './Navbar';
import '../AnimeSwiper.css';
import '../WatchList.css';
import { motion, AnimatePresence } from 'framer-motion';
import StreamingPlatforms from './StreamingPlatforms.jsx';

const WatchList = ({ onClose }) => {
  const [watchList, setWatchList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // No user—stop spinner
        setLoading(false);
        return;
      }
            try {
        const userRef = doc(db, 'Users', user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const likes = docSnap.data().likes || [];
          const list = await Promise.all(
            likes.map(async (anime) => {
              const res = await fetch(`https://kitsu.io/api/edge/anime/${anime.id}`);
              const data = await res.json();
              const attr = data.data.attributes;
              return {
                id: anime.id,
                title: attr.canonicalTitle || anime.title,
                image: attr.posterImage?.small || anime.image,
                synopsis: attr.synopsis || 'No synopsis available',
                truncatedSynopsis: truncateSynopsis(attr.synopsis),
                // carry over any other fields you need…
              };
            })
          );
          setWatchList(list);
        }
      } catch (err) {
        console.error('Error fetching watch list:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  

  const handleDetailsClick = async (anime) => {
    setIsLoadingDetails(true);
    try {
      // Fetch details for the selected anime (including full synopsis, genres, recommendations) from Kitsu
      const kitsuRes = await fetch(`https://kitsu.io/api/edge/anime/${anime.id}`);
      const kitsuData = await kitsuRes.json();
      const kitsuAnime = kitsuData.data.attributes;

      // Fetch genres and recommendations from Jikan
      const searchRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(anime.title)}&limit=1`);
      const searchData = await searchRes.json();
      const jikanAnime = searchData.data[0];

      let genres = jikanAnime?.genres?.map(g => g.name).join(', ') || 'N/A';
      let recommendations = [];
      if (jikanAnime) {
        const recRes = await fetch(`https://api.jikan.moe/v4/anime/${jikanAnime.mal_id}/recommendations`);
        const recData = await recRes.json();
        recommendations = recData.data.slice(0, 5).map(rec => ({
          title: rec.entry.title,
          url: rec.entry.url
        }));
      }

      // Fetch streaming links from Kitsu
      const streamRes = await fetch(`https://kitsu.io/api/edge/anime/${anime.id}/streaming-links`);
      const streamData = await streamRes.json();
      const streamingLinks = streamData.data.map(link => ({
        url: link.attributes.url,
        subs: link.attributes.subs,
        dubs: link.attributes.dubs
      }));

      setSelectedAnime({
        ...anime,
        genres,
        recommendations,
        streamingLinks,
        popularityRank: kitsuAnime.popularityRank,
        averageRating: kitsuAnime.averageRating, // User Rating from Kitsu
        episodeCount: kitsuAnime.episodeCount,
        ageRating: kitsuAnime.ageRatingGuide,
        startDate: kitsuAnime.startDate,
        endDate: kitsuAnime.endDate,
        synopsis: kitsuAnime.synopsis || 'Synopsis unavailable'
      });

      setShowDetails(true);
    } catch (err) {
      console.error('Error fetching anime details:', err);
      setSelectedAnime({ ...anime, genres: 'N/A', recommendations: [], synopsis: 'Synopsis unavailable', streamingLinks: [] });
      setShowDetails(true);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const closeDetails = () => setShowDetails(false);

  // Function to truncate synopsis (limit to first 100-150 characters)
  const truncateSynopsis = (synopsis, length = 150) => {
    if (!synopsis) return '';
    return synopsis.length > length ? `${synopsis.substring(0, length)}...` : synopsis;
  };

  return (
    <div className="watch-list-overlay">
      <div className="watch-list-container">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Your Watch List</h2>

        {loading ? (
          <div className="loading">Loading your watch list...</div>
        ) : watchList.length === 0 ? (
          <div className="empty-watch-list">You haven't added any anime to your watch list yet.</div>
        ) : (
          <div className="anime-grid-container">
            <div className="anime-grid">
              {watchList.map((anime, index) => (
                <div key={`${anime.id}-${index}`} className="watchlist-card">
                  <img
                    src={anime.image || 'https://via.placeholder.com/220x320'}
                    alt={anime.title}
                    className="poster"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/220x320';
                    }}
                  />
                  <div className="anime-info">
                    <h2>{anime.title}</h2>
                    {/* Display the truncated synopsis on the card */}
                    <p>{anime.truncatedSynopsis}</p>
                    <button className="details-btn" onClick={() => handleDetailsClick(anime)}>
                      More Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDetails && selectedAnime && (
          <div className="watch-list-details-overlay">
            <motion.div 
              className="watch-list-details-popup"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <button className="close-btn" onClick={closeDetails}>✕</button>
              <div className="watch-list-popup-content">
                <img
                  src={selectedAnime.image || 'https://via.placeholder.com/220x320'}
                  alt={selectedAnime.title}
                  className="watch-list-popup-poster"
                />
                <div className="watch-list-popup-info">
                  <h2>{selectedAnime.title}</h2>

                  <div className="popup-section">
                    <span>Genres: {selectedAnime.genres}</span>
                  </div>

                  <div className="popup-section meta-info">
                    {selectedAnime.popularityRank && (
                      <span className="meta-item popularity"># {selectedAnime.popularityRank}</span>
                    )}
                    {selectedAnime.averageRating && (
                      <span className="meta-item rating-star">{selectedAnime.averageRating}%</span>
                    )}
                    {selectedAnime.episodeCount && (
                      <span className="meta-item episodes">{selectedAnime.episodeCount} eps</span>
                    )}
                    {selectedAnime.ageRating && (
                      <span className="meta-item age-rating">{selectedAnime.ageRating}</span>
                    )}
                    {selectedAnime.startDate && (
                      <span className="meta-item calendar">
                        {new Date(selectedAnime.startDate).toLocaleDateString()} - {selectedAnime.endDate ? new Date(selectedAnime.endDate).toLocaleDateString() : 'Ongoing'}
                      </span>
                    )}
                  </div>

                  <div className="popup-section">
                    <h3>Synopsis</h3>
                    <p>{selectedAnime.synopsis}</p>  {/* Display full synopsis */}
                  </div>

                  {/* Use StreamingPlatforms Component */}
                  <div className="popup-section">
                    <h3>Available On</h3>
                    <StreamingPlatforms streamingLinks={selectedAnime.streamingLinks} /> {/* Display streaming platforms */}
                  </div>

                  <div className="popup-section similar">
                    <h3>Similar Anime</h3>
                    {selectedAnime.recommendations.length > 0 ? (
                      <ul>
                        {selectedAnime.recommendations.map((rec, index) => (
                          <li key={index}>
                            <a href={rec.url} target="_blank" rel="noopener noreferrer">
                              {rec.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No recommendations found.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchList;

