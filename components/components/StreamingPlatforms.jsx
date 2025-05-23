const StreamingPlatforms = ({ streamingLinks }) => {
  if (!streamingLinks || streamingLinks.length === 0) {
    return <p>Not available on any platform.</p>;
  }

  return (
    <div className="streamers">
      {streamingLinks.map((link, index) => {
        let platformName;

        try {
          const hostname = new URL(link.url).hostname;
          if (hostname.includes('crunchyroll')) platformName = 'Crunchyroll';
          else if (hostname.includes('netflix')) platformName = 'Netflix';
          else if (hostname.includes('hidive')) platformName = 'HIDIVE';
          else if (hostname.includes('hulu')) platformName = 'Hulu';
          else platformName = hostname.replace('www.', '').split('.')[0];
        } catch {
          platformName = 'Stream';
        }

        return (
          <a
            key={index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`streamer-btn ${platformName.toLowerCase()}-btn`}
          >
            {platformName}
          </a>
        );
      })}
    </div>
  );
};

export default StreamingPlatforms;