import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import 'dotenv/config';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const usersTableName = process.env.MIMAMORI_USERS_TABLE || "MimamoriUsers";

async function createTable() {
  const params = {
    TableName: usersTableName,
    KeySchema: [
      { AttributeName: "email", KeyType: "HASH" },
    ],
    AttributeDefinitions: [
      { AttributeName: "email", AttributeType: "S" },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };
  try {
    const data = await client.send(new CreateTableCommand(params));
    console.log("Table created:", data.TableDescription?.TableName);
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log("Table already exists.");
    } else {
      console.error("Error creating table:", err);
    }
  }
}
createTable();
