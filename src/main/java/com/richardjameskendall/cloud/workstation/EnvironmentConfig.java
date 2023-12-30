package com.richardjameskendall.cloud.workstation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public class EnvironmentConfig {

    private static Logger logger = LoggerFactory.getLogger(EnvironmentConfig.class);

    private static EnvironmentConfig instance;

    private String authMode;
    private String expectedUser;
    private String targetHost;
    private String targetPort;
    private String protocol;
    private String displayRes;
    private String password;
    private String username;
    private String configTable;
    private String privateKey;

    private EnvironmentConfig() {
        // get environment config into instance
        logger.info("EnvironmentConfig: constructing...");

        authMode = System.getenv("AUTH_MODE");
        configTable = System.getenv("CONFIG_TABLE");

        expectedUser = System.getenv("REMOTE_USER");
        targetHost = System.getenv("HOST");
        targetPort = System.getenv("PORT");
        protocol = System.getenv("PROTOCOL");
        displayRes = System.getenv("DISPLAY_RES");
        username = System.getenv("USERNAME");
        password = System.getenv("PASSWORD");
    }

    public EnvironmentConfig(Map<String, String> input) {
        // build a config object from a map of strings
        logger.info("EnvironmentConfig: constructing from map...");

        // auth mode always comes from environment, as does config table
        authMode = System.getenv("AUTH_MODE");
        configTable = System.getenv("CONFIG_TABLE");

        // rest come from map
        // expected user is not used in this model, so is also not set
        targetHost = input.get(ConfigStore.HOST_FIELD_NAME);
        targetPort = input.get(ConfigStore.PORT_FIELD_NAME);
        protocol = input.get(ConfigStore.PROTOCOL_FIELD_NAME);
        displayRes = input.get(ConfigStore.DISPLAY_RES_FIELD_NAME);
        password = input.get(ConfigStore.PASSWORD_FIELD_NAME);
        privateKey = input.get(ConfigStore.PRIVATE_KEY_FIELD_NAME);
        username = input.get(ConfigStore.USERNAME_FIELD_NAME);

    }

    public static EnvironmentConfig get() {
        if(instance == null) {
            instance = new EnvironmentConfig();
        }
        return instance;
    }

    public String getAuthMode() {
        return authMode;
    }

    public String getExpectedUser() {
        return expectedUser;
    }

    public String getTargetHost() {
        return targetHost;
    }

    public String getTargetPort() {
        return targetPort;
    }

    public String getProtocol() {
        return protocol;
    }

    public String getDisplayRes() {
        return displayRes;
    }

    public String getPassword() {
        return password;
    }

    public String getUsername() {
        return username;
    }

    public String getConfigTable() {
        return configTable;
    }

    public String getPrivateKey() {
        return privateKey;
    }
}
