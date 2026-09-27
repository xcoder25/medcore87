# Production hardening (items 3 & 4)

## Infrastructure

| Component | Env / action |
|-----------|----------------|
| API host | ECS/EC2/Railway — always on |
| OS | Vercel/Amplify — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL=wss://…/ws` |
| Postgres | `DATABASE_URL=postgresql://…` (RDS). Schema: `services/api-server/sql/init.sql` |
| CORS | `CORS_ORIGINS=https://os.example.com` (comma-separated; default `*` for dev only) |
| SSL to RDS | `PG_SSL=true` |
| Health | `GET /health` — ALB/target group |

## Backups

```bash
export DATABASE_URL=postgresql://...
export BACKUP_DIR=./backups
export S3_BACKUP_BUCKET=medcore-backups   # optional
./scripts/backup-postgres.sh
```

Schedule with cron or EventBridge nightly.

## Admin MFA

1. Firebase Console → Authentication → Sign-in method → enable **Email/Password**.
2. Enable **MFA** (SMS or TOTP) for admin accounts when available on the project plan.
3. Until MFA is on: restrict admin network, rotate `AKS-0012442` after first onboarding, enrol only known staff.
4. Longer term: AWS Cognito or Entra ID SSO with MFA enforced for `hospital_admin`.

## Attendance AI

- Live camera feed only → `POST /api/v1/attendance/punch`
- Video bodies rejected
- Rows dual-written to memory + Postgres when `DATABASE_URL` is set

## Checklist before PHI

- [ ] `CORS_ORIGINS` locked
- [ ] `DATABASE_URL` on API
- [ ] `/health` green with postgres UP
- [ ] Nightly backup job
- [ ] Admin password rotated + MFA path defined
- [ ] Hospital NDPR / DPA notice signed
