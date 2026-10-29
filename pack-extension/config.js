// PACK Extension: where the extension talks to.
// Loaded before the side panel and content scripts, so both read the same values.
// To test against a local PACK, set DEV to true and reload the extension.
// The release build (pack-extension/build.sh) refuses to package with DEV on.

const DEV = false

const PACK_CONFIG = DEV
  ? {
      apiBase: 'http://localhost:8001/api/v1',
      webUrl: 'http://localhost:4000',
      // Pages allowed to hand the extension a sign-in token
      authOrigins: ['http://localhost:4000'],
    }
  : {
      apiBase: 'https://pack-capstone-production.up.railway.app/api/v1',
      webUrl: 'https://textpack.co',
      authOrigins: ['https://textpack.co'],
    }
