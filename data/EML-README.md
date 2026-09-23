# Akwa Ibom State Essential Medicines List (AKS-EML)

Integrated into Hospital OS from the official 2026 PDFs:

- **Adults** — 3rd Edition 2026  
- **Children** — 1st Edition 2026  
Authority: Akwa Ibom State Ministry of Health (Dr. Ekem Emmanuel John, Hon. Commissioner)

## Files

| File | Purpose |
|------|---------|
| `assets/js/eml-formulary.js` | Browser formulary + search/isOnEML |
| `data/aks-eml.json` | Full structured list (API + offline) |
| `data/aks-eml.csv` | Spreadsheet for procurement / CMS |

## Wired into

1. **Doctor ePrescribing** — search filters Adult / Children EML; AKS-EML + AWaRe badges; non-EML warning  
2. **Pharmacist dashboard** — formulary count + Reserve antibiotics callout  
3. **API** — `GET /api/v1/eml` or `/api/v1/formulary`  
4. **Data store** — `HOS_DATA.drugs` built from EML; `searchEML()`, `isOnEML()`

## AWaRe

Antibacterials tagged **Access / Watch / Reserve** per state EML stewardship guidance.

## Expanding the list

The structured extract covers major therapeutic classes (~135 core items).  
To complete every line from the PDFs, append more objects to `items` in `eml-formulary.js` (same schema) and re-export JSON/CSV.
