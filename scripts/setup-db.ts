import { CreateTableCommand, type CreateTableCommandInput } from "@aws-sdk/client-dynamodb";
import { client } from "../lib/dynamodb.js";

const usersTableName = process.env.MIMAMORI_USERS_TABLE || "MimamoriUsers";
const dataTableName = process.env.MIMAMORI_DATA_TABLE || "MimamoriData";

async function createTable(params: CreateTableCommandInput) {
  try {
    const data = await client.send(new CreateTableCommand(params));
    console.log(`Table ${params.TableName} created successfully:`, data.TableDescription?.TableName);
  } catch (err: any) {
    if (err.name === "ResourceInUseException") {
      console.log(`Table ${params.TableName} already exists.`);
    } else {
      console.error(`Error creating table ${params.TableName}:`, err);
    }
  }
}

async function setup() {
  const usersParams: CreateTableCommandInput = {
    TableName: usersTableName,
    KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  };

  const dataParams: CreateTableCommandInput = {
    TableName: dataTableName,
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" }
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  };

  await createTable(usersParams);
  await createTable(dataParams);
}

setup();
