#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HasuraCdkStack } from '../lib/hasura-cdk-stack';

const app = new cdk.App();
new HasuraCdkStack(app, 'HasuraCdkStack', {
  env: { account: '589522649676', region: 'us-east-2' },
});