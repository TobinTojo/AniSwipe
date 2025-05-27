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
  const [sortedList, setSortedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [sortMethod, setSortMethod] = useState('recent'); // 'recent', 'rating', 'popularity'

  // Fetch user's liked anime once
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
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
                image: attr.posterImage?.medium || anime.image,
                synopsis: attr.synopsis || 'No synopsis available',
                averageRating: attr.averageRating,
                popularityRank: attr.popularityRank,
                episodeCount: attr.episodeCount,
                ageRating: attr.ageRatingGuide,
                startDate: attr.startDate,
                endDate: attr.endDate,
                addedAt: anime.timestamp || new Date().toISOString(),
                genres: attr.genres || []
              };
            })
          );
          setWatchList(list);
          sortAnimeList(list, sortMethod);
        }
      } catch (err) {
        console.error('Error fetching watch list:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sort helper
  const sortAnimeList = (list, method) => {
    const sorted = [...list];
    switch (method) {
      case 'recent':
        sorted.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        break;
      case 'rating':
        sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'popularity':
        sorted.sort((a, b) => (a.popularityRank || Infinity) - (b.popularityRank || Infinity));
        break;
      default:
        break;
    }
    setSortedList(sorted);
  };

  useEffect(() => {
    sortAnimeList(watchList, sortMethod);
  }, [watchList, sortMethod]);

  const handleSortChange = (method) => {
    setSortMethod(method);
    sortAnimeList(watchList, method);
  };

  // Fetch details when “More Details” is clicked
  const handleDetailsClick = async (anime) => {
    setIsLoadingDetails(true);
    try {
      // Kitsu details
      const kitsuRes = await fetch(`https://kitsu.io/api/edge/anime/${anime.id}`);
      const kitsuData = await kitsuRes.json();
      const ka = kitsuData.data.attributes;

      // Jikan lookup + recs
      const searchRes = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(anime.title)}&limit=1`
      );
      const searchData = await searchRes.json();
      const j = searchData.data[0];
      const genres = j?.genres?.map((g) => g.name).join(', ') || 'N/A';

      let recs = [];
      if (j) {
        const recRes = await fetch(`https://api.jikan.moe/v4/anime/${j.mal_id}/recommendations`);
        const recData = await recRes.json();
        recs = recData.data.slice(0, 5).map((r) => ({
          title: r.entry.title,
          url: r.entry.url
        }));
      }

      // Streaming links
      const streamRes = await fetch(
        `https://kitsu.io/api/edge/anime/${anime.id}/streaming-links`
      );
      const streamData = await streamRes.json();
      const streamingLinks = streamData.data.map((l) => ({
        url: l.attributes.url,
        subs: l.attributes.subs,
        dubs: l.attributes.dubs
      }));

      setSelectedAnime({
        ...anime,
        genres,
        recommendations: recs,
        streamingLinks,
        popularityRank: ka.popularityRank,
        averageRating: ka.averageRating,
        episodeCount: ka.episodeCount,
        ageRating: ka.ageRatingGuide,
        startDate: ka.startDate,
        endDate: ka.endDate,
        synopsis: ka.synopsis || 'Synopsis unavailable'
      });
      setShowDetails(true);
    } catch (err) {
      console.error('Error fetching anime details:', err);
      setSelectedAnime({
        ...anime,
        genres: 'N/A',
        recommendations: [],
        synopsis: 'Synopsis unavailable',
        streamingLinks: []
      });
      setShowDetails(true);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const closeDetails = () => setShowDetails(false);

  return (
    <div className="watch-list-overlay">
      <div className="watch-list-container">
        <h2>Your Watch List</h2>

        {/* Sorting Controls */}
        <div className="watch-list-controls">
          <div className="sort-options">
            {['recent', 'rating', 'popularity'].map((m) => (
              <button
                key={m}
                className={`sort-btn ${sortMethod === m ? 'active' : ''}`}
                onClick={() => handleSortChange(m)}
              >
                {m === 'recent'
                  ? 'Recently Added'
                  : m === 'rating'
                  ? 'Highest Rated'
                  : 'Most Popular'}
              </button>
            ))}
          </div>
        </div>

        {/* ───── Loading Overlay ───── */}
        {isLoadingDetails && (
          <div className="watchlist-loading-overlay">
            <div className="watchlist-loading-spinner"></div>
          </div>
        )}

        {/* Main Content */}
        {loading ? (
          <div className="loading">Loading your watch list...</div>
        ) : !sortedList.length ? (
          <div className="empty-watch-list">
            You haven't added any anime to your watch list yet.
          </div>
        ) : (
          <div className="anime-grid">
            {sortedList.map((a, i) => (
              <div key={`${a.id}-${i}`} className="watchlist-card">
                <img
                  src={a.image || 'https://via.placeholder.com/220x320'}
                  alt={a.title}
                  className="poster"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/220x320'; }}
                />
                <div className="anime-info">
                  <h2>{a.title}</h2>
                  <div className="anime-stats">
                    {a.averageRating && <span className="rating-star">{a.averageRating}%</span>}
                    {a.popularityRank && <span className="popularity">#{a.popularityRank}</span>}
                  </div>
                  <button
                    className="details-btn"
                    onClick={() => handleDetailsClick(a)}
                    disabled={isLoadingDetails}
                  >
                    More Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Popup */}
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
                        {new Date(selectedAnime.startDate).toLocaleDateString()} -{' '}
                        {selectedAnime.endDate
                          ? new Date(selectedAnime.endDate).toLocaleDateString()
                          : 'Ongoing'}
                      </span>
                    )}
                  </div>

                  <div className="popup-section">
                    <h3>Synopsis</h3>
                    <p>{selectedAnime.synopsis}</p>
                  </div>

                  <div className="popup-section">
                    <h3>Available On</h3>
                    <StreamingPlatforms streamingLinks={selectedAnime.streamingLinks} />
                  </div>

                  <div className="popup-section similar">
                    <h3>Similar Anime</h3>
                    {selectedAnime.recommendations.length > 0 ? (
                      <ul>
                        {selectedAnime.recommendations.map((rec, idx) => (
                          <li key={idx}>
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

