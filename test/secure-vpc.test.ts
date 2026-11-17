import { Match, Template } from 'aws-cdk-lib/assertions';
import { SecureVpc } from '../src';
import { nagErrors, testStack } from './helpers';

test('logs every packet to an encrypted log group with rotation and retention', () => {
  const stack = testStack();
  new SecureVpc(stack, 'Net');
  const t = Template.fromStack(stack);
  t.hasResourceProperties('AWS::EC2::FlowLog', { TrafficType: 'ALL', LogDestinationType: 'cloud-watch-logs' });
  t.hasResourceProperties('AWS::Logs::LogGroup', { KmsKeyId: Match.anyValue(), RetentionInDays: 365 });
  t.hasResourceProperties('AWS::KMS::Key', { EnableKeyRotation: true });
});

test('has three tiers per zone, a restricted default security group and an S3 gateway endpoint', () => {
  const stack = testStack();
  new SecureVpc(stack, 'Net');
  const t = Template.fromStack(stack);
  t.resourceCountIs('AWS::EC2::Subnet', 6);
  t.resourceCountIs('AWS::EC2::NatGateway', 1);
  t.resourceCountIs('Custom::VpcRestrictDefaultSG', 1);
  t.hasResourceProperties('AWS::EC2::VPCEndpoint', { VpcEndpointType: 'Gateway' });
});

test('without NAT gateways the app tier is fully isolated', () => {
  const stack = testStack();
  new SecureVpc(stack, 'Net', { natGateways: 0 });
  const t = Template.fromStack(stack);
  t.resourceCountIs('AWS::EC2::NatGateway', 0);
  t.resourceCountIs('AWS::EC2::Subnet', 6);
});

test('passes the cdk-nag AwsSolutions checks', () => {
  const stack = testStack();
  new SecureVpc(stack, 'Net');
  expect(nagErrors(stack)).toEqual([]);
});
