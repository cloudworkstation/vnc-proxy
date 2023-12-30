package com.richardjameskendall.cloud.workstation;

import com.google.gson.Gson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

@WebServlet(name = "ClientConfigProvider", urlPatterns = "/clientconfig")
public class ClientConfigProvider extends HttpServlet {

    private static Logger logger = LoggerFactory.getLogger(ClientConfigProvider.class);

    private Gson gson = new Gson();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        logger.info("doGet: getting config for client");
        EnvironmentConfig envconfig = EnvironmentConfig.get();

        ClientConfig config = new ClientConfig(envconfig.getAuthMode(), "test");
        String clientConfigString = this.gson.toJson(config);

        PrintWriter out = resp.getWriter();
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        out.print(clientConfigString);
        out.flush();
    }
}
