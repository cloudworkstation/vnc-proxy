import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';

import Guacamole from 'guacamole-common-js';
import ModalBox from './ModalBox';
import axios from 'axios';

const TitleBar = styled.div`
  width: 100vw;
  background-color: black;
  height: 30px;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  color: white;
  align-items: center;

  input {
    vertical-align: middle;
  }

  p, label {
    margin: 0px;
    padding: 0px;
    font-family: Arial;
    font-size: 10pt;
    padding-left: 5px;
    padding-right: 5px;
  }

  p:first-child {
    padding-left: 10px;
  }

  button:last-child {
    margin-left: auto;
    margin-right: 10px;
  }
`

const Display = styled.div`
  width: 100vw;
  height: calc(100vh - 30px);
`

const HostList = styled.div`
  width: 400px;
  border: 1px solid darkgrey;
  padding: 2px;

  max-height: 100px;

  overflow-y: auto;

  ul {
    list-style-type: none;
    margin: 0px;
    padding: 0px;

    li:hover {
      background-color: lightgrey;
      cursor: pointer;
    }
  }
`

const HostListTitle = styled.p`
  font-weight: bold;
  margin: 0px;
  padding: 0px;
  margin-bottom: 10px;
`

const ClipboardPermissions = [
  { name: "clipboard-read" },
  { name: "clipboard-write" }
];

const DetectAPIAddress = (scheme) => {
  if(window.location.hostname === "localhost" && window.location.port === "3000") {
    // we are running locally, so assume we are needing to talk to tomcat on port 8080
    return `${scheme}://localhost:8080/workstation/`
  } else {
    // we are running against a remote server
    return "";
  }
}

// Guacamole status codes
const GUAC_STATUS = {
  CLIENT_UNAUTHORIZED: 0x0301,  // 769
  CLIENT_FORBIDDEN: 0x0303,     // 771
  SERVER_ERROR: 0x0200,         // 512
  SERVER_TIMEOUT: 0x0202,       // 514
  UPSTREAM_TIMEOUT: 0x0207,     // 519
  UPSTREAM_ERROR: 0x0208,       // 520
  RESOURCE_CLOSED: 0x0205,      // 517
  UPSTREAM_UNAVAILABLE: 0x020B  // 523
};

const RETRYABLE_ERRORS = [
  GUAC_STATUS.SERVER_ERROR,
  GUAC_STATUS.SERVER_TIMEOUT,
  GUAC_STATUS.UPSTREAM_TIMEOUT,
  GUAC_STATUS.UPSTREAM_ERROR,
  GUAC_STATUS.RESOURCE_CLOSED,
  GUAC_STATUS.UPSTREAM_UNAVAILABLE
];

const AUTH_ERRORS = [
  GUAC_STATUS.CLIENT_UNAUTHORIZED,
  GUAC_STATUS.CLIENT_FORBIDDEN
];

// Pre-flight check to detect OIDC redirects before WebSocket connection
const checkAuthStatus = async () => {
  try {
    // Try checking the clientconfig endpoint first (always exists in dynamic-config)
    const checkUrl = window.location.pathname.includes('workstation')
      ? `${window.location.pathname}clientconfig`
      : '/clientconfig';

    const response = await fetch(checkUrl, {
      method: 'GET',
      redirect: 'manual',  // Don't follow redirects automatically
      credentials: 'include'  // Include cookies for OIDC session
    });

    // Check if we got a redirect (302) - this means OIDC token expired
    if (response.type === 'opaqueredirect') {
      console.warn('Auth check detected redirect - OIDC token likely expired');
      return { authenticated: false, shouldRedirect: true };
    }

    // Check for explicit auth errors
    if (response.status === 401 || response.status === 403) {
      console.warn('Auth check failed with status:', response.status);
      return { authenticated: false, shouldRedirect: true };
    }

    // Connection successful (200 or 404 means we at least reached the backend)
    if (response.status === 200 || response.status === 404 || response.status === 0) {
      console.log('Auth check passed - backend accessible');
      return { authenticated: true, shouldRedirect: false };
    }

    // Unexpected status - could be network error, allow connection attempt
    console.warn('Auth check returned unexpected status:', response.status, '- proceeding anyway');
    return { authenticated: false, shouldRedirect: false };
  } catch (e) {
    console.error('Auth check failed with error:', e);
    // Network error - allow retry with backoff
    return { authenticated: false, shouldRedirect: false };
  }
};

