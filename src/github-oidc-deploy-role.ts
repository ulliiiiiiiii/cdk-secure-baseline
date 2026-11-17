import { Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const GITHUB_OIDC_HOST = 'token.actions.githubusercontent.com';

export interface GitHubOidcDeployRoleProps {
  /** The one GitHub repository allowed to assume the role, as "owner/name". */
  readonly repository: string;
  /** The one branch allowed to deploy. @default "main" */
  readonly branch?: string;
  /** Reuse the account's GitHub OIDC provider (there can only be one). @default a new native provider */
  readonly provider?: iam.IOidcProvider;
  /** @default one hour */
  readonly maxSessionDuration?: Duration;
}

/**
 * Lets GitHub Actions deploy without stored AWS keys: short-lived credentials through OIDC,
 * trusted for exactly one repository and one branch. The role starts without any
 * permissions, grant only what the pipeline needs.
 */
export class GitHubOidcDeployRole extends Construct {
  public readonly role: iam.Role;
  public readonly provider: iam.IOidcProvider;

  constructor(scope: Construct, id: string, props: GitHubOidcDeployRoleProps) {
    super(scope, id);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(props.repository)) {
      throw new Error(`repository must look like "owner/name", got "${props.repository}"`);
    }
    const branch = props.branch ?? 'main';
    if (!/^[A-Za-z0-9_.\/-]+$/.test(branch)) {
      throw new Error(`branch must be one exact branch name without wildcards, got "${branch}"`);
    }

    this.provider = props.provider ?? new iam.OidcProviderNative(this, 'GitHub', {
      url: `https://${GITHUB_OIDC_HOST}`,
      clientIds: ['sts.amazonaws.com'],
    });
    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.WebIdentityPrincipal(this.provider.oidcProviderArn, {
        StringEquals: {
          [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com',
          [`${GITHUB_OIDC_HOST}:sub`]: `repo:${props.repository}:ref:refs/heads/${branch}`,
        },
      }),
      maxSessionDuration: props.maxSessionDuration ?? Duration.hours(1),
      description: `GitHub Actions deploy role for ${props.repository}@${branch}`,
    });
  }
}
