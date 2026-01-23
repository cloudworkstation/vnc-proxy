# VNC Proxy (with RDP Support)

A web-based VNC/RDP proxy built with Apache Guacamole and React, designed to work with OIDC authentication via [oidc-rproxy](https://github.com/richardjkendall/oidc-rproxy).

## Features

- 🖥️ **Web-based remote desktop** - Access VNC/RDP servers through your browser
- 🔐 **OIDC Authentication** - Secure authentication via OIDC providers (Google, Azure AD, Okta, etc.)
- 🔄 **Auto-reconnection** - Intelligent reconnection with exponential backoff
- 🎯 **Auth timeout detection** - Automatic redirect to login when OIDC tokens expire
- 📱 **Responsive UI** - Automatic screen scaling and clipboard support
- 🌐 **Multi-host support** - Dynamic configuration via DynamoDB (optional)

## Version

**Current**: 0.0.2 (dynamic-config branch)
- Updated to Guacamole 1.6.0
- Node.js 20 LTS
- Enhanced auth timeout handling

## Quick Start

See [TESTING.md](TESTING.md) for detailed local testing instructions.

```bash
# 1. Build the application
mvn clean install
docker build -t vnc-proxy:0.0.2 .

# 2. Configure OIDC
cp .env.example .env
# Edit .env with your OIDC provider details

# 3. Start the stack
docker-compose up -d

# 4. Access at https://localhost:8443
```

## Documentation

- **[TESTING.md](TESTING.md)** - Local testing guide with Docker Compose
- **[OIDC_PROVIDERS.md](OIDC_PROVIDERS.md)** - OIDC provider configuration examples (Google, Azure AD, Okta, etc.)
- **[DYNAMODB_SETUP.md](DYNAMODB_SETUP.md)** - DynamoDB setup for multi-host dynamic configuration

## Environment Variables

### VNC Proxy Application

| Variable | Description | Required |
|----------|-------------|----------|
| `GUACD_HOST` | Guacamole daemon hostname | Yes |
| `AUTH_MODE` | Authentication mode (`OIDC`) | Yes |
| `AWS_REGION` | AWS region for DynamoDB | If using dynamic-config |
| `AWS_ACCESS_KEY_ID` | AWS access key | If using dynamic-config |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | If using dynamic-config |
| `CONFIG_TABLE` | DynamoDB table name | If using dynamic-config |

### OIDC Reverse Proxy

| Variable | Description | Required |
|----------|-------------|----------|
| `DOMAIN` | Application domain | Yes |
| `OIDC_CLIENT_ID` | OAuth client ID | Yes |
| `OIDC_CLIENT_SECRET` | OAuth client secret | Yes |
| `OIDC_CRYPTO_PASSPHRASE` | Session encryption key | Yes |
| `OIDC_PROVIDER_JWKS_URI` | OIDC JWKS URI | Yes |
| `OIDC_PROVIDER_METADATA_URL` | OIDC metadata URL | Yes |
| `OIDC_REMOTE_USER` | OIDC claim for username | Yes |
| `UPSTREAM` | Upstream target URL | Yes |

See [`.env.example`](.env.example) for complete configuration template.

## Architecture

```
Browser (HTTPS) → oidc-rproxy → vnc-proxy → guacd → VNC/RDP Server
                      ↓ (OIDC)
                OIDC Provider
```

### Components

1. **oidc-rproxy** - Handles OIDC authentication and sets `X-Remote-User` header
2. **vnc-proxy** - React/Tomcat application providing web-based VNC/RDP client
3. **guacd** - Apache Guacamole daemon handling VNC/RDP protocols

## Authentication

The application expects requests to include the `X-Remote-User` header set by oidc-rproxy after successful OIDC authentication.

### Auth Timeout Handling (New in 0.0.2)

- **Pre-flight checks** - Validates authentication before WebSocket connections
- **Automatic detection** - Identifies expired OIDC tokens via HTTP 302 redirects
- **Smart reconnection** - Exponential backoff for network errors, immediate redirect for auth failures
- **Seamless UX** - No manual page refresh required

## Modes

### SINGLE Mode
- Single preconfigured VNC/RDP host
- No DynamoDB required
- Automatically connects on page load

### PASS_THROUGH Mode (Dynamic Config)
- Multiple hosts configured in DynamoDB
- User selects from available hosts
- Centralized configuration management

See [DYNAMODB_SETUP.md](DYNAMODB_SETUP.md) for configuration details.

## Development

```bash
# Build
mvn clean install

# Run frontend locally
cd src/main/javascript/frontend
npm install
npm start

# Package WAR
mvn package

# Build Docker image
docker build -t vnc-proxy:0.0.2 .
```

## Branches

- **main** - Basic single-host configuration
- **dynamic-config** - Multi-host configuration with DynamoDB support

## License

See LICENSE file for details.

## Credits

Built with [Apache Guacamole](https://guacamole.apache.org/) and [oidc-rproxy](https://github.com/richardjkendall/oidc-rproxy).
