# Uptime Kuma Configuration Guide

Uptime Kuma provides uptime monitoring and status pages for BuhBot services.

## Access

- **URL**: http://localhost:3003 (development) or https://your-domain.com/uptime (production)
- **First Login**: Create admin account on first access

## Initial Setup

### 1. First Launch

When Uptime Kuma starts for the first time:

1. Open the web UI at http://localhost:3003
2. Create an admin account:
   - Username: Choose a secure username
   - Password: Use a strong password (store in password manager)
3. Complete the setup wizard

### 2. Create Admin Account

On first access, you will be prompted to create an admin account:

```
Username: admin (or your preferred username)
Password: <strong-password>
```

**Important**: Store credentials securely. There is no password recovery without database access.

## Monitor Configurations

### Required Monitors

Configure the following monitors per BuhBot specification:

#### 1. BuhBot Backend Health

| Setting               | Value                          |
| --------------------- | ------------------------------ |
| Monitor Type          | HTTP(s)                        |
| Friendly Name         | BuhBot Backend                 |
| URL                   | http://bot-backend:3000/health |
| Heartbeat Interval    | 300 seconds (5 minutes)        |
| Retries               | 3                              |
| Retry Interval        | 60 seconds                     |
| Method                | GET                            |
| Expected Status Codes | 200                            |

**Tags**: `backend`, `critical`

#### 2. BuhBot Frontend Health

| Setting               | Value                           |
| --------------------- | ------------------------------- |
| Monitor Type          | HTTP(s)                         |
| Friendly Name         | BuhBot Frontend                 |
| URL                   | http://frontend:3000/api/health |
| Heartbeat Interval    | 300 seconds (5 minutes)         |
| Retries               | 3                               |
| Retry Interval        | 60 seconds                      |
| Method                | GET                             |
| Expected Status Codes | 200                             |

**Tags**: `frontend`, `critical`

#### 3. Supabase API

| Setting               | Value                                      |
| --------------------- | ------------------------------------------ |
| Monitor Type          | HTTP(s)                                    |
| Friendly Name         | Supabase API                               |
| URL                   | https://[PROJECT-REF].supabase.co/rest/v1/ |
| Heartbeat Interval    | 300 seconds (5 minutes)                    |
| Retries               | 3                                          |
| Retry Interval        | 60 seconds                                 |
| Method                | GET                                        |
| Expected Status Codes | 200                                        |
| Headers               | `apikey: <SUPABASE_ANON_KEY>`              |

**Note**: Replace `[PROJECT-REF]` with your actual Supabase project reference.
Replace `<SUPABASE_ANON_KEY>` with your Supabase anon key.

**Tags**: `database`, `external`, `critical`

#### 4. Redis (Optional)

| Setting            | Value                   |
| ------------------ | ----------------------- |
| Monitor Type       | TCP Port                |
| Friendly Name      | Redis Cache             |
| Hostname           | redis                   |
| Port               | 6379                    |
| Heartbeat Interval | 300 seconds (5 minutes) |
| Retries            | 3                       |

**Tags**: `cache`, `internal`

#### 5. Prometheus (Optional)

| Setting               | Value                           |
| --------------------- | ------------------------------- |
| Monitor Type          | HTTP(s)                         |
| Friendly Name         | Prometheus                      |
| URL                   | http://localhost:9090/-/healthy |
| Heartbeat Interval    | 300 seconds (5 minutes)         |
| Method                | GET                             |
| Expected Status Codes | 200                             |

**Tags**: `monitoring`, `internal`

#### 6. Grafana (Optional)

| Setting               | Value                            |
| --------------------- | -------------------------------- |
| Monitor Type          | HTTP(s)                          |
| Friendly Name         | Grafana                          |
| URL                   | http://localhost:3000/api/health |
| Heartbeat Interval    | 300 seconds (5 minutes)          |
| Method                | GET                              |
| Expected Status Codes | 200                              |

**Note**: Inside the monitoring container, Grafana runs on port 3000.

**Tags**: `monitoring`, `internal`

## Telegram Notification Setup

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow prompts to create bot:
   - Name: `BuhBot Alerts` (or your preferred name)
   - Username: `buhbot_alerts_bot` (must be unique)
