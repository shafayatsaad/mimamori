# Mimamori

## AWS / Amplify runtime configuration

Set these environment variables in Amplify Hosting for the app runtime:

- `AWS_REGION` (example: `us-east-1`)
- `MIMAMORI_USERS_TABLE` (defaults to `MimamoriUsers` if not set)
- `MIMAMORI_DATA_TABLE` (defaults to `MimamoriData` if not set)
- Optional app features also use:
  - `AWS_S3_BUCKET_NAME`
  - `AWS_SES_FROM_EMAIL`
  - `AWS_BEDROCK_ROUTER_ARN`
  - `AWS_BEARER_TOKEN_BEDROCK`

Use `.env.example` as the local/env template.

Authentication routes currently use DynamoDB tables directly (`/api/auth/login`, `/api/auth/signup`).

If tables do not exist, create them before login/signup traffic:

- Users table: hash key `email` (string)
- Data table: hash key `PK` (string), range key `SK` (string)
