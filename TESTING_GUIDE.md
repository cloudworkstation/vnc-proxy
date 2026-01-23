# Testing Guide: Auth Timeout & Reconnection Features

This guide walks you through testing the new OIDC authentication timeout detection and auto-reconnection features.

## Prerequisites

- Docker Compose stack running (`docker-compose up -d`)
- Browser with Developer Tools (Chrome/Firefox/Safari)
- OIDC provider configured and working

## Overview of Features to Test

1. **Pre-flight Auth Check** - Validates authentication before WebSocket connection
2. **Auth Timeout Detection** - Detects expired OIDC tokens and redirects to login
3. **Auto-Reconnection** - Exponential backoff for network errors
4. **Manual Reconnect** - Auth check on manual reconnect button

---

## Test 1: Initial Connection (Happy Path)

### What it tests
Pre-flight auth check before initial WebSocket connection.

### Steps

1. **Open browser and access**: `https://localhost:8443`
   - Accept self-signed certificate warning if prompted

2. **Open Browser DevTools**:
   - Chrome/Edge: F12 or Cmd+Option+I (Mac)
   - Firefox: F12 or Cmd+Option+K (Mac)
   - Safari: Cmd+Option+C (Mac)

3. **Go to Console tab**

4. **Watch for messages**:
   ```
   Auth check passed
   creating client and connecting...
   ```

5. **You should be redirected to OIDC login**

6. **After login, you should see**:
   - Host selection modal (if multiple hosts in DynamoDB)
   - OR direct connection to VNC/RDP server

### What to verify
- ✅ No errors in console
- ✅ `Auth check passed` logged before connection
- ✅ Successful OIDC authentication
- ✅ Connection to VNC/RDP server

---

## Test 2: Token Expiry During Active Session

### What it tests
Automatic detection of expired OIDC tokens and redirect to login.

### Setup
You need a way to simulate token expiry. Options:

**Option A: Clear cookies (simulates expired token)**
```bash
# In browser DevTools > Application tab > Cookies
# Delete all cookies for localhost:8443
```

**Option B: Wait for actual token expiry**
```bash
# Check OIDC token lifetime
# Google: typically 1 hour
# Azure AD: configurable, default 1 hour
```

**Option C: Disconnect VNC to trigger reconnect**
```bash
# Stop guacd temporarily
docker-compose stop guacd
```

### Steps

1. **Connect to a VNC/RDP session** (from Test 1)

2. **Wait for connection to establish**
   - You should see the remote desktop

3. **Simulate token expiry** using one of the options above

4. **Force a disconnect**:
   - **Option A**: Stop guacd: `docker-compose stop guacd`
   - **Option B**: Kill VNC server temporarily
   - **Option C**: Wait for natural disconnect

5. **Watch Browser Console** for:
   ```
   Error from Guacamole: {code: xxxx, message: "..."}
   Unknown error - checking if auth expired
   Auth check detected redirect - OIDC token likely expired
   Auth expired (detected via unknown error) - redirecting
   Redirecting to login...
   ```

6. **Page should automatically reload**

7. **OIDC provider login screen should appear**

### What to verify
- ✅ Console shows "Auth check detected redirect"
- ✅ Console shows "Redirecting to login..."
- ✅ Page reloads automatically (no manual refresh needed)
- ✅ Redirected to OIDC login page
- ✅ After re-authentication, returns to VNC proxy

---

## Test 3: Network Error Auto-Reconnection

### What it tests
Exponential backoff reconnection for non-auth network errors.

### Steps

1. **Connect to a VNC/RDP session**

2. **Open Browser Console**

3. **Stop guacd** (simulates network error):
   ```bash
   docker-compose stop guacd
   ```

4. **Watch Console** for reconnection attempts:
   ```
   Retryable error detected - starting auto-reconnect
   Reconnect attempt 1/10 in 1000ms
   Reconnect attempt 2/10 in 2000ms
   Reconnect attempt 3/10 in 4000ms
   Reconnect attempt 4/10 in 8000ms
   Reconnect attempt 5/10 in 16000ms
   Reconnect attempt 6/10 in 30000ms  (capped at 30s)
   ```

5. **Watch UI** - Title bar should show:
   ```
   Reconnecting... (1/10)
   Reconnecting... (2/10)
   ...etc
   ```

6. **Restart guacd**:
   ```bash
   docker-compose start guacd
   ```

7. **Connection should succeed** on next attempt

