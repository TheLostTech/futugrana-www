# Animazioni realistiche della landing — design breve

Data: 2026-11-18 · Approvato da Ale in chat ("fai tutto per bene") sulla direzione proposta.

## Intento

La landing (scene impilate guidate dallo scroll) ha animazioni che si leggono come finte. Il
**concetto resta identico**: stesse scene, stessi testi, stessa palette, la dashboard della hero che
cresce fino a riempire lo schermo. Cambia solo **come** le cose si muovono, e la hero diventa un
oggetto fisico renderizzato in Blender.

## Diagnosi (stato attuale)

1. Interpolazioni lineari sullo scroll: niente accelerazione/decelerazione.
2. La card cresce cambiando `width/height/bottom/border-radius` ogni frame: il contenuto si
   ri-impagina mentre cresce (non sembra un oggetto) e costa layout a ogni frame.
3. Nessuna inerzia: la scena segue la rotella a scatti.
4. Overlay hero spento con un fade a tempo (0,3 s) a soglia fissa, slegato dallo scroll: il titolo
   resta visibile in trasparenza dietro la dashboard.
5. Profondità finta (rotateX fisso 2,5°).

## Approcci considerati

- **A. Solo codice** (easing, scale, inerzia). Economico, risolve 1-5, ma la hero resta un
  rettangolo piatto.
- **B. Tutto in Blender** (ogni scena un render). Massimo realismo, ma mock non più traducibili
  IT/EN, pesanti, da ri-renderizzare a ogni modifica dell'app. Scartato.
- **C. Codice + Blender solo sulla hero** (scelto). Il codice sistema la fisica di tutte le scene;
  la hero diventa un pannello-display reale che si solleva verso la camera mentre la camera entra
  nello schermo; l'ultimo frame coincide con la dashboard HTML a tutto schermo e lì si passa
  all'HTML vivo (testo nitido, traducibile).

## Design

**Fisica in codice (tutte le scene pattern A + overlay hero + titoli HedgeMock)**
- Progresso di scroll smorzato (inseguimento esponenziale, τ ≈ 110 ms): inerzia leggera.
- Curve easing (in-out cubic per la crescita, out cubic per le entrate).
- La card è sempre grande quanto il viewport e cresce con `transform: scale()` +
  `clip-path: inset(... round r)`: il contenuto si ingrandisce come un oggetto, niente reflow.
- La dashboard della hero si raddrizza (inclinazione 10° → 0°) mentre cresce.
- L'overlay hero sfuma e sale in funzione dello scroll, finisce prima che la card copra il testo.
- `prefers-reduced-motion`: stato finale immediato, niente inerzia, niente sequenza.

**Hero Blender**
- Scena procedurale versionata in `blender/hero_scene.py` (Blender 5.3, Cycles Metal), sfondo
  trasparente + shadow catcher (ombra reale sul bianco della hero).
- Oggetto: pannello display sottile, bordo in alluminio scuro anodizzato, vetro con riflesso di
  un softbox; sullo schermo la cattura reale della `DashboardMock` (script
  `scripts/capture-hero-texture.mjs`).
- Movimento: pannello inclinato all'indietro in basso → si alza e si raddrizza, camera in
  carrellata; ultimo frame = schermo che riempie esattamente il fotogramma, emissione pura in
  vista Standard (colori identici all'HTML).
- Output: sequenza WebP con alpha in `public/hero-seq/` disegnata su canvas in base al progresso
  di scroll; finestra di passaggio all'HTML vivo a fine crescita.
- Attiva solo su viewport ≥ 768 px, senza reduced-motion, e solo dopo che tutti i frame sono
  caricati; si attiva solo con la hero ferma (inizio o già superata) per non creare salti.
  Altrimenti resta l'animazione HTML migliorata.

## Non obiettivi / anti-obiettivi

- Non cambiare testi, layout, colori, ordine delle scene.
- Non rendere la pagina pesante: budget sequenza ≤ ~5 MB, caricata dopo il primo paint.
- Fallimento anche se "funziona": un 3D lucido da videogioco, che stona col minimal navy/oro.

## Lasciato al costruttore

Numero di frame, risoluzione e qualità WebP entro il budget; dettagli di luce/materiali.
