# System Configuration Reference

> **This file contains the CORRECT system configurations. ALWAYS refer to this!**

## 🌐 Domains

### Production
- **URL:** https://mc-app.manualmode.at
- **Domain:** mc-app.manualmode.at
- **Protocol:** HTTPS
- **SSL:** Let's Encrypt (automatisch)

### Staging
- **URL:** https://mc-beta.manualmode.at
- **Domain:** mc-beta.manualmode.at
- **Protocol:** HTTPS
- **SSL:** Let's Encrypt (automatisch)

### ❌ NEVER USE
- ~~manualmode.meaningful-conversations.de~~
- ~~mc-app-staging.manualmode.at~~
- Any `.de` domains

---

## 🖥️ Server

### Host
- **IP:** 91.99.193.87
- **User:** root
- **OS:** Rocky Linux / Fedora-basiert
- **SSH:** `ssh root@91.99.193.87`

### Hardware
- **CPU:** 4 vCPUs (Intel Xeon Skylake)
- **RAM:** 7.3 GiB
- **Swap:** 4 GB (configured on 2025-11-27)
- **Disk:** ~76 GB SSD

---

## 📁 Directory Structure

### Production
- **Base Path:** `/opt/manualmode-production`
- **Compose File:** `/opt/manualmode-production/podman-compose-production.yml`
- **Scripts:** `/opt/manualmode-production/scripts/`
- **Environment:** `/opt/manualmode-production/.env.production`

### Staging
- **Base Path:** `/opt/manualmode-staging`
- **Compose File:** `/opt/manualmode-staging/podman-compose-staging.yml`
- **Environment:** `/opt/manualmode-staging/.env.staging`

### Nginx
- **Config Dir:** `/etc/nginx/conf.d/`
- **Production Config:** `/etc/nginx/conf.d/production-meaningful-conversations.conf`
- **Staging Config:** `/etc/nginx/conf.d/staging-meaningful-conversations.conf`
- **Logs:** `/var/log/nginx/`

---

## 🐳 Container Names

### Production
- **Pod:** `meaningful-conversations-production`
- **MariaDB:** `meaningful-conversations-mariadb-production`
- **Backend:** `meaningful-conversations-backend-production`
- **Frontend:** `meaningful-conversations-frontend-production`
- **TTS:** `meaningful-conversations-tts-production`

### Staging
- **Pod:** `meaningful-conversations-staging`
- **MariaDB:** `meaningful-conversations-mariadb-staging`
- **Backend:** `meaningful-conversations-backend-staging`
- **Frontend:** `meaningful-conversations-frontend-staging`
- **TTS:** `meaningful-conversations-tts-staging`

---

## 💾 Volumes

### Production
- **MariaDB:** `meaningful-conversations-production_mariadb_data`
- **TTS Voices:** `meaningful-conversations-production_tts_voices`
- **Location:** Managed by Podman

### Staging
- **MariaDB:** `meaningful-conversations-staging_mariadb_data`
- **TTS Voices:** `meaningful-conversations-staging_tts_voices`
- **Location:** Managed by Podman

---

## 🔌 Ports

### Production
- **Frontend:** 3000 (internal), 443 (external via Nginx)
- **Backend:** 8080 (internal), 443 (external via Nginx at `/api`)
- **MariaDB:** 3306 (pod-internal only)
- **TTS:** 5002 (pod-internal only)

### Staging
- **Frontend:** 3000 (internal), 443 (external via Nginx)
- **Backend:** 8080 (internal), 443 (external via Nginx at `/api`)
- **MariaDB:** 3306 (pod-internal only)
- **TTS:** 5002 (pod-internal only)

---

## 🗄️ Database

### Production
- **Database Name:** `meaningful_conversations_production`
- **Host:** `mariadb` (in pod network)
- **Port:** 3306
- **Root Password:** In `.env.production` as `MARIADB_ROOT_PASSWORD`
- **User Count (2025-11-27):** 14 users

### Staging
- **Database Name:** `meaningful_conversations_staging`
- **Host:** `mariadb` (in pod network)
- **Port:** 3306
- **Root Password:** In `.env.staging` as `MARIADB_ROOT_PASSWORD`
- **User Count (2025-11-27):** 1 user (Admin)

---

## 🔑 Environment Variables

### Critical Variables (in .env files)
- `MARIADB_ROOT_PASSWORD`
- `JWT_SECRET`
- `API_KEY` (Google Gemini - deprecated, use GOOGLE_API_KEY)
- `GOOGLE_API_KEY`
- `MISTRAL_API_KEY`
- `DATABASE_URL`

### AI Provider Configuration
- **Current:** Google Gemini (Primary), Mistral AI (Secondary)
- **Config:** In `AppConfig` table (database-driven, hot-reload)
- **Default:** `AI_PROVIDER=google`

---

## 📊 Monitoring

### System Resources
```bash
# Dashboard (interactive)
make monitor-dashboard-manualmode

# Quick stats
make monitor-stats-manualmode

# System overview
make monitor-system-manualmode
```

### Logs
```bash
# Production backend
podman logs -f meaningful-conversations-backend-production

# Production frontend
podman logs -f meaningful-conversations-frontend-production

# Nginx error log
tail -f /var/log/nginx/error.log

# Nginx access log (anonymized)
tail -f /var/log/nginx/production-access.log
```

---

## 🔄 Common Operations

### Restart Production
```bash
cd /opt/manualmode-production
podman-compose -f podman-compose-production.yml restart
bash /opt/manualmode-production/update-nginx-ips.sh production
systemctl reload nginx
```

### Restart Single Service (Production)
```bash
cd /opt/manualmode-production
podman-compose -f podman-compose-production.yml restart backend
bash /opt/manualmode-production/update-nginx-ips.sh production
systemctl reload nginx
```

### Database Backup
```bash
# Automatic daily backup at 06:00 UTC
# Location: /root/backups/meaningful-conversations-production/

# Manual backup
podman exec meaningful-conversations-mariadb-production \
  mariadb-dump -u root -p${MARIADB_ROOT_PASSWORD} meaningful_conversations_production \
  > backup-$(date +%Y%m%d-%H%M%S).sql
```

### View Container IPs
```bash
# Production backend
podman inspect meaningful-conversations-backend-production \
  --format '{{.NetworkSettings.Networks.podman.IPAddress}}'

# Production frontend
podman inspect meaningful-conversations-frontend-production \
  --format '{{.NetworkSettings.Networks.podman.IPAddress}}'
```

---

## 🚨 Emergency Contacts

### Project Owner
- **Name:** Not specified in codebase
- **Domains:** mc-app.manualmode.at, mc-beta.manualmode.at

### External Services
- **DNS:** Not specified
- **SSL:** Let's Encrypt (automatic renewal via Certbot)
- **Hosting:** Not specified

---

## 📝 Notes

1. **NEVER** stop Production without explicit user request
2. **ALWAYS** test Staging first before Production deployments
3. **ALWAYS** use `.at` domains, NEVER `.de`
4. **ALWAYS** verify User Count after DB restore (should be 14)
5. **ALWAYS** update Nginx IPs after container restart

---

**Created:** 2025-11-27
**Last Updated:** 2025-11-27
**Version:** 1.0

