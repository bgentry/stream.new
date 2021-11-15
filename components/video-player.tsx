/* globals Image */
import { useState, useEffect, useRef, forwardRef } from 'react';

// import logger from '../lib/logger';
import { breakpoints } from '../style-vars';
import { HTMLVideoElementWithPlyr } from '../types';
import { useCombinedRefs } from '../util/use-combined-refs';

/*
 * We need to set the width/height of the player depending on what the dimensions of
 * the underlying video source is.
 *
 * On most platforms we know the dimensions on 'loadedmetadata'
 * On Desktop Safari we don't know the dimensions until 'canplay'
 *
 * At first, I tried to get the dimensions of the video from these callbacks, that worked
 * great except for on moble Safari. On Mobile Safari none of those callbacks fire until
 * there is some user interaction :(
 *
 * BUT! There is a brilliant hack here. We can create a `display: none` `img` element in the
 * DOM, load up the poster image.
 *
 * Since the poster image will have the same dimensions of the video, now we know if the video
 * is vertical and now we can style the proper width/height so the layout doesn't have a sudden
 * jump or resize.
 *
 */

type Props = {
  playbackId: string
  poster: string
  currentTime?: number
  onLoaded: () => void
  onError: (error: ErrorEvent) => void
};

type SizedEvent = {
  target: {
    width: number
    height: number
  }
};

const VideoPlayer = forwardRef<HTMLVideoElementWithPlyr, Props>(({ playbackId, poster, currentTime, onLoaded, onError }, ref) => {
  const videoRef = useRef<HTMLVideoElementWithPlyr>(null);
  const metaRef = useCombinedRefs(ref, videoRef);
  const [aspectRatio, setAspectRatio] = useState('');
  // const playerRef = useRef<Plyr | null>(null);
  const [isVertical, setIsVertical] = useState<boolean | null>();
  // const [playerInitTime] = useState(Date.now());

  const videoError = (event: ErrorEvent) => onError(event);

  const onImageLoad = (event: SizedEvent) => {
    const [w, h] = [event.target.width, event.target.height];
    if (w && h) {
      setIsVertical((w / h) < 1);
      setAspectRatio(`${w} / ${h}`);
      onLoaded();
    } else {
      onLoaded();
      console.error('Error getting img dimensions', event); // eslint-disable-line no-console
    }
  };

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
    // let hls: Hls | null;
    // hls = null;
    if (video) {
      video.addEventListener('error', videoError);
    }

    return () => {
      if (video) {
        video.removeEventListener('error', videoError);
      }
    };
  }, [playbackId, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (currentTime && video) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    import('@mux-elements/mux-video');
    import('media-chrome');
  }, []);

  return (
    <>
      <div className='video-container'>
        <media-controller autohide="2">
          <mux-video
            slot="media"
            ref={metaRef}
            env-key={process.env.NEXT_PUBLIC_MUX_ENV_KEY}
            playback-id={playbackId}
            poster={poster}
            metadata-video-title={playbackId}
            stream-type="vod"
            playsInline
          />
          <div slot="centered-chrome">
            <media-seek-backward-button />
            <media-play-button />
            <media-seek-forward-button />
          </div>
          <media-control-bar class="seek-control-bar">
            <media-time-range />
            <media-time-display show-duration remaining />
          </media-control-bar>
          <media-control-bar>
            <media-mute-button />
            <media-playback-rate-button />
            <media-pip-button />
            <media-fullscreen-button />
          </media-control-bar>
        </media-controller>
      </div>
      <style jsx>{`
        :global(:root) {
        }
        .video-container {
          margin-bottom: 40px;
          margin-top: 40px;
          border-radius: 30px;
          width: 100%;
        }
        :global(mux-video) {
          display: block;
          max-width: 100%;
          max-height: 50vh;
          cursor: pointer;
        }
        :global(media-controller) {
          display: block;
          aspect-ratio: ${aspectRatio};
          width: 100%;
          margin-left: auto;
          margin-right: auto;
        }
        @media only screen and (min-width: ${breakpoints.md}px) {
          :global(media-controller) {
            width: ${isVertical ? 'auto' : '1000px'};
            height: ${isVertical ? '600px' : 'auto'};
            max-height: 70vh;
            min-width: 30rem;
          }
        }
        @media only screen and (max-width: ${breakpoints.md}px) {
          :global(media-controller) {
            width: 100%;
            height: 100%;
          }
        }
      `}
      </style>
    </>
  );
});

export default VideoPlayer;
