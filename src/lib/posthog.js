import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  enable_exception_autocapture: true,
  capture_pageview: false,
  session_recording: {
    recordCrossOriginIframes: false,
  },
  // Allow session replays on localhost and local development domains
  disable_session_recording: false,
});

export default posthog;
