import json
import logging
import os
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

region = os.environ.get('AWS_REGION', 'us-east-1')

sqs = boto3.client('sqs', region_name=region)
QUEUE_URL = os.environ['QUEUE_URL']


def lambda_handler(event, context):
    """
    Reached only when both CompareFaces and CompareDetails have passed.
    Sends the driver's license ID to the LicenseQueue for third-party validation.
    """
    # Step Functions parallel state returns a list of outputs from each branch;
    # both branches carry app_uuid, bucket, and customer_details so we read
    # from the first branch result.
    if isinstance(event, list):
        result = event[0]
    else:
        result = event

    app_uuid = result['app_uuid']
    customer_details = result['customer_details']

    logger.info(f"Sending license validation message to SQS for app_uuid={app_uuid}")

    message_body = json.dumps({
        "driver_license_id": customer_details.get('DOCUMENT_NUMBER'),
        "validation_override": True,
        "uuid": app_uuid
    })

    sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=message_body)

    logger.info(f"Successfully queued license validation for app_uuid={app_uuid}")

    return {"app_uuid": app_uuid, "status": "queued"}
