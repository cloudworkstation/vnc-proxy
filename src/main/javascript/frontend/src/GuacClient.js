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
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isReconnecting, _setIsReconnecting] = useState(false);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  const maxReconnectDelay = 30000; // 30 seconds

  // ref allows reconnection state to be accessed inside event listeners
  const isReconnectingRef = useRef(isReconnecting);
  const setIsReconnecting = data => {
    isReconnectingRef.current = data;
    _setIsReconnecting(data);
  };

  const reconnectAttemptRef = useRef(reconnectAttempt);
  const setReconnectAttemptWithRef = data => {
    reconnectAttemptRef.current = data;
    setReconnectAttempt(data);
  };

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

  const attemptReconnect = async (attempt) => {
    if (attempt >= maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      setIsReconnecting(false);
      setConState("Disconnected - Max retries exceeded");
      return;
    }

    const delay = getReconnectDelay(attempt);
    console.log(`Reconnect attempt ${attempt + 1}/${maxReconnectAttempts} in ${delay}ms`);
    setConState("Connecting...");

    setTimeout(async () => {
      // Pre-flight auth check before WebSocket connection
      const authStatus = await checkAuthStatus();

      if (authStatus.shouldRedirect) {
        console.log('Auth expired - re-authenticating via popup');
        setConState('Re-authenticating...');
        try {
          await reauthenticateViaPopup();
          // Auth succeeded, retry connection
          if (guac.current) {
            guac.current.connect();
          }
        } catch (error) {
          console.error('[Reauth] Failed:', error);
          setConState('Re-authentication failed - please refresh page');
        }
        return;
      }

      // Auth OK, attempt WebSocket connection
      if (guac.current) {
        guac.current.connect();
      }
    }, delay);
  };

  const Reconnect = () => {
    guac.current.connect();
  }

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
        try {
          await reauthenticateViaPopup();
        } catch (error) {
          console.error('[Reauth] Failed:', error);
          setConState('Re-authentication failed - please refresh page');
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

      // Track previous tunnel state to detect transitions
      let previousTunnelState = null;
      let tunnelWasOpen = false;

      // Monitor tunnel state changes
      tunnel.onstatechange = (state) => {
        // Tunnel states: CONNECTING=0, OPEN=1, CLOSED=2, UNSTABLE=3
        if (state === Guacamole.Tunnel.State.OPEN) {
          tunnelWasOpen = true;

          // Reset reconnection state on successful connection
          if (isReconnectingRef.current) {
            setIsReconnecting(false);
            setReconnectAttemptWithRef(0);
          }
        } else if (state === Guacamole.Tunnel.State.CLOSED) {
          // If we were previously open, we need to reconnect
          if (tunnelWasOpen) {
            if (!isReconnectingRef.current) {
              console.log('[Tunnel] Connection dropped - starting reconnection');
              setIsReconnecting(true);
              setReconnectAttemptWithRef(0);
              attemptReconnect(0);
            } else {
              // Already reconnecting - this is a failed reconnect attempt
              const nextAttempt = reconnectAttemptRef.current + 1;
              setReconnectAttemptWithRef(nextAttempt);
              attemptReconnect(nextAttempt);
            }
          }
        }

        previousTunnelState = state;
      };

      // Monitor tunnel errors for auth detection
      // Reconnection is handled by the tunnel state CLOSED handler to avoid duplicates
      tunnel.onerror = (status) => {
        const statusCode = status && status.code ? status.code : null;

        if (statusCode !== null) {
          const errorType = classifyError(statusCode);

          // Only handle auth errors here - retryable errors will be handled by CLOSED state
          if (errorType === 'auth') {
            console.warn('[Tunnel] Authentication error - checking auth status');
            checkAuthStatus().then(async authStatus => {
              if (authStatus.shouldRedirect) {
                setConState('Re-authenticating...');
                try {
                  await reauthenticateViaPopup();
                  if (guac.current) {
                    guac.current.connect();
                  }
                } catch (error) {
                  console.error('[Reauth] Failed:', error);
                  setConState('Re-authentication failed');
                }
              }
            });
          }
        }
      };

      // Store tunnel reference for later WebSocket monitoring
      const tunnelRef = tunnel;

      // create guac client with tunnel
      guac.current = new Guacamole.Client(tunnel);

      // attach to canvas
      displayRef.current.appendChild(guac.current.getDisplay().getElement());

      // register error handler
      guac.current.onerror = async (status) => {
        const statusCode = status && status.code ? status.code : null;

        if (statusCode !== null) {
          const errorType = classifyError(statusCode);

          if (errorType === 'auth') {
            console.warn("Authentication error - checking auth status");
            const authStatus = await checkAuthStatus();
            if (authStatus.shouldRedirect) {
              setConState('Re-authenticating...');
              try {
                await reauthenticateViaPopup();
                setIsReconnecting(true);
                setReconnectAttemptWithRef(0);
                attemptReconnect(0);
              } catch (error) {
                console.error('[Reauth] Failed:', error);
                setIsReconnecting(false);
                setConState("Re-authentication failed");
              }
            } else {
              setIsReconnecting(false);
              setConState("Disconnected - Authentication Error");
            }
          } else if (errorType === 'retryable' && !isReconnectingRef.current) {
            setIsReconnecting(true);
            setReconnectAttemptWithRef(0);
            attemptReconnect(0);
          } else if (errorType === 'unknown') {
            // Unknown error could be auth failure (WebSocket upgrade returned 302)
            console.warn("Unknown error - checking if auth expired");
            const authStatus = await checkAuthStatus();
            if (authStatus.shouldRedirect) {
              setConState('Re-authenticating...');
              try {
                await reauthenticateViaPopup();
                setIsReconnecting(true);
                setReconnectAttemptWithRef(0);
                attemptReconnect(0);
              } catch (error) {
                console.error('[Reauth] Failed:', error);
                setConState("Re-authentication failed");
              }
            }
          }
        }
      }

      // register disconnect handler
      window.onunload = () => {
        guac.current.disconnect();
      }

      // register remote resize
      guac.current.getDisplay().onresize = RemoteResize;

      // register local resize
      displayObserver.current.observe(displayRef.current);

      // register state change handler
      guac.current.onstatechange = (state) => {
        ConnStateUpdate(state);

        if (state === 3) { // Connected
          setReconnectAttemptWithRef(0);
          setIsReconnecting(false);
        }

        // State 4 = DISCONNECTING, State 5 = DISCONNECTED
        if (state === 4 || state === 5) {
          if (isReconnectingRef.current) {
            const nextAttempt = reconnectAttemptRef.current + 1;
            setReconnectAttemptWithRef(nextAttempt);
            attemptReconnect(nextAttempt);
          } else if (reconnectAttemptRef.current < maxReconnectAttempts) {
            setIsReconnecting(true);
            setReconnectAttemptWithRef(0);
            attemptReconnect(0);
          }
        }
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
      };
    };

    if(shouldConnect) {
      initConnection();
    }
  }, [shouldConnect])

  const connect = (host) => {
    setSelectedHost(host);
    setShowHostSelector(false);
    setShouldConnect(true);
  }

  return (
    <div>
      <TitleBar>
        <p>{conState}</p>
        {isReconnecting && (
          <p style={{color: '#ffa500'}}>
            Reconnecting... ({reconnectAttempt}/{maxReconnectAttempts})
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
          disabled={conState === "Connected" || isReconnecting}
          onClick={async () => {
            setReconnectAttemptWithRef(0);
            setIsReconnecting(false);

            // Check auth before manual reconnect
            const authStatus = await checkAuthStatus();
            if (authStatus.shouldRedirect) {
              console.warn('Manual reconnect: Auth expired - re-authenticating via popup');
              setConState('Re-authenticating...');
              try {
                await reauthenticateViaPopup();
                Reconnect();
              } catch (error) {
                console.error('[Reauth] Failed:', error);
                setConState('Re-authentication failed');
              }
              return;
            }

            Reconnect();
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