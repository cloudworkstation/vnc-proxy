# DynamoDB Setup for Dynamic-Config Mode

This guide explains how to set up DynamoDB for the dynamic-config mode, which allows multiple VNC/RDP hosts to be configured dynamically.

## What is Dynamic-Config Mode?

Dynamic-config mode allows you to:
- Configure multiple VNC/RDP hosts in a DynamoDB table
- Users can select from a list of available hosts
- Hosts can be added/removed without redeploying the application
- Host configuration is centralized and easy to manage

## Prerequisites

- AWS Account with DynamoDB access
- AWS CLI configured (or use AWS Console)
- IAM user with DynamoDB permissions

## Step 1: Create DynamoDB Table

### Using AWS CLI

```bash
aws dynamodb create-table \
    --table-name vnc-hosts \
    --attribute-definitions \
        AttributeName=hostName,AttributeType=S \
    --key-schema \
        AttributeName=hostName,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1
```

### Using AWS Console

1. Go to [DynamoDB Console](https://console.aws.amazon.com/dynamodb)
2. Click **Create table**
3. Table settings:
   - **Table name**: `vnc-hosts`
   - **Partition key**: `hostName` (String)
4. Table settings:
   - **Billing mode**: On-demand (or Provisioned if preferred)
5. Click **Create table**

## Step 2: Add Host Entries

### Schema

Each item in the table should have:

```json
{
  "hostName": "desktop-01",           // Unique identifier (partition key)
  "host": "192.168.1.100",            // IP or hostname of VNC/RDP server
  "port": 5900,                       // Port number
  "protocol": "vnc",                  // "vnc" or "rdp"
  "password": "optional-vnc-password" // Optional: VNC password
}
```

### Add Items via AWS CLI

```bash
# VNC Server Example
aws dynamodb put-item \
    --table-name vnc-hosts \
    --item '{
        "hostName": {"S": "desktop-01"},
        "host": {"S": "192.168.1.100"},
        "port": {"N": "5900"},
        "protocol": {"S": "vnc"}
    }'

# RDP Server Example
aws dynamodb put-item \
    --table-name vnc-hosts \
    --item '{
        "hostName": {"S": "windows-server"},
        "host": {"S": "192.168.1.200"},
        "port": {"N": "3389"},
        "protocol": {"S": "rdp"}
    }'
```

### Add Items via AWS Console

1. Go to your table in DynamoDB Console
2. Click **Explore table items**
3. Click **Create item**
4. Add attributes:
   - `hostName` (String): `desktop-01`
   - `host` (String): `192.168.1.100`
   - `port` (Number): `5900`
   - `protocol` (String): `vnc`
5. Click **Create item**

## Step 3: Create IAM User/Role

### Required Permissions

The application needs these DynamoDB permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:BatchGetItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/vnc-hosts"
    }
  ]
}
```

### Create IAM User (AWS CLI)

```bash
# Create IAM user
aws iam create-user --user-name vnc-proxy-dynamodb

# Create access keys
aws iam create-access-key --user-name vnc-proxy-dynamodb

# Attach policy
aws iam put-user-policy \
    --user-name vnc-proxy-dynamodb \
    --policy-name DynamoDBReadAccess \
    --policy-document file://dynamodb-policy.json
```

Save the **Access Key ID** and **Secret Access Key** from the output.

### Create IAM User (AWS Console)

1. Go to [IAM Console](https://console.aws.amazon.com/iam)
2. Users → Add users
3. User name: `vnc-proxy-dynamodb`
4. Select **Access key - Programmatic access**
5. Permissions: Attach existing policies or create inline policy with permissions above
6. Create user and **save the credentials**

## Step 4: Configure Application

Update your `.env` file with AWS credentials:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
CONFIG_TABLE=vnc-hosts

# Auth mode
AUTH_MODE=OIDC
```

## Testing

### Query the Table

Test that your credentials can access the table:

