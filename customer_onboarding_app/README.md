# Customer Onboarding App

A capstone project where I take on the role of a cloud application developer at "AnyCompany Bank," building a customer onboarding application on AWS. During onboarding, the bank exchanges sensitive documentation with customers (ID, selfie, application data) to meet regulatory requirements before offering products and services — this project designs and builds the secure, event-driven backend for that exchange.

## Progress

| Part | Description | Status |
|---|---|---|
| Customer Onboarding App | Design and deploy the document/identity verification pipeline shown below | In progress |

## Overview

The app lets a customer submit application data, a selfie, and a driver's license photo through a client (web or mobile). The backend verifies the customer's identity by matching the selfie against the license photo and extracting/validating the license details, then records the outcome — all without a human in the loop for the happy path.

## Architecture

![Architecture diagram](./images/architecture-diagram.png)

1. **Client / Mobile client** — customer submits app data, a selfie, and a license photo
2. **S3 document bucket** — uploads land here
3. **Document Lambda function** — triggered by the S3 upload; orchestrates verification
4. **DynamoDB Table** — stores document/application state
5. **SNS topic** — notified of table changes
6. **Amazon Rekognition** — compares the selfie to the license photo for identity match
7. **Amazon Textract** — extracts text/fields from the license image
8. **SQS queue** — Document Lambda hands off license verification work
9. **License Lambda function** — triggered by the SQS queue
10. **Amazon API Gateway → Validate license Lambda function (third party)** — License Lambda calls out to a third-party service to validate the license, then writes the result back to the Table
11. **Document Lambda function IAM role** — scopes the Document Lambda's permissions to only what it needs (S3, Rekognition, Textract, DynamoDB, SNS, SQS)

## What I Did

- Created the S3 document bucket, `customer-application-data-5911`, to receive customer app data, selfies, and license photo uploads
- Added a bucket policy denying access to the bucket and its objects over plain HTTP, requiring HTTPS (`aws:SecureTransport`)
- Created the Lambda execution role `customer-onboarding-lambda-role`, with a trust policy allowing `sts:AssumeRole` (for the Lambda service)
- Created the permissions policy `document_lambda_policy`, granting the Document Lambda `s3:GetObject` and `s3:PutObject` on the application bucket, `dynamodb:PutItem` and `dynamodb:UpdateItem` on the DynamoDB table, and `sns:Publish` on the SNS topic
- Added a bucket policy statement denying `s3:GetObject` to everyone except the Lambda role using `ArnNotEquals`
- Created the `CustomerMetadataTable` DynamoDB table with `APP_UUID` as the partition key, provisioned with 2 RCUs and 2 WCUs, with auto scaling configured to scale between 2 and 20 at 70% utilization
- Created the `ApplicationNotifications` SNS topic encrypted with the default `alias/aws/sns` KMS key, with an email subscription
- Wrote `DocumentLambda.py` — triggered by S3 `ObjectCreated:Put` on the `zipped/` prefix; downloads and extracts the zip to `/tmp`, uploads extracted files to the `unzipped/` prefix, parses the customer details CSV, and writes the record to DynamoDB

## Infrastructure as Code

Migrated the document-ingestion half of the pipeline (steps 1-5 in the architecture diagram) to AWS SAM (`template.yaml`); the license-verification half (SQS, License Lambda, Textract, API Gateway) is still manual/not started. Covers:

- **S3 bucket** (`CustomerApplicationBucket`) with HTTP deny bucket policy
- **DynamoDB table** (`CustomerMetadataTable`) with provisioned capacity and Application Auto Scaling for read and write capacity (target 70%, min 2, max 20)
- **SNS topic** (`ApplicationNotifications`) with KMS encryption and email subscription
- **IAM role** (`DocumentLambdaRole`) with inline policies for CloudWatch Logs, S3, DynamoDB, and SNS — scoped to least privilege with no AWS managed policies
- **Lambda function** (`DocumentLambdaFunction`) using Python 3.13 runtime, 20s timeout, S3 event trigger on `zipped/` prefix, and `DYNAMODB_TABLE_NAME` environment variable
- **Lambda invoke permission** allowing S3 to invoke the Lambda (implicit, created by SAM from the `Events` declaration)

### Project Structure

```
customer_onboarding_app/
├── template.yaml               # SAM template
├── samconfig.toml              # SAM deployment config
├── document_lambda/
│   ├── DocumentLambdaSam.py    # Lambda function code
│   └── requirements.txt
└── images/
    └── architecture-diagram.png
```

### Deploy

```bash
sam build && sam deploy
```

## Screenshots

_TODO_

## Files in This Directory

_TODO_

## Tech / Services Used

- **Amazon S3** — document bucket for uploaded app data, selfies, and license photos
- **AWS Lambda** — Document Lambda function and License Lambda function
- **Amazon DynamoDB** — table storing onboarding/document state
- **Amazon SNS** — topic notified of table changes
- **Amazon SQS** — queue decoupling document processing from license verification
- **Amazon Rekognition** — selfie-to-license face verification
- **Amazon Textract** — text extraction from license images
- **Amazon API Gateway** — entry point to the third-party license validation service
- **AWS IAM** — least-privilege role for the Document Lambda function

## Why This Project

_TODO_
