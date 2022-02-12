package com.richardjameskendall.cloud.workstation;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleSocket;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.InetGuacamoleSocket;
import org.apache.guacamole.net.SimpleGuacamoleTunnel;
import org.apache.guacamole.protocol.ConfiguredGuacamoleSocket;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.servlet.GuacamoleHTTPTunnelServlet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@WebServlet("/tunnel")
public class CloudWorkstationGuacamoleTunnelServlet
    extends GuacamoleHTTPTunnelServlet {

    private static Logger logger = LoggerFactory.getLogger(CloudWorkstationGuacamoleTunnelServlet.class);

    @Override
    protected GuacamoleTunnel doConnect(HttpServletRequest request)
        throws GuacamoleException {

        logger.info("In doConnect...");

        // get config
        GuacamoleConfiguration config = ConfigFactory.getConfigFromEnvironment();

        // Connect to guacd - everything is hard-coded here.
        GuacamoleSocket socket = new ConfiguredGuacamoleSocket(
                new InetGuacamoleSocket(System.getenv("GUACD_HOST"), 4822),
                config
        );

        // Return a new tunnel which uses the connected socket
        return new SimpleGuacamoleTunnel(socket);

    }

}