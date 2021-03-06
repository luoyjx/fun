# ƒun

[![CircleCI](https://circleci.com/gh/zeit/fun/tree/master.svg?style=svg&circle-token=8df270134881b60f9ec91f47f5268e0b5cce2acd)](https://circleci.com/gh/zeit/fun/tree/master) [![codecov](https://codecov.io/gh/zeit/fun/branch/master/graph/badge.svg?token=6bZSbITKbj)](https://codecov.io/gh/zeit/fun)

Local serverless function λ development runtime.

 * Programmatic. A TypeScript API is exposed to trigger invocations.
 * Provider agnostic. AWS Lambda + other cloud providers planned.
 * Runtime agnostic. Node, go, python and custom runtime APIs.
 * Platform agnostic. Functions can be executed natively (e.g. macOS) or via Docker.
 * Zero setup needed. ƒun acquires the necessary runtime files (e.g. `node`).


## Example

Given a Lambda function like this one:

```js
// index.js
exports.handler = function(event, context, callback) {
	callback(null, { hello: 'world' });
};
```

You can invoke this function locally using the code below:

```js
const { createFunction } = require('@zeit/fun');

async function main() {
	// Starts up the necessary server to be able to invoke the function
	const fn = await createFunction({
		Code: {
			// `ZipFile` works, or an already unzipped directory may be specified
			Directory: __dirname + '/example'
		},
		Handler: 'index.handler',
		Runtime: 'nodejs8.10',
		Environment: {
			Variables: {
				HELLO: 'world'
			}
		},
		MemorySize: 512
	});

	// Invoke the function with a custom payload. A new instance of the function
	// will be initialized if there is not an available one ready to process.
	const res = await fn({ hello: 'world' });

	console.log(res);
	// Prints: { hello: 'world' }

	// Once we are done with the function, destroy it so that the processes are
	// cleaned up, and the API server is shut down (useful for hot-reloading).
	await fn.destroy();
}

main().catch(console.error);
```


## Providers

ƒun has a concept of pluggable "providers", which are responsible for
creating, freezing, unfreezing and shutting down the processes that execute the
Lambda function.

### `native`

The `native` provider executes Lambda functions directly on the machine executing
ƒun. This provides an execution environment that closely resembles the
real Lambda environment, with some key differences that are documented here:

 * Lambdas processes are ran as your own user, not the `sbx_user1051` user.
 * Processes are *not* sandboxed nor chrooted, so do not rely on hard-coded
   locations like `/var/task`, `/var/runtime`, `/opt`, etc. Instead, your
   function code should use the environment variables that represent these
   locations (namely `LAMBDA_TASK_ROOT` and `LAMBDA_RUNTIME_DIR`).
 * Processes are frozen by sending the `SIGSTOP` signal to the lambda process,
   and unfrozen by sending the `SIGCONT` signal, not using the [cgroup freezer][].
 * Lambdas that compile to native executables (i.e. Go) will need to be compiled
   for your operating system. So if you are on macOS, then the binary needs to be
   executable on macOS.

### `docker`

A `docker` provider is planned, but not yet implemented. This will allow for an
execution environment that more closely matches the AWS Lambda environment,
including the ability to execute Linux x64 binaries / shared libraries.


## Runtimes

ƒun aims to support all runtimes that AWS Lambda provides. Currently
implemented are:

 * `nodejs` for Node.js Lambda functions using the system `node` binary
 * `nodejs6.10` for Node.js Lambda functions using a downloaded Node v6.10.0 binary
 * `nodejs8.10` for Node.js Lambda functions using a downloaded Node v8.10.0 binary
 * `nodejs10.x` for Node.js Lambda functions using a downloaded Node v10.15.3 binary
 * `python` for Python Lambda functions using the system `python` binary
 * `python2.7` for Python Lambda functions using a downloaded Python v2.7.12 binary
 * `python3.6` for Python Lambda functions using a downloaded Python v3.6.8 binary
 * `python3.7` for Python Lambda functions using a downloaded Python v3.7.2 binary
 * `go1.x` for Lambda functions written in Go - binary must be compiled for your platform
 * `provided` for [custom runtimes][]

[cgroup freezer]: https://www.kernel.org/doc/Documentation/cgroup-v1/freezer-subsystem.txt
[custom runtimes]: https://docs.aws.amazon.com/lambda/latest/dg/runtimes-custom.html
