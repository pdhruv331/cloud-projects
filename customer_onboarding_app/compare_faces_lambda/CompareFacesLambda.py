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

rekognition = boto3.client('rekognition', region_name=region)

sns = boto3.client('sns', region_name=region)
SNS_TOPIC = os.environ['TOPIC']


class FaceMatchError(Exception):
    """Raised when the selfie and license photos do not match."""
    pass


def lambda_handler(event, context):
    bucket = event['bucket']
    app_uuid = event['app_uuid']

    selfie_key = f"{unzipped_s3_prefix}{app_uuid}_selfie.png"
    license_key = f"{unzipped_s3_prefix}{app_uuid}_license.png"

    logger.info(f"Comparing faces for app_uuid={app_uuid}")

    response = rekognition.compare_faces(
        SourceImage={'S3Object': {'Bucket': bucket, 'Name': selfie_key}},
        TargetImage={'S3Object': {'Bucket': bucket, 'Name': license_key}},
        SimilarityThreshold=80
    )

    face_match = bool(response['FaceMatches'])

    # Update DynamoDB with the face match result
    customer_metadata_table.update_item(
        Key={'APP_UUID': app_uuid},
        UpdateExpression='SET LICENSE_SELFIE_MATCH = :val',
        ExpressionAttributeValues={':val': face_match}
    )

    if not face_match:
        logger.warning(f"Face match FAILED for app_uuid={app_uuid}")
        # Publish SNS notification for the failure
        sns.publish(
            TopicArn=SNS_TOPIC,
            Message=f"License Photo Validation Failed for APP_UUID: {app_uuid}",
            Subject="License Photo Validation Failed"
        )
        # Raise an error so Step Functions marks this state as failed
        # and does NOT proceed to the SQS/third-party validation step
        raise FaceMatchError(
            f"Face match failed for APP_UUID: {app_uuid}. "
            "LICENSE_SELFIE_MATCH set to False."
        )

    logger.info(f"Face comparison PASSED for app_uuid={app_uuid}")

    # Pass through context needed by downstream states
    return {
        "app_uuid": app_uuid,
        "bucket": bucket,
        "customer_details": event.get('customer_details', {})
    }
