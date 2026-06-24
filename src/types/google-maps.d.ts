// Minimal ambient typing for the Google Maps JS API loaded at runtime via a
// <script> tag. We intentionally type it loosely to avoid a build-time dep.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
  // eslint-disable-next-line no-var
  var google: any;
}

export {};
