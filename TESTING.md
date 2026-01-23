# Local Testing Guide

This guide explains how to test the vnc-proxy stack locally using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- OIDC provider configured (Google, Azure AD, Okta, etc.)
- A VNC server to connect to (for testing the full flow)

## Quick Start

### 1. Build the Application

```bash
# Build the WAR file
mvn clean install

# Build the Docker image
docker build -t vnc-proxy:0.0.2 .
```

### 2. Configure OIDC

Copy the example environment file and configure your OIDC provider:

```bash
cp .env.example .env
```

Edit `.env` and fill in your OIDC provider details:

```bash
# OIDC Reverse Proxy Configuration
DOMAIN=localhost:8443
OIDC_CLIENT_ID=your-client-id.apps.googleusercontent.com
OIDC_CLIENT_SECRET=your-client-secret

# Generate a random crypto passphrase (64 characters)
OIDC_CRYPTO_PASSPHRASE=$(openssl rand -hex 32)

# For Google OAuth 2.0
OIDC_PROVIDER_JWKS_URI=https://www.googleapis.com/oauth2/v3/certs
OIDC_PROVIDER_METADATA_URL=https://accounts.google.com/.well-known/openid-configuration

# OIDC claim to use (usually 'email')
OIDC_REMOTE_USER=email

# Port and scheme
PORT=8443
SCHEME=https
UPSTREAM=http://vnc-proxy:8080

# VNC Proxy Configuration
AUTH_MODE=OIDC
GUACD_HOST=guacd

# AWS Configuration (for dynamic-config with DynamoDB)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
CONFIG_TABLE=vnc-hosts
```

### 3. Register Redirect URI

In your OIDC provider's configuration, add the redirect URI:
- **Local Testing**: `https://localhost:8443/oidc/callback`

For Google OAuth 2.0:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project → APIs & Services → Credentials
3. Edit your OAuth 2.0 Client ID
4. Add `https://localhost:8443/oidc/callback` to Authorized redirect URIs

