# Three studies: the joined context records

This download sets three dated, well-attested sets of accounts beside the weather, sky, space weather, seismic, satellite
and airfield records of the same nights and places. It is context only: it tests no known-cause candidate against any account
and gives no verdict. It shows what the open records say about the conditions at the time, where the records agree, and
where they stop.

The three studies:

- Washington, D.C., July and August 1952: radar returns that the air traffic controllers at Washington National Airport and
  Andrews Air Force Base did not match to known traffic, with accounts of lights, on several nights between 19 July and
  16 August 1952.
- Rendlesham Forest, Suffolk, December 1980: accounts of lights in and beside the forest between the twin air bases of
  RAF Woodbridge and RAF Bentwaters, on the nights of 25 to 28 December 1980.
- Phoenix, Arizona, 13 March 1997: accounts of lights over the city and the desert to the south during the evening.

## The files

| file | what it holds |
|---|---|
| `manifest.json` | the version of this download (contract 1), the snapshot date, the counts of each study, and a SHA-256 checksum of every other file |
| `sources.json` | every source used, with its registry identifier, title, address, licence verdict and licence name, whether its records are included, only summarised (derived only) or only linked, and why, in plain words |
| `schema.md` | this page |
| `<case>/case.json` | the study: its reference point, time zone, the periods examined, the number of copied records in each group, and the derived results for each period |
| `<case>/records/<group>.jsonl` | the copied records, one JSON object per line |
| `<case>/sky_positions.json` | computed altitude and azimuth of the Sun, the Moon, five planets and 16 bright stars at the reference point, every hour of the study nights and every 15 minutes within the periods |
| `<case>/satellites.json` | for each instant checked: the Sun's depression, the height of the Earth's shadow, and counts of catalogued objects in orbit and possibly sunlit; and the number of catalogued decays per day |
| `<case>/soundings.json` | the temperature inversions found in each radiosonde sounding from a site run by a US federal agency (strength, base, depth): Washington National and Tucson; empty for Rendlesham |
| `washington_1952/press_1952.json` | the 1952 press items: date, publication or wire dateline, page, the number of papers that printed a wire story, and a link where the page is open; and counts per day |

The studies are `washington_1952`, `rendlesham_1980` and `phoenix_1997`. The record groups are `surface_weather`,
`reanalysis`, `space_weather`, `sky`, `launches`, `earthquakes`, `airfields` and, for Washington, `radar_reports`.

## What is copied, what is summarised, what is only linked

A record is copied only when all three hold: the source's licence verdict in the registry is open; its terms put no
condition on copying (such as non-commercial use only, research use only, unmodified copies only, or the separate terms of
foreign contributions); and no wording of a third party is reproduced. Everything else is handled more strictly:

- Derived only. Where the terms allow the data to be used freely but the records are not marked for copying, this download
  gives only results computed here: nearest values, ranges, counts and computed positions, each naming its source.
  - The planetary ephemerides may be used by anyone; the files are not copied, the positions computed from them are given.
  - The public satellite catalogue gives counts only.
  - The US station archives (hourly station observations, daily summaries, radiosonde soundings) include observations
    supplied by foreign, volunteer and other non-federal services, so their terms as a whole are not known. Results are
    derived only for the stations run by US federal agencies (the National Weather Service, the FAA and the US military),
    whose records are federal work: first-order stations by their WBAN number, and the sounding sites that carry the index of
    such a station (Washington National, Tucson). Every other station (cooperative and volunteer stations, state and private
    stations, stations whose operator the station histories do not show, such as Flagstaff's sounding site, and all foreign
    stations, so every Rendlesham station and its sounding site) is a link only.
  - The 1952 wire stories and newspaper articles are open, but no headline or sentence is reproduced: only the date, the
    publication or wire dateline, the page, the number of papers printing a wire story (as the wire collection counts it)
    and the number of days it was printed. The items were found by keyword searches in the searchers' own words; some may concern
    other subjects. No topic is assigned to any item.
  - Newspaper pages from the Library of Congress leave the rights in each item to the user: only the date, the publication
    and a link to the page are given.
- Links only. The hourly solar wind compilation and the daily sunspot group counts include indices or observations made
  outside NASA and NOAA, so their terms are not known: no record is copied and no value is derived from them. Also the
  stations of the US station archives named above as links only, the Dst index (no commercial use of the indices), the magnetic observatory hourly values (commercial use only
  by agreement), the 1968 University of Colorado study (copies only whole, unmodified and non-commercial), the NICAP case pages
  (terms unknown; only the dates and hours used for the periods come from them), and every source not held.

## A copied record

