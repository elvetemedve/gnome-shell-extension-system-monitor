# System Monitor

[![codebeat badge](https://codebeat.co/badges/7d1c7fdf-19b1-402a-b222-b2791e868e1d)](https://codebeat.co/projects/github-com-elvetemedve-gnome-shell-extension-system-monitor-master)
[![Build Status](https://travis-ci.org/elvetemedve/gnome-shell-extension-system-monitor.svg?branch=master)](https://travis-ci.org/elvetemedve/gnome-shell-extension-system-monitor)

## Introduction

### What is System Monitor?
This is a Gnome shell extension which aims to indicate the usage of system resources on a GNU/Linux OS.

It displays a list of icons as indicator in the top bar of a Gnome shell.

### Why use System Monitor?
When you use a piece of application on your computer, sometimes it does not clear what it is doing, you only see that the requested action
has not completed. For example you do not know for sure if an misbehaving application is waiting for the network
or doing CPU heavy computation. This extension can help with this by displaying resources using symbolic
icons and indicate their usage by color. Resource usage color range starts from white (low usage) to red (high usage).

Besides the above, the detailed view can show you which processes or directories are responsible for the high resource utilization.

No clicks or key presses needed, just take a look at the top of the screen when an application misbehaves.

## Build

### Requirements

The following applications need to be installed:
- zip
- rake

Project can be built with Rake (http://rake.rubyforge.org/).
To install Rake, first you need RubyGems package manager which is available via the own package manager
of the OS. Once you have that, issue the following command:

    gem install rake

Then `rake build` command will make the “**build/System_Monitor@bghome.gmail.com-[version].zip**” for you.

To remove all generated files, use the `rake cleanup` command.

## Install

Extensions can be installed per-user in *~/.local/share/gnome-shell/extensions*, or system wide in */usr/share/gnome-shell/extensions* and */usr/local/share/gnome-shell/extensions*.
You can simply extract the content of the zip archive to the proper location or use Gnome Tweak tool.

Also don't forget to install the dependencies. You can find distribution specific instructions on the [Installation wiki page](https://github.com/elvetemedve/gnome-shell-extension-system-monitor/wiki/Installation).

### Requirements

In order to run the extension, the following software is required to be installed:
- Linux kernel 3.2 or later
- Libgtop 2.30 or later

## Contribute

If you would like to help by coding, these are the steps you should take:

1. Fork the Git repository and create a new branch for the feature or bug fix
1. Make your changes
1. Run `rake install` to install the extension for the current Linux user
1. Press **Alt + F2** and type the command **r** to restart Gnome Shell (it does not work under Wayland session at the moment)
1. Test your changes and check the logs for errors
1. When you satisfied with it, create a pull request against this repository

## License

System Monitor is released under the [GNUGPLv3 license](https://www.gnu.org/licenses/gpl.html).
