package com.richardjameskendall.cloud.workstation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

public class ConfigStore {
    private static Logger logger = LoggerFactory.getLogger(ConfigStore.class);

    public static String PRIVATE_KEY_FIELD_NAME = "key";
    public static String HOST_FIELD_NAME = "endpoint";
    public static String PORT_FIELD_NAME = "port";
    public static String PROTOCOL_FIELD_NAME = "protocol";
    public static String DISPLAY_RES_FIELD_NAME = "display_res";
    public static String PASSWORD_FIELD_NAME = "password";
    public static String USERNAME_FIELD_NAME = "username";

    private static Map<String, String> convertRecord(Map<String, AttributeValue> input) {
        Map<String, String> newMap = input.entrySet().stream()
                .collect(Collectors.toMap(e -> e.getKey(), e -> e.getValue().s()));
        return newMap;
    }

    public static Map<String, String> getRecord(String host, String username, String tableName) {
        DynamoDbClient ddb = DynamoDbClient.builder().build();
        HashMap<String, AttributeValue> keyToGet = new HashMap<>();
        keyToGet.put("host", AttributeValue.builder()
                .s(host)
                .build());
        keyToGet.put("username", AttributeValue.builder()
                .s(username)
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
