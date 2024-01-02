package com.richardjameskendall.cloud.workstation;

import java.util.List;

public class ClientConfig {
    private String mode;

    private String protocol;

    private List<RemoteHost> availableHosts;

    public ClientConfig(EnvironmentConfig envconfig) {
        // used when we are taking config from the environment
        this.mode = envconfig.getAuthMode();
        this.protocol = envconfig.getProtocol();
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getProtocol() {
        return protocol;
    }

    public void setProtocol(String protocol) {
        this.protocol = protocol;
    }

    public List<RemoteHost> getAvailableHosts() {
        return availableHosts;
    }

    public void setAvailableHosts(List<RemoteHost> availableHosts) {
        this.availableHosts = availableHosts;
    }
}
