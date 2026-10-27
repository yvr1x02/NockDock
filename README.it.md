<p align="center">
  <img src="build/icon.png" width="120" alt="Icona di Nockdock" />
</p>

<h1 align="center">Nockdock</h1>

<p align="center">
  Una dashboard touch per il piccolo schermo sotto i monitor: apri i progetti, segui Claude Code,
  controlla i deploy e la postazione con un tocco.<br />
  <a href="README.md">Read in English</a>
</p>

<p align="center">
  <img src="docs/screenshots/home.png" width="720" alt="Home" />
</p>

Nockdock è un'app Electron per Windows pensata per uno schermo touch da 7" (1024×600, come il Waveshare 7inch HDMI LCD (H)) messo tra o sotto i monitor. Funziona come uno Stream Deck che conosce i tuoi progetti: legge i repo git, avvia i dev server, apre VS Code, il terminale e Claude Code, mostra i deploy di Vercel e controlla audio e monitor. Una piccola mascotte in pixel art, Yuyu, cammina nella barra in alto e reagisce a quello che fai.

Non hai uno schermo touch? Funziona anche in una normale finestra 1024×600.

## Funzioni

- **Progetti**: branch, file non committati e ultimi commit di ogni repo; un tocco per VS Code, terminale, Claude Code, GitHub, Vercel, Supabase e dev server. Una **nota per la prossima volta** per ogni progetto.
- **Sul telefono**: avvia il dev server in rete e mostra il QR per aprirlo dal telefono.
- **Vercel**: ultimo deploy e **QR dell'ultima preview pronta** da far vedere ai clienti.
- **Claude Code**: con gli hook il dock (e Yuyu) sa quando Claude lavora, aspetta il tuo ok o ha finito.
- **Account**: fino a 4 (es. Personale e Lavoro), ognuno con colore, profilo del browser (Brave, Chrome, Edge) e token Vercel. L'account si allinea da solo al progetto che apri.
- **Postazione**: volume per app, volume generale, uscita audio, luminosità dei monitor (DDC/CI) e tasti multimediali.
- **Giochi**: i giochi Steam installati con le copertine.
- **Recap di fine giornata**: i commit di oggi da tutti i repo e le note per domani.
- **Serie di commit e livelli**, schermata di riposo con orologio grande, snippet da copiare, screenshot e blocca PC.
- **Setup guidato** al primo avvio e **Impostazioni** complete dal dock: nessun file da modificare.
- **Tutto su misura**: tema scuro o chiaro (o come Windows), colore libero per ogni account, ordine delle schede, riquadri della Home e pulsanti dei progetti da mostrare, link personalizzati per progetto; Yuyu si può spegnere.
- **Italiano e inglese**, automatico da Windows o scelto nelle Impostazioni.

## Requisiti

- Windows 10 o 11
- Facoltativo: un piccolo schermo touch (qualsiasi risoluzione: il layout 1024×600 si adatta)
- Per i progetti: Git, VS Code con il comando `code`, Windows Terminal (già presente su Windows 11)
- Facoltativi: Claude Code, Claude Desktop, Steam, un account Vercel

## Installazione

Scarica l'installer dall'[ultima release](https://github.com/yvr1x02/nockdock/releases/latest) e avvialo.

L'installer non è ancora firmato, quindi Windows SmartScreen può mostrare "Windows ha protetto il PC": tocca **Ulteriori informazioni → Esegui comunque**. Se preferisci controllare il codice prima, compilalo tu (sotto).

Al primo avvio il **setup guidato** chiede:

1. **Schermo**: quale monitor fa da dock (o una finestra normale).
2. **Browser e account**: Brave, Chrome ed Edge vengono trovati con i nomi dei profili.
3. **Progetti**: scegli la cartella dei repo; i progetti vengono trovati da soli, con comando del dev server, porta e progetto Vercel dedotti da ogni repo.
4. **Aspetto e avvio**: tema, la mascotte Yuyu (facoltativa), schermata di riposo e avvio con Windows.

Token, Steam e hook di Claude Code si aggiungono dopo, in **Impostazioni → Collegamenti**.

## Compilare dal codice

Servono Node.js 22+ e pnpm (`npm i -g pnpm`).

```powershell
git clone https://github.com/yvr1x02/nockdock.git
cd nockdock
pnpm install
pnpm dev        # avvio in sviluppo
pnpm dist       # crea l'installer per Windows in dist\
```

Se pnpm chiede di approvare gli script di installazione, approva `electron`.

## Collegamenti

I token sono cifrati con il tuo account di Windows (`safeStorage` di Electron) e salvati in `%APPDATA%\Nockdock\secrets.json`, mai nel file di configurazione né mostrati nell'interfaccia.

- **Vercel**: un token per account (vercel.com → Account Settings → Tokens). Se i progetti di un account stanno in un team, aggiungi l'ID del team (`team_…`) in Impostazioni → Account.
- **Claude Code**: in Impostazioni → Collegamenti tocca _Copia gli hook_ e incollali in `%USERPROFILE%\.claude\settings.json` (se il file ha già `"hooks"`, unisci le voci). Il dock ascolta solo su `127.0.0.1:47321`.
- **Steam**: le librerie vengono trovate da sole.

## La scheda Postazione

La Postazione parla con Windows tramite un piccolo aiutante in C# ([`src/main/win/DockHelper.cs`](src/main/win/DockHelper.cs)) che PowerShell compila una volta, la prima volta che apri la scheda, e poi tiene acceso in background. Non serve installare niente. La luminosità funziona solo sui monitor con DDC/CI attivo (di solito si attiva dal menu del monitor).

## Configurazione

Tutto si cambia dal dock in **Sistema → Impostazioni**. La configurazione sta anche in `%APPDATA%\Nockdock\config.json` per chi preferisce modificarla a mano: il dock la ricarica quando salvi. Le note e lo stato dell'app sono in `state.json`, mai nei repo.

## Traduzioni

L'interfaccia usa il testo italiano come chiave e [`src/shared/i18n-en.ts`](src/shared/i18n-en.ts) contiene l'inglese. Un test fallisce se una frase non ha la versione inglese. Per aggiungere una lingua vedi [CONTRIBUTING.md](CONTRIBUTING.md).

## Sviluppo

| Comando          | Cosa fa                              |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Avvia l'app in sviluppo con ricarica |
| `pnpm build`     | Compila in `out\`                    |
| `pnpm dist`      | Crea l'installer per Windows         |
| `pnpm typecheck` | Controllo dei tipi                   |
| `pnpm lint`      | ESLint                               |
| `pnpm test`      | Vitest                               |

Con `DOCK_WINDOWED=1` l'app si apre in finestra anche con lo schermo del dock collegato.

## Yuyu

Le animazioni di Yuyu sono generate dal GIF originale in pixel art in [`scripts/`](scripts) con `scripts/buddy_gen.py` (Python 3, Pillow, NumPy):

```powershell
python scripts/buddy_gen.py scripts/buddy-source.gif src/renderer/src/assets
```

## Licenza

[MIT](LICENSE). Il personaggio di Yuyu è dell'autore del progetto ed è incluso con la stessa licenza.
