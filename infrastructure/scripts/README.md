# BuhBot VDS Management Scripts

Production-grade Bash scripts for VDS setup and application deployment.

## Scripts

### 1. bootstrap-vds.sh

**Purpose**: Initial VDS setup - install Docker, configure firewall, create buhbot user

**Usage**:

```bash
sudo ./bootstrap-vds.sh
```

**Requirements**:

- Ubuntu 22.04 LTS (or compatible Debian-based system)
- Root privileges
- Internet connection
- At least 10GB free disk space

**What it does**:

1. Updates system packages
2. Installs Docker CE and Docker Compose from official repository
3. Configures UFW firewall:
   - Allows SSH (port 22)
   - Allows HTTP (port 80)
   - Allows HTTPS (port 443)
4. Creates `buhbot` system user with home directory
5. Adds `buhbot` to docker group
6. Sets up SSH key authentication (copies from current user)
7. Hardens SSH security:
   - Disables root login
   - Disables password authentication
   - Enables public key authentication only
8. Configures fail2ban
9. Verifies installation

**Features**:

- Idempotent (safe to run multiple times)
- Color-coded progress messages
- Comprehensive logging to `/var/log/buhbot-bootstrap-*.log`
- Error handling with rollback on critical failures
- Pre-flight checks (root privileges, OS compatibility)
- Post-installation verification

**Output**:

- Log file: `/var/log/buhbot-bootstrap-YYYYMMDD-HHMMSS.log`
- Application directory: `/home/buhbot/BuhBot`

**Important**:

- Test SSH access as `buhbot` user BEFORE closing root session
- Root SSH login will be disabled after running this script
- Ensure SSH keys are properly configured before disconnecting

---

### 2. deploy.sh

**Purpose**: Deploy or update BuhBot application with health checks and automatic rollback

**Usage**:

```bash
# Normal deployment (with confirmation)
./deploy.sh

# Dry run (test without making changes)
./deploy.sh --dry-run

# Force deployment (skip confirmations, CI/CD mode)
./deploy.sh --force
```

**Requirements**:

- Docker and Docker Compose installed
- Application files in `/home/buhbot/BuhBot` (or current directory)
- Environment files configured:
  - `backend/.env`
  - `frontend/.env.local`
- At least 5GB free disk space
- Can run as `buhbot` user (no root required)

**What it does**:

1. Pre-flight checks:
   - Verifies Docker is running
   - Checks docker-compose.yml files exist
   - Validates environment files
   - Ensures sufficient disk space (>5GB)
2. Acquires deployment lock (prevents concurrent deployments)
3. Creates backup of current state:
   - Environment files
   - Docker volumes
   - Container state
4. Pulls latest Docker images
5. Deploys services:
   - Uses `docker-compose.yml` + `docker-compose.prod.yml`
   - Removes orphan containers
6. Waits for health checks (timeout: 300 seconds)
7. Verifies deployment:
   - Tests bot-backend health endpoint (port 3000)
   - Tests frontend (port 3001)
   - Tests nginx (port 80)
8. On failure: Automatic rollback to previous state
9. Cleanup: Removes old Docker images
10. Shows deployment summary

**Features**:

- **Dry-run mode**: Test deployment without making changes
- **Force mode**: Skip confirmation prompts (CI/CD friendly)
- **Health checks**: Waits for all services to become healthy
- **Automatic rollback**: Restores previous state on failure
- **Deployment lock**: Prevents concurrent deployments
- **Color-coded output**: Green (success), Red (error), Yellow (warning), Blue (info)
- **Comprehensive logging**: All operations logged to `/var/log/`
- **Backup creation**: Automatic pre-deployment backup

**Output**:

- Log file: `/var/log/buhbot-deploy-YYYYMMDD-HHMMSS.log`
- Backup directory: `/var/backups/buhbot-pre-deploy-YYYYMMDD-HHMMSS/`

**Exit codes**:

- `0`: Success
- `1`: Error
- `2`: Validation failure

---

## Workflow

### Initial VDS Setup

1. **SSH into VDS as root**:

   ```bash
   ssh root@your-vds-ip
   ```

2. **Download or create bootstrap script**:

   ```bash
   curl -o bootstrap-vds.sh https://raw.githubusercontent.com/maslennikov-ig/BuhBot/main/infrastructure/scripts/bootstrap-vds.sh
   chmod +x bootstrap-vds.sh
   ```

