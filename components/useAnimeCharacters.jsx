// useAnimeCharacters.js
import { useEffect, useState } from 'react';

const useAnimeCharacters = () => {
  const [characters, setCharacters] = useState([]);

  useEffect(() => {
    const fetchCharacters = async () => {
      const randomPage = Math.floor(Math.random() * 500) + 1; // AniList has ~10000+ characters

      const query = `
        query ($page: Int) {
          Page(page: $page, perPage: 3) {
            characters {
              id
              name {
                full
              }
              image {
                large
              }
            }
          }
        }
      `;

      try {
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { page: randomPage },
          }),
        });

        const json = await response.json();
        setCharacters(json.data.Page.characters);
      } catch (error) {
        console.error('Error fetching characters:', error);
      }
    };

    fetchCharacters();
  }, []);

  return characters;
};

export default useAnimeCharacters;

