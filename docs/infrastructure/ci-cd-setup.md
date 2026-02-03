# BuhBot CI/CD Setup Guide

**Version**: 1.0.0
**Last Updated**: 2025-11-22
**Target Environment**: GitHub Actions + FirstVDS production deployment

---

## Table of Contents

1. [Overview](#overview)
2. [CI/CD Architecture](#cicd-architecture)
3. [Prerequisites](#prerequisites)
4. [Required GitHub Secrets](#required-github-secrets)
5. [GitHub Environment Setup](#github-environment-setup)
6. [CI Workflow Details](#ci-workflow-details)
7. [CD Workflow Details](#cd-workflow-details)
8. [Manual Deployment](#manual-deployment)
9. [Troubleshooting](#troubleshooting)
10. [Security Considerations](#security-considerations)

---

## Overview

BuhBot uses GitHub Actions for continuous integration and deployment. The CI/CD pipeline ensures code quality through automated testing and provides a controlled deployment path to the production VDS server.

### Key Features

- **Automated CI**: Lint, type-check, build, and test on every push and pull request
- **Manual Approval Gate**: Production deployments require explicit approval
- **Zero-Downtime Deployments**: Rolling updates with health checks
- **Automatic Rollback**: Failed deployments trigger automatic rollback
- **Deployment Notifications**: Telegram alerts for deployment status

### Pipeline Flow

```
Developer Push/PR
       │
       v
┌──────────────────┐
│    CI Workflow   │
│  ┌────────────┐  │
│  │   Lint     │  │
│  └─────┬──────┘  │
│        │         │
│  ┌─────v──────┐  │
│  │ Type-Check │  │
│  └─────┬──────┘  │
│        │         │
│  ┌─────v──────┐  │
│  │   Build    │  │
│  └─────┬──────┘  │
│        │         │
│  ┌─────v──────┐  │
│  │   Tests    │  │
│  └────────────┘  │
└────────┬─────────┘
         │
         │ (on main branch only)
         v
┌──────────────────┐
│   CD Workflow    │
│  ┌────────────┐  │
│  │Build Images│  │
│  └─────┬──────┘  │
│        │         │
│  ┌─────v──────┐  │
│  │  Manual    │◄─┼── Reviewer Approval Required
│  │  Approval  │  │
│  └─────┬──────┘  │
│        │         │
│  ┌─────v──────┐  │
│  │SSH Deploy  │  │
│  │  to VDS    │  │
│  └─────┬──────┘  │
│        │         │
│  ┌─────v──────┐  │
│  │Health Check│  │
│  └─────┬──────┘  │
│        │         │
│  ┌─────v──────┐  │
│  │  Notify    │  │
│  │ Telegram   │  │
│  └────────────┘  │
└──────────────────┘
```

---

## CI/CD Architecture

### Workflow Files

| File                           | Purpose                                                | Trigger                         |
| ------------------------------ | ------------------------------------------------------ | ------------------------------- |
| `.github/workflows/ci.yml`     | Continuous Integration (lint, type-check, build, test) | Push to any branch, PRs to main |
| `.github/workflows/deploy.yml` | Continuous Deployment (build images, deploy to VDS)    | Push to main (after CI passes)  |
| `.github/workflows/test.yml`   | Extended testing with services (Redis, Supabase)       | Push to any branch, PRs         |
| `.github/workflows/build.yml`  | Build validation and artifact upload                   | Push/PR to main                 |

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   CI Runner  │───>│  CD Runner   │───>│  Deployment Runner   │  │
│  │  (ubuntu-    │    │  (ubuntu-    │    │  (SSH to VDS)        │  │
│  │   latest)    │    │   latest)    │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                                      │
                                                      │ SSH (port 22)
                                                      v
┌─────────────────────────────────────────────────────────────────────┐
│                      FirstVDS Production Server                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │    Nginx     │    │ Bot Backend  │    │      Frontend        │  │
│  │  (reverse    │    │  (Node.js)   │    │     (Next.js)        │  │
│  │   proxy)     │    │              │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│  ┌──────────────┐    ┌──────────────┐                              │
│  │    Redis     │    │  Monitoring  │                              │
│  │   (cache)    │    │    Stack     │                              │
│  └──────────────┘    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before configuring CI/CD, ensure you have:

### Repository Access

- [ ] **GitHub repository owner/admin access** (to configure secrets and environments)
- [ ] **Write access to main branch** (or branch protection bypass for initial setup)

### VDS Server Ready

- [ ] **VDS provisioned and accessible** (see [vds-setup.md](./vds-setup.md))
- [ ] **SSH access configured** for `buhbot` user
- [ ] **Docker and Docker Compose installed** on VDS
- [ ] **Application deployed at least once manually** (to verify setup)

### Credentials Available

- [ ] **VDS IP address** (e.g., `123.45.67.89`)
- [ ] **SSH private key** for `buhbot` user
- [ ] **Telegram Bot Token** (for deployment notifications)
- [ ] **Telegram Admin Chat ID** (for deployment notifications)

---

## Required GitHub Secrets

Navigate to: **Settings > Secrets and variables > Actions > New repository secret**

### Required Secrets (Must Configure)

| Secret Name   | Description                       | Example                                  | Where to Get           |
| ------------- | --------------------------------- | ---------------------------------------- | ---------------------- |
| `VDS_HOST`    | VDS server IP address             | `123.45.67.89`                           | FirstVDS control panel |
| `VDS_USER`    | SSH username                      | `buhbot`                                 | Set during bootstrap   |
| `VDS_SSH_KEY` | Private SSH key (entire contents) | `-----BEGIN OPENSSH PRIVATE KEY-----...` | `~/.ssh/id_ed25519`    |

### Optional Secrets (For Notifications)

| Secret Name              | Description                 | Example               | Where to Get                       |
| ------------------------ | --------------------------- | --------------------- | ---------------------------------- |
| `TELEGRAM_BOT_TOKEN`     | Bot token for notifications | `123456789:ABCdef...` | @BotFather on Telegram             |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID for notifications   | `-100123456789`       | Send message to bot, check updates |

### Testing Secrets (For CI Tests)

| Secret Name            | Description               | Example                   |
| ---------------------- | ------------------------- | ------------------------- |
| `SUPABASE_URL`         | Supabase project URL      | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGciOiJI...`         |
| `SUPABASE_ANON_KEY`    | Supabase anon/public key  | `eyJhbGciOiJI...`         |

### Configuring SSH Key Secret

The SSH key must be the **private key** (not public key) and include the entire contents:

**Step 1**: Display your private key:

```bash
cat ~/.ssh/id_ed25519
```

**Step 2**: Copy the entire output, including:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
... (multiple lines)
-----END OPENSSH PRIVATE KEY-----
```

**Step 3**: Paste into GitHub Secret `VDS_SSH_KEY`

**Important**: Ensure no extra whitespace at the beginning or end of the secret value.

### Verifying Secrets Configuration

After adding secrets, verify they appear in the list:

1. Go to **Settings > Secrets and variables > Actions**
2. Confirm all required secrets are listed:
   - `VDS_HOST`
   - `VDS_USER`
   - `VDS_SSH_KEY`

Secrets should show "Updated X minutes ago" timestamp.

---

## GitHub Environment Setup

GitHub Environments provide manual approval gates and environment-specific secrets.

### Creating "production" Environment

1. Navigate to **Settings > Environments > New environment**
2. Enter name: `production`
3. Click **Configure environment**

### Configuring Required Reviewers

Enable manual approval before deployments:

1. In the `production` environment settings
2. Check **Required reviewers**
3. Add team members who can approve deployments
4. Recommended: Add at least 2 reviewers for redundancy

### Setting Wait Timer (Optional)

Add a delay before deployment proceeds:

1. Check **Wait timer**
2. Set minutes (e.g., `5` minutes)
3. This allows time to cancel accidental deployments

### Environment Protection Rules

Configure branch restrictions:

1. Check **Deployment branches**
2. Select **Selected branches**
3. Add pattern: `main`
4. This ensures only main branch can deploy to production

### Final Environment Configuration

Your production environment should have:

```
Environment: production
├── Required reviewers: [your-team-members]
├── Wait timer: 0-5 minutes (optional)
└── Deployment branches: main only
```

---

## CI Workflow Details

### Trigger Conditions

The CI workflow (`.github/workflows/ci.yml`) triggers on:

| Event          | Branches     | Purpose               |
| -------------- | ------------ | --------------------- |
| `push`         | All branches | Validate every commit |
| `pull_request` | `main`       | Gate merges to main   |

### CI Jobs

#### Job: lint

**Purpose**: Check code style and formatting

```yaml
steps:
  - Checkout code
  - Setup pnpm
  - Setup Node.js 20.x
  - Install dependencies
  - Run ESLint: pnpm lint
```

**Expected Output**: Exit code 0 (no linting errors)

**Common Failures**:

- Unused variables
- Missing imports
- Formatting inconsistencies

**Fix locally**: `pnpm lint --fix`

#### Job: type-check

**Purpose**: Validate TypeScript types

```yaml
steps:
  - Checkout code
  - Setup pnpm
  - Setup Node.js 20.x
  - Install dependencies
  - Run TypeScript: pnpm type-check
```

**Expected Output**: Exit code 0 (no type errors)

**Common Failures**:

- Type mismatches
- Missing type definitions
- Incorrect generic usage

**Fix locally**: `pnpm type-check` and resolve errors

#### Job: build

**Purpose**: Ensure application builds successfully

```yaml
steps:
  - Checkout code
  - Setup pnpm
  - Setup Node.js 20.x
  - Install dependencies
  - Clean TypeScript cache
  - Build all packages: pnpm build
  - Verify build artifacts exist
  - Upload build artifacts
```

**Expected Output**:

- Exit code 0
- `packages/*/dist/` directories created
- Build artifacts uploaded to GitHub

**Common Failures**:

- Import resolution errors
- Missing dependencies
- Build script errors

#### Job: test

**Purpose**: Run automated tests

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: [6379:6379]

steps:
  - Checkout code
  - Setup pnpm
  - Setup Node.js 20.x
  - Install dependencies
  - Run Vitest: pnpm test
```

**Expected Output**: All tests pass

**Common Failures**:

- Test assertions failing
- Missing test environment variables
- Service connection timeouts

### CI Job Dependencies

```
lint ─────────┐
              │
type-check ───┼──> All must pass for CI to succeed
              │
build ────────┤
              │
test ─────────┘
```

Jobs run in parallel for faster feedback.

---

## CD Workflow Details

### Trigger Conditions

The CD workflow (`.github/workflows/deploy.yml`) triggers on:

| Event               | Condition       | Purpose                  |
| ------------------- | --------------- | ------------------------ |
| `push` to `main`    | After CI passes | Automatic deployment     |
| `workflow_dispatch` | Manual trigger  | Emergency/manual deploys |

### CD Jobs

#### Job: build-images

**Purpose**: Build Docker images for deployment

```yaml
steps:
  - Checkout code
  - Setup pnpm
  - Setup Node.js 20.x
  - Install dependencies
  - Build application
  - Prepare deployment package
```

**Output**: Deployment package ready

#### Job: deploy

**Purpose**: Deploy to production VDS

**Environment**: `production` (requires approval)

```yaml
environment:
  name: production
  url: https://your-domain.com

steps:
  - Checkout code
  - Setup SSH key from secrets
  - SSH to VDS
  - Pull latest code
  - Run docker compose up
  - Verify health checks
  - Send deployment notification
```

### Manual Approval Process

When CD workflow reaches the deploy job:

1. **Workflow pauses** and shows "Waiting for approval"
2. **Reviewers receive notification** (email/GitHub)
3. **Reviewer visits Actions tab** and reviews changes
4. **Reviewer clicks "Approve and deploy"** or "Reject"
5. **Deployment proceeds** (if approved) or **fails** (if rejected)

### Health Checks

After deployment, the workflow verifies:

```bash
# Backend health check
curl -f http://localhost:3000/health

# Frontend accessibility
curl -f http://localhost:3001

# Container status
docker compose ps
```

**Success criteria**:

- HTTP 200 from health endpoints
- All containers showing `Up` and `(healthy)`

### Rollback Procedures

If deployment fails, automatic rollback triggers:

```bash
# Stop failed deployment
docker compose down

# Restore from backup
BACKUP_DIR=/var/backups/buhbot-pre-deploy-[timestamp]

# Restore volumes
for volume in $(ls $BACKUP_DIR/*.tar.gz); do
  docker run --rm \
    -v [volume]:/data \
    -v $BACKUP_DIR:/backup \
    alpine sh -c "tar xzf /backup/[volume].tar.gz -C /data"
done

# Restore environment files
cp $BACKUP_DIR/backend.env backend/.env
cp $BACKUP_DIR/frontend.env.local frontend/.env.local

# Start previous version
docker compose up -d
```

### Deployment Notifications

Telegram notification sent on deployment completion:

**Success message**:

```
BuhBot Deployment Successful

Version: v1.0.5
Environment: production
Time: 2025-11-22 15:30:45 MSK
Duration: 3m 45s

All health checks passed.
```

**Failure message**:

```
BuhBot Deployment FAILED

Version: v1.0.5
Environment: production
Time: 2025-11-22 15:30:45 MSK

Error: Health check timeout after 60 seconds
Rollback: Initiated automatically

Check logs: https://github.com/...
```

---

## Manual Deployment

### Triggering Manual Deployment

**Via GitHub UI**:

1. Go to **Actions** tab
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Select branch: `main`
5. Click **Run workflow**
6. Wait for approval (if required reviewers configured)
7. Approve deployment

**Via GitHub CLI**:

```bash
gh workflow run deploy.yml --ref main
```

### Emergency Rollback Commands

If you need to rollback immediately without waiting for CI/CD:

**SSH to VDS**:

```bash
ssh buhbot@[VDS_IP]
```

**Quick rollback to previous version**:

```bash
cd /home/buhbot/BuhBot

# Find latest backup
BACKUP=$(ls -t /var/backups/buhbot-pre-deploy-* | head -1)
echo "Rolling back to: $BACKUP"

# Stop current deployment
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml down

# Restore environment files
cp $BACKUP/backend.env backend/.env 2>/dev/null || true
cp $BACKUP/frontend.env.local frontend/.env.local 2>/dev/null || true

# Restore volumes (if needed)
for backup_file in "$BACKUP"/*.tar.gz; do
  volume_name=$(basename "$backup_file" .tar.gz)
  echo "Restoring volume: $volume_name"
  docker run --rm \
    -v "$volume_name:/data" \
    -v "$BACKUP:/backup" \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/${volume_name}.tar.gz -C /data"
done

# Start services
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml up -d

# Verify health
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml ps
```

**Rollback to specific git commit**:

```bash
cd /home/buhbot/BuhBot

# Find working commit
git log --oneline -10

# Reset to specific commit
git checkout [commit-hash]

# Redeploy
./infrastructure/scripts/deploy.sh
```

### Force Deploy (Skip Approval)

For emergencies, repository admins can bypass approval:

1. Go to **Settings > Environments > production**
2. Temporarily remove required reviewers
3. Trigger deployment
4. Re-add required reviewers after deployment

**Warning**: Only use this for genuine emergencies.

---

## Troubleshooting

### Common CI Failures

#### Lint Errors

**Symptom**: CI fails at lint step

**Diagnosis**:

```bash
# Run locally
pnpm lint
```

**Solution**:

```bash
# Auto-fix where possible
pnpm lint --fix

# Commit fixes
git add -A
git commit -m "fix: resolve linting errors"
git push
```

#### Type Errors

**Symptom**: CI fails at type-check step

**Diagnosis**:

```bash
# Run locally
pnpm type-check
```

**Common causes**:

- Missing type imports
- Incorrect return types
- Generic type mismatches

**Solution**: Fix type errors in your code, commit, and push.

#### Build Failures

**Symptom**: CI fails at build step

**Diagnosis**:

```bash
# Clean and rebuild
rm -rf packages/*/dist
pnpm build
```

**Common causes**:

- Circular dependencies
- Missing exports
- Package.json misconfiguration

#### Test Failures

**Symptom**: CI fails at test step

**Diagnosis**:

```bash
# Run tests locally
pnpm test

# Run specific failing test
pnpm test -- --run [test-file]
```

**Common causes**:

- Missing environment variables
- Test data inconsistencies
- Async timeout issues

### Deployment Issues

#### SSH Connection Failed

**Symptom**: Deploy fails with "Connection refused" or "Permission denied"

**Diagnosis**:

1. Check SSH key is correctly configured:

```bash
# Verify key format (should be OpenSSH format)
head -1 ~/.ssh/id_ed25519
# Expected: -----BEGIN OPENSSH PRIVATE KEY-----
```

2. Test SSH connection manually:

```bash
ssh -i ~/.ssh/id_ed25519 buhbot@[VDS_IP] "echo OK"
```

**Solutions**:

- **Permission denied**: Verify `VDS_SSH_KEY` secret contains full private key
- **Connection refused**: Check VDS firewall allows port 22
- **Host key verification failed**: First SSH manually to accept host key

#### Docker Compose Fails on VDS

**Symptom**: Deploy fails at "docker compose up" step

**Diagnosis** (on VDS):

```bash
cd /home/buhbot/BuhBot
docker compose -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.prod.yml config
```

**Common causes**:

- Invalid YAML syntax
- Missing environment variables
- Image pull failures

**Solutions**:

- Check `.env` files exist and have correct values
- Verify Docker Hub/registry access
- Check disk space: `df -h`

#### Health Check Timeout

**Symptom**: Deploy fails with "Health check failed"

**Diagnosis** (on VDS):

```bash
# Check container status
docker ps -a

# Check container logs
docker logs buhbot-bot-backend --tail=100

# Test health endpoint manually
curl -v http://localhost:3000/health
```

**Common causes**:

- Application startup error
- Database connection failure
- Port conflict

**Solutions**:

- Review application logs for startup errors
- Verify database credentials in `.env`
- Increase health check timeout in `docker-compose.yml`

### SSH Connection Problems

#### "Host key verification failed"

**Cause**: SSH host key changed or not trusted

**Solution**: Update known_hosts

```bash
# Remove old key
ssh-keygen -R [VDS_IP]

# Connect and accept new key
ssh buhbot@[VDS_IP]
# Type 'yes' when prompted
```

#### "Connection timed out"

**Cause**: Firewall blocking or wrong IP

**Diagnosis**:

```bash
# Test port connectivity
nc -zv [VDS_IP] 22
```

**Solutions**:

- Verify `VDS_HOST` secret has correct IP
- Check VDS firewall: `sudo ufw status` (on VDS via console)
- Contact FirstVDS support if VDS unreachable

#### "Permission denied (publickey)"

**Cause**: SSH key not accepted

**Diagnosis**:

```bash
# Verbose SSH connection
ssh -vvv buhbot@[VDS_IP]
```

**Solutions**:

- Verify public key is in `/home/buhbot/.ssh/authorized_keys` on VDS
- Check key format (Ed25519 recommended)
- Ensure no trailing newlines in GitHub secret

---

## Security Considerations

### Secrets Management

- **Never commit secrets** to the repository
- **Rotate secrets periodically** (every 90 days recommended)
- **Use environment-specific secrets** for staging vs production
- **Audit secret access** via GitHub security log

### SSH Key Security

- **Use Ed25519 keys** (more secure than RSA)
- **Password-protect private keys** if stored locally
- **Limit key access** to deployment user only
- **Regenerate keys** if compromise suspected

### Deployment Safety

- **Always use manual approval** for production
- **Review changes before approving** deployment
- **Keep backups enabled** for automatic rollback
- **Monitor deployment notifications** for unexpected deploys

### Network Security

- **VDS firewall** limits SSH access (consider IP whitelisting)
- **GitHub Actions IPs** can be whitelisted if needed
- **Use HTTPS** for all webhook communications

### Audit Trail

GitHub Actions maintains full audit trail:

- All workflow runs logged
- Approval/rejection recorded with username and timestamp
- Secret access logged (not values)

To review: **Settings > Security > Audit log**

---

## Summary

You have configured CI/CD for BuhBot with:

- **Continuous Integration**: Automated lint, type-check, build, and test
- **Continuous Deployment**: Automated deployment with manual approval gate
- **Safety Features**: Automatic rollback, health checks, deployment notifications
- **Security**: Secrets management, SSH key authentication, audit trail

**Next Steps**:

1. Add all required secrets to GitHub repository
2. Configure "production" environment with required reviewers
3. Push a test change to main branch
4. Verify CI workflow passes
5. Approve deployment when prompted
6. Verify application deployed successfully on VDS

**Support Resources**:

- **VDS Setup Guide**: [vds-setup.md](./vds-setup.md)
- **Security Checklist**: [security-checklist.md](./security-checklist.md)
- **Monitoring Guide**: [monitoring-guide.md](./monitoring-guide.md)
- **GitHub Actions Documentation**: https://docs.github.com/en/actions

---

**Document Version**: 1.0.0
**Tested on**: GitHub Actions, Ubuntu 22.04 LTS, Docker 24.0+
**Last Updated**: 2025-11-22
