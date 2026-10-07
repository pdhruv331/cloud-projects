import json
import logging
import zipfile
import os
from urllib.parse import unquote_plus
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

unzipped_directory = "/tmp/unzipped/"
unzipped_s3_prefix = "unzipped/"
region = os.environ.get('AWS_REGION', 'us-east-1')

s3 = boto3.client('s3', region_name=region)
sfn = boto3.client('stepfunctions', region_name=region)

STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']


def lambda_handler(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    # S3 event keys are URL-encoded (spaces arrive as '+'), so decode before using the key
    key = unquote_plus(event['Records'][0]['s3']['object']['key'])

    logger.info(f"Unzipping s3://{bucket}/{key}")

    # Download the zip file from S3 into /tmp, extract it, then remove the zip
    zip_filename = os.path.basename(key)
    zip_fullpath = f"/tmp/{zip_filename}"

    s3.download_file(bucket, key, zip_fullpath)
    os.makedirs(unzipped_directory, exist_ok=True)
    with zipfile.ZipFile(zip_fullpath, 'r') as zf:
        zf.extractall(unzipped_directory)
    os.remove(zip_fullpath)

    # Upload each extracted file to the unzipped/ prefix in S3
    for file_name in os.listdir(unzipped_directory):
        logger.info(f"Uploading file: {file_name}")
        s3.upload_file(
            unzipped_directory + file_name,
            bucket,
            unzipped_s3_prefix + file_name
        )

    # Derive app_uuid from the zip filename (e.g. "8d247914.zip" -> "8d247914")
    app_uuid = os.path.basename(key).replace(".zip", "")

    logger.info(f"Unzip complete. app_uuid={app_uuid}. Starting state machine.")

    # Start the Step Functions state machine, passing app_uuid and bucket
    # as the input for the WriteDynamo state
    sfn.start_execution(
        stateMachineArn=STATE_MACHINE_ARN,
        name=f"{app_uuid}-{context.aws_request_id}",  # execution names must be unique, so re-uploads still start
        input=json.dumps({
            "app_uuid": app_uuid,
            "bucket": bucket
        })
    )

    logger.info(f"State machine execution started for app_uuid={app_uuid}")
    return {"app_uuid": app_uuid, "bucket": bucket}
