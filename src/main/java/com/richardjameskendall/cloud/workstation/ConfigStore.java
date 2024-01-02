package com.richardjameskendall.cloud.workstation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

import java.util.*;
import java.util.stream.Collectors;

public class ConfigStore {
    private static Logger logger = LoggerFactory.getLogger(ConfigStore.class);

    public static String PRIVATE_KEY_FIELD_NAME = "key";
    public static String HOST_FIELD_NAME = "endpoint";
    public static String PORT_FIELD_NAME = "port";
    public static String PROTOCOL_FIELD_NAME = "protocol";
    public static String DISPLAY_RES_FIELD_NAME = "display_res";
    public static String PASSWORD_FIELD_NAME = "password";
    public static String USERNAME_FIELD_NAME = "user";
    public static String HOST_ALIAS_FIELD_NAME = "host";

    private static Map<String, String> convertRecord(Map<String, AttributeValue> input) {
        Map<String, String> newMap = input.entrySet().stream()
                .collect(Collectors.toMap(e -> e.getKey(), e -> e.getValue().s()));
        return newMap;
    }

    public static List<RemoteHost> getAvailableHostsForUser(String username, String tableName) {
        DynamoDbClient ddb = DynamoDbClient.builder().build();
        HashMap<String, String> attrNameAlias = new HashMap<>();
        attrNameAlias.put("#a", USERNAME_FIELD_NAME);

        HashMap<String, AttributeValue> attrValues = new HashMap<>();
        attrValues.put(":" + USERNAME_FIELD_NAME, AttributeValue.builder()
                .s(username)
                .build());

        QueryRequest query = QueryRequest.builder()
                .tableName(tableName)
                .keyConditionExpression("#a = :" + USERNAME_FIELD_NAME)
                .expressionAttributeNames(attrNameAlias)
                .expressionAttributeValues(attrValues)
                .build();

        try {
            QueryResponse resp = ddb.query(query);
            logger.info("getAvailableHostsForUser: got " + resp.count() + " records");

            ArrayList<RemoteHost> list = new ArrayList<>();
            Iterator<Map<String, AttributeValue>> iterator = resp.items().iterator();
            while(iterator.hasNext()) {
                Map<String, AttributeValue> item = iterator.next();
                String host = item.get(HOST_FIELD_NAME).s();
                String port = item.get(PORT_FIELD_NAME).s();
                String protocol = item.get(PROTOCOL_FIELD_NAME).s();
                String hostName = item.get(HOST_ALIAS_FIELD_NAME).s();
                list.add(new RemoteHost(protocol, host, port, hostName));
            }

            return list;

        } catch (DynamoDbException e) {
            logger.error("getRecord: error reading from DynamoDB table", e);
        }

        return null;
    }

    public static Map<String, String> getRecord(String host, String username, String tableName) {
        logger.info("getRecord: attempting to get record from table = " + tableName);
        logger.info("getRecord: for host = " + host + "; user = " + username);

        DynamoDbClient ddb = DynamoDbClient.builder().build();
        HashMap<String, AttributeValue> keyToGet = new HashMap<>();
        keyToGet.put("user", AttributeValue.builder()
                .s(username)
                .build());
        keyToGet.put("host", AttributeValue.builder()
                .s(host)
                .build());

        GetItemRequest request = GetItemRequest.builder()
                .key(keyToGet)
                .tableName(tableName)
                .build();

        try {
            Map<String, AttributeValue> returnedItem = ddb.getItem(request).item();
            if (returnedItem.isEmpty()) {
                logger.info("getRecord: no record found for host = " + host + " and user = " + username);
                return null;
            } else {
                logger.info("getRecord: found a record");
                return convertRecord(returnedItem);
            }
        } catch (DynamoDbException e) {
            logger.error("getRecord: error reading from DynamoDB table", e);
        }

        logger.info("getRecord: got to end and returning null");
        return null;
    }
}
