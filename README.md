# cdk-secure-baseline

Secure-by-default building blocks for the AWS CDK. Every construct is checked against the
[cdk-nag](https://github.com/cdklabs/cdk-nag) **AwsSolutions** rules in its tests, without a
single suppression. A control test proves the check actually catches an insecure resource.

## Constructs

### `SecureVpc`: a network that is safe to build on

- three tiers per availability zone: public, app, data
- VPC flow logs for all traffic, stored in CloudWatch Logs, encrypted with a rotating KMS key,
  kept for one year
- default security group stripped of all rules
- S3 traffic stays inside AWS through a gateway endpoint
- `natGateways: 0` isolates the app tier completely

```ts
import { SecureVpc } from 'cdk-secure-baseline';

const net = new SecureVpc(this, 'Net');
// net.vpc is a regular ec2.Vpc
```

### `GitHubOidcDeployRole`: deploy from GitHub Actions without stored AWS keys

- short-lived credentials through OIDC, with the native IAM provider (no helper Lambda)
- trusts exactly one repository and one branch; wildcards are rejected
- one-hour sessions; the role starts without permissions; grant only what the pipeline needs

```ts
import { GitHubOidcDeployRole } from 'cdk-secure-baseline';

const deploy = new GitHubOidcDeployRole(this, 'Deploy', { repository: 'acme/app' });
bucket.grantReadWrite(deploy.role);
```

```yaml
# .github/workflows/deploy.yml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: <deploy role ARN>
      aws-region: eu-central-1
```

## Checks

```sh
npm install
npm run check   # type check + tests, including the cdk-nag AwsSolutions rules
```

## Roadmap

Containers (Fargate), monitoring and alarms, least-privilege roles.

## License

Apache-2.0