For Azure AD:
1. Go to [Azure Portal](https://portal.azure.com)
2. Azure Active Directory → App registrations → Your app
3. Authentication → Add a platform → Web
4. Add `https://localhost:8443/oidc/callback` to Redirect URIs

### 4. Start the Stack

```bash
docker-compose up -d
```

Check logs:
```bash
docker-compose logs -f
```

### 5. Access the Application

1. Open your browser to: **https://localhost:8443**
2. You'll see a certificate warning (self-signed cert) - accept it
3. You'll be redirected to your OIDC provider to login
4. After authentication, you'll be redirected back to the VNC proxy

## Testing Auth Timeout Fix

To test the OIDC authentication timeout fix:

### Scenario 1: Initial Auth Check
1. Clear your browser cookies
2. Navigate to `https://localhost:8443`
3. Watch browser console - should see "Auth check passed"
4. Should redirect to OIDC login

### Scenario 2: Token Expiry During Session
1. Connect to a VNC session
2. Wait for OIDC token to expire (or force expire by clearing cookies)
3. Disconnect the VNC connection (simulate network drop)
4. Watch browser console - should see:
   - "Auth check detected redirect - OIDC token likely expired"
   - "Redirecting to login..."
5. Page should reload and redirect to OIDC login

### Scenario 3: Network Error Auto-Reconnect
1. Connect to a VNC session with valid auth
2. Stop guacd: `docker-compose stop guacd`
3. Disconnect VNC connection
4. Watch browser console - should see:
   - "Retryable error detected - starting auto-reconnect"
   - Exponential backoff attempts (1s, 2s, 4s, 8s, 16s, 30s)
5. Restart guacd: `docker-compose start guacd`
6. Should reconnect automatically

### Scenario 4: Manual Reconnect with Expired Token
1. Connect to a VNC session
2. Expire OIDC token (clear cookies)
3. Disconnect VNC
4. Click "Reconnect" button
5. Should detect expired auth and redirect to login

## Docker Compose Services

### guacd
- **Image**: guacamole/guacd:1.6.0
- **Port**: 4822 (internal)
- **Purpose**: Guacamole daemon handling VNC/RDP protocol

### vnc-proxy
- **Image**: vnc-proxy:0.0.2 (built locally)
- **Port**: 8080 (internal, accessed via oidc-rproxy)
- **Purpose**: Web application providing VNC client interface

### oidc-rproxy
- **Image**: richardjkendall/oidc-rproxy:latest
- **Ports**:
  - 8443 (HTTPS)
  - 8000 (HTTP, redirects to HTTPS)
- **Purpose**: OIDC authentication reverse proxy

## Environment Variables

### vnc-proxy Service

| Variable | Description | Default |
|----------|-------------|---------|
| `GUACD_HOST` | Guacamole daemon hostname | `guacd` |
| `GUACD_PORT` | Guacamole daemon port | `4822` |
| `AUTH_MODE` | Authentication mode | `OIDC` |
| `AWS_REGION` | AWS region for DynamoDB | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | Required for DynamoDB |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required for DynamoDB |
| `CONFIG_TABLE` | DynamoDB table name | `vnc-hosts` |

### oidc-rproxy Service

| Variable | Description | Required |
|----------|-------------|----------|
| `DOMAIN` | Domain for the application | Yes |
| `OIDC_CLIENT_ID` | OAuth client ID | Yes |
| `OIDC_CLIENT_SECRET` | OAuth client secret | Yes |
| `OIDC_CRYPTO_PASSPHRASE` | Crypto passphrase (64 chars) | Yes |
| `OIDC_PROVIDER_JWKS_URI` | OIDC provider JWKS URI | Yes |
| `OIDC_PROVIDER_METADATA_URL` | OIDC discovery metadata URL | Yes |
| `OIDC_REMOTE_USER` | OIDC claim for username | Yes (e.g., `email`) |
| `PORT` | Port to listen on | No (default: 8443) |
| `SCHEME` | http or https | No (default: https) |
| `UPSTREAM` | Upstream target URL | Yes (e.g., `http://vnc-proxy:8080`) |

## Dynamic-Config Mode

If using dynamic-config with DynamoDB:

1. Uncomment AWS environment variables in `docker-compose.yml`
2. Configure AWS credentials in `.env`
3. Create DynamoDB table with host configuration
4. Set table name in `DYNAMODB_TABLE_NAME`

## Troubleshooting

### "Access denied: Authentication required"
- Check that `REMOTE_USER` matches your OIDC email
- Check `X-Remote-User` header is being set by oidc-rproxy
- View logs: `docker-compose logs vnc-proxy`

### "Cannot connect to guacd"
- Ensure guacd is running: `docker-compose ps`
- Check guacd logs: `docker-compose logs guacd`
- Verify `GUACD_HOSTNAME` and `GUACD_PORT` are correct

### OIDC Redirect Loop
- Verify `OIDC_REDIRECT_URI` matches what's registered in OIDC provider
- Check `SESSION_KEY` is set and is at least 16 characters
- Clear browser cookies and try again

### Certificate Warnings
- For local testing, accept the self-signed certificate warning
- For production, mount real TLS certificates (see docker-compose.yml comments)

### WebSocket Connection Fails
- Check browser console for errors
- Verify oidc-rproxy is forwarding WebSocket connections
- Check that OIDC token hasn't expired

## Stopping the Stack

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f vnc-proxy
docker-compose logs -f oidc-rproxy
docker-compose logs -f guacd
```

## Network Diagram

```
Browser (HTTPS) → oidc-rproxy:8443 → vnc-proxy:8080 → guacd:4822 → VNC Server
                      ↓ (OIDC)
                OIDC Provider
```

## Next Steps

After local testing:
- Deploy to your target environment
- Configure production TLS certificates
- Set up proper secrets management
- Configure monitoring and logging
- Test with real VNC/RDP servers
