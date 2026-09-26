# MedCore on AWS — Ready Plan (5 TB envelope)

**Goal:** Run Hospital OS + API + durable Postgres for **all facilities**, with **5 TB** total cloud storage budget.  
**Attendance AI:** **live feed only** — store **time-book events**, not CCTV/video.

---

## 1. Storage split (5 TB total)

| Bucket / volume | Allocation | Use |
|-----------------|------------|-----|
| **RDS PostgreSQL** | **500 GB** start (autoscale to **1 TB**) | Patients, encounters, orders, bills, MPI, **attendance punches**, audit |
| **S3 – clinical docs** | **2 TB** | Discharge PDFs, scanned cards, lab PDFs (not DICOM archive) |
| **S3 – backups / exports** | **1.5 TB** | DB dumps, FHIR/SHR exports, compliance packs |
| **EBS / container logs** | **~200 GB** | API hosts, OS build artifacts |
| **Reserve** | **~800 GB** | Growth, snapshots, unexpected docs |
| **CCTV / continuous video** | **0 TB** | **Not stored in MedCore** |

5 TB is **more than enough** for statewide structured EMR + documents. Do **not** put NVR video libraries on this quota.

---

## 2. Recommended architecture

```
Internet
   │
   ├─ Route 53
   │     ├─ os.example.gov.ng  → Amplify or ALB (Next.js OS)
   │     └─ api.example.gov.ng → ALB → ECS Fargate / EC2 (api-server + WSS)
   │
   ├─ RDS PostgreSQL (Multi-AZ when production)
   ├─ S3 (docs + backups)
   ├─ Secrets Manager (DB URL, Firebase, keys)
   └─ CloudWatch (CPU, 5xx, free storage, alarms)
```

**Attendance path (no video retention):**

```
Camera live stream (hospital LAN)
  → local/edge recognition (optional)
  → HTTPS POST /api/v1/attendance/punch
  → Postgres attendance_events only
  → stream discarded
```

---

## 3. RDS sizing (start → scale)

| Phase | Instance | Storage |
|-------|----------|---------|
| Pilot (1 facility) | `db.t4g.medium` | 100–200 GB gp3 |
| Multi-facility | `db.r6g.large` | 500 GB gp3 |
| Statewide heavy | `db.r6g.xlarge` | up to **1 TB** of the 5 TB plan |

Enable **storage autoscaling** (max 1000–1500 GB for DB portion).  
Automated backups: **7–35 days**. Export weekly dump to S3 (counts toward backup slice).

---

## 4. Environment

**API (ECS/EC2):**

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://medcore:SECRET@medcore-db.xxxx.rds.amazonaws.com:5432/medcore
AWS_REGION=af-south-1
S3_DOCS_BUCKET=medcore-clinical-docs
S3_BACKUP_BUCKET=medcore-backups
# Attendance: no video bucket required
```

**OS (Amplify / front door):**

```bash
NEXT_PUBLIC_API_URL=https://api.example.gov.ng
NEXT_PUBLIC_WS_URL=wss://api.example.gov.ng/ws
NEXT_PUBLIC_FIREBASE_* = …
```

---

## 5. Security checklist

- [ ] RDS not public; only API security group  
- [ ] TLS on ALB (ACM certificate)  
- [ ] CORS limited to OS origin  
- [ ] Admin MFA (Firebase MFA or Cognito)  
- [ ] NDPR notice: live biometric processing for attendance; **no routine video retention**  
- [ ] Nightly RDS snapshot + weekly `pg_dump` → S3  

---

## 6. Local / staging parity

```bash
# From repo root
docker compose up -d postgres
# optional: docker compose up api
```

See root `docker-compose.yml`.

---

## 7. What 5 TB is *not* for

- Unlimited CCTV archives  
- Full PACS multi-year imaging (use dedicated imaging + S3/Glacier with separate budget if ever needed)  
- Raw AI training video datasets  

MedCore attendance AI = **live recognition → punch row**.
