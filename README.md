# Doetinchems Hart — web-app met Google Drive opslag

Lokale Node.js + React applicatie voor vereniging **Doetinchems Hart**. Bestanden staan op **Google Drive**; alleen accounts/agenda/mededelingen worden lokaal opgeslagen in JSON.

## Mappenstructuur op Google Drive

```
Mijn Drive
└── Doetinchemshart
    ├── Activiteiten/             ← zichtbaar voor leden + bestuur
    ├── Bestuursplatform/
    │   ├── Agenda/               ← alleen bestuur
    │   ├── Notulen/              ← alleen bestuur
    │   ├── Diversen/             ← alleen bestuur
    │   └── Activiteiten/         ← alleen bestuur
    └── app/                      ← (optioneel) code-backup, niet door app gebruikt
```

## Rollen

| Rol      | Wat kan deze rol? |
|----------|-------------------|
| BESTUUR  | Alles: bestuursplatform-bestanden bekijken, uploaden en verwijderen; agenda en mededelingen beheren; accounts beheren. |
| LEDEN    | Algemene Activiteiten-map (alleen lezen/downloaden), mededelingen, openbare agenda-items. |

---

## Google Cloud setup — stap voor stap

De app gebruikt een **service account** om in te loggen op de Google Drive API. Een service account is een soort robot-gebruiker dat los staat van jouw Google-account. Je moet de map `Doetinchemshart` expliciet met de robot delen.

### 1. Project aanmaken in Google Cloud

1. Ga naar https://console.cloud.google.com/.
2. Klik linksboven op de project-keuze → **Nieuw project**.
3. Naam: `doetinchemshart` (vrije keuze). Klik **Aanmaken**.
4. Wacht tot het project actief is en selecteer het.

### 2. Google Drive API inschakelen

1. Open het menu **APIs &amp; Services → Library**.
2. Zoek op **Google Drive API** en klik **Inschakelen** (Enable).

### 3. Service Account aanmaken

1. Ga naar **APIs &amp; Services → Credentials**.
2. Klik **Create credentials → Service account**.
3. Naam: `doetinchemshart-app`. Klik **Create and continue**.
4. Rol overslaan (geen project-rollen nodig). Klik **Continue → Done**.
5. Open het zojuist aangemaakte service account.
6. Tab **Keys → Add key → Create new key → JSON → Create**.
7. Er wordt een `.json` bestand gedownload. **Bewaar dit goed** — het is feitelijk een wachtwoord.

### 4. Sleutel installeren in de app

Plaats het gedownloade JSON-bestand als:

```
C:\DoetinchemsHart\app\config\service-account.json
```

> Dit bestand staat in `.gitignore` zodat het niet per ongeluk wordt gedeeld.

### 5. Service account email vinden

Open `service-account.json` in een teksteditor. Zoek het veld `client_email`. Het ziet eruit zoals:

```
doetinchemshart-app@<project-id>.iam.gserviceaccount.com
```

Kopieer dit e-mailadres.

### 6. Drive-map delen met service account

1. Open Google Drive in je browser.
2. Ga naar **Mijn Drive → Doetinchemshart**.
3. Rechtermuisknop op de map `Doetinchemshart` → **Delen**.
4. Plak het service account e-mailadres.
5. Rol: **Editor** (nodig voor upload + verwijderen). Klik **Delen / Send**.
6. Verstuur ook even (eventueel zonder mailmelding, vinkje uit).

Vanaf dit moment kan de robot via de Drive API in `Doetinchemshart` en alle submappen werken.

### 7. (Optioneel) Folder-ID hardcoden

Standaard zoekt de app de map `Doetinchemshart` op basis van de naam. Wil je zeker zijn dat de juiste map wordt gebruikt:

1. Open de map `Doetinchemshart` in Drive.
2. Kopieer het ID uit de URL: `https://drive.google.com/drive/folders/<DIT_IS_HET_ID>`.
3. Plak het in [`config/google.json`](config/google.json) bij `rootFolderId`.

---

## App installeren

In `C:\DoetinchemsHart\app`:

```powershell
npm install
npm run build              # bouwt de React frontend
node scripts/seed.js       # eenmalig: maakt standaard accounts aan
```

Standaard inloggegevens:

| Gebruikersnaam | Wachtwoord  | Rol     |
|----------------|-------------|---------|
| `bestuur`      | `bestuur123`| BESTUUR |
| `lid`          | `lid123`    | LEDEN   |

> **Wijzig deze wachtwoorden direct na de eerste login** via _Mijn account_.

## Starten

```powershell
npm start
```

Open `http://localhost:3000`. In de console zie je `[drive] Verbonden. Root map id: …` als de Drive-verbinding werkt. Bij problemen verschijnt een uitleg in de console (bv. `Map "Doetinchemshart" niet zichtbaar voor service account` → de map is nog niet gedeeld).

## Ontwikkelen (live-reload, twee terminals)

```powershell
# terminal 1 — backend
npm run dev

# terminal 2 — frontend
cd client
npm run dev
```

## Wat staat waar?

| Onderdeel                          | Opslag                                                  |
|------------------------------------|---------------------------------------------------------|
| Accounts (users)                   | Turso / libSQL (productie) of `data/local.db` (lokaal)  |
| Agenda-items                       | idem                                                    |
| Mededelingen                       | idem                                                    |
| .docx / .xlsx en overige bestanden | Google Drive — submappen onder `Doetinchemshart`        |

> **Belangrijk:** wegens een Google-beperking (service accounts hebben geen storage quota op persoonlijke Drives) is uploaden via de app uitgeschakeld. Bestuur uploadt nieuwe bestanden rechtstreeks in de Drive web-app; de lijst in onze app ververst dan automatisch.

