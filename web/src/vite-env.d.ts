/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build timestamp, injected by vite.config.ts. Shown in the footer so it is
 *  possible to tell which version a phone is actually running. */
declare const __BUILD_TIME__: string
