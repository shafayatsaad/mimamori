/**
 * Centralized AWS client initialization.
 *
 * Credentials are resolved in this order:
 *   1. APP_ACCESS_KEY_ID / APP_SECRET_ACCESS_KEY env vars (Amplify Hosting)
 *   2. AWS SDK default provider chain (IAM roles, ~/.aws/credentials, etc.)
 *
 * Region is read from Config_Service.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { SESClient } from '@aws-sdk/client-ses';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ComprehendMedicalClient } from '@aws-sdk/client-comprehendmedical';
import { TextractClient } from '@aws-sdk/client-textract';
import { getConfig } from './config-service';

const { region } = getConfig().aws;

// Build explicit credentials when APP_ env vars are set (Amplify can't use AWS_ prefix)
const credentials =
  process.env.APP_ACCESS_KEY_ID && process.env.APP_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.APP_ACCESS_KEY_ID,
        secretAccessKey: process.env.APP_SECRET_ACCESS_KEY,
      }
    : undefined;

// S3 bucket lives in us-east-1 (Amplify default); other services use the configured region.
export const s3Client = new S3Client({ region: 'us-east-1', credentials });
export const sesClient = new SESClient({ region, credentials });
export const bedrockClient = new BedrockRuntimeClient({ region, credentials, requestHandler: { requestTimeout: 30_000 } });

const dynamoClient = new DynamoDBClient({ region, credentials });
export const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const comprehendMedicalClient = new ComprehendMedicalClient({ region, credentials, requestHandler: { requestTimeout: 15_000 } });
export const textractClient = new TextractClient({ region, credentials });