// Popup-based re-authentication
const reauthenticateViaPopup = () => {
  return new Promise((resolve, reject) => {
    console.log('[Reauth] Opening popup for OIDC re-authentication');

    const clientConfigUrl = window.location.pathname.includes('workstation')
      ? `${window.location.pathname}clientconfig`
      : '/clientconfig';

    const popup = window.open(clientConfigUrl, 'oidc-reauth', 'width=500,height=600,location=yes,scrollbars=yes');

    if (!popup) {
      console.error('[Reauth] Failed to open popup - may be blocked');
      reject(new Error('Popup blocked'));
      return;
    }

    // Poll the popup to detect when auth succeeds
    const pollInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(pollInterval);
          console.warn('[Reauth] Popup closed by user');
          reject(new Error('Popup closed'));
          return;
        }

        // Try to access popup location - will succeed when back on our domain
        const popupLocation = popup.location.href;
        if (popupLocation && popupLocation.includes(window.location.origin)) {
          // Successfully back on our domain - auth succeeded
          console.log('[Reauth] Authentication successful!');

          // Replace popup content with friendly message
          try {
            popup.document.body.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <div style="text-align: center;">
                  <h2 style="color: #4CAF50;">✓ Authentication Successful</h2>
                  <p>This window will close automatically...</p>
                </div>
              </div>
            `;
          } catch (e) {
            console.warn('[Reauth] Could not update popup content:', e);
          }

          clearInterval(pollInterval);
          setTimeout(() => popup.close(), 2000); // Show success message for 2 seconds
          resolve();
        }
      } catch (e) {
        // Cross-origin error - popup is still on OIDC provider, keep polling
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!popup.closed) {
        clearInterval(pollInterval);
        popup.close();
        console.error('[Reauth] Popup timeout - authentication took too long');
        reject(new Error('Popup timeout'));
      }
    }, 300000);
  });
};

const GuacClient = (props) => {
  const displayRef = useRef(null);
  const guac = useRef(null);

  const displayObserver = useRef(
    new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setLocalDisplayRect({
        width: width,
        height: height
      });
    })
  )

  const [mode, setMode] = useState("SINGLE");
  const [listOfHosts, setListOfHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState({});
  const [shouldConnect, setShouldConnect] = useState(false);
  const [showHostSelector, setShowHostSelector] = useState(false);

  const [displayRect, setDisplayRect] = useState({x: 0, y: 0});
  const [localDisplayRect, setLocalDisplayRect] = useState({width: 0, height: 0});
  const [scaleFactor, setScaleFactor] = useState(1);
  const [conState, setConState] = useState("Idle");

  // Reconnection state machine
  const ReconnectState = {
    CONNECTED: 'CONNECTED',
    DISCONNECTED: 'DISCONNECTED',
    RECONNECTING: 'RECONNECTING',
    CHECKING_AUTH: 'CHECKING_AUTH',
    REAUTHING: 'REAUTHING',
    FAILED: 'FAILED'
  };

  const [reconnectState, _setReconnectState] = useState(ReconnectState.DISCONNECTED);
  const reconnectStateRef = useRef(reconnectState);
  const setReconnectState = data => {
    reconnectStateRef.current = data;
    _setReconnectState(data);
  };

  const [reconnectAttempt, _setReconnectAttempt] = useState(0);
  const reconnectAttemptRef = useRef(reconnectAttempt);
  const setReconnectAttempt = data => {
    reconnectAttemptRef.current = data;
    _setReconnectAttempt(data);
  };

  const reconnectTimerRef = useRef(null);
  const lastErrorRef = useRef(null);

  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  const maxReconnectDelay = 30000; // 30 seconds

  // Session timer - tracks time since last successful connection
  const [sessionTime, setSessionTime] = useState(0);
  const sessionStartTimeRef = useRef(null);
  const sessionTimerIntervalRef = useRef(null);

  // ref allows this state item to be accessed inside an event listener
  const [clipboardEnabled, _setClipboardEnabled] = useState(false);
  const clipboardEnabledRef = useRef(clipboardEnabled);
  const setClipboardEnabled = data => {
    clipboardEnabledRef.current = data;
    _setClipboardEnabled(data);
  };

  const RemoteResize = (x, y) => {
    setDisplayRect(
      {
        x: x,
        y: y
      }
    );
  }

  const GetClipboardPermissions = () => {
    ClipboardPermissions.forEach(p => {
      navigator.permissions.query(p)
      .then(r => {
        if(p.name === "clipboard-read" && r.state === "prompt") {
          navigator.clipboard.readText();
        }
      });
    });
  }

  useEffect(() => {
    if(clipboardEnabled) {
      GetClipboardPermissions();
    }
  }, [clipboardEnabled]);

  useEffect(() => {
    SetDisplayScale();
  }, [displayRect])

  useEffect(() => {
    SetDisplayScale();
  })

  const SetDisplayScale = () => {
    const localDisplayRect = displayRef.current.getBoundingClientRect();
    if(displayRect.x > 0) {
      if(localDisplayRect.width >= displayRect.x && localDisplayRect.height >= displayRect.y) {
        if(scaleFactor !== 1) {
          setScaleFactor(1);
        }
      } else {
        let factor = Math.min(localDisplayRect.width / displayRect.x, localDisplayRect.height / displayRect.y);
        setScaleFactor(factor);
      }
    }
  }

  useEffect(() => {
    if(guac.current) {
      guac.current.getDisplay().scale(scaleFactor);
    }
  }, [scaleFactor]);

  const ConnStateUpdate = (state) => {
    switch (state) {
      case 0:
        setConState("Idle");
        break;
      case 1:
        setConState("Connecting...");
        break;
      case 2:
        setConState("Waiting...");
        break;
      case 3:
        setConState("Connected");
        break;
      case 4:
        setConState("Disconnecting");
        break;
      case 5:
        setConState("Disconnected");
        break;
      default:
        setConState("Unknown");
        break;
    }
  }

  const getBlob = (stream, mimetype) => {
    return new Promise((resolve, reject) => {
      const reader = new Guacamole.BlobReader(stream, mimetype);
      reader.onend = () => {
        resolve(reader.getBlob());
      };
      reader.onerror = () => {
        reject(new Error('Failed to read clipboard blob from remote'));
      };
    });
  }

  const SendToLocalClipboard = async (blob, mimetype) => {
    if(clipboardEnabledRef.current) {
      try {
        await navigator.clipboard.write([
          new window.ClipboardItem({
            [mimetype]: blob
          })
        ]);
      } catch (error) {
        console.error("Failed to write to local clipboard:", error);
      }
    }
  }

  const HandleRemoteClipboard = async (stream, mimetype) => {
    await getBlob(stream, mimetype)
    .then(async blob => {
      SendToLocalClipboard(blob, mimetype);
    })
    .catch(e => {
      console.error("Error getting blob from remote clipboard:", e);
    });
  }

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read blob as base64'));
      reader.readAsDataURL(blob);
    });
  }

  const sendBlobBasedOnMimeType = async (item, mimeType) => {
    try {
      const blob = await item.getType(mimeType);
      const blobAsDataUrl = await blobToBase64(blob);
      const blobAsB64 = blobAsDataUrl.split(",")[1];

      console.log(`Sending ${blobAsB64.length} bytes to remote clipboard (type: ${mimeType})`);

      const stream = guac.current.createClipboardStream(mimeType, "remote");

      stream.onerror = (error) => {
        console.error("Clipboard stream error:", error);
      }

      // Send the blob
      stream.sendBlob(blobAsB64);

      // Close the stream immediately after sending
      stream.sendEnd();
      console.log('Clipboard stream sent and closed');

    } catch (error) {
      console.error("Failed to send blob to remote:", error);
      throw error;
    }
  }

  const MimeOrder = ['text/plain', 'text/html'];

  const SendToRemoteClipboard = async () => {
    try {
      console.log('Reading local clipboard...');
      const items = await navigator.clipboard.read();
      console.log(`Read ${items.length} clipboard items`);

      if(items.length > 0) {
        const item = items[0];
        const itemTypes = item.types;
        console.log('Available MIME types:', itemTypes);

        if(itemTypes.length >  1) {
          const typeToSend = itemTypes.map(i => MimeOrder.indexOf(i)).reduce((p, c) => Math.max(p, c), -1);
          if(typeToSend !== -1) {
            console.log(`Sending type: ${MimeOrder[typeToSend]}`);
            await sendBlobBasedOnMimeType(item, MimeOrder[typeToSend]);
            console.log('Clipboard sent successfully');
          }
        } else {
          console.log(`Sending type: ${itemTypes[0]}`);
          await sendBlobBasedOnMimeType(item, itemTypes[0]);
          console.log('Clipboard sent successfully');
        }
      } else {
        console.log('No clipboard items found');
      }
    } catch (error) {
      console.error("Failed to send to remote clipboard:", error);
    }
  }

  // Start session timer
  const startSessionTimer = React.useCallback(() => {
    // Clear any existing timer
    if (sessionTimerIntervalRef.current) {
      clearInterval(sessionTimerIntervalRef.current);
    }

    // Record start time
    sessionStartTimeRef.current = Date.now();
    setSessionTime(0);

    // Update every second
    sessionTimerIntervalRef.current = setInterval(() => {
      if (sessionStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        setSessionTime(elapsed);
      }
    }, 1000);

    console.log('[Timer] Session timer started');
  }, []);

  // Stop session timer
  const stopSessionTimer = React.useCallback(() => {
    if (sessionTimerIntervalRef.current) {
      clearInterval(sessionTimerIntervalRef.current);
      sessionTimerIntervalRef.current = null;
    }
    sessionStartTimeRef.current = null;
    console.log('[Timer] Session timer stopped');
  }, []);

  // Format seconds as HH:MM:SS
  const formatSessionTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const classifyError = (statusCode) => {
    if (AUTH_ERRORS.includes(statusCode)) {
      return 'auth';
    } else if (RETRYABLE_ERRORS.includes(statusCode)) {
      return 'retryable';
    } else {
      return 'unknown';
    }
  };

  const getReconnectDelay = (attempt) => {
    return Math.min(baseReconnectDelay * Math.pow(2, attempt), maxReconnectDelay);
  };

  // Schedule a reconnection attempt with backoff
  const scheduleReconnectAttempt = React.useCallback((attempt) => {
    const delay = getReconnectDelay(attempt);
    console.log(`[Coordinator] Scheduling attempt ${attempt + 1}/${maxReconnectAttempts} in ${delay}ms`);

    reconnectTimerRef.current = setTimeout(() => {
      executeReconnectAttempt(attempt);
    }, delay);
  }, []);

  // Execute a single reconnection attempt
  const executeReconnectAttempt = React.useCallback(async (attempt) => {
    console.log(`[Coordinator] Executing attempt ${attempt + 1}/${maxReconnectAttempts}`);

    // Step 1: Check authentication
    setReconnectState(ReconnectState.CHECKING_AUTH);
    const authStatus = await checkAuthStatus();

    if (authStatus.shouldRedirect) {
      // Auth expired - need to reauth
      console.log('[Coordinator] Auth expired, starting reauth flow');
      setReconnectState(ReconnectState.REAUTHING);
      setConState('Re-authenticating...');

      try {
        await reauthenticateViaPopup();
        console.log('[Coordinator] Reauth successful, attempting connection');

        // After reauth, try to connect
        setReconnectState(ReconnectState.RECONNECTING);
        if (guac.current) {
          guac.current.connect();
        }

        // Tunnel state handler will call us back if connection fails

      } catch (reauthError) {
        console.error('[Coordinator] Reauth failed:', reauthError);

        // Reauth failed - treat as a failed attempt and retry
        const nextAttempt = attempt + 1;
        if (nextAttempt >= maxReconnectAttempts) {
          setReconnectState(ReconnectState.FAILED);
          setConState('Re-authentication failed - Max retries exceeded');
        } else {
          // Retry the whole process (including auth check)
          setReconnectAttempt(nextAttempt);
          scheduleReconnectAttempt(nextAttempt);
        }
      }

    } else {
      // Auth is OK - just reconnect
      console.log('[Coordinator] Auth OK, attempting connection');
      setReconnectState(ReconnectState.RECONNECTING);

      if (guac.current) {
        guac.current.connect();
      }

      // Tunnel state handler will call us back if connection fails
    }
  }, [ReconnectState, scheduleReconnectAttempt, setReconnectState, setConState, setReconnectAttempt, maxReconnectAttempts]);

  // Central reconnection coordinator
  const reconnectionCoordinator = React.useCallback((trigger, errorInfo = null) => {
    console.log(`[Coordinator] Triggered by: ${trigger}, Current state: ${reconnectStateRef.current}`);

    // Cancel any pending reconnection timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Update error info if provided
    if (errorInfo) {
      lastErrorRef.current = errorInfo;
    }

    const currentState = reconnectStateRef.current;

    // State-based decision making
    switch (currentState) {
      case ReconnectState.CONNECTED:
        // Connection just dropped - start reconnection
        console.log('[Coordinator] Connection lost, starting reconnection');
        setReconnectState(ReconnectState.CHECKING_AUTH);
        setReconnectAttempt(0);
        scheduleReconnectAttempt(0);
        break;

      case ReconnectState.RECONNECTING:
        // A reconnection attempt failed - continue sequence
        const nextAttempt = reconnectAttemptRef.current + 1;

        if (nextAttempt >= maxReconnectAttempts) {
          console.error('[Coordinator] Max retries exceeded');
          setReconnectState(ReconnectState.FAILED);
          setConState('Disconnected - Max retries exceeded');
          return;
        }

        console.log(`[Coordinator] Attempt ${reconnectAttemptRef.current} failed, scheduling attempt ${nextAttempt}`);
        setReconnectAttempt(nextAttempt);
        scheduleReconnectAttempt(nextAttempt);
        break;

      case ReconnectState.CHECKING_AUTH:
      case ReconnectState.REAUTHING:
        // Already handling auth or reconnection - ignore duplicate triggers
        console.log('[Coordinator] Already handling reconnection, ignoring duplicate trigger');
        break;

      case ReconnectState.FAILED:
        // In failed state - only manual reconnect can restart
        console.log('[Coordinator] In failed state, ignoring trigger');
        break;

      case ReconnectState.DISCONNECTED:
        // Not connected and not trying - this shouldn't happen from a trigger
        console.warn('[Coordinator] Triggered from DISCONNECTED state - starting reconnection');
        setReconnectState(ReconnectState.CHECKING_AUTH);
        setReconnectAttempt(0);
        scheduleReconnectAttempt(0);
        break;

      default:
        console.warn('[Coordinator] Unknown state:', currentState);
        break;
    }
  }, [ReconnectState, setReconnectState, setReconnectAttempt, scheduleReconnectAttempt, setConState, maxReconnectAttempts]);

  useEffect(() => {
    axios.get(`${DetectAPIAddress("http")}clientconfig`)
      .then((resp) => {
        if(resp.data.mode === "PASS_THROUGH") {
          setMode(resp.data.mode);
          setListOfHosts(resp.data.availableHosts);
          if(resp.data.availableHosts.length === 1) {
            setSelectedHost(resp.data.availableHosts[0]);
            setShouldConnect(true);
          } else {
            setListOfHosts(resp.data.availableHosts);
            setShowHostSelector(true);
          }
        } else {
          if(resp.data.mode === "SINGLE") {
            setMode(resp.data.mode);
            setShouldConnect(true);
          }
        }
      })
      .catch((error) => {
        console.error("Error calling clientconfig API:", error);
      })
  }, [])

  useEffect(() => {
    const initConnection = async () => {
      // Pre-flight auth check before initial connection
      const authStatus = await checkAuthStatus();

      if (authStatus.shouldRedirect) {
        console.warn('Initial auth check failed - re-authenticating via popup');
        setConState('Re-authenticating...');
        setReconnectState(ReconnectState.REAUTHING);
        try {
          await reauthenticateViaPopup();
        } catch (error) {
          console.error('[Reauth] Failed:', error);
          setConState('Re-authentication failed - please refresh page');
          setReconnectState(ReconnectState.FAILED);
          return;
        }
      }

      // create WebSocket tunnel
      let tunnel;
      if(mode === "SINGLE") {
        tunnel = new Guacamole.WebSocketTunnel(`${DetectAPIAddress("ws")}websocket-tunnel/__DEFAULT__`);
      } else {
        tunnel = new Guacamole.WebSocketTunnel(`${DetectAPIAddress("ws")}websocket-tunnel/${selectedHost.hostName}`);
      }

      // Track if tunnel was ever successfully opened
      let tunnelWasOpen = false;

      // Monitor tunnel state changes
      tunnel.onstatechange = (state) => {
        // Tunnel states: CONNECTING=0, OPEN=1, CLOSED=2, UNSTABLE=3
        if (state === Guacamole.Tunnel.State.OPEN) {
          console.log('[Tunnel] Connection opened');
          tunnelWasOpen = true;

          // Success! Reset to connected state
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          setReconnectState(ReconnectState.CONNECTED);
          setReconnectAttempt(0);
          setConState('Connected');

          // Start session timer
          startSessionTimer();

        } else if (state === Guacamole.Tunnel.State.CLOSED) {
          console.log('[Tunnel] Connection closed');

          // Stop session timer
          stopSessionTimer();

          // Only trigger reconnection if we were previously connected
          if (tunnelWasOpen) {
            const currentState = reconnectStateRef.current;

            if (currentState === ReconnectState.CONNECTED) {
              // This is an unexpected disconnect - start reconnection
              reconnectionCoordinator('tunnel-closed');

            } else if (currentState === ReconnectState.RECONNECTING) {
              // This was a reconnection attempt that failed - tell coordinator
              reconnectionCoordinator('reconnect-failed');

            }
            // If in CHECKING_AUTH or REAUTHING state, coordinator is already handling it
          }
        }
      };

      // Monitor tunnel errors - just log, let state handler trigger reconnection
      tunnel.onerror = (status) => {
        const statusCode = status?.code;
        console.log('[Tunnel] Error:', statusCode);

        if (statusCode && AUTH_ERRORS.includes(statusCode)) {
          lastErrorRef.current = { type: 'auth', code: statusCode };
        }
        // Don't trigger coordinator - let state handler do it when tunnel closes
      };

      // Store tunnel reference for later WebSocket monitoring
      const tunnelRef = tunnel;

      // create guac client with tunnel
      guac.current = new Guacamole.Client(tunnel);

      // attach to canvas
      displayRef.current.appendChild(guac.current.getDisplay().getElement());

      // register error handler - just log, let state handler trigger reconnection
      guac.current.onerror = (status) => {
        const statusCode = status?.code;
        console.log('[Client] Error:', statusCode);

        if (statusCode) {
          const errorType = classifyError(statusCode);
          lastErrorRef.current = { type: errorType, code: statusCode };
        }
        // Don't trigger coordinator - let state handler do it when tunnel closes
      }

      // register disconnect handler
      window.onunload = () => {
        guac.current.disconnect();
      }

      // register remote resize
      guac.current.getDisplay().onresize = RemoteResize;

      // register local resize
      displayObserver.current.observe(displayRef.current);

      // register state change handler - just updates UI
      guac.current.onstatechange = (state) => {
        ConnStateUpdate(state);

        if (state === 3) { // Connected
          console.log('[Client] State: Connected');
        }

        // Note: Reconnection is handled by tunnel.onstatechange and coordinator
        // This handler only updates the UI state
      }

      // register remote clipboard handler
      guac.current.onclipboard = HandleRemoteClipboard

      // connect
      guac.current.connect();

      // register mouse handler
      let mouse  = new Guacamole.Mouse(guac.current.getDisplay().getElement());
      mouse.onmousedown =
      mouse.onmouseup =
      mouse.onmousemove = (mouseState) => {
        const scale = guac.current.getDisplay().getScale();
        const scaledState = new Guacamole.Mouse.State(
          mouseState.x / scale,
          mouseState.y / scale,
          mouseState.left,
          mouseState.middle,
          mouseState.right,
          mouseState.up,
          mouseState.down
        );
        guac.current.sendMouseState(scaledState);
      }

      // register keyboard handler
      let keyboard = new Guacamole.Keyboard(document);
      keyboard.onkeydown = (keysym) => {
        guac.current.sendKeyEvent(1, keysym);
        if(keysym === 32) {
          return false;
        }
      }
      keyboard.onkeyup = (keysym) => {
        guac.current.sendKeyEvent(0, keysym);
      }

      // Cleanup on unmount
      return () => {
        if (keyboard) {
          keyboard.reset();
        }
        if (guac.current) {
          guac.current.disconnect();
        }
        // Stop session timer
        stopSessionTimer();
      };
    };

    if(shouldConnect) {
      initConnection();
    }
  }, [shouldConnect, stopSessionTimer])

  const connect = (host) => {
    setSelectedHost(host);
    setShowHostSelector(false);
    setShouldConnect(true);
  }

  return (
    <div>
      <TitleBar>
        <p>{conState}</p>
        {reconnectState === ReconnectState.CONNECTED && (
          <p style={{color: '#4CAF50'}}>
            Session: {formatSessionTime(sessionTime)}
          </p>
        )}
        {(reconnectState === ReconnectState.RECONNECTING ||
          reconnectState === ReconnectState.CHECKING_AUTH ||
          reconnectState === ReconnectState.REAUTHING) && (
          <p style={{color: '#ffa500'}}>
            {reconnectState === ReconnectState.REAUTHING ? 'Re-authenticating...' : `Reconnecting... (${reconnectAttempt + 1}/${maxReconnectAttempts})`}
          </p>
        )}
        {mode === "PASS_THROUGH" && shouldConnect && <p>{selectedHost.hostName} {selectedHost.protocol}</p>}
        <p>{`${displayRect.x} x ${displayRect.y}`}</p>
        <p>(x{Math.round(scaleFactor * 100) / 100})</p>
        <div>
          <input
           id="ce"
           type="checkbox"
           checked={clipboardEnabled}
           onChange={(e) => { setClipboardEnabled(e.target.checked) }}
          />
          <label htmlFor="ce">Clipboard enabled</label>
        </div>
        <button disabled={!clipboardEnabled} onClick={SendToRemoteClipboard}>Copy to remote clipboard</button>
        <p></p>
        <button
          disabled={reconnectState === ReconnectState.CONNECTED ||
                    reconnectState === ReconnectState.RECONNECTING ||
                    reconnectState === ReconnectState.REAUTHING ||
                    reconnectState === ReconnectState.CHECKING_AUTH}
          onClick={() => {
            console.log('[Manual] User triggered reconnect');

            // Cancel any existing timers
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }

            // Reset state and start fresh
            setReconnectState(ReconnectState.CHECKING_AUTH);
            setReconnectAttempt(0);
            lastErrorRef.current = null;

            // Start reconnection
            scheduleReconnectAttempt(0);
          }}
        >
          Reconnect
        </button>
      </TitleBar>
      <Display
        ref={displayRef} 
      />
      <ModalBox
        show={showHostSelector}
      >
        <HostListTitle>Select a host to connect to:</HostListTitle>
        {listOfHosts.length > 0 && <HostList>
          <ul>
            {
              listOfHosts.map(host => <li key={`host_${host.hostName}`} onClick={connect.bind(null, host)}>{host.hostName} ({host.protocol} {host.host}:{host.port})</li>)
            }
          </ul>
        </HostList>}
        {listOfHosts.length === 0 && <p>No hosts are available for you</p>}
      </ModalBox>
    </div>
  )
}

export default GuacClient;