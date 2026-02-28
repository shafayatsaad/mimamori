import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';

/**
 * Mimamori Backend Configuration
 * Defines auth, data models, and custom IAM policies for AWS services
 */
const backend = defineBackend({
  auth,
  data,
});

// Get the authenticated user role to attach policies to
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;

// Grant SES permissions (send emails, verify identities)
const sesPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'ses:SendEmail',
    'ses:SendRawEmail',
    'ses:VerifyEmailIdentity',
    'ses:GetIdentityVerificationAttributes',
  ],
  resources: ['*'],
});

// Grant Bedrock permissions (invoke models for AI analysis)
const bedrockPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'bedrock:InvokeModel',
    'bedrock:Converse',
    'bedrock:InvokeModelWithResponseStream',
  ],
  resources: ['*'],
});

// Grant ComprehendMedical permissions (detect medical entities)
const comprehendMedicalPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'comprehendmedical:DetectEntitiesV2',
    'comprehendmedical:InferICD10CM',
    'comprehendmedical:InferRxNorm',
  ],
  resources: ['*'],
});

// Grant Textract permissions (extract text from documents)
const textractPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'textract:DetectDocumentText',
    'textract:AnalyzeDocument',
  ],
  resources: ['*'],
});

// Grant DynamoDB permissions for MimamoriData and MimamoriUsers tables
const accountId = Stack.of(backend.auth.resources.authenticatedUserIamRole).account;
const region = Stack.of(backend.auth.resources.authenticatedUserIamRole).region;

const dynamoPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'dynamodb:GetItem',
    'dynamodb:PutItem',
    'dynamodb:UpdateItem',
    'dynamodb:DeleteItem',
    'dynamodb:Query',
    'dynamodb:Scan',
    'dynamodb:BatchGetItem',
    'dynamodb:BatchWriteItem',
  ],
  resources: [
    `arn:aws:dynamodb:${region}:${accountId}:table/MimamoriData`,
    `arn:aws:dynamodb:${region}:${accountId}:table/MimamoriData/index/*`,
    `arn:aws:dynamodb:${region}:${accountId}:table/MimamoriUsers`,
    `arn:aws:dynamodb:${region}:${accountId}:table/MimamoriUsers/index/*`,
  ],
});

// Grant S3 permissions for the document vault bucket
const s3Policy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    's3:GetObject',
    's3:PutObject',
    's3:DeleteObject',
    's3:ListBucket',
  ],
  resources: [
    'arn:aws:s3:::amplify-mimamorimvp-*',
    'arn:aws:s3:::amplify-mimamorimvp-*/*',
    'arn:aws:s3:::mimamori-vault-*',
    'arn:aws:s3:::mimamori-vault-*/*',
  ],
});

// Attach all policies to the authenticated user role
authenticatedRole.addToPrincipalPolicy(sesPolicy);
authenticatedRole.addToPrincipalPolicy(bedrockPolicy);
authenticatedRole.addToPrincipalPolicy(comprehendMedicalPolicy);
authenticatedRole.addToPrincipalPolicy(textractPolicy);
authenticatedRole.addToPrincipalPolicy(dynamoPolicy);
authenticatedRole.addToPrincipalPolicy(s3Policy);
