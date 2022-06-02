# vnc-proxy (also supports RDP)

Tomcat with Apache Guacamole to act as a web-based VNC/RDP proxy as part of the Cloudworkstation solution.

It is built into a docker image which is available here cloudworkstation/vnc-proxy

Has a semi-friendly React based front-end with support for scaling the screen to fit the browser and 

## Environment variables

The application gets its confiuration via environment variables:

|Variable|Purpose|
|---|---|
|GUACD_HOST| The hostname where guacd is running|
|HOST| The host where the VNC/RDP server is running|
|PORT| The port where the VNC/RDP server is available on the host specified in `HOST`|
|PROTOCOL| What protocol should be used to connect to the host, can be `vnc` or `rdp`|
|USERNAME| The username needed to connect to the VNC/RDP session (can be missing for VNC)|
|PASSWORD| The password needed to connect to the VNC/RDP session|
|DISPLAY_RES| A string specifying the width and height of the display in pixels e.g. 1280x720|
|REMOTE_USER| The username expected in the X-Remote-User header|

## Authentication

The application expects inbound requests to carry a header with the username of the user who is making the request.  The header is called `X-Remote-User` and it needs to contain a value which is identical to the value in the `REMOTE_USER` environment variable.

If the value is missing or does not match then the request will be denied.
