package com.richardjameskendall.cloud.workstation;

import org.apache.guacamole.protocol.GuacamoleConfiguration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/*
 Description of config modes:

 AUTH_MODE: PASS_THROUGH = configuration is grabbed from the config store based on user and host being requested
 Also specified should be CONFIG_STORE_TABLE which is the name of the dynamodb table where the config information is stored

 AUTH_MODE: ENVIRONMENT (or not set) = configuration is taken from the environment
 Expects:
  - HOST = hostname to be connected to
  - PORT = port on the host to be connected to
  - PASSWORD = password to be used to establish the connection
 Optional:
  - PROTOCOL = defaults to vnc if not set, can be vnc, rdp or ssh
  - USERNAME = the user id to use when connecting, mandatory for ssh
  - DISPLAY_RES = the display resolution to use of the form <width>x<height>, only used for rdp connections
 */
public class ConfigFactory {

  private static Logger logger = LoggerFactory.getLogger(ConfigFactory.class);

  public static boolean useEnvironment() {
    return !EnvironmentConfig.get().getAuthMode().equals("PASS_THROUGH");
  }

  public static GuacamoleConfiguration getConfigForUserAndHost(String user, String host) throws ConfigException {
    // in this version we get config for a given user and host pair from the config store
    EnvironmentConfig envconfig = EnvironmentConfig.get();

    // need to lookup config
    logger.info("getConfigForUserAndHost: starting...");
    logger.info("getConfigForUserAndHost: getting config for user = " + user + ", and host = " + host);

    String configTable = envconfig.getConfigTable();
    if(configTable != null) {
      logger.info("getConfigForUserAndHost: table = " + envconfig.getConfigTable());

      Map<String, String> record = ConfigStore.getRecord(host, user, configTable);
      if(record == null) {
        throw new ConfigException("No record found for user and host.");
      }

      return buildConfig(new EnvironmentConfig(record));
    } else {
      logger.error("getConfigForUserAndHost: config table name is missing from environment config");
      throw new ConfigException("Cannot find config table name in environment.");
    }

  }

  private static GuacamoleConfiguration buildConfig(EnvironmentConfig envconfig) {
    GuacamoleConfiguration config = new GuacamoleConfiguration();
    logger.info("buildConfig: starting...");

    String protocol = envconfig.getProtocol();
    if(protocol != null) {
      logger.info("buildConfig: protocol = " + protocol);
      config.setProtocol(protocol);

      // for RDP we have some special parameters to set
      if(protocol.equals("rdp")) {
        logger.info("buildConfig: as protocol is RDP, setting specific config parameters");
        config.setParameter("ignore-cert", "true");
        config.setParameter("enable-wallpaper", "true");
        config.setParameter("enable-font-smoothing", "true");
        String displayRes = envconfig.getDisplayRes();
        if(displayRes != null) {
          String[] displayResBits = displayRes.split("x");
          if(displayResBits.length < 2) {
            logger.error("buildConfig: value provided for display resolution is not formatted correctly, using default 1280x720");
            config.setParameter("width", "1280");
            config.setParameter("height", "720");
          } else {
            logger.info("buildConfig: setting display resolution to " + displayResBits[0] + "x" + displayResBits[1]);
            config.setParameter("width", displayResBits[0]);
            config.setParameter("height", displayResBits[1]);
          }
        } else {
          logger.info("buildConfig: defaulting screen resolution to 1280x720");
          config.setParameter("width", "1280");
          config.setParameter("height", "720");
        }
      }
    } else {
      // we default to vnc if a protocol is not specified
      logger.info("buildConfig: defaulting protocol to VNC");
      config.setProtocol("vnc");
    }

    // these are needed in all circumstances
    config.setParameter("hostname", envconfig.getTargetHost());
    config.setParameter("port", envconfig.getTargetPort());

    // set username if it was provided in the config
    String username = envconfig.getUsername();
    if(username != null) {
      logger.info("buildConfig: username was found in environment");
      config.setParameter("username", username);
    }

    // set password if it was provided in the config
    String password = envconfig.getPassword();
    if(password != null) {
      logger.info("buildConfig: setting password");
      config.setParameter("password", password);
    } else {
      // if there's no password, but is a private-key, then set it
      String privateKey = envconfig.getPrivateKey();
      if(privateKey != null) {
        logger.info("buildConfig: setting private key");
        config.setParameter("private-key", privateKey);
      }
    }

    return config;
  }

  public static GuacamoleConfiguration getConfigFromEnvironment() {
    EnvironmentConfig envconfig = EnvironmentConfig.get();

    logger.info("getConfigFromEnvironment: starting...");
    logger.info("getConfigFromEnvironment: mode = " + envconfig.getAuthMode());
    if(envconfig.getTargetHost() != null) {
      logger.info("getConfigFromEnvironment: target host is specified in config = " + envconfig.getTargetHost() + ":" + envconfig.getTargetPort());
    }

    return buildConfig(envconfig);

  }
}
