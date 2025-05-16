import React, { useEffect, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import '../AnimeSwiper.css';
import StreamingPlatforms from './StreamingPlatforms.jsx';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { auth, db } from './Navbar';

function parseJsonFromText(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return JSON.parse(match[0]);
  }
  return JSON.parse(text);
}

function AnimeSwiper({ hasCompletedPreferences }) {
   const [animeList, setAnimeList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [currentAnimeDetails, setCurrentAnimeDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [activeSwipe, setActiveSwipe] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const [userPreferences, setUserPreferences] = useState({ likes: [], dislikes: [] });
  const [hasLoadedValidAnime, setHasLoadedValidAnime] = useState(false);

  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  const [initialSwipeDir, setInitialSwipeDir] = useState(null);



  // Fetch initial anime on load
 const fetchInitialAnime = async (user) => {
  setIsLoading(true);
  try {
    const userRef = doc(db, 'Users', user.uid);
    const docSnap = await getDoc(userRef);

    let preferences = { likes: [], dislikes: [] };
    let ratedAnimeIds = [];
    let userPreferences = {};
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      preferences = { likes: data.likes || [], dislikes: data.dislikes || [] };
      ratedAnimeIds = [
        ...preferences.likes.map(like => like.id),
        ...preferences.dislikes.map(dislike => dislike.id)
      ];
      userPreferences = data.preferences || {};
    }

    if (preferences.likes.length > 0 || preferences.dislikes.length > 0) {
      await getPersonalizedRecommendation(preferences, ratedAnimeIds);
    } else if (userPreferences.favoriteAnimes?.length > 0 || userPreferences.favoriteGenres?.length > 0) {
      await getInitialRecommendation(userPreferences, ratedAnimeIds);
    } else {
      await fetchRandomAnime(ratedAnimeIds);
    }
  } catch (error) {
    console.error('Error fetching initial anime:', error);
    await fetchRandomAnime([]);
  } finally {
    setIsLoading(false);
  }
};

// Add this new function to AnimeSwiper.jsx
const getInitialRecommendation = async (preferences, ratedAnimeIds) => {
  setIsLoading(true);
  const tried = new Set();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const favoriteAnimes = preferences.favoriteAnimes?.join(', ') || 'none';
      const favoriteGenres = preferences.favoriteGenres?.join(', ') || 'any';

      const prompt = `Recommend exactly one anime that:
1. Matches the user's favorite genres: ${favoriteGenres}
2. Is similar to the user's favorite anime: ${favoriteAnimes}
3. Is in the Kitsu.io database
Only return JSON in this format: { "title": "Anime Title", "reason": "25-word explanation linking the pick to the user's preferences" }`;

      const result = await model.generateContent([prompt]);
      const raw = result.response.text().trim();
      let rec;
      try {
        rec = parseJsonFromText(raw);
      } catch (err) {
        console.error('Failed to parse recommendation JSON:', raw);
        rec = { title: raw, reason: '' };
      }
      tried.add(rec.title);

      const searchRes = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(rec.title)}`);
      const searchData = await searchRes.json();
      const filtered = searchData.data.filter(a => !ratedAnimeIds.includes(a.id));

      if (filtered.length) {
        setAnimeList([{ ...filtered[0], explanation: rec.reason }]);
        setCurrentIndex(0);
        break;
      }
    } catch (e) {
      console.error(e);
    }
  }
  setIsLoading(false);
};

useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(async user => {
    if (user) {
      setIsUserLoggedIn(true);

      // Fetch user preferences regardless of session state
      const userRef = doc(db, 'Users', user.uid);
      const docSnap = await getDoc(userRef);
      const userData = docSnap.exists() ? docSnap.data() : {};

      const hasPrefs =
        (userData.preferences?.favoriteAnimes?.length > 0 ||
        userData.preferences?.favoriteGenres?.length > 0) ||
        (userData.likes?.length > 0 || userData.dislikes?.length > 0);

      if (hasCompletedPreferences || hasPrefs) {
        fetchInitialAnime(user);
      }
    } else {
      setIsUserLoggedIn(false);
      setAnimeList([]);
      setCurrentIndex(0);
    }
  });
  return () => unsubscribe();
}, [hasCompletedPreferences]);



  const fetchRandomAnime = async (ratedAnimeIds) => {
  setIsLoading(true);
  try {
    // 1) Find total number of anime
    const totalRes = await fetch('https://kitsu.io/api/edge/anime');
    const { count: total } = (await totalRes.json()).meta;

    // 2) Pick a random offset
    const offset = Math.floor(Math.random() * total);

    // 3) Fetch one at that offset
    const randomRes = await fetch(
      `https://kitsu.io/api/edge/anime?page[limit]=1&page[offset]=${offset}`
    );
    const { data } = await randomRes.json();
    const candidate = data[0];

    // 4) If it’s already rated, retry or fall back
    if (ratedAnimeIds.includes(candidate.id)) {
      return fetchRandomAnime(ratedAnimeIds);
    }

    setAnimeList([candidate]);
    setCurrentIndex(0);

  } catch (error) {
    console.error('Error fetching truly random anime:', error);
  } finally {
    setIsLoading(false);
  }
};


   const getPersonalizedRecommendation = async (preferences, ratedAnimeIds) => {
    setIsLoading(true);
    const tried = new Set();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const likedTitles = preferences.likes.map(l => l.title).join(', ') || 'none';
        const dislikedTitles = preferences.dislikes.map(d => d.title).join(', ') || 'none';
        const avoid = [...tried, ...preferences.likes.map(l => l.title), ...preferences.dislikes.map(d => d.title)].join(', ') || 'none';

           const prompt = `Recommend exactly one anime that:
1. Aligns with the user's liked preferences only:
   - Liked: ${likedTitles}
2. Avoids any similarity to the user's dislikes:
   - Disliked: ${dislikedTitles}
3. Is in the Kitsu.io database and not among: ${likedTitles}, ${dislikedTitles}
Only return JSON in this format: { "title": "Anime Title", "reason": "25-word explanation linking the pick to the user's liked preferences" }`;
        const result = await model.generateContent([prompt]);
        const raw = result.response.text().trim();
        let rec;
        try {
          rec = parseJsonFromText(raw);
        } catch (err) {
          console.error('Failed to parse recommendation JSON:', raw);
          rec = { title: raw, reason: '' };
        }
        tried.add(rec.title);

        const searchRes = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(rec.title)}`);
        const searchData = await searchRes.json();
        const filtered = searchData.data.filter(a => !ratedAnimeIds.includes(a.id));

        if (filtered.length) {
          setAnimeList([{ ...filtered[0], explanation: rec.reason }]);
          setCurrentIndex(0);
          break;
        }
      } catch (e) {
        console.error(e);
      }
    }
    setIsLoading(false);
  };





  const getGeminiRecommendedAnime = async (currentAnime, action) => {
    setIsLoading(true);

    // Gather latest user preferences
    const user = auth.currentUser;
    let latest = { likes: [], dislikes: [] };
    let ratedIds = [];
    if (user) {
      const userRef = doc(db, 'Users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        latest = { likes: data.likes || [], dislikes: data.dislikes || [] };
        ratedIds = [...latest.likes.map(l => l.id), ...latest.dislikes.map(d => d.id)];
      }
    }

    const likedTitles = latest.likes.map(l => l.title).join(', ') || 'none';
    const dislikedTitles = latest.dislikes.map(d => d.title).join(', ') || 'none';

    const tried = new Set();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
      const prompt = `Recommend exactly one anime that:
