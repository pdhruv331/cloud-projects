# Customer Onboarding App

A capstone project where I take on the role of a cloud application developer at "AnyCompany Bank," building a customer onboarding application on AWS. During onboarding, the bank exchanges sensitive documentation with customers (ID, selfie, application data) to meet regulatory requirements before offering products and services — this project designs and builds the secure, event-driven backend for that exchange.

## Progress

| Part | Description | Status |
|---|---|---|
| Customer Onboarding App | Design and deploy the document/identity verification pipeline shown below | Not started |

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

_TODO_

## Infrastructure as Code

_TODO_

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
