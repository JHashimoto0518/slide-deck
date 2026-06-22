#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { CdkEc2Stack } from '../lib/cdk-ec2-stack';

const app = new cdk.App();
new CdkEc2Stack(app, 'CdkEc2Stack');
