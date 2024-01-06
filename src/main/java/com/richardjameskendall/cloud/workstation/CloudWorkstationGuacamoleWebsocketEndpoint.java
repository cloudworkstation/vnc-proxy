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

import java.util.Map;

@ServerEndpoint(value = "/websocket-tunnel/{host}", subprotocols = "guacamole")
public class CloudWorkstationGuacamoleWebsocketEndpoint
  extends GuacamoleWebSocketTunnelEndpoint {

  private static Logger logger = LoggerFactory.getLogger(CloudWorkstationGuacamoleWebsocketEndpoint.class);

  @Override
  protected GuacamoleTunnel createTunnel(Session session, EndpointConfig endPConfig)
                            throws GuacamoleException {
    
    logger.info("createTunnel: starting...");

    GuacamoleConfiguration config;
    if(ConfigFactory.useEnvironment()) {
      // this is the use environment case
      logger.info("createTunnel: using environment config...");
      config = ConfigFactory.getConfigFromEnvironment();
    } else {
      logger.info("createTunnel: using dynamic config...");
      // check if host path parameter is defined
      Map<String, String> params = session.getPathParameters();
      if(params.containsKey("host")) {
        String host = params.get("host");
        logger.info("createTunnel: host is defined in path, host = " + host);

        // get http session
        PrincipalWithSession httpSession = ((PrincipalWithSession)session.getUserPrincipal());
        // get user
        String sessionUser = httpSession.getName();
        logger.info("createTunnel: user is in session, user = " + sessionUser);

        // if the host is __DEFAULT__ then we are in single mode, so we don't attempt to get config dynamically
        if(host.equals("__DEFAULT__")) {
          logger.info("createTunnel: using config defined in the environment");
          config = ConfigFactory.getConfigFromEnvironment();
        } else {

          // get config
          try {
            logger.info("createTunnel: getting dynamic config");
            config = ConfigFactory.getConfigForUserAndHost(sessionUser, host);
          } catch (ConfigException e) {
            logger.error("createTunnel: error getting config", e);
            throw new GuacamoleException(e.getMessage());
          }

        }
      } else {
        logger.info("createTunnel: no host found in path");
        throw new GuacamoleException("No host found in path");
      }
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

