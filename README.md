
# Cloud Projects
 
A collection of hands-on AWS cloud projects I've built to learn and demonstrate core cloud infrastructure concepts — hosting, compute, networking, security, and content delivery.
 
## Projects
 
| Project | Description | AWS Services |
|---|---|---|
| [Resume Hosted on S3 + CloudFront](./resumefromstaticwebsite) | A static HTML/CSS resume hosted on S3 and served securely over HTTPS via a CloudFront distribution. | S3, CloudFront |
| [Serverless CRUD API](./simple_serverless) | A REST API built with API Gateway and Lambda for create/read/update/delete/list operations on a DynamoDB table, tested with Postman. | API Gateway, Lambda, DynamoDB, IAM |
| [Customer Onboarding App](./customer_onboarding_app) | A secure customer onboarding application for a bank, verifying identity documents via Rekognition/Textract and third-party license validation — in progress. | S3, Lambda, DynamoDB, SNS, SQS, Rekognition, Textract, API Gateway, IAM |
| [Self-Hosted n8n on EC2](./n8n_on_ec2) | The n8n workflow-automation app in Docker on a free-tier EC2 instance, served over HTTPS at n8n.builtbydhruv.com via Caddy + Let's Encrypt, with DNS on Route 53 alongside the Amplify-hosted apex. | EC2, VPC, Elastic IP, Route 53, IAM |
 
More projects will be added here as I continue building out this repo.
 
## About Me
 
I'm Dhruv Patel, and I'm building this repo to document and showcase practical AWS projects as part of my journey into cloud engineering. Each folder contains its own README with a project overview, architecture, and screenshots.
 
**Contact:** [pdhruv331@gmail.com](mailto:pdhruv331@gmail.com)
 


