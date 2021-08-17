import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import logger from '../lib/logger';
import Router from 'next/router';
import 'media-chrome';

type Props = {
  playbackId: string
  poster: string
  onLoaded: () => void
  onError: (error: ErrorEvent) => void
};

type SizedEvent = {
  target: {
    width: number
    height: number
  }
};

declare global {
  module JSX { // eslint-disable-line @typescript-eslint/no-namespace,@typescript-eslint/prefer-namespace-keyword
    interface IntrinsicElements {
      'media-controller': any; // eslint-disable-line @typescript-eslint/no-explicit-any
      'media-control-bar': any; // eslint-disable-line @typescript-eslint/no-explicit-any
      'media-play-button': any; // eslint-disable-line @typescript-eslint/no-explicit-any
      'media-mute-button': any; // eslint-disable-line @typescript-eslint/no-explicit-any
      'media-volume-range': any; // eslint-disable-line @typescript-eslint/no-explicit-any
      'media-clip-selector': any; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  }
}

const VideoClipper: React.FC<Props> = ({ playbackId, poster, onLoaded, onError }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clipSelectorRef = useRef<HTMLElement | null>(null);
  // const [isVertical, setIsVertical] = useState<boolean | null>();
  const [errorMessage, setErrorMessage] = useState('');
  const [isCreatingClip, setIsCreatingClip] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const prevStartTime = useRef<number | null>(null);
  const prevEndTime = useRef<number | null>(null);
  const [duration, setDuration] = useState<number | null>();

  const videoError = (event: ErrorEvent) => onError(event);

  const onImageLoad = (event: SizedEvent) => {
    const [w, h] = [event.target.width, event.target.height];
    if (w && h) {
      // setIsVertical((w / h) < 1);
      onLoaded();
    } else {
      onLoaded();
      console.error('Error getting img dimensions', event); // eslint-disable-line no-console
    }
  };

  const createClip = async () => {
    try {
      setErrorMessage('');
      setIsCreatingClip(true);
      await fetch('/api/clips', {
        method: 'POST',
        body: JSON.stringify({ playbackId, startTime, endTime }),
        headers: { 'content-type': 'application/json' },
      })
        .then((res) => res.json())
        .then(({ id }) => {
          setIsCreatingClip(false);
          Router.push({
            pathname: `/assets/${id}`,
          });
        });
    } catch (e) {
      console.error('Error in createUpload', e); // eslint-disable-line no-console
      setIsCreatingClip(false);
      setErrorMessage('Error creating this clip');
      return Promise.reject(e);
    }
  };

  const loadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      setDuration(videoRef.current.duration);
    }
  };

  useEffect(() => {
    import('media-chrome/dist/extras/media-clip-selector');
  }, []);

  /*
   * See comment above -- we're loading the poster image just so we can grab the dimensions
   * which determines styles for the player
   */
  useEffect(() => {
    const img = new Image();
    img.onload = (evt) => onImageLoad((evt as unknown) as SizedEvent);
    img.src = poster;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const src = `https://stream.mux.com/${playbackId}.m3u8`;
    let hls: Hls | null;
    hls = null;
    if (video) {
      video.addEventListener('error', videoError);
      video.addEventListener('loadedmetadata', loadedMetadata);

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // This will run in safari, where HLS is supported natively
        video.src = src;
      } else if (Hls.isSupported()) {
        // This will run in all other modern browsers
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            logger.error('hls.js fatal error');
            videoError(new ErrorEvent('HLS.js fatal error'));
          }
        });
      } else {
        console.error( // eslint-disable-line no-console
          'This is an old browser that does not support MSE https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API',
        );
      }
    }

    return () => {
      if (video) {
        video.removeEventListener('error', videoError);
      }
      if (hls) {
        hls.destroy();
      }
    };
  }, [playbackId, videoRef]);

  /*
   * When the selected start/end times change, update the playhead of the player
   */
  useEffect(() => {
    if (startTime !== prevStartTime.current) {
      if (videoRef.current) {
        videoRef.current.currentTime = (startTime || 0);
      }
      prevStartTime.current = startTime;
    }
    if (endTime !== prevEndTime.current) {
      if (videoRef.current) {
        videoRef.current.currentTime = (endTime || 0);
      }
      prevEndTime.current = endTime;
    }
  }, [startTime, endTime]);

  useEffect(() => {
    if (clipSelectorRef.current) {
      clipSelectorRef.current.addEventListener('update', ((evt: CustomEvent) => {
        const { startTime, endTime } = evt.detail;
        setStartTime(startTime);
        setEndTime(endTime);
      }) as EventListener);
    }
  }, [duration, clipSelectorRef]);

  return (
    <>
      <div className='video-container'>
        <media-controller>
          <video
            ref={videoRef}
            slot="media"
            crossOrigin="true"
          >
            <track label="thumbnails" default kind="metadata" src={`https://image.mux.com/${playbackId}/storyboard.vtt`}></track>
          </video>
          <media-control-bar>
            <div className="clip-selector">
              <media-clip-selector ref={clipSelectorRef}></media-clip-selector>
            </div>
            <div className="buttons">
              <media-play-button></media-play-button>
              <media-mute-button></media-mute-button>
              <media-volume-range></media-volume-range>
            </div>
          </media-control-bar>
        </media-controller>

        <div className="times">
          <div>Start: {startTime} <button onClick={() => setStartTime(Math.round(videoRef.current?.currentTime || 0))}>Set start</button></div>
          <div>End: {endTime} <button onClick={() => setEndTime(Math.round(videoRef.current?.currentTime || 0))}>Set end</button></div>
          {isCreatingClip ? <div>Creating clip...</div> : <button onClick={createClip}>create clip</button>}
          {errorMessage && <div>Error: {errorMessage}</div>}
        </div>
      </div>
      <style jsx>{`
        .video-container {
          width: 100%;
        }
        .video-container :global(media-control-bar) {
          opacity: 1;
          width: 100%;
        }
        .video-container :global(media-controller) {
          margin-left: auto;
          margin-right: auto;
        }
        .clip-selector {
          width: 100%;
        }
        .buttons {
          width: 100%;
        }
        .times {
          color: white;
        }
      `}
      </style>
    </>
  );
};

export default VideoClipper;
