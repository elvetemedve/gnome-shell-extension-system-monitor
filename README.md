# System Monitor

## Introduction

### What is System Monitor?
This is a Gnome shell extension which aims to indicate the usage of system resources on a GNU/Linux OS.

It displays a list of icons as indicator in the top bar of a Gnome shell.

### Why use System Monitor?
When you use piece of application on your computer sometimes it does not clear that it doing the action
you requested. For example you do not know for sure if the application is in use waiting for the network 
or doing CPU heavy computation. This extension can help with this by displaying resources using symbolic
icons and indicate their usage by color.
No clicks or keypresses needed, just take a look at the top of the screen.

## Build
Project can be built with Rake (http://rake.rubyforge.org/).
To install Rake, first you need RubyGems package manager which is available via the own package manager
of the OS. One you have that, issue the following command:
    gem install rake

Then `rake build` command will make the “build/System_Monitor@bghome.gmail.com-<version>.zip” for you.

To remove all generated files use the `rake cleanup` command.

## Install
Extensions can be installed per-user in ~/.local/share/gnome-shell/extensions, or systemwide in /usr/share/gnome-shell/extensions and /usr/local/share/gnome-shell/extensions.
You can simple extract the content of the zip archive to the proper location or use Gnome Tweak tool.

## License

System Monitor is released under the [GNUGPLv3 license](https://www.gnu.org/licenses/gpl.html).