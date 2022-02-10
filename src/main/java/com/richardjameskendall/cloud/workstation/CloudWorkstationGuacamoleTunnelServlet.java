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
        logger.info("Target=" + System.getenv("HOST") + "; port=" + System.getenv("PORT") + "; user=" + System.getenv("USERNAME"));

        // Create our configuration
        GuacamoleConfiguration config = new GuacamoleConfiguration();
        String protocol = System.getenv("PROTOCOL");
        if(protocol != null) {
            logger.info("Protocol was found in environment");
            config.setProtocol(System.getenv("PROTOCOL"));
            if(protocol.equals("rdp")) {
                config.setParameter("ignore-cert", "true");
                config.setParameter("width", "1280");
                config.setParameter("height", "720");
            }
        } else {
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

        // Connect to guacd - everything is hard-coded here.
        GuacamoleSocket socket = new ConfiguredGuacamoleSocket(
                new InetGuacamoleSocket(System.getenv("GUACD_HOST"), 4822),
                config
        );

        // Return a new tunnel which uses the connected socket
        return new SimpleGuacamoleTunnel(socket);

    }

}