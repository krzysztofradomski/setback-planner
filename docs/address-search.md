# Polish location search

`public/core/address-search.ts` exports `searchLocations(query, fetcher = fetch, signal?)`, returning `Promise<LocationCandidate[]>`. Each candidate contains `label`, WGS84 `longitude`/`latitude`, `provider: 'GUGiK UUG'`, and `kind: 'address' | 'street' | 'locality'`. `LOCATION_PROVIDER` exposes the official source and documentation URLs.

## Source and verified behavior

Use the public [GUGiK Universal Geocoding Service](https://services.gugik.gov.pl/uug/) and its [current endpoint documentation](https://services.gugik.gov.pl/uug/opis.html). Checked 2026-11-16 with read-only HTTPS requests, without credentials or private product APIs.

- `GET /uug/?request=GetAddress&address=…&exact_number=1` accepts a town, town and street, or full address; rural addresses can omit a street. The service also offers reverse geocoding, dictionary and PRNG operations; this adapter only uses address search.
- Live `Marki, Andersa 1` returned JSON `type: "address"`, a keyed `results` object with `city`, `street`, `number`, `jednostka`, and numeric-string `x`/`y`. The coordinates `644234.29,499514.03` are PL-1992 easting/northing and convert to approximately `21.117950,52.342594` in WGS84 using the project's existing projection.
- `Marki` returned `type: "city"` with ten localities. Administrative area labels distinguish these candidates. `Marki, Andersa` returned `type: "street"` with representative coordinates; its WKT can be a multiline geometry. The adapter uses the explicit x/y location, not the shape.
- A nonexistent locality returned `{"type":"city","found objects":0,"results":null,…}`. This yields an empty list; transport and malformed-response failures throw.
- The live response sent `Access-Control-Allow-Origin: *`, `Content-Type: application/json` and HTTP 200. Browser use does not require a proxy or key. This is an observed response, not a permanent CORS or availability guarantee.

## Limits and integration

No numerical request quota or SLA was stated in the inspected current service documentation. The docs describe an `accuracy` matching option and `exact_number`; they do not promise that an address match establishes property identity. The example address response reported a provider result limit of 15. The adapter allows at most 15 records and 64 KiB, enforces a 10-second request timeout, accepts a caller abort signal, and makes one request without retries. User input must be 3–200 characters. It rejects malformed envelopes and coordinates outside the supported Polish region.

Call on form submission, never on every keystroke. Cancel an obsolete request and suppress stale UI responses. Display the provider and candidate precision. A candidate should recenter the map and invite the user to select the correct parcel. Resolve that point through ULDK and require parcel confirmation before continuing. A town or street point must never silently select a property. Complete parcel identifiers should use the existing ULDK identifier lookup directly.

There is no automatic alternative-provider fallback: UUG was available during implementation, and silent fallback would disclose the address to another provider. During an outage, offer map selection or parcel-identifier entry. Reassess public-provider terms and CORS before introducing any fallback.
