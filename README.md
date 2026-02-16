# Pi Benchmark - Visueller Monte-Carlo-Algorithmus

Ein PC-Benchmark, der Pi mithilfe der Monte-Carlo-Methode visuell berechnet.
Geschrieben in HTML5, CSS3 und modernem JavaScript.

## Installation / Start

Dies ist eine reine Web-Applikation ohne Backend-Abhängigkeiten.

1. Öffne die Datei `index.html` in einem modernen Browser (Chrome, Firefox, Edge).
2. Drücke "Start", um den Benchmark zu starten.

## Features

- **Visuelle Berechnung**: Beobachte, wie der Kreis durch zufällige Punkte gefüllt wird.
- **Benchmark-Score (Punkte/Sek)**: Misst die reine Rechenleistung (JavaScript Multi-Core Performance).
- **Multi-Threading**: Nutze alle CPU-Kerne deines Systems für maximale Performance.
- **Hardware-Erkennung**: Zeigt am Ende die verwendete GPU und Thread-Anzahl an.
- **Einstellbare Last**: Erhöhe die "Batch Größe", um mehr Punkte pro Frame zu berechnen (Stresstest).
- **Genauigkeits-Anzeige**: Zeigt in Echtzeit, wie nah die Annäherung an Pi ist.

## Technologie

- **Web Workers**: Für echte Parallelisierung auf allen CPU-Kernen.
- **Canvas API**: Für visuelles Feedback.
- **Uint32Array / Direct Pixel Manipulation**: Für maximale Rendering-Performance.
- **RequestAnimationFrame**: Für flüssige 60fps+ Darstellung (wenn die CPU mitkommt).

Viel Spaß beim Testen deiner CPU!
