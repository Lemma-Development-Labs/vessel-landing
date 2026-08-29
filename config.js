/* ==========================================================================
   Vessel — runtime configuration
   This is a static site with no build step, so there is no place to inject
   NEXT_PUBLIC_* at build time. Set the API origin here instead.

   WAITLIST_API — origin of the Railway waitlist service. NO TRAILING SLASH.
     current    : the Railway service URL below
     optional   : https://api.vessel.wtf — add it as a custom domain on the
                  Railway service, then CNAME api -> the *.up.railway.app host
                  in Cloudflare (DNS-only, not proxied), and swap it in here
     local dev  : http://localhost:8080

   Public value only. Never put ADMIN_KEY, DATABASE_URL or RESEND_API_KEY here —
   everything in this file ships to the browser.
   ========================================================================== */
window.VESSEL_CONFIG = {
  WAITLIST_API: "https://waitlist-api-production-a4a0.up.railway.app"
};
