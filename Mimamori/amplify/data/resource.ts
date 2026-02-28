import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Mimamori Data Schema
 * Defines the data models used by the Mimamori healthcare platform.
 * Note: The app primarily uses custom DynamoDB tables (MimamoriData, MimamoriUsers)
 * via the AWS SDK directly. This Amplify data layer provides a GraphQL API
 * for any additional data needs.
 */
const schema = a.schema({
  UserProfile: a
    .model({
      email: a.string().required(),
      name: a.string().required(),
      role: a.string(),
      phone: a.string(),
      dateOfBirth: a.string(),
      gender: a.string(),
      bloodType: a.string(),
      conditions: a.string().array(),
      allergies: a.string().array(),
    })
    .authorization((allow) => [allow.owner(), allow.guest()]),

  MedicalDocument: a
    .model({
      name: a.string().required(),
      type: a.string(),
      fileUrl: a.string(),
      status: a.string(),
      analysis: a.json(),
      ownerEmail: a.string(),
    })
    .authorization((allow) => [allow.owner(), allow.guest()]),

  DailyLog: a
    .model({
      text: a.string().required(),
      transcript: a.string(),
      probes: a.string().array(),
      probeAnswers: a.json(),
      entities: a.json(),
      ownerEmail: a.string(),
    })
    .authorization((allow) => [allow.owner(), allow.guest()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});
