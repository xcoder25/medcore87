# MedCore Hospital Platform — START HERE

## One-command start (Hospital OS desktop + API + realtime)

```bash
cd medcore
./start.sh
```

Open **http://localhost:4000**

### Demo logins

| Role        | Email                              | Password       |
|-------------|------------------------------------|----------------|
| Doctor      | a.bello@ibomspecialist.gov.ng      | doctor123      |
| Nurse       | c.okeke@ibomspecialist.gov.ng      | nurse123       |
| Pharmacist  | i.musa@ibomspecialist.gov.ng       | pharm123       |
| Lab         | e.nwosu@ibomspecialist.gov.ng      | lab123         |
| Reception   | f.adeyemi@ibomspecialist.gov.ng    | reception123   |
| Admin       | c.okoro@ibomspecialist.gov.ng      | admin123       |

## Mobile apps

### Staff mobile (MedCore Clinic)
```bash
cd apps/clinic
npm install
npx expo start
```

### Patient mobile (MedCore Care) — from original package
```bash
cd apps/care
npm install
npx expo start
```

### MOH Admin
```bash
cd apps/admin
npm install
npm run dev
```

## What’s included

1. **Hospital OS** — multi-role desktop (doctor, nurse, pharmacy, lab, reception, admin) + AKS EML formulary + realtime gateway
2. **MedCore Clinic** — staff mobile (eMAR, tasks, orders, ward, handover…)
3. **MedCore Care** — patient mobile (appointments, records, messaging, profile)
4. **MOH Admin** — ministry console (if apps/admin present)

## Requirements

- Node.js 18+
- For mobile: Expo Go app on phone, or simulators
