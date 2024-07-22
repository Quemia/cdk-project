import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3deploy from '@aws-cdk/aws-s3-deployment';
import * as path from 'path';
import {
  aws_codebuild as codebuild,
  aws_codecommit as codecommit,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_elasticbeanstalk as elasticbeanstalk,
  aws_s3 as s3, aws_s3_deployment
} from 'aws-cdk-lib';

export class HelloCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Criação do repositório CodeCommit
    const codeCommitRepository = new codecommit.Repository(this, 'RepositoryCodeCommit', {
      repositoryName: 'myAppPy',
      description: 'my app made with python'
    });

    // Projeto CodeBuild
    const codeBuildProject = new codebuild.Project(this, 'CodeCommitRepoBuild', {
      source: codebuild.Source.codeCommit({
        repository: codeCommitRepository,
      }),
    });

    // Bucket S3
    const codeBucket = new s3.Bucket(this, 'kekeBucketPy', {
      versioned: true,
    });

    //------------------------------------

    // Aplicação Elastic Beanstalk
    const elasticApplication = new elasticbeanstalk.CfnApplication(this, 'ElasticApplication', {
      applicationName: 'MyAppPy'
    });

    // Bucket S3 para o pacote do aplicativo elastic
    const appBucket = new s3.Bucket(this, 'AppBucket');

    // @ts-ignore
    const appSource = s3deploy.Source.asset(this, 'appAsset', {
      path:path.join(__dirname, '../cdk-hnb659fds-assets-471112743502-sa-east-1/packageAsset/package.zip')
    });


    // Deploy do pacote para o bucket S3
    // new s3deploy.BucketDeployment(this, 'AppDeployment', {
    //   sources: [appSource],
    //   destinationBucket: appBucket
    // });

    // Versão do  Elastic Beanstalk
    const appVersion = new elasticbeanstalk.CfnApplicationVersion(this, 'AppVersion', {
      applicationName: elasticApplication.applicationName!,
      // sourceBundle: {
      //   s3Bucket: appBucket.bucketName,
      //   // s3Key: appSource.s3ObjectKey ?? ''
      // }
    });

    // Ambiente Elastic Beanstalk
    const elasticBeanstalkEnvironment = new elasticbeanstalk.CfnEnvironment(this, 'AppPythonEnvironment', {
      environmentName: 'MyPythonEnvironment',
      applicationName: elasticApplication.applicationName!,
      solutionStackName: '64bit Amazon Linux 2023 v5.2.0 running Tomcat 10 Corretto 17',
      optionSettings: [{
        namespace: 'aws:elasticbeanstalk:environment',
        optionName: 'EnvironmentType',
        value: 'SingleInstance'
      }],
      versionLabel: v1, // Substituir pela versão apropriado
    });

    // Artefatos do CodePipeline
    const pipelineSourceArtifact = new codepipeline.Artifact();
    const pipelineBuildArtifact = new codepipeline.Artifact();

    // Pipeline CodePipeline
    const pyPipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'py-pipe',
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeCommitSourceAction({
              actionName: 'Source',
              repository: codeCommitRepository,
              output: pipelineSourceArtifact,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
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
            new codepipeline_actions.S3DeployAction({
              actionName: 'Deploy',
              input: pipelineBuildArtifact,
              bucket: codeBucket,
              objectKey: 'deploy.zip',
            }),
          ],
        },
      ],
    });
  }
}
