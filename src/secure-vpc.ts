import { Aws, RemovalPolicy } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface SecureVpcProps {
  /** Availability zones to span. @default 2 */
  readonly maxAzs?: number;
  /** NAT gateways for outbound traffic from the app tier; 0 isolates it completely. @default 1 */
  readonly natGateways?: number;
  /** How long VPC flow logs are kept. @default one year */
  readonly flowLogRetention?: logs.RetentionDays;
}

/**
 * A VPC that is safe to build on: three tiers (public, app, data), every packet logged to an
 * encrypted log group, the default security group stripped of all rules, and S3 traffic kept
 * inside AWS through a gateway endpoint.
 */
export class SecureVpc extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly flowLogKey: kms.Key;
  public readonly flowLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: SecureVpcProps = {}) {
    super(scope, id);
    const natGateways = props.natGateways ?? 1;

    this.flowLogKey = new kms.Key(this, 'FlowLogKey', {
      description: 'Encrypts the VPC flow logs',
      enableKeyRotation: true,
    });
    // CloudWatch Logs can only encrypt with a customer key it is allowed to use (AWS docs)
    this.flowLogKey.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal(`logs.${Aws.REGION}.amazonaws.com`)],
      actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
      resources: ['*'],
      conditions: {
        ArnLike: { 'kms:EncryptionContext:aws:logs:arn': `arn:${Aws.PARTITION}:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:*` },
      },
    }));
    this.flowLogGroup = new logs.LogGroup(this, 'FlowLogs', {
      retention: props.flowLogRetention ?? logs.RetentionDays.ONE_YEAR,
      encryptionKey: this.flowLogKey,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: props.maxAzs ?? 2,
      natGateways,
      restrictDefaultSecurityGroup: true,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: 'app',
          subnetType: natGateways > 0 ? ec2.SubnetType.PRIVATE_WITH_EGRESS : ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 22,
        },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      flowLogs: {
        all: {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(this.flowLogGroup),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
      gatewayEndpoints: { S3: { service: ec2.GatewayVpcEndpointAwsService.S3 } },
    });
  }
}
