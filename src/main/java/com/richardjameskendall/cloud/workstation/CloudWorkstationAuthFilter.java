package com.richardjameskendall.cloud.workstation;

import javax.servlet.*;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.security.Principal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@WebFilter("/*")
public class CloudWorkstationAuthFilter implements Filter {

    private static Logger logger = LoggerFactory.getLogger(CloudWorkstationAuthFilter.class);

    FilterConfig config;

    public void init(FilterConfig filterConfig) {
        config = filterConfig;
    }

    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws ServletException, IOException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        
        String requestUser = httpRequest.getHeader("X-Remote-User");
        EnvironmentConfig config = EnvironmentConfig.get();

        // check mode
        // if mode is pass user through then we 1) check a user is set, 2) add user details to context
        // if more is normal, we check the supplied username matches the expected value
        if(config.getAuthMode() != null && config.getAuthMode().equals("PASS_THROUGH")) {
            // in this mode we are checking a user is defined and passing it through to the app
            request.setAttribute("mode", "PASS_THROUGH");
            if(requestUser != null) {
                logger.info("Mode = PASS_THROUGH; setting APP_USER and sending down the chain");
                final PrincipalWithSession p = new PrincipalWithSession(httpRequest.getSession(), requestUser);
                HttpServletRequestWrapper wrappedRequest = new HttpServletRequestWrapper(httpRequest) {
                    @Override
                    public Principal getUserPrincipal() {
                        return p;
                    }
                };
                logger.info("doFilter: setting wrapped request with principal added");
                chain.doFilter(wrappedRequest, response);
            } else {
                logger.info("doFilter: mode = PASS_THROUGH; and there is no user name available in the headers, so denying request");
                httpResponse.setContentType("text/html");
                httpResponse.setStatus(401);
                PrintWriter out = httpResponse.getWriter();
                out.println("Access denied.");
            }
        } else {
            // this is the default mode, where we check that the user in the header matches the expected value
            String expectedUser = config.getExpectedUser();

            // check we have a user provided in the headers
            if(requestUser != null) {
                // check we have been provided a user in the app config (environment variable)
                if(expectedUser != null) {
                    if (requestUser.equals(expectedUser)) {
                        // the user in the header matches the expected user, so keep going
                        logger.info("doFilter: mode = SINGLE_USER; and the user in header matches the expected user");
                        chain.doFilter(request, response);
                    } else {
                        response.setContentType("text/html");
                        PrintWriter out = response.getWriter();
                        out.println("Access denied.");
                    }
                } else {
                    logger.info("doFilter: no REMOTE_USER environment variable is set.");
                    response.setContentType("text/html");
                    PrintWriter out = response.getWriter();
                    out.println("Access denied.");
                }
            } else {
                logger.info("doFilter: there is no user name available in the headers, so denying request");
                response.setContentType("text/html");
                PrintWriter out = response.getWriter();
                out.println("Access denied.");
            }

        }

    }
}
