# Kadaster zoekhulp (CSV)

Deze map bevat een volledig client‑side zoekpagina voor de Kadaster‑data van Het Utrechts Archief. De data wordt lokaal in de browser ingelezen uit `KADASTER.csv.gz` (met fallback naar `KADASTER.csv`) en is doorzoekbaar op dezelfde velden als de oude ASP‑pagina.

## Starten

Gebruik een lokale webserver (vereist voor `fetch`):

```bash
python3 -m http.server
```

Open daarna `http://localhost:8000/index.html`.

## Bestanden

- `index.html` – de interface en instructies per bron.
- `index.js` – de UI‑logica en renderen van resultaten.
- `worker.js` – inlezen/filteren van de CSV in een Web Worker.
- `styles.css` – vormgeving.
- `KADASTER.csv.gz` – gecomprimeerde dataset (primair).
- `KADASTER.csv` – fallback voor browsers zonder gzip‑decompressie.

## Bronnen en betekenis

De dropdown **“Zoek in”** komt overeen met verschillende Kadaster‑registers. De bijbehorende instructies zijn direct in `index.html` opgenomen. Hieronder een korte samenvatting van wat je per bron kunt afleiden (op basis van de instructieteksten en de CSV‑kolommen):

- **Register 71 (1844–1987)**
  - Ingang op de legger via perceelnummer.
  - Zoeken op gemeente, sectie en perceelnummer.
  - Kolommen: gemeente, sectie, reeks, perceel‑bereik, inventarisnummer, scan.

- **Naamlijsten (1832–1863)**
  - Ingang op de legger via naam van de eigenaar.
  - Zoeken op gemeente en (optioneel) beginletter van de naam.
  - Kolommen: gemeente, reeks, naam‑bereik (naam1 t/m naam2), inventarisnummer, scan.

- **Leggers (1832–1987)**
  - Overzicht per artikelnummer (eigenaar/rechthebbende) van bezittingen in een gemeente.
  - Zoeken op gemeente + leggerartikelnummer.
  - Kolommen: gemeente, leggerartikelnummer, volgnummer, t/m, reeks, inventarisnummer, scan.

- **SAT (Supplementoire Aanwijzende Tafel, 1832–1863)**
  - Verwijzingen naar leggerartikelen en nieuwe perceelnummers.
  - Zoeken op gemeente, sectie en volgnummer (volgnummer in SAT, niet het perceelnummer).
  - Kolommen: gemeente, sectie, volgnummer, t/m, inventarisnummer, scan.

- **Register 69 (1838–1928)**
  - Ingang op het Algemeen Register via perceelnummer.
  - Zoeken op gemeente, sectie en perceelnummer.
  - Kolommen: gemeente, sectie, reeks, perceelnummer, t/m, inventarisnummer, scan.

- **Algemeen Register (1838–1928)**
  - Overzicht per vak (= eigenaar) met verwijzingen naar akten en lasten.
  - Zoeken op arrondissement, deel en vaknummer.
  - Kolommen: arrondissement, vaknummer, t/m, inventarisnummer, scan.

- **Legger: voor- en nawerk**
  - Gemeente‑brede tabellen zoals Verzamellijst, Tarieflijst, Lijst tijdelijk zakelijke rechten, Aanwijzing polderlasten.
  - Zoeken op gemeente + type (soort2).
  - Kolommen: gemeente, reeks, inventarisnummer, scan.

## CSV‑kolommen

De dataset bevat o.a. de volgende velden (afhankelijk van bron worden ze gebruikt):

- `id` – intern id.
- `gemeente` – gemeentenaam.
- `arrondissement` – arrondissement (voor Algemeen Register).
- `soort` – bron/registratie (bijv. “Register 71”, “SAT”, “Naamlijst”).
- `leggerart` – leggerartikelnummer.
- `sectie` – sectie.
- `begin`, `eind` – numeriek bereik (bijv. perceelnummer/volgnummer/vaknummer).
- `begino`, `eindo` – originele bereikwaarden (bijv. met suffixen) gebruikt voor “perceel‑bereik”.
- `invnr` – inventarisnummer.
- `reeksdeel` – reeks of deel.
- `pad`, `filenaam`, `dvd_nr` – opbouw van scan‑link.
- `naam1`, `naam2` – naam‑bereik in naamlijsten.

## Scans en inventaris

- **Scan**: de scanlink verwijst naar interne studiezaal‑URL’s en is alleen opvraagbaar in de studiezaal van Het Utrechts Archief.
- **Inventarisnummer**: linkt naar `https://hualab.nl/1294.{invnr}`.

## Performance

Het filteren en sorteren gebeurt in `worker.js` om de UI responsief te houden. De tabel wordt in batches gerenderd.

## Opmerkingen

- Als een browser `DecompressionStream` niet ondersteunt, wordt automatisch `KADASTER.csv` gebruikt.
- In de console zie je of de `.gz` of de `.csv` bron wordt geladen.
