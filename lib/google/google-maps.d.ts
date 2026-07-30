declare namespace google.maps {
  function importLibrary(name: "places"): Promise<{
    Autocomplete: typeof google.maps.places.Autocomplete
  }>

  namespace places {
    class Autocomplete {
      constructor(
        inputField: HTMLInputElement,
        opts?: {
          componentRestrictions?: { country: string | string[] }
          fields?: string[]
          types?: string[]
        }
      )
      addListener(
        eventName: "place_changed",
        handler: () => void
      ): MapsEventListener
      getPlace(): PlaceResult
    }

    interface PlaceResult {
      address_components?: Array<{
        long_name: string
        short_name: string
        types: string[]
      }>
      formatted_address?: string
      geometry?: {
        location?: {
          lat: () => number
          lng: () => number
        }
      }
    }
  }

  namespace event {
    function clearInstanceListeners(instance: object): void
  }

  interface MapsEventListener {
    remove(): void
  }
}

declare const google: {
  maps: typeof google.maps
}

interface Window {
  google?: typeof google
}
