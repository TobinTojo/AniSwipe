import React, { useEffect, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import '../AnimeSwiper.css';
import StreamingPlatforms from './StreamingPlatforms.jsx';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { auth, db } from './Navbar';
import { GENRES } from './PreferencesModal'; // Import the genres
import { useLocation } from 'react-router-dom';


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

   // ... existing state ...
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([...GENRES]);
  const [episodeFilter, setEpisodeFilter] = useState('any');

  const unselectedGenres = GENRES.filter(g => !selectedGenres.includes(g)).map(g => g.toLowerCase());

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);

   const currentAnime = animeList[currentIndex];
   
   const location = useLocation();

    // Load filters from Firebase on component mount
   useEffect(() => {
  const loadFilters = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, 'Users', user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) return;
    const filters = docSnap.data().filters;
    if (filters) {
      console.log(filters.genres);
      setSelectedGenres(filters.genres || [...GENRES]);
      setEpisodeFilter(filters.episodes || 'any');
      // Trigger a new search with the loaded filters
      if (hasCompletedPreferences) {
        fetchInitialAnime(user);
      }
    }
  };
  loadFilters();
}, [isUserLoggedIn, hasCompletedPreferences]);


  // Save filters to Firebase whenever they change
  const saveFilters = async (genres = selectedGenres, episodes = episodeFilter) => {
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'Users', user.uid);
      await updateDoc(userRef, {
        filters: {
          genres,
          episodes
        }
      });
    }
  };

  const toggleGenre = (genre) => {
  const newGenres = selectedGenres.includes(genre)
    ? selectedGenres.filter(g => g !== genre)
    : [...selectedGenres, genre];
  setSelectedGenres(newGenres);
  saveFilters(newGenres, episodeFilter);
};


  const handleEpisodeFilterChange = (value) => {
  setEpisodeFilter(value);
  saveFilters(selectedGenres, value);
};



  // Fetch initial anime on load
const fetchInitialAnime = async (user) => {
  setIsLoading(true);
  try {
    const userRef = doc(db, 'Users', user.uid);
    const docSnap = await getDoc(userRef);

    let preferences = { likes: [], dislikes: [] };
    let ratedAnimeIds = [];
    let userPreferences = {};
    // grab filters right away
    const filters = docSnap.data().filters || {};
    const genresFromDB = filters.genres || selectedGenres;
    // update local state so the UI matches
    setSelectedGenres(genresFromDB);
    setEpisodeFilter(filters.episodes || episodeFilter);

    
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
    // pass in the genres you just loaded
    await getPersonalizedRecommendation(preferences, ratedAnimeIds, genresFromDB);
    } else if (userPreferences.favoriteAnimes?.length > 0 || userPreferences.favoriteGenres?.length > 0) {
      console.log('Calling getInitialRecommendation (has favorite animes/genres)');
      await getInitialRecommendation(userPreferences, ratedAnimeIds);
    } else {
      console.log('Calling fetchRandomAnime (no preferences available)');
      await fetchRandomAnime(ratedAnimeIds);
    }
  } catch (error) {
    console.error('Error fetching initial anime:', error);
    console.log('Falling back to fetchRandomAnime due to error');
    await fetchRandomAnime([]);
  } finally {
    setIsLoading(false);
  }
};

