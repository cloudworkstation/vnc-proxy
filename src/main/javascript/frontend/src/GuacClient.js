import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';

import { Client, WebSocketTunnel, Mouse, Keyboard, BlobReader } from 'guacamole-common-js';
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
    return `${scheme}://localhost:8080/workstation-0.0.1/`
  } else {
    // we are running against a remote server
    return "";
  }
}

const GuacClient = (props) => {
  const displayRef = useRef(null);
  const guac = useRef(null);

  const displayObserver = useRef(
    new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      console.log(`resized display local element ${width} x ${height}`, displayRect);
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

  // ref allows this state item to be accessed inside an event listener
  const [clipboardEnabled, _setClipboardEnabled] = useState(false);
  const clipboardEnabledRef = useRef(clipboardEnabled);
  const setClipboardEnabled = data => {
    clipboardEnabledRef.current = data;
    _setClipboardEnabled(data);
  };

  const RemoteResize = (x, y) => {
    console.log(`remote resize ${x} x ${y}`)
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
        console.log("permissions", p, r.state);
        if(p.name === "clipboard-read" && r.state === "prompt") {
          navigator.clipboard.readText();
        }
      });
    });
  }

  useEffect(() => {
    console.log("clipboard enabled", clipboardEnabled);
    if(clipboardEnabled) {
      GetClipboardPermissions();
    }
  }, [clipboardEnabled]); 

  useEffect(() => {
    console.log("display rect", displayRect);
    SetDisplayScale();
  }, [displayRect])

  useEffect(() => {
    console.log("local display rect", localDisplayRect);
    SetDisplayScale();
  })

  const SetDisplayScale = () => {
    const localDisplayRect = displayRef.current.getBoundingClientRect();
    console.log('scaling', localDisplayRect, displayRect);
    if(displayRect.x > 0) {
      if(localDisplayRect.width >= displayRect.x && localDisplayRect.height >= displayRect.y) {
        console.log("no scaling needed");
        if(scaleFactor !== 1) {
          setScaleFactor(1);
        }
      } else {
        console.log("need to scale");
        let factor = Math.min(localDisplayRect.width / displayRect.x, localDisplayRect.height / displayRect.y);
        setScaleFactor(factor);
      }
    }
  }

  useEffect(() => {
    console.log(`updating scale ${scaleFactor}`);
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
      case 5:
        setConState("Disconnected");
        break;
      default:
        break;
    }
  }

  const getBlob = (stream, mimetype) => {
    return new Promise((resolve, reject) => {
      const reader = new BlobReader(stream, mimetype);
      reader.onend = () => {
        resolve(reader.getBlob());
      };
    });
  }

  const SendToLocalClipboard = (blob, mimetype) => {
    console.log("sending to clipboard", clipboardEnabledRef.current);
    if(clipboardEnabledRef.current) {
      navigator.clipboard.write([
        new window.ClipboardItem({
          [mimetype]: blob
        })
      ]);
    } else {
      console.log("clipboard disabled");
    }
  }

  const HandleRemoteClipboard = async (stream, mimetype) => {
    console.log("remote clipboard fired type", mimetype);
    await getBlob(stream, mimetype)
    .then(async blob => {
      SendToLocalClipboard(blob, mimetype);
    })
    .catch(e => {
      console.log("error getting blob from clipboard");
    });
  }

  const blobToBase64 = (blob) => {
    return new Promise((res, _) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  const sendBlobBasedOnMimeType = async (item, mimeType) => {
    const blob = await item.getType(mimeType);
    const blobAsDataUrl = await blobToBase64(blob);
    const blobAsB64 = blobAsDataUrl.split(",")[1];
    console.log("size of b64 blob", blobAsB64.length);
    const stream = guac.current.createClipboardStream(mimeType, "remote");
    stream.onack = () => {
      stream.sendEnd();
    }
    stream.sendBlob(blobAsB64);
  }

  const MimeOrder = ['text/plain', 'text/html'];

  const SendToRemoteClipboard = async () => {
    // need to get the contents of the local clipboard
    const items = await navigator.clipboard.read();
    if(items.length > 0) {
      console.log("local clipboard has something");
      const item = items[0];
      const itemTypes = item.types;
      if(itemTypes.length >  1) {
        console.log("multiple types available", itemTypes);
        const typeToSend = itemTypes.map(i => MimeOrder.indexOf(i)).reduce((p, c) => Math.max(p, c), -1);
        console.log("got type to send of", typeToSend);
        if(typeToSend != -1) {
          console.log("type to send is", MimeOrder[typeToSend]);
          sendBlobBasedOnMimeType(item, MimeOrder[typeToSend]);
        } else {
          console.log("no compatible types on clipboard");
        }
      } else {
        // only one mimetype available
        console.log("Got a single mimetype from clipboard of", itemTypes[0]);
        sendBlobBasedOnMimeType(item, itemTypes[0]);
      }
    }
  }

  const Reconnect = () => {
    guac.current.connect();
  }

  useEffect(() => {
    // this is the page load
    // need to call client config API to see what kind of scenario this is
    axios.get(`${DetectAPIAddress("http")}clientconfig`)
      .then((resp) => {
        console.log("got response from config API", resp.data)
        if(resp.data.mode === "PASS_THROUGH") {
          setMode(resp.data.mode);
          setListOfHosts(resp.data.availableHosts);
          if(resp.data.availableHosts.length === 1) {
            console.log("only a single host provided, so connecting straight away");
            setSelectedHost(resp.data.availableHosts[0]);
            setShouldConnect(true);
          } else {
            console.log("we have multiple hosts to select from");
            setListOfHosts(resp.data.availableHosts);
            setShowHostSelector(true);
          }
        } else {
          if(resp.data.mode === "SINGLE") {
            console.log("in SINGLE MODE");
            setMode(resp.data.mode);
            setShouldConnect(true);
          }
        }
      })
      .catch((error) => {
        console.log("error calling clientconfig API", error);
      })
  }, [])

  useEffect(() => {
    if(shouldConnect) {
      console.log("starting....");

      // create guac client
      if(mode === "SINGLE") {
        console.log("in single mode, so just connecting to tunnel")
        guac.current = new Client(new WebSocketTunnel(`${DetectAPIAddress("ws")}websocket-tunnel/__DEFAULT__`));
      } else {
        console.log("in multi mode, using host", selectedHost);
        guac.current = new Client(new WebSocketTunnel(`${DetectAPIAddress("ws")}websocket-tunnel/${selectedHost.hostName}`));
      }

      // attach to canvas
      displayRef.current.appendChild(guac.current.getDisplay().getElement());
      // register error handler
      guac.current.onerror = (e) => {
        console.error("error from guac", e);
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
      guac.current.onstatechange = ConnStateUpdate

      // register remote clipboard handler
      guac.current.onclipboard = HandleRemoteClipboard
      
      // connect
      guac.current.connect();

      // register mouse handler
      let mouse  = new Mouse(guac.current.getDisplay().getElement());
      mouse.onmousedown = 
      mouse.onmouseup = 
      mouse.onmousemove = (mouseState) => {
        const scale = guac.current.getDisplay().getScale();
        const scaledState = new Mouse.State(
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
      let keyboard = new Keyboard(document);
      keyboard.onkeydown = (keysym) => {
        guac.current.sendKeyEvent(1, keysym);
        if(keysym === 32) {
          console.log("Space bar, swallowing event.")
          return false;
        }
        if(keysym === 17) {
          console.log("Ctrl has been pressed.")
        }
      }
      keyboard.onkeyup = (keysym) => {
        guac.current.sendKeyEvent(0, keysym);
      }
    }
  }, [shouldConnect])

  const connect = (host) => {
    console.log("connecting to host", host);
    setSelectedHost(host);
    setShowHostSelector(false);
    setShouldConnect(true);
  }

  return (
    <div>
      <TitleBar>
        <p>{conState}</p>
        {mode === "PASS_THROUGH" && shouldConnect && <p>{selectedHost.hostName} {selectedHost.protocol}</p>}
        <p>{`${displayRect.x} x ${displayRect.y}`}</p>
        <p>(x{Math.round(scaleFactor * 100) / 100})</p>
        <div>
          <input
           id="ce" 
           type="checkbox" 
           checked={clipboardEnabled}
           onChange={(e) => { console.log("checkbox", e.target.checked); setClipboardEnabled(e.target.checked) }}
          />
          <label htmlFor="ce">Clipboard enabled</label>
        </div>
        <button disabled={!clipboardEnabled} onClick={SendToRemoteClipboard}>Copy to remote clipboard</button>
        <p></p>
        <button disabled={conState === "Connected"} onClick={Reconnect}>Reconnect</button>
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