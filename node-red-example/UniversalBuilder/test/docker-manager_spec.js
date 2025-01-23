const { expect } = require('chai');
const sinon = require('sinon');
const DockerManager = require('../src/lib/docker-manager');

describe('Docker Manager', function() {
    let dockerManager;
    let dockerodeMock;

    beforeEach(function() {
        // Create mock for dockerode
        dockerodeMock = {
            buildImage: sinon.stub(),
            listImages: sinon.stub(),
            getImage: sinon.stub(),
            createContainer: sinon.stub(),
            listContainers: sinon.stub()
        };
        dockerManager = new DockerManager(dockerodeMock);
    });

    afterEach(function() {
        sinon.restore();
    });

    describe('#buildImage', function() {
        it('should build image successfully', async function() {
            const imageName = 'test-image';
            const buildContext = './test-context';
            
            dockerodeMock.buildImage.resolves({ id: 'test-image-id' });
            
            const result = await dockerManager.buildImage(imageName, buildContext);
            expect(result).to.have.property('id', 'test-image-id');
            expect(dockerodeMock.buildImage.calledOnce).to.be.true;
        });

        it('should handle build errors', async function() {
            const imageName = 'test-image';
            const buildContext = './test-context';
            
            dockerodeMock.buildImage.rejects(new Error('Build failed'));
            
            try {
                await dockerManager.buildImage(imageName, buildContext);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('Build failed');
            }
        });
    });

    describe('#pushImage', function() {
        it('should push image successfully', async function() {
            const imageName = 'test-image';
            const registry = 'test-registry';
            
            const imageMock = {
                push: sinon.stub().resolves()
            };
            dockerodeMock.getImage.returns(imageMock);
            
            await dockerManager.pushImage(imageName, registry);
            expect(dockerodeMock.getImage.calledOnce).to.be.true;
            expect(imageMock.push.calledOnce).to.be.true;
        });

        it('should handle push errors', async function() {
            const imageName = 'test-image';
            const registry = 'test-registry';
            
            const imageMock = {
                push: sinon.stub().rejects(new Error('Push failed'))
            };
            dockerodeMock.getImage.returns(imageMock);
            
            try {
                await dockerManager.pushImage(imageName, registry);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('Push failed');
            }
        });
    });

    describe('#runContainer', function() {
        it('should run container successfully', async function() {
            const imageName = 'test-image';
            const containerConfig = {
                port: 8080,
                env: ['TEST=true']
            };
            
            const containerMock = {
                start: sinon.stub().resolves(),
                id: 'test-container-id'
            };
            dockerodeMock.createContainer.resolves(containerMock);
            
            const result = await dockerManager.runContainer(imageName, containerConfig);
            expect(result).to.have.property('id', 'test-container-id');
            expect(dockerodeMock.createContainer.calledOnce).to.be.true;
            expect(containerMock.start.calledOnce).to.be.true;
        });

        it('should handle container run errors', async function() {
            const imageName = 'test-image';
            const containerConfig = {
                port: 8080,
                env: ['TEST=true']
            };
            
            dockerodeMock.createContainer.rejects(new Error('Container creation failed'));
            
            try {
                await dockerManager.runContainer(imageName, containerConfig);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('Container creation failed');
            }
        });
    });

    describe('#listContainers', function() {
        it('should list running containers', async function() {
            const containers = [
                { Id: 'container1', Names: ['/test1'] },
                { Id: 'container2', Names: ['/test2'] }
            ];
            
            dockerodeMock.listContainers.resolves(containers);
            
            const result = await dockerManager.listContainers();
            expect(result).to.deep.equal(containers);
            expect(dockerodeMock.listContainers.calledOnce).to.be.true;
        });

        it('should handle list errors', async function() {
            dockerodeMock.listContainers.rejects(new Error('List failed'));
            
            try {
                await dockerManager.listContainers();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('List failed');
            }
        });
    });

    describe('#cleanup', function() {
        it('should cleanup resources successfully', async function() {
            const containerMock = {
                stop: sinon.stub().resolves(),
                remove: sinon.stub().resolves()
            };
            dockerodeMock.getContainer = sinon.stub().returns(containerMock);
            
            await dockerManager.cleanup('test-container-id');
            expect(dockerodeMock.getContainer.calledOnce).to.be.true;
            expect(containerMock.stop.calledOnce).to.be.true;
            expect(containerMock.remove.calledOnce).to.be.true;
        });

        it('should handle cleanup errors gracefully', async function() {
            const containerMock = {
                stop: sinon.stub().rejects(new Error('Stop failed')),
                remove: sinon.stub().resolves()
            };
            dockerodeMock.getContainer = sinon.stub().returns(containerMock);
            
            try {
                await dockerManager.cleanup('test-container-id');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('Stop failed');
            }
        });
    });
}); 