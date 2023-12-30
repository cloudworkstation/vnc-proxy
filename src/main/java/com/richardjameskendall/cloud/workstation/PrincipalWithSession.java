package com.richardjameskendall.cloud.workstation;

import java.security.Principal;
import javax.servlet.http.HttpSession;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


public class PrincipalWithSession implements Principal {

    private static Logger logger = LoggerFactory.getLogger(PrincipalWithSession.class);

    private final HttpSession session;
    private final String username;

    public PrincipalWithSession(HttpSession session, String user) {
        logger.info("PrincipalWithSession: construct session for user = " + user);
        this.session = session;
        this.username = user;
    }

    public HttpSession getSession() {
        return session;
    }

    @Override
    public String getName() {
        logger.info("getName: getting username " + username);
        return username;
    }
}
