import React, { useEffect, useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import '../AnimeSwiper.css';
import StreamingPlatforms from './StreamingPlatforms.jsx';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { auth, db } from './Navbar';

function AnimeSwiper() {
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

  const fetchInitialAnime = async (user) => {
    setIsLoading(true);
    try {
      // Fetch user preferences
      const userRef = doc(db, 'Users', user.uid);
      const docSnap = await getDoc(userRef);
      
      let preferences = { likes: [], dislikes: [] };
      let ratedAnimeIds = [];
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        preferences = {
          likes: data.likes || [],
          dislikes: data.dislikes || []
        };
        ratedAnimeIds = [
          ...preferences.likes.map(like => like.id),
          ...preferences.dislikes.map(dislike => dislike.id)
        ];
      }

      // If user has preferences, get personalized recommendation
      if (preferences.likes.length > 0 || preferences.dislikes.length > 0) {
        await getPersonalizedRecommendation(preferences, ratedAnimeIds);
      } else {
        await fetchRandomAnime(ratedAnimeIds);
      }
    } catch (error) {
      console.error('Error fetching initial anime:', error);
      await fetchRandomAnime([]); // Fallback with empty rated list
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsUserLoggedIn(true);
        fetchInitialAnime(user);
      } else {
        setIsUserLoggedIn(false);
        // Clear anime data when user logs out
        setAnimeList([]);
        setCurrentIndex(0);
      }
    });

    return () => unsubscribe(); // Clean up listener
  }, []);

  const fetchRandomAnime = async (ratedAnimeIds) => {
    setIsLoading(true);
    try {
      const res = await fetch('https://kitsu.io/api/edge/anime?page[limit]=10&sort=-user_count');
      const data = await res.json();
      
      // Filter out rated anime
      const unratedAnime = data.data.filter(anime => 
        !ratedAnimeIds.includes(anime.id)
      );
      
      if (unratedAnime.length > 0) {
        setAnimeList(unratedAnime);
        setCurrentIndex(0);
      } else {
        // If all are rated, just show the first one
        setAnimeList([data.data[0]]);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Error fetching random anime:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPersonalizedRecommendation = async (preferences, ratedAnimeIds) => {
    setIsLoading(true);
    try {
      const likedTitles = preferences.likes.map(like => `${like.title}`).join(', ') || 'none';
      const dislikedTitles = preferences.dislikes.map(dislike => `${dislike.title}`).join(', ') || 'none';

      const prompt = `Recommend exactly one anime that:
1. Matches the user's preferences:
   - Liked: ${likedTitles}
   - Disliked: ${dislikedTitles}
2. Is not any of these: ${likedTitles}, ${dislikedTitles}
3. Exists in Kitsu.io's database

Return ONLY the exact anime title (nothing else).;`;

      const result = await model.generateContent([prompt]);
      const response = await result.response;
      let recommendedTitle = response.text().trim().replace(/"/g, '');
      console.log('Personalized recommendation:', recommendedTitle);

      // Search Kitsu for this title
      const searchRes = await fetch(
        `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(recommendedTitle)}`
      );
      const searchData = await searchRes.json();
      
      // Filter out any anime that's already been rated
      const filteredResults = searchData.data.filter(anime => 
        !ratedAnimeIds.includes(anime.id)
      );
      
      if (filteredResults.length > 0) {
        setAnimeList([filteredResults[0]]);
        setCurrentIndex(0);
        setHasLoadedValidAnime(true);
      } else {
        console.warn('Recommended anime not found or already rated, falling back to random');
        await fetchRandomAnime();
      }
    } catch (error) {
      console.error('Error in personalized recommendation:', error);
      await fetchRandomAnime();
    } finally {
      setIsLoading(false);
    }
  };

  const getGeminiRecommendedAnime = async (currentAnime, action) => {
    setIsLoading(true);
    try {
      // Get the latest preferences
      const user = auth.currentUser;
      let latestPreferences = { likes: [], dislikes: [] };
      let ratedAnimeIds = [];
      
      if (user) {
        const userRef = doc(db, 'Users', user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          latestPreferences = {
            likes: data.likes || [],
            dislikes: data.dislikes || []
          };
          ratedAnimeIds = [
            ...latestPreferences.likes.map(like => like.id),
            ...latestPreferences.dislikes.map(dislike => dislike.id)
          ];
        }
      }

      const likedTitles = latestPreferences.likes.map(like => `${like.title}`).join(', ') || 'none';
      const dislikedTitles = latestPreferences.dislikes.map(dislike => `${dislike.title}`).join(', ') || 'none';

      const prompt = `Recommend exactly one anime that:
1. Is similar to "${currentAnime.attributes.canonicalTitle}"
2. Would be appropriate for someone who ${action === 'right' ? 'liked' : 'did not like'} it
3. Matches these preferences:
   - User liked: ${likedTitles}
   - User disliked: ${dislikedTitles}
4. Is not any of these: ${likedTitles}, ${dislikedTitles}
5. Exists in Kitsu.io's database

Return ONLY the exact anime title (nothing else).;`;

      const result = await model.generateContent([prompt]);
      const response = await result.response;
      const recommendedTitle = response.text().trim().replace(/"/g, '');
      console.log('Gemini recommendation:', recommendedTitle);

      // Search Kitsu for this title
      const searchRes = await fetch(
        `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(recommendedTitle)}`
      );
      const searchData = await searchRes.json();
      
      // Filter out rated anime
      const filteredResults = searchData.data.filter(anime => 
        !ratedAnimeIds.includes(anime.id)
      );
      
      if (filteredResults.length > 0) {
        setAnimeList(prev => [...prev, filteredResults[0]]);
        setCurrentIndex(prev => prev + 1);
      } else {
        console.warn('Recommended anime not found or already rated, falling back to random');
        await fetchRandomAnime();
      }
    } catch (error) {
      console.error('Error in recommendation:', error);
      await fetchRandomAnime();
    } finally {
      setIsLoading(false);
    }
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
    onSwiping: (eventData) => {
      setIsDragging(true);
      // Update active swipe direction based on movement
      if (eventData.deltaX < -50) {
        setActiveSwipe('left');
      } else if (eventData.deltaX > 50) {
        setActiveSwipe('right');
      } else {
        setActiveSwipe(null);
      }
    },
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => {
      setIsDragging(false);
      setActiveSwipe(null);
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

      // Get fun fact from Gemini
      let funFact = '';
      try {
        const factResult = await model.generateContent([`Give me a fun fact about the anime "${title}" in 20 words or less.`]);
        funFact = await factResult.response.text();
      } catch (error) {
        console.error('Error getting fun fact:', error);
        funFact = 'Fun fact not available';
      }

      setCurrentAnimeDetails({
        ...selectedAnime,
        genres,
        recommendations,
        funFact,
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
        funFact: 'Fun fact not available',
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
              <div className="loading-spinner">Finding your perfect anime...</div>
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
                      <p>{animeList[currentIndex].attributes.synopsis?.substring(0, 150)}...</p>
                      <button 
                        className="details-btn" 
                        onClick={handleDetailsClick}
                        disabled={isLoadingDetails}
                      >
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

                <div className="popup-section">
                  <h3>Fun Fact</h3>
                  <p>{currentAnimeDetails.funFact}</p>
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