| field | meaning |
|---|---|
| `record_id` | a stable identifier, `u0:` and 20 hexadecimal digits; the same record keeps it in later versions |
| `source_row_id` | the registry identifier of the source (16 hexadecimal digits); look it up in `sources.json` |
| `kind` | `observation` (an instrument reading at one time), `measurement` (a value sampled on a clock), `event` (an entry in an authority catalogue, such as an earthquake), `computed` (derived, not observed), `report` (an entry in a document, such as one line of a radar report) |
| `category` | what the record is, in lower case with underscores, for example `surface_weather`, `reanalysis_profile`, `temperature_inversion`, `kp_index`, `launch`, `earthquake`, `uap_radar_return` (a radar return entered in a radar report) |
| `time` | the time, below |
| `place` | the place, below |
| `measures` | a list of values, below |
| `text` | only on the Sun and Moon day records: the rise, set and twilight times in local clock time |
| `source_url` | the address the values came from, when there is one |
| `source_record_id` | the provider's own identifier for the record, when it has one (a station and hour, a COSPAR designation, a report page) |
| `links` | other copied records this record is about, each with a relation, for example an inversion `derived_from_profile` |

### Time

All instants are in UTC and end in `Z`.

- `edtf`: the time as the source gives it, in the Extended Date/Time Format (ISO 8601-2). A source that gives local clock
  time keeps it here.
- `start` and `end`: the widest UTC interval the source time allows. An instant has `start` equal to `end`.
- `tz_source`: the IANA time zone used to turn local clock time into UTC, or null.
- `utc_offset`: when the source states a fixed offset instead of a zone, that offset (for example `-05:00`), or null.
- `precision`: `second`, `minute`, `hour`, `day`, `month` or `year`.
- `uncertainty_s`: a stated uncertainty in seconds, or null.

Local time: Washington in July and August 1952 kept Eastern Daylight Time (UTC-4), but the 1953 radar report gives Eastern
Standard Time (UTC-5), so its records carry `utc_offset` `-05:00`. Suffolk in December is on UTC. Phoenix keeps Mountain
Standard Time all year (UTC-7), so 22:00 on 13 March 1997 is 05:00 UTC on 14 March.

### Place

- `lat`, `lon`: WGS84 decimal degrees, or null for a value that holds for the whole Earth (a geomagnetic index).
- `radius_m`: how far from the point the record may apply, in metres. A station is 100 m; a reanalysis grid cell 18,000 m;
  a radar report entry for an area 10,000 to 40,000 m.
- `precision`: `exact`, `locality`, `region`, `global` or `none`.
- `name`: the station, grid cell, airfield or area, as a reader would name it.
- `country`: ISO 3166-1 two-letter country, or null.

### Measures

Each value is `{quantity, value, unit, qualifier, uncertainty}`. The unit is a UCUM unit: `Cel` degrees Celsius, `K` kelvin
(for inversion strength, a temperature difference), `m`, `km`, `m/s`, `km/s`, `hPa`, `Pa`, `deg` degrees of angle, `%`,
`1` for a count, an index or a coded value. Cloud layers are numbered from the lowest (`cloud_layer1_base_m` and so on). A
reanalysis profile lists its levels in order, each starting with `pressure_pa`. Altitudes of the Sun, Moon, planets and
stars are geometric, measured from the horizon, with no refraction; azimuths run from north through east.

## How a context record is joined to a study

Each study has a reference point (in `case.json`) and a list of periods in UTC: the nights or hours that the NICAP case
pages and the radar report give for the accounts. A context record is joined when its time interval overlaps a period and its place lies
near enough. Intervals are half-open in UTC: a period from 00:00 to 06:00 holds 00:00 but not 06:00, so a 3 hour Kp value
from 21:00 to 24:00 the day before, or one from 06:00 to 09:00, lies outside it, and a launch dated to the day a study span
ends lies outside the span.

| group | time | place |
|---|---|---|
| surface_weather and station results | the period plus or minus 3 hours | station within 150 km |
| daily station results | the local dates the period falls on | station within 150 km |
| reanalysis, soundings | the hourly reanalysis and soundings gathered for the study dates | the reanalysis grid cells and radiosonde sites nearest the reference points |
| space_weather | indices for the study span | the whole Earth |
| sky positions | every whole hour of the study nights, and every 15 minutes within the periods | the reference point |
| satellites | the satellite windows of each study | the reference point |
| launches | launches dated to the day within the study span | anywhere |
| earthquakes | the period plus or minus 24 hours | anywhere; the derived results count those within 500 km; for Phoenix the catalogue query held asks for magnitude 2.5 and above |
| airfields | none (current listings) | within 200 km of the reference point |

The study spans are 14 July to 20 August 1952, 20 to 31 December 1980, and 10 to 17 March 1997.

For each period, `case.json` gives derived results: the nearest reporting station (a copied airport record, or a station
run by a US federal agency), with its ranges of temperature, dew point, wind, visibility and lowest cloud base; the nearest
daily summary of such a station for the local dates; the range of the Kp index; the reanalysis cloud, boundary layer and
inversions at the nearest grid cell; the sounding nearest in time (within 24 hours) from a federally run site, with its
inversions; the bodies above the horizon at the middle of the period; earthquakes in the period plus or minus
24 hours; and the number of catalogued satellites in orbit and possibly sunlit. Where only link-only stations are held,
the station, daily summary or sounding reads held, link only (see above). Each result names its source. A null means
the material does not cover that period or may not be summarised. Two results are not null and not values:

