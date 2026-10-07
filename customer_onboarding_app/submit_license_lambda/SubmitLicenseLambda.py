import boto3
import json
import os
import requests

# Read resource names from environment variables
TABLE = os.environ['TABLE']
TOPIC = os.environ['TOPIC']
QUEUE_URL = os.environ['QUEUE_URL']
INVOKE_URL = os.environ['INVOKE_URL']

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')


def lambda_handler(event, context):
    print(event)

    # The SQS event contains a list of Records; BatchSize is 1 so there's always one record
    for record in event['Records']:
        # Parse the message body (it's a JSON string)
        body = json.loads(record['body'])

        # Extract the driver's license ID, validation override flag, and APP_UUID
        driver_license_id = body['driver_license_id']
        validation_override = body['validation_override']
        app_uuid = body['uuid']

        print(f"Processing license validation for APP_UUID: {app_uuid}")
        print(f"Driver License ID: {driver_license_id}, Override: {validation_override}")

        # Submit the license ID and override flag to the third-party validation API
        payload = {
            'driver_license_id': driver_license_id,
            'validation_override': validation_override
        }
        response = requests.post(INVOKE_URL, json=payload)
        api_result = response.json()

        print(f"API response: {api_result}")

        # Determine whether the validation passed
        is_valid = api_result.get('result', False)

        # Update the DynamoDB table with the LICENSE_VALIDATION result
        table = dynamodb.Table(TABLE)
        table.update_item(
            Key={'APP_UUID': app_uuid},
            UpdateExpression='SET LICENSE_VALIDATION = :val',
            ExpressionAttributeValues={':val': is_valid}
        )

        print(f"Updated DynamoDB: APP_UUID={app_uuid}, LICENSE_VALIDATION={is_valid}")

        # If validation failed, publish a failure notification to the SNS topic
        if not is_valid:
            message = (
                f"License validation FAILED for APP_UUID: {app_uuid}. "
                f"Driver License ID: {driver_license_id}."
            )
            sns.publish(
                TopicArn=TOPIC,
                Message=message,
                Subject='License Validation Failure'
            )
            print(f"SNS failure notification sent for APP_UUID: {app_uuid}")
