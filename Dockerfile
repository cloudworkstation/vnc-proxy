FROM tomcat:9-jdk11-corretto

ADD target/workstation-0.0.1.war /usr/local/tomcat/webapps/

EXPOSE 8080