```bash
aws dynamodb scan \
    --table-name vnc-hosts \
    --region us-east-1
```

### Test with Application

1. Start the Docker Compose stack:
   ```bash
   docker-compose up -d
   ```

2. Check logs for DynamoDB connection:
   ```bash
   docker-compose logs vnc-proxy | grep -i dynamodb
   ```

3. Access the application at `https://localhost:8443`

4. If multiple hosts are configured, you should see a host selection modal

## Example Hosts Configuration

### Home Lab Setup

```bash
# Development Desktop (VNC)
aws dynamodb put-item --table-name vnc-hosts --item '{
    "hostName": {"S": "dev-desktop"},
    "host": {"S": "192.168.1.100"},
    "port": {"N": "5900"},
    "protocol": {"S": "vnc"}
}'

# Windows Server (RDP)
aws dynamodb put-item --table-name vnc-hosts --item '{
    "hostName": {"S": "windows-srv"},
    "host": {"S": "192.168.1.101"},
    "port": {"N": "3389"},
    "protocol": {"S": "rdp"}
}'

# Linux Server (VNC with custom port)
aws dynamodb put-item --table-name vnc-hosts --item '{
    "hostName": {"S": "linux-srv"},
    "host": {"S": "192.168.1.102"},
    "port": {"N": "5901"},
    "protocol": {"S": "vnc"}
}'
```

## Single Host Mode vs. Dynamic Config

The application supports two modes:

### SINGLE Mode
- One preconfigured VNC/RDP connection
- No DynamoDB required
- Automatically connects on page load

### PASS_THROUGH Mode (Dynamic Config)
- Multiple hosts configured in DynamoDB
- User selects which host to connect to
- Requires DynamoDB table and AWS credentials

The mode is determined by the backend based on configuration.

## Security Best Practices

1. **Use IAM Roles** (when running on EC2/ECS)
   - Attach IAM role to instance instead of using access keys
   - Automatically rotates credentials

2. **Least Privilege**
   - Only grant read access to the specific table
   - Don't use root AWS credentials

3. **Encrypt at Rest**
   - Enable DynamoDB encryption (enabled by default)

4. **Network Security**
   - Use VPC endpoints for DynamoDB if running in AWS
   - Restrict security group rules

5. **Audit Access**
   - Enable CloudTrail for DynamoDB API calls
   - Monitor for unusual access patterns

## Troubleshooting

### "Unable to locate credentials"
- Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
- Verify credentials are valid: `aws sts get-caller-identity`

### "Table does not exist"
- Verify table name matches `CONFIG_TABLE` environment variable
- Check region matches `AWS_REGION`
- Confirm table exists: `aws dynamodb describe-table --table-name vnc-hosts`

### "Access Denied"
- Verify IAM user has DynamoDB read permissions
- Check table name in IAM policy matches actual table

### "No hosts available"
- Verify table has items: `aws dynamodb scan --table-name vnc-hosts`
- Check items have required attributes: `hostName`, `host`, `port`, `protocol`
- Review application logs for errors

## Cost Considerations

DynamoDB pricing (On-Demand mode):
- **Write**: ~$1.25 per million write request units
- **Read**: ~$0.25 per million read request units
- **Storage**: ~$0.25 per GB-month

For a typical VNC proxy with 100 users:
- ~100 reads per day = 3,000 reads/month
- Cost: **< $0.01/month**

Very cost-effective for this use case!

## Advanced: Using Parameter Store Instead

If you prefer not to use DynamoDB, you can store configuration in AWS Systems Manager Parameter Store:

```bash
# Store configuration as JSON
aws ssm put-parameter \
    --name /vnc-proxy/hosts \
    --type String \
    --value '[
        {"hostName": "desktop-01", "host": "192.168.1.100", "port": 5900, "protocol": "vnc"}
    ]'
```

**Note**: This requires code changes to read from Parameter Store instead of DynamoDB.