## Online hosten via Render + Turso (volledig gratis)

De app draait gratis als web service op [Render](https://render.com) met een gratis Turso libSQL database voor app state. Voorwaarden: Google Drive setup hierboven is afgerond.

### 1. Turso database aanmaken

1. Maak account op https://turso.tech (gratis, geen creditcard).
2. Installeer de Turso CLI (eenmalig, op je eigen laptop):
   ```powershell
   # Windows met PowerShell
   irm get.tur.so/install.ps1 | iex
   ```
   Of via npm: `npm install -g @libsql/cli` (alternatief). Volg daarna `turso auth login`.
3. Maak een database aan:
   ```powershell
   turso db create doetinchemshart
   turso db show doetinchemshart --url        # → libsql://...turso.io  (kopieer)
   turso db tokens create doetinchemshart     # → eyJ...                (kopieer)
   ```
4. Bewaar de URL en het token — die ga je straks in Render plakken als `TURSO_DATABASE_URL` en `TURSO_AUTH_TOKEN`.

> Turso free tier: 9 GB opslag, 1 miljard reads, 25 miljoen writes per maand. Meer dan ruim voldoende.

### 2. Code naar GitHub

Zorg dat de map `C:\DoetinchemsHart\app` als git-repo op GitHub staat. `config/service-account.json` en `config/google.json` worden NIET mee gecommit (staan in `.gitignore`). De service-account JSON gaat als env var naar Render.

### 3. Render account + nieuw project

1. Maak een account op https://render.com (gratis, GitHub login werkt).
2. **New +** → **Blueprint** → kies je GitHub-repo.
3. Render leest [`render.yaml`](render.yaml) en stelt de web service voor — bevestig.

### 4. Environment variables invullen

Render vraagt voor elke `sync: false` env var een waarde. Vul in:

| Env var | Waarde |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://…turso.io` uit stap 1 |
| `TURSO_AUTH_TOKEN` | Het `eyJ…` token uit stap 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Volledige inhoud** van `config/service-account.json` (open het bestand, copy-paste alles incl. `{}`) |
| `DRIVE_ROOT_FOLDER_ID` | Folder-ID van `Doetinchemshart` (zie [config/google.json](config/google.json) `rootFolderId`) |
| `INITIAL_BESTUUR_USERNAME` | Bv. `voorzitter` |
| `INITIAL_BESTUUR_PASSWORD` | Sterk wachtwoord, **min 8 tekens** |
| `INITIAL_BESTUUR_NAME` | Naam voor weergave, bv. `Voorzitter` |
| `INITIAL_BESTUUR_EMAIL` | (optioneel) |

`NODE_ENV` is al ingesteld op `production`.

### 5. Deploy

Klik **Apply**. Render bouwt de app (~2 min) en geeft een URL terug, bv. `https://doetinchemshart.onrender.com`. Bij eerste start ziet de console:

```
[store] Verbonden met Turso (libsql://...)
[drive] Verbonden. Root map id: …
[seed] Initieel BESTUUR-account "voorzitter" aangemaakt.
Doetinchems Hart server draait op http://localhost:10000
```

### 6. Eerste login + accounts aanmaken

1. Open de Render-URL en log in met `voorzitter` + jouw wachtwoord.
2. Ga naar **Beheer → Leden & accounts** en maak accounts aan voor de overige bestuursleden en de LEDEN.
3. **Belangrijk:** Verwijder de env vars `INITIAL_BESTUUR_*` uit Render (Settings → Environment). Ze zijn alleen voor de eerste boot — laten staan is niet schadelijk, maar wachtwoorden in env vars zijn slordig.

### 7. QR-code maken

1. Kopieer je Render-URL.
2. Genereer een QR-code via bv. https://www.qrcode-monkey.com of `qrcode.show`.
3. Print/deel.

### 8. Cold start oplossen (optioneel)

Gratis Render valt na 15 min idle in slaap (eerste request na slaap = 30–60s wachten). Voorkom met een gratis uptime-monitor:

1. Maak account op https://uptimerobot.com.
2. **Add New Monitor** → type **HTTP(s)** → URL `https://<jouw-render-url>/healthz` → interval **5 min**.

Dat houdt de app warm. Render free heeft 750 service-uren/maand — voldoende voor één 24/7 service.

## Veelvoorkomende fouten

## Veelvoorkomende fouten

- `Service-account sleutelbestand niet gevonden` — `config/service-account.json` ontbreekt of staat verkeerd.
- `Map "Doetinchemshart" niet zichtbaar voor service account` — Drive-map nog niet gedeeld met het service account email, of foutieve naam in `config/google.json`.
- `Submap niet gevonden: "Bestuursplatform"` — submapnamen in `config/google.json` komen niet exact overeen met die in Drive (let op hoofdletters/spaties).
- `403 The user does not have sufficient permissions` bij upload — service account heeft alleen **Viewer** rechten. Geef het **Editor**-rechten op de map.

## Veiligheid

- Op Render draait alles via HTTPS (gratis). Cookies krijgen automatisch `secure: true` als `NODE_ENV=production`.
- `config/service-account.json` en `config/google.json` blijven uit git (`.gitignore`).
- Wachtwoorden zijn bcrypt-hashes; reset alleen via de Mijn-account pagina of door BESTUUR.
- In-memory sessies: bij een Render-restart (deploy of cold-boot) zijn iedereen opnieuw moet inloggen. Geen dataverlies — alleen heraanmelden.
- Multer 1.x heeft een upstream-vulnerability. Voor publieke deploy: vroeg of laat naar 2.x migreren (kleine refactor).
