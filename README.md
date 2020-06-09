# Go for Visual Studio Code

[![Slack](https://img.shields.io/badge/slack-gophers-green.svg?style=flat)](https://gophers.slack.com/messages/vscode/)

<!--TODO: We should add a badge for the build status or link to the build dashboard.-->

This extension provides rich language support for the [Go programming language](https://golang.org/) in VS Code.

Take a look at the [Changelog](CHANGELOG.md) to learn about new features.

> This is the future home for the VS Code Go extension. We are currently migrating from the [original repository](https://github.com/Microsoft/vscode-go). Read [the announcement](https://github.com/microsoft/vscode-go/blob/master/README.md#we-are-moving---) to learn about the transition and subscribe to [Microsoft/vscode-go#3247](https://github.com/microsoft/vscode-go/issues/3247) for updates.

## Overview

* [Getting started](#getting-started)
* [Support for Go modules](#support-for-go-modules)
* [Features](#features)
  * [Debugging](#debugging)
* [Customization](#customization)
  * [Linter](#linter)
  * [GOPATH](#gopath)
* [Language server](#language-server)
* [Troubleshooting](docs/troubleshooting.md)
* [Ask for help](#ask-for-help)
* [Preview version](#preview-version)
* [Contributing](#contributing)

## Getting started

Welcome! Whether you are new to Go or an experienced Go developer, we hope this extension will fit your needs and enhance your development experience.

### Install Go

Before you start coding, make sure that you have already installed Go, as explained on the [Go installation guide](https://golang.org/doc/install). If you are unsure, open the Command Palette in VS Code (Ctrl+Shift+P) and run the `Go: Locate Configured Go Tools` command. If the `GOROOT` output is empty, you are missing a Go installation. For help installing Go, ask a question on the `#newbies` [Gophers Slack] channel.

### Set up your environment

Read about [Go code organization](https://golang.org/doc/code.html) to learn how to configure your environment. This extension works in both [GOPATH](docs/gopath.md) and [module](docs/modules.md) modes. We suggest using modules, as they are quickly becoming the new standard in the Go community.

Here are some additional resources for learning about how to set up your Go project:

* [Using Go modules](https://blog.golang.org/using-go-modules)
* [Modules wiki](https://github.com/golang/go/wiki/Modules)
* [GOPATH](https://golang.org/cmd/go/#hdr-GOPATH_environment_variable)

**NOTE: If you are using modules, we recommend using the Go [language server](#language-server), which is explained below.**

More advanced users may be interested in using different `GOPATH`s or Go versions per-project. You can learn about the different `GOPATH` manipulation options in the [`GOPATH` documentation](gopath.md). Take a look at the other [customization](#customization) options as well.

### Install the extension

If you haven't already done so, install and open [Visual Studio Code](https://code.visualstudio.com). Navigate to the Extensions pane (Ctrl+Shift+X). Search for "Go" and install this extension (the publisher ID is "golang.Go").

### Activate the Go extension

To activate the extension, open any directory or workspace containing Go code.

You should immediately see a prompt in the bottom-right corner of your screen titled `Analysis Tools Missing`. This extension relies on a suite of [command-line tools](docs/tools.md), which must be installed separately from the extension. Accept the prompt, or use the `Go: Install/Update Tools` command to pick which tools you would like to install. Note that you must have [`git`](https://git-scm.com/) installed.

If you see an error that looks like `command Go: Install/Update Tools not found`, it means that the extension has failed to activate and register its commands. Please uninstall and then reinstall the extension.

### Start coding

You're ready to Go!

Be sure to learn more about the many [features](#features) of this extension, as well as how to [customize](#customization) them. Take a look at [Troubleshooting](docs/troubleshooting.md) and [Resources](#resources) for further guidance.

## Support for Go modules

[Go modules](https://blog.golang.org/using-go-modules) have added a lot of complexity to the way most tools and features are built for Go. This has also added a lot of latency to most of the features. Some, but not all, [features](features.md) of this extension have been updated to work with Go modules. Some features may be slower in module mode. The [features documentation](features.md) contains more specific details.

**In general, we recommend using [gopls, the official Go language server](#language-server), if you are using modules.** Read more [below](#language-server) and in the [gopls](gopls.md) documentation.

## [Features](docs/features.md)

This extension has a wide range of features, including [Intellisense](docs/features.md#intellisense), [code navigation](docs/features.md#code-navigation), and [code editing](docs/features.md#code-editing) support, as well as build, vet, and lint [diagnostics](docs/features.md#diagnostics) as you work. The VS Code Go extension also provides enhanced support for [testing](docs/features.md#testing) and [debugging](#debugging) your programs. For more detail, see the [full feature breakdown](docs/features.md).

In addition to integrated editing features, the extension also provides several commands for working with Go files. You can access any of these by opening the Command Palette (Ctrl+Shift+P) and typing in the name of the command. See the [full list of commands](docs/commands.md) provided by the extension.

The majority of the extension's features are provided by command-line tools written in Go. If you're having an issue with a specific feature, you may want to investigate the underlying tool. You can do this by taking a look at the [full list of the tools this extension depends on](docs/tools.md).

### [Debugging](docs/debugging.md)

Debugging is a major feature offered by this extension. For information on how to debug your Go program, please see the [Debugging Guide](docs/debugging.md). It includes information about debugging on Windows Subsystem for Linux (WSL) and remote debugging.

## Customization

This extension needs no configuration; it works out of the box. However, you may wish to modify your experience.

Many of the features are configurable to your preference. The list of settings can be found in [Settings and Commands documentation](docs/commands.md).

### [Linter](tools.md#diagnostics)

A commonly customized feature is the linter, which is a tool used to provide coding style feedback and suggestions. By default, this extension uses the official [`golint`].

<!--TODO(rstambler): Deprecate the golint setting.-->

However, you are welcome to use more advanced options like [`staticcheck`](https://pkg.go.dev/honnef.co/go/tools/staticcheck?tab=overview), [`golangci-lint`](https://golangci-lint.run/), or [`revive`](https://golangci-lint.run/). This can be configured via the [`"go.lintTool"`](docs/commands.md#lintTool) setting, and the different options are explained more thoroughly in the [list of diagnostic tools](docs/tools.md#diagnostics).

### [GOPATH](docs/gopath.md)

Advanced users may want to set different `GOPATH`s for different projects or install the Go tools to a different `GOPATH`. This is possible and explained in the [`GOPATH documentation`](docs/gopath.md).

## [Language Server](docs/gopls.md)

The Go extension uses a suite of [command-line tools](docs/tools.md) to provide language features. A new alternative is to use a [single language server](https://langserver.org/), which provides the same features using the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

The Go team at Google has developed [`gopls`](docs/gopls.md), which is the official Go language server. It is currently in an alpha state and under active development.

[`gopls`] is recommended for projects that use Go modules, as it provides much better support.

To opt-in to the language server, set [`"go.useLanguageServer"`](docs/commands.md#useLanguageServer) to `true` in your settings. You should then be prompted to install [`gopls`]. If you are not prompted, you can install `gopls` manually by running the `Go: Install/Update Tools` command and selecting `gopls`.

For more information, see the [`gopls` documentation](docs/gopls.md).

## Ask for help

If you're having issues with this extension, please reach out to us by [filing an issue](https://github.com/golang/vscode-go/issues/new/choose) or asking a question on the [Gophers Slack]. We hang out in the `#vscode` channel!

Take a look at [learn.go.dev](https://learn.go.dev) and [golang.org/help](https://golang.org/help) for additional guidance.

## [Preview version](nightly.md)

If you'd like to get early access to new features and bug fixes, you can use the nightly build of this extension. Learn how to install it in by reading the [Go Nightly documentation](nightly.md).

## [Contributing](docs/contributing.md)

We welcome your contributions and thank you for working to improve the Go development experience in VS Code. If you would like to help work on the VS Code Go extension, please see our [Contribution guide](docs/contributing.md). It explains how to build and run the extension locally, as well as the process of sending a contribution.

## [Code of Conduct](CODE_OF_CONDUCT.md)

This project follows the [Go Community Code of Conduct](https://golang.org/conduct). If you encounter an issue, please mail conduct@golang.org.

## [License](LICENSE)

[MIT](LICENSE)

[`golint`]: https://pkg.go.dev/golang.org/x/lint/golint?tab=overview
[Gophers Slack]: https://gophers.slack.com/
[`gopls`]: https://golang.org/s/gopls
