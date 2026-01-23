# OIDC Provider Configuration Examples

This document provides example configurations for common OIDC providers.

## Google OAuth 2.0

### Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://localhost:8443/oidc/callback`

### Configuration
```bash
DOMAIN=localhost:8443
OIDC_CLIENT_ID=your-client-id.apps.googleusercontent.com
OIDC_CLIENT_SECRET=your-client-secret
OIDC_CRYPTO_PASSPHRASE=$(openssl rand -hex 32)
OIDC_PROVIDER_JWKS_URI=https://www.googleapis.com/oauth2/v3/certs
OIDC_PROVIDER_METADATA_URL=https://accounts.google.com/.well-known/openid-configuration
OIDC_REMOTE_USER=email
```

## Azure AD (Microsoft Entra ID)

### Setup
1. Go to [Azure Portal](https://portal.azure.com)
2. Azure Active Directory → App registrations → New registration
3. Set redirect URI: `https://localhost:8443/oidc/callback` (Web platform)
4. Certificates & secrets → New client secret
5. Note your Tenant ID from Overview

### Configuration
```bash
DOMAIN=localhost:8443
OIDC_CLIENT_ID=your-application-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_CRYPTO_PASSPHRASE=$(openssl rand -hex 32)
OIDC_PROVIDER_JWKS_URI=https://login.microsoftonline.com/{tenant-id}/discovery/v2.0/keys
OIDC_PROVIDER_METADATA_URL=https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration
OIDC_REMOTE_USER=email
```

Replace `{tenant-id}` with your Azure AD Tenant ID.

### Optional: Use common endpoint for multi-tenant
```bash
OIDC_PROVIDER_JWKS_URI=https://login.microsoftonline.com/common/discovery/v2.0/keys
OIDC_PROVIDER_METADATA_URL=https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration
```

## Okta

### Setup
1. Go to [Okta Admin Console](https://developer.okta.com)
2. Applications → Create App Integration
3. Sign-in method: OIDC - OpenID Connect
4. Application type: Web Application
5. Sign-in redirect URIs: `https://localhost:8443/oidc/callback`
6. Note your Okta domain (e.g., `dev-12345678.okta.com`)

### Configuration
```bash
DOMAIN=localhost:8443
OIDC_CLIENT_ID=your-okta-client-id
OIDC_CLIENT_SECRET=your-okta-client-secret
OIDC_CRYPTO_PASSPHRASE=$(openssl rand -hex 32)
OIDC_PROVIDER_JWKS_URI=https://{your-okta-domain}/oauth2/default/v1/keys
OIDC_PROVIDER_METADATA_URL=https://{your-okta-domain}/oauth2/default/.well-known/openid-configuration
OIDC_REMOTE_USER=email
```

Replace `{your-okta-domain}` with your Okta domain (e.g., `dev-12345678.okta.com`).

## Auth0

### Setup
1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Applications → Create Application
3. Application type: Regular Web Applications
4. Settings → Allowed Callback URLs: `https://localhost:8443/oidc/callback`
5. Note your Domain and Client ID/Secret

### Configuration
```bash
DOMAIN=localhost:8443
OIDC_CLIENT_ID=your-auth0-client-id
OIDC_CLIENT_SECRET=your-auth0-client-secret
OIDC_CRYPTO_PASSPHRASE=$(openssl rand -hex 32)
OIDC_PROVIDER_JWKS_URI=https://{your-auth0-domain}/.well-known/jwks.json
OIDC_PROVIDER_METADATA_URL=https://{your-auth0-domain}/.well-known/openid-configuration
OIDC_REMOTE_USER=email
```

Replace `{your-auth0-domain}` with your Auth0 domain (e.g., `your-tenant.us.auth0.com`).

## Keycloak

### Setup
1. Login to Keycloak Admin Console
2. Create or select a Realm
3. Clients → Create client
4. Client type: OpenID Connect
5. Valid redirect URIs: `https://localhost:8443/oidc/callback`
6. Create client and note Client ID/Secret

### Configuration
```bash
DOMAIN=localhost:8443
OIDC_CLIENT_ID=your-keycloak-client-id
OIDC_CLIENT_SECRET=your-keycloak-client-secret
OIDC_CRYPTO_PASSPHRASE=$(openssl rand -hex 32)
OIDC_PROVIDER_JWKS_URI=https://{keycloak-host}/realms/{realm-name}/protocol/openid-connect/certs
OIDC_PROVIDER_METADATA_URL=https://{keycloak-host}/realms/{realm-name}/.well-known/openid-configuration
OIDC_REMOTE_USER=email
```

Replace:
- `{keycloak-host}` with your Keycloak hostname (e.g., `keycloak.example.com`)
- `{realm-name}` with your realm name (e.g., `master` or `myrealm`)

## Generic OIDC Provider

For any OIDC-compliant provider:

1. Find the OpenID Configuration endpoint (usually `{issuer}/.well-known/openid-configuration`)
2. Get the `jwks_uri` from the configuration
3. Configure as follows:

```bash
DOMAIN=localhost:8443
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_CRYPTO_PASSPHRASE=$(openssl rand -hex 32)
OIDC_PROVIDER_JWKS_URI={jwks_uri from configuration}
OIDC_PROVIDER_METADATA_URL={issuer}/.well-known/openid-configuration
OIDC_REMOTE_USER=email
```

## Common OIDC_REMOTE_USER Values

The `OIDC_REMOTE_USER` variable specifies which claim from the OIDC token to use as the username:

- `email` - User's email address (most common)
- `sub` - Subject identifier (unique user ID)
- `preferred_username` - Preferred username
- `name` - Full name

Check your OIDC provider's token claims to see which are available.

## Troubleshooting

### Wrong redirect URI
**Error**: "redirect_uri_mismatch"
**Solution**: Ensure the redirect URI registered in your OIDC provider exactly matches: `https://{DOMAIN}/oidc/callback`

### Invalid JWKS URI
**Error**: Unable to verify token signature
**Solution**: Verify the JWKS URI returns a valid JSON Web Key Set

### Metadata URL not found
**Error**: 404 on metadata URL
**Solution**: Verify the OpenID Configuration endpoint is accessible and returns valid JSON

### Session/token errors
**Error**: Invalid session or token
**Solution**:
- Ensure `OIDC_CRYPTO_PASSPHRASE` is at least 32 characters (64 recommended)
- Clear browser cookies and try again
- Check that token hasn't expired

## Testing Discovery Endpoints

You can verify your OIDC provider configuration with curl:

```bash
# Test OpenID Configuration
curl https://accounts.google.com/.well-known/openid-configuration | jq

# Test JWKS endpoint
curl https://www.googleapis.com/oauth2/v3/certs | jq
```

Both should return valid JSON responses.
