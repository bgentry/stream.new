import { useState, useRef, useEffect } from 'react';
import { GetStaticProps, GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import copy from 'copy-to-clipboard';
import Mux from '@mux/mux-node';
import FullpageLoader from '../../../components/fullpage-loader';
import VideoPlayer from '../../../components/video-player';
import Layout from '../../../components/layout';
import ReportForm from '../../../components/report-form';
import { HOST_URL } from '../../../constants';
import logger from '../../../lib/logger';
import { getImageBaseUrl } from '../../../lib/urlutils';

type Params = {
  id: string;
}

export type Props = {
  playbackId: string,
  shareUrl: string,
  poster: string
};

export const getStaticProps: GetStaticProps = async (context)  => {
  const { Video } = new Mux();
  const { params } = context;
  const { id: playbackId } = (params as Params);
  const poster = `${getImageBaseUrl()}/${playbackId}/thumbnail.png`;
  const shareUrl = `${HOST_URL}/v/${playbackId}`;

  let isClippable = false;

  /*
   * stream.new is special by design -- the playback URL for /v/:id will work for _ANY_
   * public Mux playback ID. Even public playback IDs from other accounts
   *
   * However, clipping only works for playback IDs that were created in the expected
   * environment (The clipping API doesn't work across environments).
   *
   */

  try {
    isClippable = !!(await Video.PlaybackIds.get(playbackId));
  } catch (e) {
    if (e.type === 'invalid_parameters') {
      isClippable = false;
    } else {
      throw e;
    }
  }


  return { props: { playbackId, shareUrl, poster, isClippable } };
};

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: true,
  };
};

const META_TITLE = "View this video created on stream.new";
const Playback: React.FC<Props> = ({ playbackId, shareUrl, poster, isClippable }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [openReport, setOpenReport] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  if (router.isFallback) {
    return (
      <Layout
        metaTitle="View this video created on stream.new"
        image={poster}
        centered
        darkMode
      >
        <FullpageLoader text="Loading player..." />;
      </Layout>
    );
  }

  const onError = (evt: ErrorEvent) => {
    setErrorMessage('This video does not exist');
    setIsLoaded(false);
    logger.error('Error', evt);
  };

  const showLoading = (!isLoaded && !errorMessage);

  const copyUrl = () => {
    copy(shareUrl, { message:  'Copy'});
    setIsCopied(true);
    /*
     * We need a ref to the setTimeout because if the user
     * navigates away before the timeout expires we will
     * clear it out
     */
    copyTimeoutRef.current = window.setTimeout(()=> {
      setIsCopied(false);
      copyTimeoutRef.current = null;
    }, 5000);
  };

  const startTime = router.query?.time && parseFloat(router.query.time as string) || 0;

  return (
    <Layout
      metaTitle={META_TITLE}
      image={poster}
      centered={showLoading}
      darkMode
    >
      {errorMessage && <h1 className="error-message">{errorMessage}</h1>}
      {showLoading && <FullpageLoader text="Loading player" />}
      <div className="wrapper">
        {!openReport && <VideoPlayer playbackId={playbackId} poster={poster} currentTime={startTime} onLoaded={() => setIsLoaded(true)} onError={onError} />}
        <div className="actions">
          {!openReport && <a onClick={copyUrl} onKeyPress={copyUrl} role="button" tabIndex={0}>{ isCopied ? 'Copied to clipboard' :'Copy video URL' }</a>}
          {!openReport && (
            <a
              onClick={() => setOpenReport(!openReport)}
              onKeyPress={() => setOpenReport(!openReport)}
              role="button"
              tabIndex={0}
              className="report">{ openReport ? 'Back' : 'Report abuse' }
            </a>
          )}
        </div>
        {!openReport && isClippable && (
          <div><Link href={`/v/${playbackId}/clip`}><a>Clip this video</a></Link></div>
        )}
        <div className="report-form">
          { openReport && <ReportForm playbackId={playbackId} close={() => setOpenReport(false)} /> }
        </div>
      </div>
      <style jsx>{`
        .actions a:first-child {
          padding-right: 30px;
        }
        .error-message {
          color: #ccc;
        }
        .report-form {
          margin-top: 20px;
        }
        .wrapper {
          display: ${isLoaded ? 'flex' : 'none'};
          flex-direction: column;
          flex-grow: 1;
          align-items: center;
          justify-content: center;
        }
      `}
      </style>
    </Layout>
  );
};

export default Playback;