8. **Watch Console**:
   ```
   Connection state: Connected
   ```

9. **UI should clear** reconnection indicator

### What to verify
- ✅ Exponential backoff delays (1s → 2s → 4s → 8s → 16s → 30s max)
- ✅ Reconnection counter in UI
- ✅ Orange warning text in title bar
- ✅ Automatic reconnection when guacd restarts
- ✅ Counter resets to 0 after successful connection
- ✅ "Connected" state displayed

---

## Test 4: Max Reconnection Attempts

### What it tests
Reconnection stops after max attempts.

### Steps

1. **Connect to VNC/RDP**

2. **Stop guacd**:
   ```bash
   docker-compose stop guacd
   ```

3. **Wait for all 10 reconnection attempts**
   - This takes ~2 minutes (1+2+4+8+16+30+30+30+30+30 seconds)

4. **Watch Console**:
   ```
   Reconnect attempt 10/10 in 30000ms
   Max reconnect attempts reached
   ```

5. **UI should show**:
   ```
   Disconnected - Max retries exceeded
   ```

6. **Reconnection should stop**

### What to verify
- ✅ Stops after exactly 10 attempts
- ✅ "Max retries exceeded" message
- ✅ No further reconnection attempts
- ✅ Manual "Reconnect" button enabled

---

## Test 5: Manual Reconnect with Valid Auth

### What it tests
Manual reconnect button with valid authentication.

### Steps

1. **Connect to VNC/RDP**

2. **Disconnect** (stop guacd or VNC server)

3. **Click "Reconnect" button**

4. **Watch Console**:
   ```
   Auth check passed
   ```

5. **Connection should attempt**

6. **If guacd is running, should reconnect**

### What to verify
- ✅ Pre-flight auth check runs before reconnect
- ✅ "Auth check passed" in console
- ✅ Connection attempt made
- ✅ Successful reconnection

---

## Test 6: Manual Reconnect with Expired Auth

### What it tests
Manual reconnect detects expired auth and redirects.

### Steps

1. **Connect to VNC/RDP**

2. **Clear browser cookies** (Application > Cookies > Delete all)

3. **Disconnect VNC** (stop guacd)

4. **Click "Reconnect" button**

5. **Watch Console**:
   ```
   Auth check detected redirect - OIDC token likely expired
   Auth expired - redirecting to OIDC login
   Redirecting to login...
   ```

6. **Page should reload and redirect to OIDC login**

### What to verify
- ✅ Pre-flight check detects expired auth
- ✅ "Auth check detected redirect" in console
- ✅ Redirects to OIDC login (no connection attempt)
- ✅ After re-auth, returns to VNC proxy

---

## Test 7: Clipboard Functionality (Sanity Check)

### What it tests
Existing clipboard features still work after changes.

### Steps

1. **Connect to VNC/RDP**

2. **Enable clipboard** (check the "Clipboard enabled" checkbox)

3. **Grant clipboard permissions** when prompted

4. **Copy text on remote desktop**

5. **Text should appear in local clipboard**

6. **Copy text locally**

7. **Click "Copy to remote clipboard"**

8. **Paste on remote desktop** - should show local text

### What to verify
- ✅ Clipboard checkbox works
- ✅ Browser prompts for clipboard permissions
- ✅ Remote → Local clipboard works
- ✅ Local → Remote clipboard works
- ✅ No errors in console

---

## Test 8: Multi-Host Selection (Dynamic Config)

### What it tests
DynamoDB host selection still works.

### Prerequisites
- DynamoDB table configured with multiple hosts
- AWS credentials in `.env`

### Steps

1. **Clear cookies and access app**

2. **After OIDC login, should see modal**:
   ```
   Select a host to connect to:
   - desktop-01 (vnc 192.168.1.100:5900)
   - windows-srv (rdp 192.168.1.101:3389)
   ...
   ```

3. **Click on a host**

4. **Should connect to that specific host**

5. **Check Console**:
   ```
   connecting to host {hostName: "desktop-01", ...}
   in multi mode, using host ...
   ```

### What to verify
- ✅ Host selection modal appears
- ✅ All hosts from DynamoDB shown
- ✅ Clicking host initiates connection
- ✅ Pre-flight auth check runs before connection
- ✅ Connection to correct host

---

## Monitoring & Debugging

### Browser Console Messages

**Success messages to look for:**
```
Auth check passed
creating client and connecting...
```