1. Aligns with the user's liked preferences only:
   - Liked: ${likedTitles}
2. Avoids any similarity to the user's dislikes:
   - Disliked: ${dislikedTitles}
3. Is in the Kitsu.io database and not among: ${likedTitles}, ${dislikedTitles}
Only return JSON in this format: { "title": "Anime Title", "reason": "25-word explanation linking the pick to the user's liked preferences" }`;

      const result = await model.generateContent([prompt]);
      const raw = result.response.text().trim();
      let rec;
      try {
        rec = parseJsonFromText(raw);
      } catch (err) {
        console.error('Failed to parse recommendation JSON:', raw);
        rec = { title: raw, reason: '' };
      }

      if (tried.has(rec.title)) continue;
        tried.add(rec.title);

        // Search Kitsu
        const searchRes = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(rec.title)}`);
        const searchData = await searchRes.json();
        const candidates = searchData.data.filter(a => !ratedIds.includes(a.id));
        if (candidates.length) {
          setAnimeList(prev => [...prev, { ...candidates[0], explanation: rec.reason }]);
          setCurrentIndex(prev => prev + 1);
          break;
        }
      } catch (err) {
        console.error('Error during retry attempt:', err);
      }
    }

        setIsLoading(false);
  };


   const handleSwipe = async (direction) => {
    const currentAnime = animeList[currentIndex];
    setSwipeDirection(direction);
    setIsDragging(false);
    setActiveSwipe(direction);
    setShowFeedback(true);

    // Save to Firebase
    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'Users', user.uid);
        
        if (direction === 'right') {
          await updateDoc(userRef, {
            likes: arrayUnion({
              id: currentAnime.id,
              title: currentAnime.attributes.canonicalTitle,
              image: currentAnime.attributes.posterImage?.medium,
              timestamp: new Date().toISOString()
            })
          });
        } else {
          await updateDoc(userRef, {
            dislikes: arrayUnion({
              id: currentAnime.id,
              title: currentAnime.attributes.canonicalTitle,
              image: currentAnime.attributes.posterImage?.medium,
              timestamp: new Date().toISOString()
            })
          });
        }
      }
    } catch (error) {
      console.error('Error saving swipe:', error);
    }

    // Show feedback for 500ms before transitioning
    setTimeout(() => {
      setShowFeedback(false);
      setActiveSwipe(null);
      setSwipeDirection(null);
      getGeminiRecommendedAnime(currentAnime, direction);
    }, 500);
  };


