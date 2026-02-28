// Re-export the DynamoDB clients from centralized aws-clients
import { docClient } from '@/lib/aws-clients';

export default docClient;
