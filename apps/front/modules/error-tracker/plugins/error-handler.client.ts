export default defineNuxtPlugin((nuxtApp) => {
  const { reportError } = useErrors();

  nuxtApp.vueApp.config.errorHandler = async (err: any, instance, info) => {
    console.error("[ErrorTracker] Vue Error:", err);

    if (
      err?.response?.status &&
      [400, 401, 403, 422].includes(err.response.status)
    ) {
      return;
    }

    try {
      await reportError({
        message: err?.message || String(err),
        source: `Frontend Vue - ${info}`,
        stack: err?.stack || "",
        metadata: {
          info,
          route: window?.location?.pathname,
          userAgent: navigator?.userAgent,
        },
      });
    } catch (e) {
      console.error("[ErrorTracker] Failed to report error:", e);
    }
  };

  window.addEventListener("unhandledrejection", async (event) => {
    const reason = event.reason;
    console.error("[ErrorTracker] Unhandled Rejection:", reason);

    if (
      reason?.response?.status &&
      [400, 401, 403, 422].includes(reason.response.status)
    ) {
      return;
    }

    try {
      await reportError({
        message: reason?.message || String(reason),
        source: "Frontend Promise Rejection",
        stack: reason?.stack || "",
        metadata: {
          route: window?.location?.pathname,
          userAgent: navigator?.userAgent,
        },
      });
    } catch (e) {
      console.error("[ErrorTracker] Failed to report rejection:", e);
    }
  });

  window.addEventListener("error", async (event) => {
    console.error("[ErrorTracker] Global Error:", event.error);

    try {
      await reportError({
        message: event.error?.message || event.message,
        source: "Frontend Global Error",
        stack: event.error?.stack || "",
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          route: window?.location?.pathname,
          userAgent: navigator?.userAgent,
        },
      });
    } catch (e) {
      console.error("[ErrorTracker] Failed to report global error:", e);
    }
  });
});
