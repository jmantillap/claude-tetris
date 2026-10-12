---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí el requerimiento
argument-hint: <requerimiento / instrucciones a ejecutar>
---

Requerimiento: $ARGUMENTS

## Pasos

1. Si `$ARGUMENTS` está vacío, pide el requerimiento y detente.
2. Deriva `[nombre]` del requerimiento: kebab-case, minúsculas, sin acentos, 2-4 palabras (ej. `puntuacion-combo`, `modo-pausa`). Si `.trees/[nombre]` ya existe, añade sufijo `-2`, `-3`...
3. Crea el worktree desde la raíz del repo:

   ```bash
   git worktree add .trees/[nombre] -b [nombre]
   ```

   La rama nueva se llama igual que el worktree y parte de `HEAD`.
4. Ejecuta el requerimiento **solo dentro de `.trees/[nombre]`**:
   - Usa rutas absolutas bajo `.trees/[nombre]` para Read/Edit/Write/Glob/Grep.
   - Comandos de shell con `git -C .trees/[nombre] ...` o `Set-Location` en esa carpeta.
   - Nunca toques archivos del directorio principal.
5. Respeta el `CLAUDE.md` del proyecto (arquitectura, dimensiones, etc.) y las reglas globales de Git: **nunca** `git add`, `commit` ni `push`, tampoco dentro del worktree. Deja los cambios sin stage.
6. Al terminar reporta, conciso: nombre del worktree, ruta, archivos cambiados y por qué, cómo probar (abrir `.trees/[nombre]/index.html`), y un mensaje de commit sugerido.

## Limpieza (solo si el usuario la pide)

```bash
git worktree remove .trees/[nombre]
git branch -d [nombre]
```
