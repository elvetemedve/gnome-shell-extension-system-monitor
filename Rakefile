require 'rake'
require 'json'

PACKAGE_NAME = 'System_Monitor@bghome.gmail.com'
VERSION = JSON.parse(File.read("#{PACKAGE_NAME}/metadata.json"))['version']
BUILD_DIRECTORY = File.join(File.dirname(__FILE__), "build")
USER_INSTALL_DIRECTORY = File.expand_path('~/.local/share/gnome-shell/extensions')
SYSTEM_INSTALL_DIRECTORY = '/usr/local/share/gnome-shell/extensions'
GLIB_SCHEMA_COMPILE_COMMAND = 'glib-compile-schemas'

directory BUILD_DIRECTORY
directory USER_INSTALL_DIRECTORY

def zip_file
	"#{PACKAGE_NAME}-#{VERSION}.zip"
end

task :prepare => BUILD_DIRECTORY do
	cp_r PACKAGE_NAME, BUILD_DIRECTORY
	sh %{#{GLIB_SCHEMA_COMPILE_COMMAND} #{BUILD_DIRECTORY}/#{PACKAGE_NAME}/schemas}
end

task :package => [:prepare, zip_file]
file zip_file do
	chdir(BUILD_DIRECTORY) do
		sh %{zip -r #{zip_file} #{PACKAGE_NAME}}
	end
end

desc "Build the distributable files under the build directory"
task :build => [:package] do
	puts "Build complete"
end

desc "Install the GNOME extension, available options for target: user*, system."
task :install, [:target] => [:cleanup, :build] do |t, args|
	args.with_defaults(:target => 'user')

	if args.target === 'user'
		target_dir = USER_INSTALL_DIRECTORY
		message = "#{PACKAGE_NAME} has been installed for the current user."
	elsif args.target === 'system'
		target_dir = SYSTEM_INSTALL_DIRECTORY
		message = "#{PACKAGE_NAME} has been installed for all users."
	else
		raise "Unknown option for target '#{args.target}'."
	end

	Rake::Task['uninstall'].invoke args.target
	Rake::Task[target_dir].invoke
	sh %{unzip -uo #{BUILD_DIRECTORY}/#{zip_file} -d #{target_dir}}
	puts message
end

desc "Uninstall the GNOME extension, available options for target: user*, system."
task :uninstall, [:target] do |t, args|
	args.with_defaults(:target => 'user')

	if args.target === 'user'
		target_dir = USER_INSTALL_DIRECTORY
		message = "#{PACKAGE_NAME} has been removed for the current user."
	elsif args.target === 'system'
		target_dir = SYSTEM_INSTALL_DIRECTORY
		message = "#{PACKAGE_NAME} has been removed for all users."
	else
		raise "Unknown option for target '#{args.target}'."
	end

	if File.exists? "#{target_dir}/#{PACKAGE_NAME}"
		rm_r "#{target_dir}/#{PACKAGE_NAME}"
		puts message
	end

end

desc "Clean up build artifacts"
task :cleanup do
	if File.exists? BUILD_DIRECTORY
		rm_r BUILD_DIRECTORY
	end
	puts "Project is clean"
end

task :default do
	puts 'List of available tasks:'
	system("rake -sT")
end
