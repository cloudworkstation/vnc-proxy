package com.richardjameskendall.cloud.workstation;

import java.util.List;

public class ClientConfig {
    private String mode;

    private String protocol;

    private List<String> availableHosts;


    public ClientConfig(String mode, String protocol) {
        this.mode = mode;
        this.protocol = protocol;
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

    public List<String> getAvailableHosts() {
        return availableHosts;
    }

    public void setAvailableHosts(List<String> availableHosts) {
        this.availableHosts = availableHosts;
    }
}
