# 📘 Guía Git del Equipo

> Flujo de trabajo estándar para desarrollo y documentación de código.

---

## 📋 Tabla de Contenidos

- [Flujo de desarrollo (feature branches)](#-flujo-de-desarrollo-feature-branches)
- [Cómo documentar código ya mergeado a dev](#-cómo-documentar-código-ya-mergeado-a-dev)
- [Reglas de oro](#-reglas-de-oro)

---

## 🚀 Flujo de desarrollo (feature branches)

Cada persona trabaja en su propia rama por funcionalidad (HU). Seguir estos pasos **en orden** evita el 90% de los conflictos.

### Paso 1 — Partir siempre desde `dev` actualizado

```bash
git checkout dev
git pull origin dev
```

> ⚠️ Nunca crear una rama desde código desactualizado.

---

### Paso 2 — Crear tu rama con nombre descriptivo

```bash
git checkout -b feature/nombre-de-la-hu
```

**Ejemplos:**

```bash
git checkout -b feature/login
git checkout -b feature/dashboard
git checkout -b feature/cambio-de-password
```

---

### Paso 3 — Trabajar en tu código

Desarrolla tu funcionalidad normalmente. Haz commits frecuentes y descriptivos:

```bash
git add .
git commit -m "feat: agrega validación de formulario en login"
```

---

### Paso 4 — Actualizar tu rama con lo último de `dev` (hacer esto cada día)

Antes de seguir trabajando o de abrir un PR, traer los cambios nuevos de `dev`:

```bash
git fetch origin
git rebase origin/dev
```

> 💡 Si hay conflictos, resolverlos, luego:
> ```bash
> git add .
> git rebase --continue
> ```

---

### Paso 5 — Subir tu rama y abrir el PR

```bash
git push origin feature/nombre-de-la-hu
```

Luego abrir el **Pull Request** hacia `dev` desde la interfaz de GitHub.

---

### Flujo visual

```
dev
 ├── feature/login           → fetch+rebase diario → PR → dev ✅
 ├── feature/dashboard       → fetch+rebase diario → PR → dev ✅
 └── feature/cambio-password → fetch+rebase diario → PR → dev ✅
```

---

## 📝 Cómo documentar código ya mergeado a `dev`

Cuando el código ya fue mergeado a `dev` y las ramas originales están desactualizadas o eliminadas, **no tocar las ramas viejas**. Partir desde `dev` directamente.

### Paso 1 — Cada quien crea su propia rama de documentación desde `dev`

```bash
git checkout dev
git pull origin dev
git checkout -b docs/comentarios-nombre-funcionalidad
```

**Ejemplos:**

```bash
git checkout -b docs/comentarios-login        # persona de login
git checkout -b docs/comentarios-dashboard    # persona de dashboard
git checkout -b docs/comentarios-password     # persona de password
```

---

### Paso 2 — Comentar solo los archivos de tu funcionalidad

Cada persona comenta **únicamente sus archivos**. No tocar archivos de otros para evitar conflictos.

```bash
# Ejemplo de comentario en una función
git add src/login/authService.js
git commit -m "docs: agrega comentarios a funciones de autenticación"
```

---

### Paso 3 — Subir la rama y abrir el PR hacia `dev`

```bash
git push origin docs/comentarios-nombre-funcionalidad
```

Luego abrir el **Pull Request** hacia `dev`.

---

### Flujo visual

```
dev (con todo el código mergeado)
 ├── docs/comentarios-login       → PR → dev ✅
 ├── docs/comentarios-dashboard   → PR → dev ✅
 └── docs/comentarios-password    → PR → dev ✅
```

> ✅ Con ramas separadas por persona, cada quien es independiente. Si uno se tarda, los demás no se bloquean.

---

## 🏆 Reglas de oro

| Regla | Por qué importa |
|---|---|
| Siempre partir desde `dev` actualizado | Evita trabajar sobre código viejo |
| `fetch` + `rebase` diario | Reduce conflictos al mínimo |
| PRs pequeños y frecuentes | Más fácil de revisar y mergear |
| Cada quien toca solo sus archivos | Evita pisar el trabajo de otros |
| Comentar el código antes del PR | Evita tener que crear ramas de docs después |

---

> 📌 **Tip final:** Establecer como regla del equipo que todo PR debe incluir comentarios en las funciones nuevas antes de mergear a `dev`. Esto evita el problema de raíz.
