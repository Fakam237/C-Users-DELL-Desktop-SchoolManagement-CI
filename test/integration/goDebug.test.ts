import * as assert from 'assert';
import { ChildProcess, exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { stringify } from 'querystring';
import * as sinon from 'sinon';
import { DebugConfiguration } from 'vscode';
import {DebugClient} from 'vscode-debugadapter-testsupport';
import { ILocation } from 'vscode-debugadapter-testsupport/lib/debugClient';
import {DebugProtocol} from 'vscode-debugprotocol';
import {
	Delve,
	escapeGoModPath,
	GoDebugSession,
	PackageBuildInfo,
	RemoteSourcesAndPackages,
} from '../../src/debugAdapter/goDebug';
import { GoDebugConfigurationProvider } from '../../src/goDebugConfiguration';
import { getBinPath } from '../../src/util';
import { killProcessTree } from '../../src/utils/processUtils';

suite('Path Manipulation Tests', () => {
	test('escapeGoModPath works', () => {
		assert.strictEqual(escapeGoModPath('BurnSushi/test.go'), '!burn!sushi/test.go');
	});
});

suite('GoDebugSession Tests', async () => {
	const workspaceFolder = '/usr/workspacefolder';
	const delve: Delve = {} as Delve;
	let goDebugSession: GoDebugSession;
	let remoteSourcesAndPackages: RemoteSourcesAndPackages;
	let fileSystem: typeof fs;

	let previousEnv: any;

	setup(() => {
		previousEnv = Object.assign({}, process.env);

		process.env.GOPATH = '/usr/gopath';
		process.env.GOROOT = '/usr/goroot';
		remoteSourcesAndPackages = new RemoteSourcesAndPackages();
		fileSystem = { existsSync: () => false } as unknown as typeof fs;
		delve.program = workspaceFolder;
		delve.isApiV1 = false;
		goDebugSession = new GoDebugSession(true, false, fileSystem);
		goDebugSession['delve'] = delve;
		goDebugSession['remoteSourcesAndPackages'] = remoteSourcesAndPackages;
	});

	teardown(() => {
		process.env = previousEnv;
		sinon.restore();
	});

	test('inferRemotePathFromLocalPath works', () => {
		const sourceFileMapping = new Map<string, string[]>();
		sourceFileMapping.set('main.go', ['/app/hello-world/main.go', '/app/main.go']);
		sourceFileMapping.set('blah.go', ['/app/blah.go']);

		remoteSourcesAndPackages.remoteSourceFilesNameGrouping = sourceFileMapping;

		const inferredPath = goDebugSession['inferRemotePathFromLocalPath'](
			'C:\\Users\\Documents\\src\\hello-world\\main.go');
		assert.strictEqual(inferredPath, '/app/hello-world/main.go');
	});

	test('inferLocalPathFromRemoteGoPackage works for package in workspaceFolder', () => {
		const remotePath = '/src/hello-world/morestrings/morestrings.go';
		const helloPackage: PackageBuildInfo = {
			ImportPath: 'hello-world/morestrings',
			DirectoryPath: '/src/hello-world/morestrings',
			Files: ['/src/hello-world/morestrings/lessstrings.go', '/src/hello-world/morestrings/morestrings.go']
		};

		const testPackage: PackageBuildInfo = {
			ImportPath: 'FooBar/test',
			DirectoryPath: 'remote/pkg/mod/!foo!bar/test@v1.0.2',
			Files: ['remote/pkg/mod/!foo!bar/test@v1.0.2/test.go']
		};

		const localPath = path.join(workspaceFolder, 'hello-world/morestrings/morestrings.go');
		const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
		existsSyncStub.withArgs(localPath).returns(true);

		remoteSourcesAndPackages.remotePackagesBuildInfo = [helloPackage, testPackage];

		goDebugSession['localPathSeparator'] = '/';
		const inferredLocalPath = goDebugSession['inferLocalPathFromRemoteGoPackage'](remotePath);
		assert.strictEqual(inferredLocalPath, localPath);
	});

	test('inferLocalPathFromRemoteGoPackage works for package in GOPATH/pkg/mod', () => {
		const remotePath = 'remote/pkg/mod/!foo!bar/test@v1.0.2/test.go';
		const helloPackage: PackageBuildInfo = {
			ImportPath: 'hello-world',
			DirectoryPath: '/src/hello-world',
			Files: ['src/hello-world/hello.go', 'src/hello-world/world.go']
		};

		const testPackage: PackageBuildInfo = {
			ImportPath: 'FooBar/test',
			DirectoryPath: 'remote/pkg/mod/!foo!bar/test@v1.0.2',
			Files: ['remote/pkg/mod/!foo!bar/test@v1.0.2/test.go']
		};

		const localPath = path.join(process.env.GOPATH, 'pkg/mod/!foo!bar/test@v1.0.2/test.go');
		const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
		existsSyncStub.withArgs(localPath).returns(true);

		remoteSourcesAndPackages.remotePackagesBuildInfo = [helloPackage, testPackage];

		goDebugSession['localPathSeparator'] = '/';
		const inferredLocalPath = goDebugSession['inferLocalPathFromRemoteGoPackage'](remotePath);
		assert.strictEqual(inferredLocalPath, localPath);
	});

	test('inferLocalPathFromRemoteGoPackage works for package in GOPATH/pkg/mod with relative path', () => {
		const remotePath = '!foo!bar/test@v1.0.2/test.go';
		const helloPackage: PackageBuildInfo = {
			ImportPath: 'hello-world',
			DirectoryPath: '/src/hello-world',
			Files: ['src/hello-world/hello.go', 'src/hello-world/world.go']
		};

		const testPackage: PackageBuildInfo = {
			ImportPath: 'FooBar/test',
			DirectoryPath: '!foo!bar/test@v1.0.2',
			Files: ['!foo!bar/test@v1.0.2/test.go']
		};

		const localPath = path.join(process.env.GOPATH, 'pkg/mod/!foo!bar/test@v1.0.2/test.go');
		const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
		existsSyncStub.withArgs(localPath).returns(true);

		remoteSourcesAndPackages.remotePackagesBuildInfo = [helloPackage, testPackage];

		goDebugSession['localPathSeparator'] = '/';
		const inferredLocalPath = goDebugSession['inferLocalPathFromRemoteGoPackage'](remotePath);
		assert.strictEqual(inferredLocalPath, localPath);
	});

	test('inferLocalPathFromRemoteGoPackage works for package in GOPATH/src', () => {
		const remotePath = 'remote/gopath/src/foobar/test@v1.0.2-abcde-34/test.go';
		const helloPackage: PackageBuildInfo = {
			ImportPath: 'hello-world',
			DirectoryPath: '/src/hello-world',
			Files: ['src/hello-world/hello.go', 'src/hello-world/world.go']
		};

		const testPackage: PackageBuildInfo = {
			ImportPath: 'foobar/test',
			DirectoryPath: 'remote/gopath/src/foobar/test@v1.0.2-abcde-34',
			Files: ['remote/gopath/src/foobar/test@v1.0.2-abcde-34/test.go']
		};

		const localPath = path.join(process.env.GOPATH, 'src', 'foobar/test@v1.0.2-abcde-34/test.go');
		const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
		existsSyncStub.withArgs(localPath).returns(true);

		remoteSourcesAndPackages.remotePackagesBuildInfo = [helloPackage, testPackage];

		goDebugSession['localPathSeparator'] = '/';
		const inferredLocalPath = goDebugSession['inferLocalPathFromRemoteGoPackage'](remotePath);
		assert.strictEqual(inferredLocalPath, localPath);
	});

	test('inferLocalPathFromRemoteGoPackage works for package in GOPATH/src with relative path', () => {
		const remotePath = 'foobar/test@v1.0.2/test.go';
		const helloPackage: PackageBuildInfo = {
			ImportPath: 'hello-world',
			DirectoryPath: '/src/hello-world',
			Files: ['src/hello-world/hello.go', 'src/hello-world/world.go']
		};

		const testPackage: PackageBuildInfo = {
			ImportPath: 'foobar/test',
			DirectoryPath: 'foobar/test@v1.0.2',
			Files: ['foobar/test@v1.0.2/test.go']
		};

		const localPath = path.join(process.env.GOPATH, 'src', 'foobar/test@v1.0.2/test.go');
		const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
		existsSyncStub.withArgs(localPath).returns(true);

		remoteSourcesAndPackages.remotePackagesBuildInfo = [helloPackage, testPackage];

		goDebugSession['localPathSeparator'] = '/';
		const inferredLocalPath = goDebugSession['inferLocalPathFromRemoteGoPackage'](remotePath);
		assert.strictEqual(inferredLocalPath, localPath);
	});

	test('inferLocalPathFromRemoteGoPackage works for package in GOROOT/src', () => {
		const remotePath = 'remote/goroot/src/foobar/test@v1.0.2/test.go';
		const helloPackage: PackageBuildInfo = {
			ImportPath: 'hello-world',
			DirectoryPath: '/src/hello-world',
			Files: ['src/hello-world/hello.go', 'src/hello-world/world.go']
		};

		const testPackage: PackageBuildInfo = {
			ImportPath: 'foobar/test',
			DirectoryPath: 'remote/goroot/src/foobar/test@v1.0.2',
			Files: ['remote/goroot/src/foobar/test@v1.0.2/test.go']
		};

		const localPath = path.join(process.env.GOROOT, 'src', 'foobar/test@v1.0.2/test.go');
		const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
		existsSyncStub.withArgs(localPath).returns(true);

		remoteSourcesAndPackages.remotePackagesBuildInfo = [helloPackage, testPackage];

		goDebugSession['localPathSeparator'] = '/';
		const inferredLocalPath = goDebugSession['inferLocalPathFromRemoteGoPackage'](remotePath);
		assert.strictEqual(inferredLocalPath, localPath);
	});

	test('inferLocalPathFromRemoteGoPackage works for package in GOROOT/src with relative path', () => {
		const remotePath = 'foobar/test@v1.0.2/test.go';
		const helloPackage: PackageBuildInfo = {
			ImportPath: 'hello-world',
			DirectoryPath: '/src/hello-world',
			Files: ['src/hello-world/hello.go', 'src/hello-world/world.go']
		};

		const testPackage: PackageBuildInfo = {
			ImportPath: 'foobar/test',
			DirectoryPath: 'foobar/test@v1.0.2',
			Files: ['foobar/test@v1.0.2/test.go']
		};

		const localPath = path.join(process.env.GOROOT, 'src', 'foobar/test@v1.0.2/test.go');
		const existsSyncStub = sinon.stub(fileSystem, 'existsSync');
		existsSyncStub.withArgs(localPath).returns(true);

		remoteSourcesAndPackages.remotePackagesBuildInfo = [helloPackage, testPackage];

		goDebugSession['localPathSeparator'] = '/';
		const inferredLocalPath = goDebugSession['inferLocalPathFromRemoteGoPackage'](remotePath);
		assert.strictEqual(inferredLocalPath, localPath);
	});
});

suite('RemoteSourcesAndPackages Tests', () => {
	const helloPackage: PackageBuildInfo = {
		ImportPath: 'hello-world',
		DirectoryPath: '/src/hello-world',
		Files: ['src/hello-world/hello.go', 'src/hello-world/world.go']
	};
	const testPackage: PackageBuildInfo = {
		ImportPath: 'test',
		DirectoryPath: '/src/test',
		Files: ['src/test/test.go']
	};
	const sources = ['src/hello-world/hello.go', 'src/hello-world/world.go', 'src/test/test.go'];
	let remoteSourcesAndPackages: RemoteSourcesAndPackages;
	let delve: Delve;
	setup(() => {
		delve = { callPromise: () => ({}), isApiV1: false } as unknown as Delve;
		remoteSourcesAndPackages = new RemoteSourcesAndPackages();
	});

	teardown(() => {
		sinon.restore();
	});

	test('initializeRemotePackagesAndSources retrieves remote packages and sources', async () => {
		const stub = sinon.stub(delve, 'callPromise');
		stub.withArgs('ListPackagesBuildInfo', [{ IncludeFiles: true }])
			.returns(Promise.resolve({ List: [helloPackage, testPackage] }));
		stub.withArgs('ListSources', [{}])
			.returns(Promise.resolve({ Sources: sources }));

		await remoteSourcesAndPackages.initializeRemotePackagesAndSources(delve);
		assert.deepEqual(remoteSourcesAndPackages.remoteSourceFiles, sources);
		assert.deepEqual(remoteSourcesAndPackages.remotePackagesBuildInfo, [helloPackage, testPackage]);
	});
});

// Test suite adapted from:
// https://github.com/microsoft/vscode-mock-debug/blob/master/src/tests/adapter.test.ts
suite('Go Debug Adapter', function () {
	this.timeout(160_000);

	const debugConfigProvider = new GoDebugConfigurationProvider();
	const DEBUG_ADAPTER = path.join('.', 'out', 'src', 'debugAdapter', 'goDebug.js');

	const PROJECT_ROOT = path.normalize(path.join(__dirname, '..', '..', '..'));
	const DATA_ROOT = path.join(PROJECT_ROOT, 'test', 'testdata');

	let dc: DebugClient;

	setup(() => {
		dc = new DebugClient('node', path.join(PROJECT_ROOT, DEBUG_ADAPTER), 'go');

		// Launching delve may take longer than the default timeout of 5000.
		dc.defaultTimeout = 20000;

		// To connect to a running debug server for debugging the tests, specify PORT.
		return dc.start();
	});

	teardown(() => dc.stop());

	/**
	 * Helper function to assert that a variable has a particular value.
	 * This should be called when the program is stopped.
	 *
	 * The following requests are issued by this function to determine the
	 * value of the variable:
	 * 	1. threadsRequest
	 *  2. stackTraceRequest
	 * 	3. scopesRequest
	 *  4. variablesRequest
	 */
	async function assertVariableValue(name: string, val: string): Promise<void> {
		const threadsResponse = await dc.threadsRequest();
		assert(threadsResponse.success);
		const stackTraceResponse = await dc.stackTraceRequest({ threadId: threadsResponse.body.threads[0].id });
		assert(stackTraceResponse.success);
		const scopesResponse = await dc.scopesRequest({ frameId: stackTraceResponse.body.stackFrames[0].id });
		assert(scopesResponse.success);
		const variablesResponse = await dc.variablesRequest({
			variablesReference: scopesResponse.body.scopes[0].variablesReference
		});
		assert(variablesResponse.success);
		// Locate the variable with the matching name.
		const i = variablesResponse.body.variables.findIndex((v) => v.name === name);
		assert(i >= 0);
		// Check that the value of name is val.
		assert.strictEqual(variablesResponse.body.variables[i].value, val);
	}

	/**
	 * This function sets up a server that returns helloworld on port 8080.
	 * The server will be started as a Delve remote headless instance
	 * that will listen on the specified port.
	 */
	async function setUpRemoteProgram(port: number): Promise<ChildProcess> {
		const serverFolder = path.join(DATA_ROOT, 'helloWorldServer');
		const toolPath = getBinPath('dlv');
		console.log(`spawning ${toolPath}`)
		const childProcess = spawn(toolPath,
			['debug', '--continue', '--accept-multiclient', '--api-version=2', '--headless', `--listen=127.0.0.1:${port}`],
			{cwd: serverFolder});

		childProcess.stderr.on('data', (data) => console.log('err:', data.toString()));
		childProcess.stdout.on('data', (data) => console.log('out:', data.toString()));

		console.log('waiting...')
		// Give dlv a few minutes to start.
		await new Promise((resolve) => setTimeout(resolve, 10_000));
		console.log('done waiting.')
		return childProcess;
	}

	/**
	 * Helper function to set up remote attach configuration.
	 * This will issue an attachRequest, followed by initializedRequest and then breakpointRequest
	 * if breakpoints are provided. Lastly the configurationDoneRequest will be sent.
	 * NOTE: For simplicity, this function assumes the breakpoints are in the same file.
	 */
	async function setUpRemoteAttach(config: DebugConfiguration, breakpoints: ILocation[] = []): Promise<void> {
		const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);
		console.log(`Setting up attach request for ${debugConfig}.`);
		const attachResult = await dc.attachRequest(debugConfig as DebugProtocol.AttachRequestArguments);
		assert.ok(attachResult.success);
		console.log(`Sending initializing request for remote attach setup.`);
		const initializedResult = await dc.initializeRequest();
		assert.ok(initializedResult.success);
		if (breakpoints.length) {
			console.log(`Sending set breakpoints request for remote attach setup.`);
			const breakpointsResult = await dc.setBreakpointsRequest({source: {path: breakpoints[0].path}, breakpoints});
			assert.ok(breakpointsResult.success && breakpointsResult.body.breakpoints.length === breakpoints.length);
			// Verify that there are no non-verified breakpoints.
			breakpointsResult.body.breakpoints.forEach((breakpoint) => {
				assert.ok(breakpoint.verified);
			});
		}
		console.log(`Sending configuration done request for remote attach setup.`);
		const configurationDoneResult = await dc.configurationDoneRequest();
		assert.ok(configurationDoneResult.success);
	}

	/**
	 * Helper function to retrieved a stopped event for a breakpoint.
	 * This function will keep calling action() until we receive a stoppedEvent.
	 * Will return undefined if the result of repeatedly calling action does not
	 * induce a stoppedEvent.
	 */
	async function waitForBreakpoint(action: () => void): Promise<DebugProtocol.Event|undefined> {
		let stopEvent: DebugProtocol.Event;
		await Promise.all([
			new Promise(async (resolve) => {
				while (!stopEvent) {
					try {
						action();
					} catch (error) {
						console.log(error);
					}
					await new Promise((res) => setTimeout(res, 2_000));
				}
				resolve();
			}),
			new Promise(async (resolve) => {
				stopEvent = await dc.waitForEvent('stopped', 10_000);
				resolve();
			})
		]);
		return stopEvent;
	}

	suite('basic', () => {

		test('unknown request should produce error', (done) => {
			dc.send('illegal_request').then(() => {
				done(new Error('does not report error on unknown request'));
			}).catch(() => {
				done();
			});
		});
	});

	suite('initialize', () => {

		test('should return supported features', () => {
			return dc.initializeRequest().then((response) => {
				response.body = response.body || {};
				assert.strictEqual(response.body.supportsConditionalBreakpoints, true);
				assert.strictEqual(response.body.supportsConfigurationDoneRequest, true);
				assert.strictEqual(response.body.supportsSetVariable, true);
			});
		});

		test('should produce error for invalid \'pathFormat\'', (done) => {
			dc.initializeRequest({
				adapterID: 'mock',
				linesStartAt1: true,
				columnsStartAt1: true,
				pathFormat: 'url'
			}).then((response) => {
				done(new Error('does not report error on invalid \'pathFormat\' attribute'));
			}).catch((err) => {
				// error expected
				done();
			});
		});
	});

	suite('launch', () => {
		test('should run program to the end', () => {

			const PROGRAM = path.join(DATA_ROOT, 'baseTest');

			const config = {
				name: 'Launch',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(debugConfig),
				dc.waitForEvent('terminated')
			]);
		});

		test('should stop on entry', () => {
			const PROGRAM = path.join(DATA_ROOT, 'baseTest');
			const config = {
				name: 'Launch',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM,
				stopOnEntry: true
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(debugConfig),
				// The debug adapter does not support a stack trace request
				// when there are no goroutines running. Which is true when it is stopped
				// on entry. Therefore we would need another method from dc.assertStoppedLocation
				// to check the debugger is stopped on entry.
				dc.waitForEvent('stopped').then((event) => {
					const stevent = event as DebugProtocol.StoppedEvent;
					assert.strictEqual(stevent.body.reason, 'entry');
				})
			]);
		});

		test('should debug a file', () => {
			const PROGRAM = path.join(DATA_ROOT, 'baseTest', 'test.go');
			const config = {
				name: 'Launch file',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM,
				trace: 'verbose'
			};

			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(debugConfig),
				dc.waitForEvent('terminated')
			]);
		});

		test('should debug a single test', () => {
			const PROGRAM = path.join(DATA_ROOT, 'baseTest');
			const config = {
				name: 'Launch file',
				type: 'go',
				request: 'launch',
				mode: 'test',
				program: PROGRAM,
				args: [
					'-test.run',
					'TestMe'
				]
			};

			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(debugConfig),
				dc.waitForEvent('terminated')
			]);
		});

		test('should debug a test package', () => {
			const PROGRAM = path.join(DATA_ROOT, 'baseTest');
			const config = {
				name: 'Launch file',
				type: 'go',
				request: 'launch',
				mode: 'test',
				program: PROGRAM
			};

			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return Promise.all([
				dc.configurationSequence(),
				dc.launch(debugConfig),
				dc.waitForEvent('terminated')
			]);
		});
	});

	suite('remote attach', () => {
		test('should attach to a headless dlv instance and finish the initialize sequence successfully', async () => {
			this.timeout(10_000);
			const port = 3456;
			const childProcess = await setUpRemoteProgram(port);

			const config = {
				name: 'Attach',
				type: 'go',
				request: 'attach',
				mode: 'remote',
				host: '127.0.0.1',
				port,
			};
			await setUpRemoteAttach(config);

			await killProcessTree(childProcess);
			await new Promise((resolve) => setTimeout(resolve, 10_000));
		});
	});

	// The file paths returned from delve use '/' not the native path
	// separator, so we can replace any instances of '\' with '/', which
	// allows the hitBreakpoint check to match.
	const getBreakpointLocation = (FILE: string, LINE: number) => {
		return { path: FILE.replace(/\\/g, '/'), line: LINE };
	};

	suite('setBreakpoints', () => {

		test('should stop on a breakpoint', () => {

			const PROGRAM = path.join(DATA_ROOT, 'baseTest');

			const FILE = path.join(DATA_ROOT, 'baseTest', 'test.go');
			const BREAKPOINT_LINE = 11;

			const config = {
				name: 'Launch',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return dc.hitBreakpoint(debugConfig, getBreakpointLocation(FILE, BREAKPOINT_LINE));
		});

		test('should stop on a breakpoint in test file', () => {

			const PROGRAM = path.join(DATA_ROOT, 'baseTest');

			const FILE = path.join(DATA_ROOT, 'baseTest', 'sample_test.go');
			const BREAKPOINT_LINE = 15;

			const config = {
				name: 'Launch file',
				type: 'go',
				request: 'launch',
				mode: 'test',
				program: PROGRAM
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return dc.hitBreakpoint(debugConfig, getBreakpointLocation(FILE, BREAKPOINT_LINE));
		});

		test('stopped for a breakpoint set during initialization (remote attach)', async () => {
			this.timeout(30_000);
			const FILE = path.join(DATA_ROOT, 'helloWorldServer', 'main.go');
			const BREAKPOINT_LINE = 29;
			const port = 3456;
			const remoteProgram = await setUpRemoteProgram(port);

			const config = {
				name: 'Attach',
				type: 'go',
				request: 'attach',
				mode: 'remote',
				host: '127.0.0.1',
				port,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);
			const breakpointLocation = getBreakpointLocation(FILE, BREAKPOINT_LINE);

			// Setup attach with a breakpoint.
			await setUpRemoteAttach(debugConfig, [breakpointLocation]);

			// Calls the helloworld server to make the breakpoint hit.
			const stopEvent = await waitForBreakpoint(
				() => http.get('http://localhost:8080').on('error', (data) => console.log(data)));
			assert.ok(stopEvent && stopEvent.body);
			assert.strictEqual(stopEvent.body!.reason, 'breakpoint');

			await dc.disconnectRequest({restart: false});
			await killProcessTree(remoteProgram);
			await new Promise((resolve) => setTimeout(resolve, 10_000));
		});

		test('stopped for a breakpoint set after initialization (remote attach)', async () => {
			this.timeout(30_000);
			const FILE = path.join(DATA_ROOT, 'helloWorldServer', 'main.go');
			const BREAKPOINT_LINE = 29;
			const port = 3456;
			const remoteProgram = await setUpRemoteProgram(port);

			const config = {
				name: 'Attach',
				type: 'go',
				request: 'attach',
				mode: 'remote',
				host: '127.0.0.1',
				port,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			// Setup attach without a breakpoint.
			await setUpRemoteAttach(debugConfig);

			// Now sets a breakpoint.
			const breakpointLocation = getBreakpointLocation(FILE, BREAKPOINT_LINE);
			const breakpointsResult = await dc.setBreakpointsRequest(
				{source: {path: breakpointLocation.path}, breakpoints: [breakpointLocation]});
			assert.ok(breakpointsResult.success && breakpointsResult.body.breakpoints[0].verified);

			// Calls the helloworld server to make the breakpoint hit.
			const stopEvent = await waitForBreakpoint(
				() => http.get('http://localhost:8080').on('error', (data) => console.log(data)));
			assert.ok(stopEvent && stopEvent.body);
			assert.strictEqual(stopEvent.body!.reason, 'breakpoint');

			await killProcessTree(remoteProgram);
			await new Promise((resolve) => setTimeout(resolve, 10_000));
		});

	});

	suite('conditionalBreakpoints', () => {
		test('should stop on conditional breakpoint', () => {

			const PROGRAM = path.join(DATA_ROOT, 'condbp');
			const FILE = path.join(DATA_ROOT, 'condbp', 'condbp.go');
			const BREAKPOINT_LINE = 7;
			const location = getBreakpointLocation(FILE, BREAKPOINT_LINE);

			const config = {
				name: 'Launch',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);
			return Promise.all([

				dc.waitForEvent('initialized').then(() => {
					return dc.setBreakpointsRequest({
						lines: [location.line],
						breakpoints: [{ line: location.line, condition: 'i == 2' }],
						source: { path: location.path }
					});
				}).then(() => {
					return dc.configurationDoneRequest();
				}),

				dc.launch(debugConfig),

				dc.assertStoppedLocation('breakpoint', location)

			]).then(() =>
				// The program is stopped at the breakpoint, check to make sure 'i == 1'.
				assertVariableValue('i', '2')
			);
		});

		test('should add breakpoint condition', async () => {

			const PROGRAM = path.join(DATA_ROOT, 'condbp');
			const FILE = path.join(DATA_ROOT, 'condbp', 'condbp.go');
			const BREAKPOINT_LINE = 7;
			const location = getBreakpointLocation(FILE, BREAKPOINT_LINE);

			const config = {
				name: 'Launch',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return dc.hitBreakpoint(debugConfig, location).then(() =>
				// The program is stopped at the breakpoint, check to make sure 'i == 0'.
				assertVariableValue('i', '0')
			).then(() =>
				// Add a condition to the breakpoint, and make sure it runs until 'i == 2'.
				dc.setBreakpointsRequest({
					lines: [location.line],
					breakpoints: [{ line: location.line, condition: 'i == 2' }],
					source: { path: location.path }
				}).then(() =>
					Promise.all([
						dc.continueRequest({ threadId: 1 }),
						dc.assertStoppedLocation('breakpoint', location)
					]).then(() =>
						// The program is stopped at the breakpoint, check to make sure 'i == 2'.
						assertVariableValue('i', '2')
					)
				)
			);
		});

		test('should remove breakpoint condition', () => {

			const PROGRAM = path.join(DATA_ROOT, 'condbp');
			const FILE = path.join(DATA_ROOT, 'condbp', 'condbp.go');
			const BREAKPOINT_LINE = 7;
			const location = getBreakpointLocation(FILE, BREAKPOINT_LINE);

			const config = {
				name: 'Launch',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);
			return Promise.all([

				dc.waitForEvent('initialized').then(() => {
					return dc.setBreakpointsRequest({
						lines: [location.line],
						breakpoints: [{ line: location.line, condition: 'i == 2' }],
						source: { path: location.path }
					});
				}).then(() => {
					return dc.configurationDoneRequest();
				}),

				dc.launch(debugConfig),

				dc.assertStoppedLocation('breakpoint', location)

			]).then(() =>
				// The program is stopped at the breakpoint, check to make sure 'i == 2'.
				assertVariableValue('i', '2')
			).then(() =>
				// Remove the breakpoint condition, and make sure the program runs until 'i == 3'.
				dc.setBreakpointsRequest({
					lines: [location.line],
					breakpoints: [{ line: location.line }],
					source: { path: location.path }
				}).then(() =>
					Promise.all([
						dc.continueRequest({ threadId: 1 }),
						dc.assertStoppedLocation('breakpoint', location)
					]).then(() =>
						// The program is stopped at the breakpoint, check to make sure 'i == 3'.
						assertVariableValue('i', '3')
					)
				)
			);
		});
	});

	suite('panicBreakpoints', () => {

		test('should stop on panic', () => {

			const PROGRAM_WITH_EXCEPTION = path.join(DATA_ROOT, 'panic');

			const config = {
				name: 'Launch',
				type: 'go',
				request: 'launch',
				mode: 'auto',
				program: PROGRAM_WITH_EXCEPTION,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);

			return Promise.all([

				dc.waitForEvent('initialized').then(() => {
					return dc.setExceptionBreakpointsRequest({
						filters: ['all']
					});
				}).then(() => {
					return dc.configurationDoneRequest();
				}),

				dc.launch(debugConfig),

				dc.assertStoppedLocation('panic', {})
			]);
		});
	});

	suite('disconnect', () => {
		test('disconnect should work for remote attach', async () => {
			this.timeout(30_000);
			const FILE = path.join(DATA_ROOT, 'helloWorldServer', 'main.go');
			const BREAKPOINT_LINE = 29;
			const port = 3456;
			const remoteProgram = await setUpRemoteProgram(port);

			const config = {
				name: 'Attach',
				type: 'go',
				request: 'attach',
				mode: 'remote',
				host: '127.0.0.1',
				port,
			};
			const debugConfig = debugConfigProvider.resolveDebugConfiguration(undefined, config);
			const breakpointLocation = getBreakpointLocation(FILE, BREAKPOINT_LINE);

			// Setup attach.
			await setUpRemoteAttach(debugConfig);

			// Calls the helloworld server to get a response.
			let response = '';
			await new Promise((resolve) => {
				http.get('http://localhost:8080', (res) => {
					res.on('data', (data) => response += data);
					res.on('end', () => resolve());
				});
			});

			await dc.disconnectRequest();
			// Checks that after the disconnect, the helloworld server still works.
			let secondResponse = '';
			await new Promise((resolve) => {
				http.get('http://localhost:8080', (res) => {
					res.on('data', (data) => secondResponse += data);
					res.on('end', () => resolve());
				});
			});
			assert.strictEqual(response, secondResponse);
			await killProcessTree(remoteProgram);
			await new Promise((resolve) => setTimeout(resolve, 10_000));
		});
	});
});