**Auth expiry detection:**
```
Auth check detected redirect - OIDC token likely expired
Auth expired (detected via unknown error) - redirecting
Redirecting to login...
```

**Auto-reconnection:**
```
Retryable error detected - starting auto-reconnect
Reconnect attempt X/10 in Yms
```

**Connection state changes:**
```
Connection state: Idle
Connection state: Connecting...
Connection state: Connected
Connection state: Disconnected
```

### Docker Logs

**Watch all services:**
```bash
docker-compose logs -f
```

**Watch specific service:**
```bash
docker-compose logs -f vnc-proxy
docker-compose logs -f oidc-rproxy
docker-compose logs -f guacd
```

**Look for in vnc-proxy logs:**
```
Auth check: X-Remote-User header present
Connecting to guacd
WebSocket connection established
```

**Look for in oidc-rproxy logs:**
```
OIDC authentication successful
Setting X-Remote-User header
Token expired, redirecting to OIDC provider
```

### Network Tab (DevTools)

**Watch WebSocket connections:**
1. DevTools > Network tab
2. Filter: WS (WebSocket)
3. Look for `/websocket-tunnel` connections

**Successful WebSocket:**
- Status: 101 Switching Protocols
- Type: websocket
- Size: (pending) or data transfer

**Failed WebSocket (auth expired):**
- Status: 302 Found (redirected)
- Console shows "opaqueredirect"

### Application Tab (DevTools)

**Check cookies:**
1. DevTools > Application tab
2. Storage > Cookies > https://localhost:8443
3. Look for OIDC session cookies

**Check Local Storage:**
- May contain session data
- Can clear to simulate clean session

---

## Common Issues & Solutions

### Issue: "Access denied: Authentication required"
**Cause**: OIDC token missing or invalid
**Solution**: Clear cookies, reload page, re-authenticate

### Issue: Connection loops/doesn't establish
**Cause**: guacd not running or not accessible
**Solution**:
```bash
docker-compose ps  # Check guacd is up
docker-compose logs guacd  # Check for errors
```

### Issue: "Max retries exceeded" immediately
**Cause**: guacd is down
**Solution**: `docker-compose start guacd`

### Issue: No reconnection attempts
**Cause**: Error classified as "unknown" instead of "retryable"
**Solution**: Check console for error code, may be auth error

### Issue: Clipboard doesn't work
**Cause**: Browser permissions not granted
**Solution**: Grant clipboard read/write permissions in browser

### Issue: Host selection modal doesn't appear
**Cause**:
- DynamoDB not configured
- AWS credentials invalid
- Only one host in table

**Solution**:
```bash
# Check logs
docker-compose logs vnc-proxy | grep -i dynamodb

# Verify AWS credentials
aws dynamodb scan --table-name vnc-hosts --region us-east-1
```

---

## Performance Testing

### Reconnection Timing

Test the exponential backoff is working correctly:

```
Attempt 1: ~1 second
Attempt 2: ~2 seconds  (wait ~1s)
Attempt 3: ~4 seconds  (wait ~2s)
Attempt 4: ~8 seconds  (wait ~4s)
Attempt 5: ~16 seconds (wait ~8s)
Attempt 6+: ~30 seconds (capped, wait ~16s first time)
```

### Auth Check Speed

Pre-flight auth checks should be fast:
- **Typical**: < 100ms
- **Acceptable**: < 500ms
- **Slow**: > 1 second (check network)

Monitor with:
```javascript
// In browser console
console.time('auth-check');
// Click reconnect
console.timeEnd('auth-check');
```

---

## Success Criteria

All tests should pass with:
- ✅ No errors in browser console (except expected error codes)
- ✅ Smooth authentication flow
- ✅ Automatic redirect on token expiry
- ✅ Exponential backoff reconnection
- ✅ Clean UI state transitions
- ✅ No manual page refresh required

## Next Steps After Testing

1. **Document any issues found**
2. **Test with real VNC/RDP servers**
3. **Test with multiple users**
4. **Test with different OIDC providers**
5. **Monitor performance in production-like environment**
6. **Set up monitoring/alerting**

---

## Questions or Issues?

Check logs, review console messages, and refer to:
- [TESTING.md](TESTING.md) - Setup and configuration
- [OIDC_PROVIDERS.md](OIDC_PROVIDERS.md) - OIDC provider setup
- [DYNAMODB_SETUP.md](DYNAMODB_SETUP.md) - DynamoDB configuration
