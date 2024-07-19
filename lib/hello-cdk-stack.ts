import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_codebuild,
  aws_codecommit,
  aws_codepipeline,
  aws_codepipeline_actions,
  aws_ec2,
  aws_elasticbeanstalk,
  aws_s3
} from "aws-cdk-lib";

export class HelloCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const codeCommitRepository = new aws_codecommit.Repository(this, 'RepositoryCodeCommit',{
      repositoryName: 'myAppPy',
      description: 'my app made with python'
    });

    const codeBuildProject = new aws_codebuild.Project(this, 'CodeCommitRepoBuild',{
      // secondarySources: [
      //     aws_codebuild.Source.codeCommit({
      //       identifier: 'myAppPy',
      //       repository: repo,
      //     }),
      // ],
      source: aws_codebuild.Source.codeCommit({
        identifier: 'myAppPy',
        repository: codeCommitRepository,
      }),
    });


    const codeBucket = new aws_s3.Bucket(this, 'kekeBucketPy', {
      versioned: true,
    });

    const ElasticApplication = new elasticbeanstalk.CfnApplication(stack, 'ElasticApplication', {
      applicationName: 'MyAppPy',
    });

    const elasticBeanstalkCode = new aws_elasticbeanstalk.CfnEnvironment(
        this,
        'AppPythonEnvironment',{
          environmentName: 'MyPythonEnvironment',
          applicationName: ElasticApplication.applicationName!,
          optionSettings: [{
            namespace: 'namespace',
            optionName: 'optionName'
          }],
          versionLabel: productionVersion,
    } );



    const pipelineSourceArtifact = new aws_codepipeline.Artifact();
    const pipelineBuildArtifact = new aws_codepipeline.Artifact();

    //
    const pipelineSourceAction = new aws_codepipeline_actions.S3SourceAction({
      actionName: 'S3Source',
      bucket: codeBucket,
      bucketKey: 'path/to/source.txt',
      output: pipelineSourceArtifact,
    });

    const pyPipeline = new aws_codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'py-pipe',
      artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [
              new aws_codepipeline_actions.CodeCommitSourceAction({
              // CodeCommitSourceAction -> pipeline acionado sempre que tiver mudança no repositório do codecommit
                actionName: 'Source',
                repository: codeCommitRepository,
                output: pipelineSourceArtifact,
              }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
              new aws_codepipeline_actions.CodeBuildAction({
                actionName: 'Build',
                input: pipelineSourceArtifact,
                project: codeBuildProject,
                outputs: [pipelineBuildArtifact],
              }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
              new aws_codepipeline_actions.S3DeployAction({
                actionName: 'Deploy',
                input: pipelineSourceArtifact,
                objectKey: `${pipelineSourceAction.variables.versionId}.txt`,
                bucket: codeBucket
              }),
          ],
        },
      ],
    });



  }
}