- `status` `held_link_only`, with `records` and `source_row_id`: records are held for the period (`records` of them), but
  their terms allow a link only, so no value is given; follow the source.
- `status` `not_held`, with `held_from` and `held_to`, for earthquakes: the catalogue entries held run only between those
  UTC days, and the period plus or minus 24 hours reaches outside them, so no count is given (a count there would be a
  false zero). The days held are read from the first and last entry held for the study.

When the catalogue query held set a smallest magnitude, the earthquake result carries it as `magnitude_floor` (and the
study as `earthquakes_counted_from_magnitude`): smaller earthquakes are not in the count. Before 4 October 1957, when nothing
was in orbit, `satellites` reads 0 with `before_the_first_satellite` true.

`within_500_km` and `could_be_sunlit_above_10_deg` are counts (of earthquakes and of catalogued objects), not distances or
angles. The nearest sounding and the daily summary give the station's distance from the reference point in kilometres.
`case.json` also counts, under `not_copied_link_only`, the station observations, soundings and daily summaries held for
the study but given as links only.

## Reading the records with care

- The reanalysis is ERA5 at 0.25 degree spacing. Where it can be compared with observations, it agrees on temperature and
  on the height of cloud, is loose on cloud amount, and is weaker than the soundings on shallow surface inversions, most of
  all in 1952 and 1980. Its heights are estimates from sea level pressure. Prefer the soundings and station reports
  where they differ.
- A sounding is taken where the balloon is released; it drifts as it rises.
- Station names are as the archives list them today, and an airfield listing is the current one: its status in the study
  year is not stated.
- Satellite counts use the public satellite catalogue, which keeps the latest or final orbit of each object, not its orbit
  on the study date. Objects never catalogued are absent. No orbital element sets of the dates were used, so no pass over a
  site is claimed. In 1952 no artificial satellite was in orbit.
- Catalogued decays carry a date only, with no time or ground point.

## Gaps, study by study

Washington, 1952:

- Hourly station observations are held for 16 to 31 July only; there are none for the August nights. The Kp index is held
  for 16 to 31 July. The Dst index begins in 1957 and the solar wind record in 1963, so neither exists for 1952.
- The hourly reanalysis at the reference point is held for 20 to 28 July (UTC), which covers the nights of 19/20, 22/23,
  26/27 and 27/28 July and none of the later periods; the computed sky covers 19/20 and 26/27 July.
- Earthquake catalogue entries are held for 16 to 31 July only; for the August periods no count is given.
- The 20th Century Reanalysis (version 3), the first choice for 1952, could not be obtained; ERA5 was used instead.
- The 1968 University of Colorado study is linked only; its readings of the soundings are not given here.
- The radar sites' own recordings, their antenna heights, military flight logs, and the Project Blue Book case files are not
  held.
- Accounts by private persons are not recorded here: private persons are left out by design.
- The near-surface values come from the surface layer, which the soundings resolve only in part.

Rendlesham Forest, 1980:

- No station observations, daily summaries or soundings are given: the station archives that hold them have unknown terms,
  and values are given only for stations whose held station history shows a US federal operator. Several stations within
  reach were US Air Force bases in 1980 (Bentwaters, Woodbridge, Lakenheath, Mildenhall), but their station records do not
  show the operator for that date, nor does the record of the sounding site (Hemsby, Norfolk), so all are links only (see
  above). The reanalysis is the only weather record here.
- The Dst index, the solar wind and the magnetic observatory values are links only; Kp is given.
- No open newspaper text exists for 1980 in the collections held (the open wire and newspaper collections end in 1977 and
  1963).
- No exact satellite passes (see above), no military logs.
- No sounding is given, so the near-surface layer rests on the reanalysis alone, which is weaker than the soundings on
  shallow surface inversions (see Reading the records with care).

Phoenix, 1997:

- Hale-Bopp, the bright comet of that month, has no computed position: the sources of its orbit have unknown terms.
- No open newspaper text exists for 1997 in the collections held; one newspaper archive of unknown terms is linked.
- The Dst index, the solar wind and the magnetic observatory values are links only.
- The upper-air archive's station list gives Phoenix Sky Harbor, 12 km from the reference point, as a sounding site from 1948
  to 1998, but no Phoenix sounding is held here; the nearest sounding given is the nearest held one, at Tucson (171 km), so
  a closer sounding may exist in the archive.
- The earthquake catalogue query held for 1997 asks for magnitude 2.5 and above, so smaller earthquakes near Phoenix are not
  counted; the 1952 and 1980 queries set no smallest magnitude.
- The near-surface values come from the surface layer, which the soundings resolve only in part, and the nearest sounding
  given is 171 km away.
- No open record of military flights or illumination flares for that evening is held; the Barry M. Goldwater Range and
  Luke Air Force Base, south-west and west of Phoenix, lie within reach.

All three studies:

- The computed sky has the Sun, the Moon, five planets and 16 bright stars. A full bright-star catalogue could not be
  obtained.
- No source shows ducting above the lowest few hundred metres on any study night.
