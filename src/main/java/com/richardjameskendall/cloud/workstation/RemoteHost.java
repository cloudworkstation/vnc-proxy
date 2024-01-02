package com.richardjameskendall.cloud.workstation;

public class RemoteHost {
    private String protocol;
    private String host;
    private String port;
    private String hostName;

    public RemoteHost(String protocol, String host, String port, String hostName) {
        this.port = port;
        this.host = host;
        this.protocol = protocol;
        this.hostName = hostName;
    }

    public String getProtocol() {
        return protocol;
    }

    public String getHost() {
        return host;
    }

    public String getPort() {
        return port;
    }

    public String getHostName() {
        return hostName;
    }
}
