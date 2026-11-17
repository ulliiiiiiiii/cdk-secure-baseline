import * as s3 from 'aws-cdk-lib/aws-s3';
import { nagErrors, testStack } from './helpers';

test('control: the cdk-nag check really catches an insecure resource', () => {
  const stack = testStack();
  new s3.Bucket(stack, 'Plain');
  expect(nagErrors(stack)).toEqual(expect.arrayContaining([expect.stringMatching(/^AwsSolutions-S1: Test\/Plain/)]));
});
