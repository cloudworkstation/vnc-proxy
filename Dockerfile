FROM tomcat:9.0.102-jdk17-corretto

# Copy WAR with fixed name for version-agnostic deployment
ADD target/workstation-0.0.2.war /usr/local/tomcat/webapps/workstation.war
ADD src/resources/index.html /usr/local/tomcat/webapps/ROOT/index.html

EXPOSE 8080


