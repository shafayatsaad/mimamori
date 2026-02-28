import { BedrockClient, ListPromptRoutersCommand } from "@aws-sdk/client-bedrock";

const client = new BedrockClient({ 
  region: process.env.AWS_REGION || "us-east-1",
});

async function run() {
  try {
    const command = new ListPromptRoutersCommand({
        type: "default"
    });
    const response = await client.send(command);
    console.log(JSON.stringify(response.promptRouterSummaries, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
