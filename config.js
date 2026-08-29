/* ==========================================================================
   Vessel — runtime configuration
   This is a static site with no build step, so there is no place to inject
   NEXT_PUBLIC_* at build time. Set the API origin here instead.

   WAITLIST_API — origin of the Railway waitlist service. NO TRAILING SLASH.
     production : https://api.vessel.wtf   (or the *.up.railway.app URL)
     local dev  : http://localhost:8080

   Public value only. Never put ADMIN_KEY, DATABASE_URL or RESEND_API_KEY here —
   everything in this file ships to the browser.
   ========================================================================== */
window.VESSEL_CONFIG = {
  WAITLIST_API: "https://api.vessel.wtf"
};