const swipeHandlers = useSwipeable({
  // ignore swipes under 100px
  delta: 100,
  onSwiping: ({ deltaX }) => {
    setIsDragging(true);

    // if we haven't locked in a direction yet…
    if (!initialSwipeDir) {
      if (deltaX > 100) setInitialSwipeDir('right');
      else if (deltaX < -100) setInitialSwipeDir('left');
    } else {
      // if user reverses past 0, clear the lock
      if (initialSwipeDir === 'right' && deltaX < 0) {
        setInitialSwipeDir(null);
        setActiveSwipe(null);
      }
      if (initialSwipeDir === 'left'  && deltaX > 0) {
        setInitialSwipeDir(null);
        setActiveSwipe(null);
      }
    }

    // show visual feedback only once you pass the threshold
    setActiveSwipe(deltaX < -100 ? 'left' : deltaX > 100 ? 'right' : null);
  },
  onSwipedLeft: () => {
    // only fire if they never reversed
    if (initialSwipeDir === 'left') handleSwipe('left');
  },
  onSwipedRight: () => {
    if (initialSwipeDir === 'right') handleSwipe('right');
  },
  onSwipeEnd: () => {
    // reset everything on release
    setIsDragging(false);
    setActiveSwipe(null);
    setInitialSwipeDir(null);
  },
  preventDefaultTouchmoveEvent: true,
  trackMouse: true
});

  const handleDetailsClick = async () => {
    setIsLoadingDetails(true);
    const selectedAnime = animeList[currentIndex];
    const kitsuId = selectedAnime.id;
    const title = selectedAnime.attributes.canonicalTitle;

    try {
      // Fetch Jikan data by title to get genre and recommendations
      const searchRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const searchData = await searchRes.json();

      const jikanAnime = searchData.data[0];
      let genres = jikanAnime.genres.map(g => g.name).join(', ');
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
      const streamRes = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}/streaming-links`);
      const streamData = await streamRes.json();

      setCurrentAnimeDetails({
        ...selectedAnime,
        genres,
        recommendations,
        streamingLinks: streamData.data.map(link => ({
          url: link.attributes.url,
          subs: link.attributes.subs,
          dubs: link.attributes.dubs
        }))
      });

      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      setCurrentAnimeDetails({
        ...selectedAnime,
        genres: 'Not available',
        recommendations: [],
        streamingLinks: []
      });
      setShowDetails(true);
    }
    finally {
      setIsLoadingDetails(false); // Always hide loading bar when done
    }
  };

  const closeDetails = () => {
    setShowDetails(false);
  };

  const currentAnime = animeList[currentIndex];

  const variants = {
    enter: (direction) => ({
      opacity: 0,
      x: direction === 'left' ? 200 : -200,
    }),
    center: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'tween',
        ease: 'easeOut',
        duration: 0.5
      }
    },
    exit: (direction) => ({
      opacity: 0,
      x: direction === 'left' ? -200 : 200,
      transition: { duration: 0.3 }
    })
  };

  return (
    <div id="swipe" className="swiper-container">
      {!isUserLoggedIn ? (
        <div className="login-prompt">
          <h2>Please log in to start swiping!</h2>
          <p>Sign in to get personalized anime recommendations based on your preferences.</p>
        </div>
      ) : (
        <>
          {isLoading ? (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Finding your perfect anime...</p>
            </div>
          ) : (

            <AnimatePresence custom={swipeDirection} initial={false}>
              {animeList[currentIndex] && (
                <>
                  {/* Swipe feedback icons */}
                  <div className={`swipe-feedback like ${activeSwipe === 'right' ? 'show' : ''}`}>
                    👍 LIKE
                  </div>
                  <div className={`swipe-feedback dislike ${activeSwipe === 'left' ? 'show' : ''}`}>
                    👎 PASS
                  </div>

                  <motion.div
                    key={animeList[currentIndex].id}
                    className={`anime-card ${isDragging ? 'dragging' : ''} ${activeSwipe === 'left' ? 'swipe-left' : ''} ${activeSwipe === 'right' ? 'swipe-right' : ''}`}
                    {...swipeHandlers}
                    custom={swipeDirection}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'tween', ease: 'easeOut', duration: 0.5 }}
                  >
                    <img
                      src={animeList[currentIndex].attributes.posterImage?.medium || 'https://via.placeholder.com/220x320'}
                      alt={animeList[currentIndex].attributes.canonicalTitle}
                      className="poster"
                    />
                    <div className="anime-info">
                      <h2>{animeList[currentIndex].attributes.canonicalTitle}</h2>
                        {animeList[currentIndex].explanation && (
                          <div className="explanation-container">
                            <p className="explanation-title">Why you might like this:</p>
                            <p className="explanation">{animeList[currentIndex].explanation}</p>
                          </div>
                        )}
                      <button className="details-btn" onClick={handleDetailsClick} disabled={isLoadingDetails}>
                        {isLoadingDetails ? 'Loading...' : 'More Details'}
                      </button>
                    </div>
                    <div className="swipe-hint">
                      <span className={activeSwipe === 'left' ? 'active' : ''}>👎 Pass</span>
                      <span className={activeSwipe === 'right' ? 'active' : ''}>👍 Like</span>
                    </div>
                    <div className="buttons">
                      <button onClick={() => handleSwipe('left')} className="btn btn-left">👎</button>
                      <button onClick={() => handleSwipe('right')} className="btn btn-right">👍</button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          )}
        </>
      )}

      {showDetails && currentAnimeDetails && (
        <div className="details-overlay">
          <motion.div 
            className="details-popup"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <button className="close-btn" onClick={closeDetails}>✕</button>
            <div className="popup-content">
              <img
                src={currentAnimeDetails.attributes.posterImage?.medium || 'https://via.placeholder.com/220x320'}
                alt={currentAnimeDetails.attributes.canonicalTitle}
                className="popup-poster"
              />
              <div className="popup-info">
                <h2>{currentAnimeDetails.attributes.canonicalTitle}</h2>

                <div className="meta-info">
                  {currentAnimeDetails.attributes.ageRatingGuide && (
                    <span className="meta-item age-rating">
                      {currentAnimeDetails.attributes.ageRatingGuide}
                    </span>
                  )}
                  {currentAnimeDetails.attributes.popularityRank && (
                    <span className="meta-item popularity">
                      #{currentAnimeDetails.attributes.popularityRank}
                    </span>
                  )}
                  {currentAnimeDetails.attributes.episodeCount && (
                    <span className="meta-item episodes">
                      {currentAnimeDetails.attributes.episodeCount} eps
                    </span>
                  )}
                  {currentAnimeDetails.attributes.startDate && (
                    <span className="meta-item calendar">
                      {new Date(currentAnimeDetails.attributes.startDate).toLocaleDateString()}
                      {currentAnimeDetails.attributes.endDate && (
                        <> - {new Date(currentAnimeDetails.attributes.endDate).toLocaleDateString()}</>
                      )}
                    </span>
                  )}
                  {currentAnimeDetails.attributes.averageRating && (
                    <span className="meta-item rating-star">
                      {currentAnimeDetails.attributes.averageRating}%
                    </span>
                  )}
                </div>

                <div className="popup-section">
                  <span>Genres: {currentAnimeDetails.genres || 'N/A'}</span>
                </div>

                <div className="popup-section synopsis">
                  <h3>Synopsis</h3>
                  <p>{currentAnimeDetails.attributes.synopsis || 'No synopsis available.'}</p>
                </div>

                <div className="popup-section">
                  <h3>Available On</h3>
                  <StreamingPlatforms streamingLinks={currentAnimeDetails.streamingLinks} />
                </div>

                <div className="popup-section similar">
                  <h3>Similar Anime</h3>
                  {currentAnimeDetails?.recommendations?.length > 0 ? (
                    <ul>
                      {currentAnimeDetails.recommendations.map((rec, index) => (
                        <li key={index}>
                          <a href={rec.url} target="_blank" rel="noopener noreferrer">
                            {rec.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No recommendations available.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default AnimeSwiper;