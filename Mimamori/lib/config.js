// lib/config.js
export const config = {
  region: process.env.APP_REGION || 'us-west-2',
  bucketName: process.env.APP_S3_BUCKET_NAME,
  fromEmail: process.env.APP_SES_FROM_EMAIL,
  bedrockArn: process.env.APP_BEDROCK_ROUTER_ARN,
  usersTable: process.env.MIMAMORI_USERS_TABLE,
  dataTable: process.env.MIMAMORI_DATA_TABLE,
  nodeEnv: process.env.NODE_ENV || 'production'
};

// Medical AI Model Configuration
export const MEDICAL_MODELS = {
  micro: "amazon.nova-micro-v1:0",
  orchestrator: "anthropic.claude-3-5-haiku-20241022-v1:0",
  analyzer: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  processor: "amazon.nova-pro-v1:0",
  specialist: "amazon.nova-premier-v1:0"
};

console.log('Configuration loaded successfully:', {
  region: config.region,
  bucketName: config.bucketName ? '✓' : '✗',
  fromEmail: config.fromEmail ? '✓' : '✗',
  usersTable: config.usersTable ? '✓' : '✗',
  dataTable: config.dataTable ? '✓' : '✗',
  bedrockArn: config.bedrockArn ? '✓' : '✗',
  credentials: 'using IAM role'
});