3. **Run bootstrap script**:

   ```bash
   sudo ./bootstrap-vds.sh
   ```

4. **Test SSH access as buhbot user** (before closing root session):

   ```bash
   # From your local machine
   ssh buhbot@your-vds-ip
   ```

5. **Clone repository**:

   ```bash
   cd /home/buhbot
   git clone https://github.com/maslennikov-ig/BuhBot.git
   cd BuhBot
   ```

6. **Configure environment variables**:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   # Edit .env files with your configuration
   nano backend/.env
   nano frontend/.env.local
   ```

---

### Application Deployment

1. **SSH into VDS as buhbot user**:

   ```bash
   ssh buhbot@your-vds-ip
   cd /home/buhbot/BuhBot
   ```

2. **Pull latest code**:

   ```bash
   git pull origin main
   ```

3. **Run deployment script**:

   ```bash
   # Test deployment (dry run)
   ./infrastructure/scripts/deploy.sh --dry-run

   # Deploy to production
   ./infrastructure/scripts/deploy.sh
   ```

4. **Monitor deployment**:

   ```bash
   # Check container status
   docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps

   # View logs
   docker compose -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml logs -f
   ```

---

### Application Updates

```bash
# Pull latest changes
cd /home/buhbot/BuhBot
git pull origin main

# Deploy updates
./infrastructure/scripts/deploy.sh --force
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VDS_HOST }}
          username: buhbot
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/buhbot/BuhBot
            git pull origin main
            ./infrastructure/scripts/deploy.sh --force
```

---

## Troubleshooting

### Bootstrap Issues

**Error: "Docker installation failed"**

- Check internet connection
- Verify Ubuntu version is 22.04 LTS
- Review log file: `/var/log/buhbot-bootstrap-*.log`

**Error: "SSH key setup failed"**

- Manually copy SSH keys to `/home/buhbot/.ssh/authorized_keys`
- Set permissions: `chmod 600 /home/buhbot/.ssh/authorized_keys`
- Set ownership: `chown -R buhbot:buhbot /home/buhbot/.ssh`

### Deployment Issues

**Error: "Docker daemon is not running"**

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

**Error: "Health checks failed"**

- Check container logs: `docker compose logs`
- Verify environment variables in `.env` files
- Check disk space: `df -h`
- Review deployment log: `/var/log/buhbot-deploy-*.log`

**Error: "Deployment lock exists"**

```bash
# Check if deployment is actually running
ps aux | grep deploy.sh

# If not running, remove stale lock
rm -f /tmp/buhbot-deploy.lock
```

**Rollback manually**:

```bash
cd /home/buhbot/BuhBot/infrastructure

# Stop current containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Restore from backup
BACKUP_DIR=/var/backups/buhbot-pre-deploy-YYYYMMDD-HHMMSS
cp $BACKUP_DIR/backend.env ../backend/.env
cp $BACKUP_DIR/frontend.env.local ../frontend/.env.local

# Restart services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Security Considerations

### Bootstrap Script

- Disables root SSH login
- Disables password authentication
- Configures fail2ban to prevent brute-force attacks
- Minimal firewall rules (only 22, 80, 443)

### Deployment Script

- Can run as non-root user (buhbot)
- Creates backups before deployment
- Automatic rollback on failure
- Prevents concurrent deployments with lock file
- No hardcoded secrets (uses .env files)

---

## Logging

All scripts log to `/var/log/` with timestamps:

- Bootstrap: `/var/log/buhbot-bootstrap-YYYYMMDD-HHMMSS.log`
- Deployment: `/var/log/buhbot-deploy-YYYYMMDD-HHMMSS.log`

**View recent logs**:

```bash
# Bootstrap logs
ls -lt /var/log/buhbot-bootstrap-*.log | head -1 | xargs tail -f

# Deployment logs
ls -lt /var/log/buhbot-deploy-*.log | head -1 | xargs tail -f
```

---

## Maintenance

### Cleanup old backups

```bash
# Remove backups older than 30 days
find /var/backups/buhbot-pre-deploy-* -type d -mtime +30 -exec rm -rf {} +
```

### Cleanup old logs

```bash
# Remove logs older than 90 days
find /var/log/buhbot-*.log -mtime +90 -delete
```

### Update Docker images

```bash
cd /home/buhbot/BuhBot/infrastructure
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## License

Part of the BuhBot project. See main repository for license information.
