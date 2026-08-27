let loaderPromise: Promise<void> | null = null

function placesReady(): boolean {
  return Boolean(window.google?.maps?.places?.Autocomplete)
}

function waitForPlacesLibrary(): Promise<void> {
  if (placesReady()) {
    return Promise.resolve()
  }

  if (window.google?.maps?.importLibrary) {
    return window.google.maps.importLibrary("places").then(() => {})
  }

  return new Promise((resolve, reject) => {
    const started = Date.now()

    const tick = () => {
      if (placesReady()) {
        resolve()
        return
      }

      if (window.google?.maps?.importLibrary) {
        window.google.maps
          .importLibrary("places")
          .then(() => resolve())
          .catch(reject)
        return
      }

      if (Date.now() - started > 10_000) {
        reject(new Error("Google Maps Places library timed out"))
        return
      }

      window.setTimeout(tick, 50)
    }

    tick()
  })
}

/** Load the Google Maps JavaScript API with the Places library (client only). */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"))
  }

  if (placesReady()) {
    return Promise.resolve()
  }

  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise((resolve, reject) => {
    const finish = () => {
      waitForPlacesLibrary().then(resolve).catch(reject)
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps="true"]'
    )

    if (existing) {
      if (window.google?.maps) {
        finish()
        return
      }

      existing.addEventListener("load", finish, { once: true })
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps failed to load")),
        { once: true }
      )
      return
    }

    const callbackName = `__ampereGoogleMapsInit_${Date.now()}`
    const windowWithCallback = window as unknown as Record<string, unknown>
    windowWithCallback[callbackName] = () => {
      delete windowWithCallback[callbackName]
      finish()
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}`
    script.async = true
    script.defer = true
    script.dataset.googleMaps = "true"
    script.onerror = () => {
      delete windowWithCallback[callbackName]
      reject(new Error("Google Maps failed to load. Check your API key."))
    }
    document.head.appendChild(script)
  })

  return loaderPromise
}
