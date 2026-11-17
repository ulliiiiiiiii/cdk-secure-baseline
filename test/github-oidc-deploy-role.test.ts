import { Match, Template } from 'aws-cdk-lib/assertions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { GitHubOidcDeployRole } from '../src';
import { nagErrors, testStack } from './helpers';

test('trusts exactly one repository and branch, for one hour, with no permissions yet', () => {
  const stack = testStack();
  new GitHubOidcDeployRole(stack, 'Deploy', { repository: 'acme/app' });
  const t = Template.fromStack(stack);
  t.hasResourceProperties('AWS::IAM::Role', {
    MaxSessionDuration: 3600,
    AssumeRolePolicyDocument: {
      Statement: [Match.objectLike({
        Action: 'sts:AssumeRoleWithWebIdentity',
        Condition: {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': 'repo:acme/app:ref:refs/heads/main',
          },
        },
      })],
    },
  });
  t.resourceCountIs('AWS::IAM::Policy', 0);
  t.hasResourceProperties('AWS::IAM::OIDCProvider', {
    Url: 'https://token.actions.githubusercontent.com',
    ClientIdList: ['sts.amazonaws.com'],
  });
});

test('reuses an existing provider instead of creating a second one', () => {
  const stack = testStack();
  const provider = iam.OidcProviderNative.fromOidcProviderArn(stack, 'Existing',
    'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com');
  new GitHubOidcDeployRole(stack, 'Deploy', { repository: 'acme/app', branch: 'release', provider });
  const t = Template.fromStack(stack);
  t.resourceCountIs('AWS::IAM::OIDCProvider', 0);
  t.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: { Statement: [Match.objectLike({
      Condition: { StringEquals: Match.objectLike({
        'token.actions.githubusercontent.com:sub': 'repo:acme/app:ref:refs/heads/release' }) },
    })] },
  });
});

test('rejects vague trust: no owner/name, wildcard branches', () => {
  const stack = testStack();
  expect(() => new GitHubOidcDeployRole(stack, 'A', { repository: 'acme' })).toThrow(/owner\/name/);
  expect(() => new GitHubOidcDeployRole(stack, 'B', { repository: 'acme/*' })).toThrow(/owner\/name/);
  expect(() => new GitHubOidcDeployRole(stack, 'C', { repository: 'acme/app', branch: 'feature/*' })).toThrow(/wildcards/);
});

test('passes the cdk-nag AwsSolutions checks', () => {
  const stack = testStack();
  new GitHubOidcDeployRole(stack, 'Deploy', { repository: 'acme/app' });
  expect(nagErrors(stack)).toEqual([]);
});
