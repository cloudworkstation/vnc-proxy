package com.richardjameskendall.cloud.workstation;

import javax.websocket.Session;
import javax.websocket.server.ServerEndpoint;
import javax.websocket.EndpointConfig;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleSocket;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.InetGuacamoleSocket;
import org.apache.guacamole.net.SimpleGuacamoleTunnel;
import org.apache.guacamole.protocol.ConfiguredGuacamoleSocket;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.websocket.GuacamoleWebSocketTunnelEndpoint;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ServerEndpoint(value = "/websocket-tunnel", subprotocols = "guacamole")
public class CloudWorkstationGuacamoleWebsocketEndpoint 
  extends GuacamoleWebSocketTunnelEndpoint {

  private static Logger logger = LoggerFactory.getLogger(CloudWorkstationGuacamoleWebsocketEndpoint.class);

  @Override
  protected GuacamoleTunnel createTunnel(Session session, EndpointConfig endPConfig)
                            throws GuacamoleException {
    
    logger.info("In createTunnel...");

    logger.info("Target=" + System.getenv("HOST") + "; port=" + System.getenv("PORT") + "; user=" + System.getenv("USERNAME"));

    // Create our configuration
    GuacamoleConfiguration config = new GuacamoleConfiguration();
    config.setProtocol("vnc");
    config.setParameter("hostname", System.getenv("HOST"));
    config.setParameter("port", System.getenv("PORT"));
    config.setParameter("password", System.getenv("PASSWORD"));
    // add username if the environment variable is present
    String username = System.getenv("USERNAME");
    if(username != null) {
      logger.info("Username was found in environment");
      config.setParameter("username", username);
    }

    // Connect to guacd - everything is hard-coded here.
    GuacamoleSocket socket = new ConfiguredGuacamoleSocket(
            new InetGuacamoleSocket(System.getenv("GUACD_HOST"), 4822),
            config
    );

    // Return a new tunnel which uses the connected socket
    return new SimpleGuacamoleTunnel(socket);
  }


}