4. Save the API token provided

### 2. Get Chat ID

**For personal notifications**:

1. Send a message to your bot
2. Open: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find `chat.id` in the response

**For group notifications**:

1. Add the bot to a group
2. Send a message in the group
3. Open: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find `chat.id` (will be negative for groups)

### 3. Configure in Uptime Kuma

1. Go to **Settings** > **Notifications**
2. Click **Setup Notification**
3. Select **Telegram** as notification type
4. Configure:

| Setting                        | Value                         |
| ------------------------------ | ----------------------------- |
| Friendly Name                  | BuhBot Telegram Alerts        |
| Bot Token                      | Your bot token from BotFather |
| Chat ID                        | Your chat or group ID         |
| Default Enabled                | Yes                           |
| Apply on all existing monitors | Yes (optional)                |

### 4. Test Notification

1. Click **Test** button in notification settings
2. Verify message received in Telegram
3. Save notification configuration

### 5. Notification Template (Optional)

Default message format works well, but you can customize:

```
*[Monitor Name]* is *[Status]*

*URL*: [URL]
*Time*: [Time]
*Message*: [Message]
```

## Dashboard Customization

### Status Page

1. Go to **Status Pages** in sidebar
2. Click **New Status Page**
3. Configure:
   - **Slug**: `buhbot-status`
   - **Title**: `BuhBot Service Status`
   - **Description**: `Real-time status of BuhBot services`
4. Add monitor groups:
   - **Core Services**: Backend, Frontend
   - **Database**: Supabase API
   - **Infrastructure**: Redis, Prometheus, Grafana

### Public Access

To make status page public:

1. Edit status page settings
2. Set **Public** to `true`
3. Access at: `http://localhost:3003/status/buhbot-status`

### Incident Management

1. Go to status page
2. Click **Add Incident**
3. Fill in:
   - Title: Brief description
   - Content: Detailed explanation
   - Style: `info`, `warning`, `danger`, `primary`
4. Incidents appear on status page automatically

## Import/Export Monitors

### Export Current Configuration

1. Go to **Settings** > **Backup**
2. Click **Export**
3. Save JSON file

### Import Configuration

1. Go to **Settings** > **Backup**
2. Select JSON file (see `monitors.json` in this directory)
3. Click **Import**
4. Review and confirm monitors

**Note**: The `monitors.json` file in this directory provides a template.
You must update:

- Supabase URL with your project reference
- Notification IDs after creating Telegram notification

## Troubleshooting

### Monitor Shows Down But Service Is Up

1. Check network connectivity between containers
2. Verify URL is accessible from monitoring container:
   ```bash
   docker exec buhbot-monitoring-stack curl -s http://bot-backend:3000/health
   ```
3. Check container name resolution:
   ```bash
   docker exec buhbot-monitoring-stack ping bot-backend
   ```

### Notifications Not Working

1. Test notification from UI first
2. Verify bot token is correct
3. Check chat ID format (negative for groups)
4. Ensure bot has permission to send messages to group

### Data Persistence

Uptime Kuma data is stored in `/app/data` volume. To backup:

```bash
docker cp buhbot-monitoring-stack:/app/data ./uptime-kuma-backup
```

To restore:

```bash
docker cp ./uptime-kuma-backup/. buhbot-monitoring-stack:/app/data
```

## Security Notes

1. **Change default credentials** after first login
2. **Use HTTPS** in production (configure via Nginx)
3. **Restrict access** - don't expose Uptime Kuma directly to internet
4. **Regular backups** - export configuration periodically
5. **API access** - disable if not needed (Settings > Security)

## Maintenance

### Database Cleanup

Uptime Kuma automatically cleans old heartbeat data. Default retention:

- Heartbeat data: 180 days
- Statistics: Keep forever

Adjust in **Settings** > **General** > **Data Persistence**

### Update Monitors

To bulk update monitors:

1. Export current configuration
2. Edit JSON file
3. Re-import (will overwrite existing)

## Related Documentation

- [Monitoring Stack README](../README.md)
- [Prometheus Configuration](../prometheus.yml)
- [Grafana Configuration](../grafana.ini)
- [Nginx Reverse Proxy](../../nginx/README.md)
