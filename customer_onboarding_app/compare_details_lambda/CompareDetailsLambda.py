import logging
import os
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

unzipped_s3_prefix = "unzipped/"
region = os.environ.get('AWS_REGION', 'us-east-1')

dynamodb = boto3.resource('dynamodb', region_name=region)
TABLE_NAME = os.environ['TABLE']
customer_metadata_table = dynamodb.Table(TABLE_NAME)

textract = boto3.client('textract', region_name=region)

sns = boto3.client('sns', region_name=region)
SNS_TOPIC = os.environ['TOPIC']

required_fields = [
    'DOCUMENT_NUMBER', 'FIRST_NAME', 'LAST_NAME', 'DATE_OF_BIRTH',
    'ADDRESS', 'STATE_IN_ADDRESS', 'CITY_IN_ADDRESS', 'ZIP_CODE_IN_ADDRESS'
]


class DetailsMatchError(Exception):
    """Raised when the CSV details and Textract-extracted license data do not match."""
    pass


def textract_response(bucket, license_key):
    """Extract identity fields from the license image using Textract."""
    response = textract.analyze_id(
        DocumentPages=[{'S3Object': {'Bucket': bucket, 'Name': license_key}}]
    )
    id_fields = {}
    for field in response['IdentityDocuments'][0]['IdentityDocumentFields']:
        field_type = field['Type']['Text']
        if field_type in required_fields:
            id_fields[field_type] = field['ValueDetection']['Text']
    return id_fields


def lambda_handler(event, context):
    bucket = event['bucket']
    app_uuid = event['app_uuid']
    customer_details = event['customer_details']

    license_key = f"{unzipped_s3_prefix}{app_uuid}_license.png"

    logger.info(f"Comparing details for app_uuid={app_uuid}")

    # Extract fields from the license via Textract
    textract_dict = textract_response(bucket, license_key)

    # Compare the required fields from the CSV against what Textract extracted
    csv_subset = {k: customer_details.get(k, '') for k in required_fields}
    textract_subset = {k: textract_dict.get(k, '') for k in required_fields}
    details_match = csv_subset == textract_subset

    # Update DynamoDB with the details match result
    customer_metadata_table.update_item(
        Key={'APP_UUID': app_uuid},
        UpdateExpression='SET LICENSE_DETAILS_MATCH = :val',
        ExpressionAttributeValues={':val': details_match}
    )

    if not details_match:
        logger.warning(f"Details match FAILED for app_uuid={app_uuid}")
        # Publish SNS notification for the failure
        sns.publish(
            TopicArn=SNS_TOPIC,
            Message=f"Data validation between the license and the .csv file FAILED for APP_UUID: {app_uuid}",
            Subject="Data validation between the license and the .csv file FAILED"
        )
        # Raise an error so Step Functions marks this state as failed
        # and does NOT proceed to the SQS/third-party validation step
        raise DetailsMatchError(
            f"Details match failed for APP_UUID: {app_uuid}. "
            "LICENSE_DETAILS_MATCH set to False."
        )

    logger.info(f"Details comparison PASSED for app_uuid={app_uuid}")

    # SQS send is intentionally NOT done here — it happens in the
    # SendToQueue state, which is only reached when all validations pass
    return {
        "app_uuid": app_uuid,
        "bucket": bucket,
        "customer_details": customer_details
    }
