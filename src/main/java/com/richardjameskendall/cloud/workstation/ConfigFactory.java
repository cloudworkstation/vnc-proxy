package com.richardjameskendall.cloud.workstation;

import org.apache.guacamole.protocol.GuacamoleConfiguration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ConfigFactory {

  private static Logger logger = LoggerFactory.getLogger(CloudWorkstationGuacamoleTunnelServlet.class);

  public static GuacamoleConfiguration getConfigFromEnvironment() {

    logger.info("In getConfigFromEnvironment...");
    logger.info("Target=" + System.getenv("HOST") + "; port=" + System.getenv("PORT"));

    GuacamoleConfiguration config = new GuacamoleConfiguration();
    String protocol = System.getenv("PROTOCOL");
    if(protocol != null) {
      logger.info("Protocol is set to " + protocol);
      config.setProtocol(System.getenv("PROTOCOL"));
      if(protocol.equals("rdp")) {
        logger.info("Protcol is RDP");
        config.setParameter("ignore-cert", "true");
        config.setParameter("enable-wallpaper", "true");
        config.setParameter("enable-font-smoothing", "true");
        String displayRes = System.getenv("DISPLAY_RES");
        if(displayRes != null) {
          String[] displayResBits = displayRes.split("x");
          if(displayResBits.length < 2) {
            logger.error("Value provided for display resolution is not formatted correctly");
          } else {
            config.setParameter("width", displayResBits[0]);
            config.setParameter("height", displayResBits[1]);
          }
        } else {
          logger.info("Defaulting screen resolution to 1280x720");
          config.setParameter("width", "1280");
          config.setParameter("height", "720");
        }
      }
    } else {
      logger.info("Defaulting protocol to VNC");
      config.setProtocol("vnc");
    }
    config.setParameter("hostname", System.getenv("HOST"));
    config.setParameter("port", System.getenv("PORT"));
    config.setParameter("password", System.getenv("PASSWORD"));
    String username = System.getenv("USERNAME");
    if(username != null) {
      logger.info("Username was found in environment");
      config.setParameter("username", username);
    }
    return config;
  }
}
