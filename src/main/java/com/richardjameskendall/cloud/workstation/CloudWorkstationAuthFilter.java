package com.richardjameskendall.cloud.workstation;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.PrintWriter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CloudWorkstationAuthFilter implements Filter {

    private static Logger logger = LoggerFactory.getLogger(CloudWorkstationAuthFilter.class);

    FilterConfig config;

    public void init(FilterConfig filterConfig) {
        config = filterConfig;
    }

    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws ServletException, IOException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String requestUser = httpRequest.getHeader("X-Remote-User");
        if(requestUser.equals(System.getenv("REMOTE_USER"))) {
            logger.info("User in header matches the expected user");
            chain.doFilter(request, response);
        } else {
            response.setContentType("text/html");
            PrintWriter out = response.getWriter();
            out.println("Access denied.");
        }
    }
}
