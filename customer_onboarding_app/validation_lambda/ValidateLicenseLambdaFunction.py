import os
import boto3
import csv
import zipfile
import json

# Mock DMV driver license API responds with the validation_override

def lambda_handler(event, context):

    # Takes API gateway event and responds with the validation_override
    # sample event  {'body': '{"driver_license_id": "S123456579010", "validation_override": false}'}

    # Parse the JSON data
    json_data = json.loads(event['body'])
    license_id = json_data['driver_license_id']
    is_valid = json_data['validation_override']


    response = {}
    response['statusCode'] = 200
    response['body'] = is_valid
    return response



