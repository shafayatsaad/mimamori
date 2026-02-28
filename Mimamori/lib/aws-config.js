// lib/aws-config.js
import { S3Client } from "@aws-sdk/client-s3";
import { SESClient } from "@aws-sdk/client-ses";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ComprehendMedicalClient } from "@aws-sdk/client-comprehendmedical";
import { TextractClient } from "@aws-sdk/client-textract";
import { config, MEDICAL_MODELS } from './config.js';

// Build credentials object if explicit keys are provided
const credentials = config.accessKeyId && config.secretAccessKey
  ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  : undefined;

// Initialize AWS clients
// S3 bucket is in us-east-1 (Amplify default), other services use config.region
export const s3Client = new S3Client({ region: 'us-east-1', ...(credentials && { credentials }) });
export const sesClient = new SESClient({ region: config.region, ...(credentials && { credentials }) });
export const bedrockClient = new BedrockRuntimeClient({ region: config.region, ...(credentials && { credentials }) });

const dynamoClient = new DynamoDBClient({ region: config.region, ...(credentials && { credentials }) });
export const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const comprehendMedicalClient = new ComprehendMedicalClient({ region: config.region, ...(credentials && { credentials }) });
export const textractClient = new TextractClient({ region: config.region, ...(credentials && { credentials }) });

// Export configuration and models
export { config, MEDICAL_MODELS };

console.log('AWS clients initialized for region:', config.region);
