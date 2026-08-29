# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Tetris en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin build, sin tests, sin `package.json`.

## Ejecutar

Abrir `index.html` directo, o servir estático:

```bash
python3 -m http.server 8000   # luego http://localhost:8000
```

Sin lint ni test runner. Verificación = abrir en navegador y jugar.

## Arquitectura

Tres archivos que cooperan: `index.html` (DOM + dos `<canvas>`), `style.css` (dark theme), `game.js` (toda la lógica, ~300 líneas, IIFE implícito con `'use strict'`).

### game.js

- **Estado global mutable** a nivel de módulo (`board, current, next, score, level, dropInterval, animId`...). `init()` lo resetea todo y se llama al cargar y desde el botón Reiniciar.
- **`board`**: matriz `ROWS × COLS`; cada celda es `0` (vacía) o índice `1–7` que indexa tanto `COLORS` como el tipo de pieza.
- **`PIECES` / `COLORS`**: arrays 1-indexados (índice `0` es `null`). El valor de celda dentro de la forma de cada pieza ya es su propio índice de color.
- **Rotación**: `rotateCW` (transposición + reverso). `tryRotate` aplica wall kicks probando desplazamientos `[0,-1,1,-2,2]`.
- **`collide(shape, x, y)`**: única función de colisión; se usa también para ghost piece, hard/soft drop y detección de game over en `spawn`.
- **Game loop**: `loop(ts)` con `requestAnimationFrame`, acumula `dt` en `dropAccum` y baja una fila cuando supera `dropInterval`. `draw()` repinta todo cada frame.
- **`lockPiece`** = `merge` → `clearLines` → `spawn`. Si `spawn` genera pieza que ya colisiona → `endGame()`.
- **Overlay único** (`#overlay`) reutilizado para PAUSA y GAME OVER; se cambia texto y se togglea clase `.hidden`.
- **Nivel/velocidad**: `level = floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.

## Al modificar dimensiones

`COLS`, `ROWS`, `BLOCK` viven en `game.js`. Si cambian, ajustar también `width`/`height` del `<canvas id="board">` en `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`), que hoy están hardcodeados a `300 × 600`.
