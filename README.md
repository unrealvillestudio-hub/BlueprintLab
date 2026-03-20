# BlueprintLab — Unreal>ille Studio

UI de creación, validación y exportación de Blueprints del ecosistema Unreal>ille Studio.

**Deploy:** Google AI Studio
**Contexto completo del ecosistema:** [`CoreProject/CONTEXT.md`](https://github.com/unrealvillestudio-hub/CoreProject/blob/main/CONTEXT.md)

---

## Rol en el ecosistema

BlueprintLab es la herramienta de administración de datos maestros del ecosistema. Crea y valida los BPs que alimentan todos los demás Labs. Los exports se custodian en el repo BluePrints.

```
BlueprintLab (crea + valida BPs)
    ↓ Export → JSON
BluePrints/ repo (custodia + versioning)
    ↓ Los Labs consumen el JSON
Todos los Labs del ecosistema
```

**Futuro:** Cuando el ecosistema migre a VPS + MySQL, BlueprintLab será la UI admin de una DB centralizada y el repo BluePrints dejará de ser necesario como intermediario.

---

## Stack

- React 18 + TypeScript + Vite + Tailwind
- AI: Gemini 2.0 Flash (Gemini API)
- Deploy: Google AI Studio

---

## Schemas activos

| Schema | Versión | Descripción |
|--------|---------|-------------|
| BP_BRAND | 1.1 | Identidad de marca completa (paleta, tipografía, voz, assets) |
| BP_PERSON | 1.0 | Persona: voz, tono, humanize, compliance, visual |
| BP_LOCATION | 1.0 | Locación: atributos visuales, contexto |
| BP_PRODUCT | 1.0 | Producto: naming, packaging, claims, categoría |

---

## Estado

✅ v1.2 — 4 schemas activos

---

## Dependencias

| Consume | Provee |
|---------|--------|
| — | BPs para todos los Labs |
| — | JSON exportado → BluePrints repo |

---

## Changelog

| Fecha | Cambio |
|---|---|
| 2026-03-20 | README actualizado · BP_BRAND schema v1.1 (ForumPHs + NeuroneSCF) |
| — | v1.2 — 4 schemas |

---

## Desarrollo local

```bash
npm install
cp .env.example .env.local  # añade GEMINI_API_KEY
npm run dev
```
