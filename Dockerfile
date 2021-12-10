FROM tomcat:9-jdk11-corretto

ADD target/workstation-0.0.1.war /usr/local/tomcat/webapps/
ADD src/resources/index.html /usr/local/tomcat/webapps/ROOT/index.html

EXPOSE 8080


