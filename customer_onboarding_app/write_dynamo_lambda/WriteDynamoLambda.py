import logging
import os
import csv
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

unzipped_directory = "/tmp/unzipped/"
unzipped_s3_prefix = "unzipped/"
region = os.environ.get('AWS_REGION', 'us-east-1')

s3 = boto3.client('s3', region_name=region)
dynamodb = boto3.resource('dynamodb', region_name=region)
TABLE_NAME = os.environ['TABLE']
customer_metadata_table = dynamodb.Table(TABLE_NAME)


def parse_file(file_path):
    """Read the first row of the CSV and return it as a dict."""
    with open(file_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            return dict(row)


def lambda_handler(event, context):
    bucket = event['bucket']
    app_uuid = event['app_uuid']

    logger.info(f"Writing customer details to DynamoDB for app_uuid={app_uuid}")

    # Download the details CSV from S3 to /tmp so we can parse it
    details_key = f"{unzipped_s3_prefix}{app_uuid}_details.csv"
    local_details_path = f"/tmp/{app_uuid}_details.csv"
    s3.download_file(bucket, details_key, local_details_path)

    # Parse CSV and write to DynamoDB
    customer_details = parse_file(local_details_path)
    customer_details['APP_UUID'] = app_uuid
    customer_metadata_table.put_item(Item=customer_details)

    logger.info(f"DynamoDB write complete for app_uuid={app_uuid}")

    # Pass through all context needed by downstream functions
    return {
        "app_uuid": app_uuid,
        "bucket": bucket,
        "customer_details": customer_details
    }
