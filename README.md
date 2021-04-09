# vnc-proxy

Tomcat with Apache Guacamole to act as a web-based VNC proxy as part of the Cloudworkstation solution.

It is built into a docker image which is available here cloudworkstation/vnc-proxy

## Environment variables

The application gets its confiuration via environment variables:

|Variable|Purpose|
|---|---|
|GUACD_HOST| The hostname where guacd is running|
|HOST| The host where the VNC server is running|
|PORT| The port where the VNC server is available on the host specified in `HOST`|
|PASSWORD| The password needed to connect to the VNC session|
|REMOTE_USER| The username expected in the X-Remote-User header|

## Authentication

The application expects inbound requests to carry a header with the username of the user who is making the request.  The header is called `X-Remote-User` and it needs to contain a value which is identical to the value in the `REMOTE_USER` environment variable.

If the value is missing or does not match then the request will be denied.
