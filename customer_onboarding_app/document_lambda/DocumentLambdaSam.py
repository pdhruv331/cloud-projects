import json
import logging
import zipfile
import os
import boto3
import csv
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Extract the zip file into the tmp directory
# Upload the three extracted files into a unzipped/ prefix in the document bucket, the individual files must have
# seperate prefix
# Parse the customer details and then upload it to DynamoDB


unzipped_directory = "/tmp/unzipped/"
unzipped_s3_prefix = "unzipped/"
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME'] 
customer_metadata_table = dynamodb.Table(TABLE_NAME)


def unzip_object(bucket, key):
    zip_filename = os.path.basename(key)
    zip_fullpath = f"/tmp/{zip_filename}"

    # Download the zip file from S3 into tmp directory and then extract it. Delete the zipped version from storage after extraction.
    s3.download_file(bucket, key, zip_fullpath)
    with zipfile.ZipFile(zip_fullpath, 'r') as data:
        data.extractall(unzipped_directory)
    os.remove(zip_fullpath)

    unzipped_files = os.listdir(unzipped_directory)
    return unzipped_files


def parse_file(file):
    with open(file, "r") as data:
        csv_data = csv.DictReader(data)
        for row in csv_data:
            return dict(row)


def lambda_handler(event, context):

    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']


    files_list = unzip_object(bucket, key)

    for file_name in files_list:
        logger.info("Uploading file:" + file_name)
        s3.upload_file(unzipped_directory + file_name, bucket, unzipped_s3_prefix + file_name)


    # retrieve app_uuid, selfie_key, license_key, and details_file and save them as variables for later use
    app_uuid = os.path.basename(key).replace(".zip", "")
    selfie_key = f"{unzipped_s3_prefix}{app_uuid}_selfie.png"
    license_key = f"{unzipped_s3_prefix}{app_uuid}_license.png"
    details_file = f"{unzipped_directory}{app_uuid}_details.csv"

    #Parse the details_file and then upload the parsed items to dynamoDB
    logger.info("Uploading customer details to DynamoDB")
    customer_details = parse_file(details_file)
    customer_details['APP_UUID'] = app_uuid
    customer_metadata_table.put_item(Item=customer_details)
    

    # Add print to verify your solution by checking CloudWatch logs
    # You can remove these print statements once you verified your solution
    print(f"app_uuid = {app_uuid}")
    print(f"selfie_key = {selfie_key}")
    print(f"license_key = {license_key}")
    print(f"details_file = {details_file}")




