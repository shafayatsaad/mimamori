import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";
const bucketName = process.env.AWS_S3_BUCKET_NAME || `mimamori-vault-${accessKeyId.toLowerCase()}`;

if (!accessKeyId) {
  console.error("Missing AWS_ACCESS_KEY_ID");
  process.exit(1);
}

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: { accessKeyId, secretAccessKey },
});

async function applyCORS() {
  try {
    console.log(`Applying CORS to bucket: ${bucketName}`);
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
              AllowedOrigins: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      })
    );
    console.log("CORS applied successfully.");
  } catch (error) {
    console.error("Failed to apply CORS:", error);
  }
}

applyCORS();