// Add this new function to AnimeSwiper.jsx
const getInitialRecommendation = async (preferences, ratedAnimeIds) => {
  console.log('getInitialRecommendation called with:', {
    favoriteAnimes: preferences.favoriteAnimes?.length || 0,
    favoriteGenres: preferences.favoriteGenres?.length || 0,
    ratedAnimeIds: ratedAnimeIds.length
  });
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

 useEffect(() => {
    if (location.pathname === "/" && isUserLoggedIn) {
      fetchInitialAnime(auth.currentUser);
    }
  }, [location.pathname, isUserLoggedIn]);

  const fetchRandomAnime = async (ratedAnimeIds) => {
  console.log('fetchRandomAnime called (fallback)', {
    ratedAnimeIds: ratedAnimeIds.length
  });
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


   const getPersonalizedRecommendation = async (preferences, ratedAnimeIds, genres = selectedGenres) => {
    console.log('getPersonalizedRecommendation called with:', {
    likes: preferences.likes.length,
    dislikes: preferences.dislikes.length,
    ratedAnimeIds: ratedAnimeIds.length,
    selectedGenres: genres,
    unselectedGenres: GENRES.filter(g => !genres.includes(g)).map(g => g.toLowerCase())
  });
  setIsLoading(true);
  const tried = new Set();

    const unselected = GENRES.filter(g => !genres.includes(g)).map(g => g.toLowerCase());


  // Get favorite genres and anime from preferences
  let favoriteGenres = 'any';
  let favoriteAnimes = 'none';
  if (preferences.preferences) {
    favoriteGenres = preferences.preferences.favoriteGenres?.join(', ') || 'any';
    favoriteAnimes = preferences.preferences.favoriteAnimes?.join(', ') || 'none';
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const likedTitles = preferences.likes.map(l => l.title).join(', ') || 'none';
      const dislikedTitles = preferences.dislikes.map(d => d.title).join(', ') || 'none';
      const avoid = [...tried, ...preferences.likes.map(l => l.title), ...preferences.dislikes.map(d => d.title)].join(', ') || 'none';

          const prompt = `Recommend exactly one anime that:
1. Aligns with the user's liked preferences only:
   - Liked: ${likedTitles}, ${favoriteAnimes}
2. Avoids any similarity to the user's dislikes:
   - Disliked: ${dislikedTitles}
3. Matches the user's favorite genres: ${favoriteGenres}
4. Is in the Kitsu.io database and not among: ${likedTitles}, ${dislikedTitles}, ${favoriteAnimes}
5. Is in these genres: ${genres.join(', ')}
6. ${episodeFilter === '>=50' ? 'Has 50 or more episodes' : episodeFilter === '<=50' ? 'Has 50 or fewer episodes' : ''}
Only return JSON in this format: { "title": "Anime Title", "reason": "25-word explanation linking the pick to the user's liked preferences" }`;


   const result = await model.generateContent([prompt]);

// 1) Log the full response object (headers, status, etc.)
console.log('💬 personalizedGeminiResult:', result);

// 2) Grab and log the raw text from Gemini
const raw = (await result.response.text()).trim();
console.log('💬 personalizedGeminiRawText:', raw);

// 3) After parsing, log the parsed JSON (or fallback)
let rec;
try {
  rec = parseJsonFromText(raw);
  console.log('💬 personalizedGeminiParsed:', rec);
} catch (err) {
  console.error('❗️ Failed to parse recommendation JSON:', raw, err);
  rec = { title: raw, reason: '' };
}

      tried.add(rec.title);

      const searchRes = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(rec.title)}`);
      const searchData = await searchRes.json();
      const filtered = searchData.data.filter(a => !ratedAnimeIds.includes(a.id));

      if (filtered.length) {
        // Double-check actual genres via Jikan and skip if it has any unselected genre
        const jikanRes = await fetch(
          `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(rec.title)}&limit=1`
        );
        const jikanData = await jikanRes.json();
        const animeGenres = (jikanData.data[0]?.genres || []).map(g => g.name.toLowerCase());
        if (animeGenres.some(g => unselectedGenres.includes(g))) {
          // this one sneaks in a deselected genre—try again
          continue;
        }

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
      console.log(`Calling getGeminiRecommendedAnime after ${action === 'right' ? 'like' : 'dislike'}`);

  setIsLoading(true);

  // Gather latest user preferences
  const user = auth.currentUser;
  let latest = { likes: [], dislikes: [] };
  let ratedIds = [];
  let favoriteGenres = 'any';
  let favoriteAnimes = 'none';
  
  if (user) {
    const userRef = doc(db, 'Users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      latest = { likes: data.likes || [], dislikes: data.dislikes || [] };
      ratedIds = [...latest.likes.map(l => l.id), ...latest.dislikes.map(d => d.id)];
      
      // Get favorite genres and anime from preferences
      if (data.preferences) {
        favoriteGenres = data.preferences.favoriteGenres?.join(', ') || 'any';
        favoriteAnimes = data.preferences.favoriteAnimes?.join(', ') || 'none';
      }
    }
  }

  const likedTitles = latest.likes.map(l => l.title).join(', ') || 'none';
  const dislikedTitles = latest.dislikes.map(d => d.title).join(', ') || 'none';

  const tried = new Set();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
        const prompt = `Recommend exactly one anime that:
1. Aligns with the user's liked preferences only:
   - Liked: ${likedTitles}, ${favoriteAnimes}
2. Avoids any similarity to the user's dislikes:
   - Disliked: ${dislikedTitles}
3. Matches the user's favorite genres: ${favoriteGenres}
4. Is in the Kitsu.io database and not among: ${likedTitles}, ${dislikedTitles}, ${favoriteAnimes}
5. Is in these genres: ${selectedGenres.join(', ')}
6. ${episodeFilter === '>=50' ? 'Has 50 or more episodes' : episodeFilter === '<=50' ? 'Has 50 or fewer episodes' : ''}
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
      // Verify genres using the Jikan API
      const jikanRes = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(rec.title)}&limit=1`
      );
      const jikanData = await jikanRes.json();
      const animeGenres = (jikanData.data[0]?.genres || []).map(g => g.name.toLowerCase());

      // Skip the current recommendation if it contains any unselected genres
      if (animeGenres.some(g => unselectedGenres.includes(g))) {
        continue;
      }

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

  useEffect(() => {
  const loadDetailsForCurrentAnime = async () => {
    if (!currentAnime) return;
    
    const kitsuId = currentAnime.id;
    const title = currentAnime.attributes.canonicalTitle;

    try {
      // Fetch Jikan data by title to get genre and recommendations
      const searchRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
      const searchData = await searchRes.json();

      const jikanAnime = searchData.data[0];
      let genres = jikanAnime?.genres?.map(g => g.name).join(', ') || 'Unknown';
      let recommendations = [];

      if (jikanAnime) {
        const recRes = await fetch(`https://api.jikan.moe/v4/anime/${jikanAnime.mal_id}/recommendations`);
        const recData = await recRes.json();
        recommendations = recData.data?.slice(0, 5).map(rec => ({
          title: rec.entry.title,
          url: rec.entry.url
        })) || [];
      }

      // Fetch streaming links from Kitsu
      const streamRes = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}/streaming-links`);
      const streamData = await streamRes.json();

      setCurrentAnimeDetails({
        ...currentAnime,
        genres,
        recommendations,
        streamingLinks: streamData.data?.map(link => ({
          url: link.attributes.url,
          subs: link.attributes.subs,
          dubs: link.attributes.dubs
        })) || [],
        youtubeVideoId: currentAnime.attributes.youtubeVideoId
      });
    } catch (error) {
      console.error('Error fetching details:', error);
      setCurrentAnimeDetails({
        ...currentAnime,
        genres: 'Unknown',
        recommendations: [],
        streamingLinks: [],
        youtubeVideoId: null
      });
    }
  };

  loadDetailsForCurrentAnime();
}, [currentAnime]);

  const closeDetails = () => {
    setShowDetails(false);
  };

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

   // Add this to your JSX (before the AnimatePresence component)
  const renderFilters = () => (
    <div className={`filters-modal ${showFilters ? 'active' : ''}`}>
      <div className="filters-content">
        <h2>Filter Recommendations</h2>
        <button className="close-btn" onClick={() => setShowFilters(false)}>✕</button>
        
        <div className="filters-group">
          <label>Genres</label>
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
        {/* error if no genres */}
        {selectedGenres.length === 0 && (
          <p className="filters-error">
            ⚠️ You must select at least one genre.
          </p>
        )}
        </div>

        
        <div className="filters-group">
          <label>Episode Count</label>
          <div className="episode-filter">
            <button
              className={`episode-btn ${episodeFilter === 'any' ? 'active' : ''}`}
              onClick={() => handleEpisodeFilterChange('any')}
            >
              Any
            </button>
            <button
              className={`episode-btn ${episodeFilter === '>=50' ? 'active' : ''}`}
              onClick={() => handleEpisodeFilterChange('>=50')}
            >
              ≥50
            </button>
            <button
              className={`episode-btn ${episodeFilter === '<=50' ? 'active' : ''}`}
              onClick={() => handleEpisodeFilterChange('<=50')}
            >
              ≤50
            </button>
          </div>
        </div>
        
       <button 
        className="apply-filters-btn"
        onClick={() => {
          setShowFilters(false);
          fetchInitialAnime(auth.currentUser);
        }}
        disabled={selectedGenres.length === 0}
      >
        Apply Filters
      </button>

      </div>
    </div>
  );

  return (
    <div id="swipe" className="swiper-container">
      {isUserLoggedIn && (
        <button 
          className="filter-btn"
          onClick={() => setShowFilters(true)}
        >
          <i className="fas fa-filter"></i> Filters
        </button>
      )}
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
                      className={`anime-card ${isDragging ? 'dragging' : ''} ${activeSwipe==='left'?'swipe-left':''} ${activeSwipe==='right'?'swipe-right':''}`}
                      {...swipeHandlers}                         // ← attach here
                      custom={swipeDirection}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ type: 'tween', ease: 'easeOut', duration: 0.5 }}
                    >
                    <div className="media-gallery">
                      {currentMediaIndex === 0 ? (
                         <>
                        <img
                          src={animeList[currentIndex].attributes.posterImage?.medium || 'https://via.placeholder.com/220x320'}
                          alt={animeList[currentIndex].attributes.canonicalTitle}
                          className="poster"
                          // optionally keep this click-to-play behavior
                          onClick={() => {
                            if (animeList[currentIndex].attributes.youtubeVideoId) {
                              setCurrentMediaIndex(1);
                              setIsPlayingTrailer(true);
                            }
                          }}
                          style={{ cursor: animeList[currentIndex].attributes.youtubeVideoId ? 'pointer' : 'default' }}
                        />

                        {/* only show the button if a trailer exists */}
                        {animeList[currentIndex].attributes.youtubeVideoId && (
                          <button
                            className="view-trailer"
                            onClick={() => {
                              setCurrentMediaIndex(1);
                              setIsPlayingTrailer(true);
                            }}
                          >
                            <i className="fas fa-play"></i> View Trailer
                          </button>
                        )}
                      </>
                      ) : (
                        <div className="trailer-container">
                          <iframe
                            width="100%"
                            height="400"
                            src={`https://www.youtube.com/embed/${animeList[currentIndex].attributes.youtubeVideoId}?autoplay=1&mute=1`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                          <button 
                            className="back-to-poster"
                            onClick={() => {
                              setCurrentMediaIndex(0);
                              setIsPlayingTrailer(false);
                            }}
                          >
                            <i className="fas fa-image"></i> Back to Poster
                          </button>
                        </div>
                      )}
                      
                      {/* Dotted navigation */}
                      <div className="gallery-dots">
                        <span 
                          className={`dot ${currentMediaIndex === 0 ? 'active' : ''}`}
                          onClick={() => setCurrentMediaIndex(0)}
                        ></span>
                        {animeList[currentIndex].attributes.youtubeVideoId && (
                          <span 
                            className={`dot ${currentMediaIndex === 1 ? 'active' : ''}`}
                            onClick={() => {
                              setCurrentMediaIndex(1);
                              setIsPlayingTrailer(true);
                            }}
                          ></span>
                        )}
                      </div>
                    </div>
                    <div className="anime-info">
                      <h2>{animeList[currentIndex].attributes.canonicalTitle}</h2>
                      {animeList[currentIndex].explanation && (
                        <div className="explanation-container">
                          <p className="explanation-title">Why you might like this:</p>
                          <p className="explanation">{animeList[currentIndex].explanation}</p>
                        </div>
                      )}
                      <div className="expanded-details">
                        {/* Meta info row */}
                        <div className="meta-info">
                          {currentAnime.attributes.averageRating && (
                            <span className="meta-item rating-star">
                              {currentAnime.attributes.averageRating}%
                            </span>
                          )}
                          {currentAnime.attributes.popularityRank && (
                            <span className="meta-item popularity">
                              #{currentAnime.attributes.popularityRank} Popular
                            </span>
                          )}
                          {currentAnime.attributes.episodeCount && (
                            <span className="meta-item episodes">
                              {currentAnime.attributes.episodeCount} eps
                            </span>
                          )}
                          {currentAnime.attributes.ageRatingGuide && (
                            <span className="meta-item age-rating">
                              {currentAnime.attributes.ageRatingGuide}
                            </span>
                          )}
                        </div>

                        {/* Dates */}
                        <div className="detail-item">
                          <span className="detail-label">Aired:</span>
                          <span className="detail-value">
                            {currentAnime.attributes.startDate ? new Date(currentAnime.attributes.startDate).toLocaleDateString() : 'Unknown'}
                            {currentAnime.attributes.endDate && ` to ${new Date(currentAnime.attributes.endDate).toLocaleDateString()}`}
                          </span>
                        </div>

                        {/* Synopsis */}
                        <h3>Synopsis</h3>
                        <p>{currentAnime.attributes.synopsis || 'No synopsis available.'}</p>

                        {/* Genres */}
                        <h3>Genres</h3>
                        <div className="genres-list">
                          {currentAnimeDetails?.genres ? (
                            currentAnimeDetails.genres.split(', ').map((genre, index) => (
                              <span key={index} className="genre-pill">{genre}</span>
                            ))
                          ) : (
                            <span className="detail-value">Loading genres...</span>
                          )}
                        </div>

                       {/* Streaming Platforms */}
                        <h3>Available On</h3>
                        <StreamingPlatforms streamingLinks={currentAnimeDetails?.streamingLinks} />


                        {/* Similar Anime */}
                        <h3>Similar Anime</h3>
                        <div className="similar-anime">
                          {currentAnimeDetails?.recommendations?.length > 0 ? (
                            <ul className="similar-anime-list">
                              {currentAnimeDetails.recommendations.map((rec, index) => (
                                <li key={index} className="similar-anime-item">
                                  <a 
                                    href={rec.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="similar-anime-link"
                                  >
                                    {rec.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="detail-value">No recommendations available</span>
                          )}
                        </div>
                      </div>
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
     {showFilters && renderFilters()}
    </div>
  );
}

export default AnimeSwiper;