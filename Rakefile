require 'rake'
require 'json'
require 'yaml'

PACKAGE_NAME = 'System_Monitor@bghome.gmail.com'
BUILD_DIRECTORY = File.join(File.dirname(__FILE__), "build")
SHEXLI_WORKFLOW = File.join(File.dirname(__FILE__), '.github', 'workflows', 'shexli.yml')
SHEXLI_VENV = File.join(File.dirname(__FILE__), '.shexli-venv')
USER_INSTALL_DIRECTORY = File.expand_path('~/.local/share/gnome-shell/extensions')
SYSTEM_INSTALL_DIRECTORY = '/usr/local/share/gnome-shell/extensions'
GLIB_SCHEMA_COMPILE_COMMAND = 'glib-compile-schemas'

directory BUILD_DIRECTORY
directory USER_INSTALL_DIRECTORY

def zip_file
	"#{PACKAGE_NAME}.zip"
end

# The package doesn't include compiled settings schemas: GNOME Shell 44 and
# later compile them when the extension is installed.
task :prepare => BUILD_DIRECTORY do
	cp_r PACKAGE_NAME + "/.", BUILD_DIRECTORY
end

task :package => [:prepare, zip_file]
file zip_file do
	chdir(BUILD_DIRECTORY) do
		sh %{zip -r #{zip_file} .}
	end
end

desc "Build the distributable files under the build directory"
task :build => [:package] do
	puts "Build complete"
end

# The same shexli version the CI workflow uses, read from the workflow so the
# two can't drift apart.
def shexli_requirements
	env = YAML.load_file(SHEXLI_WORKFLOW).fetch('env')
	[
		"shexli @ #{env.fetch('SHEXLI_SOURCE')}",
		"tree-sitter==#{env.fetch('TREE_SITTER_VERSION')}",
		"tree-sitter-javascript==#{env.fetch('TREE_SITTER_JAVASCRIPT_VERSION')}",
	]
end

# Install shexli into a local virtualenv, reinstalling it from scratch
# whenever the pinned versions in the workflow change.
task :shexli_venv do
	stamp = File.join(SHEXLI_VENV, 'requirements.txt')
	requirements = shexli_requirements
	next if File.exist?(stamp) && File.readlines(stamp, chomp: true) == requirements

	sh 'python3', '-m', 'venv', '--clear', SHEXLI_VENV
	sh File.join(SHEXLI_VENV, 'bin', 'pip'), 'install', '--disable-pip-version-check', *requirements
	File.write(stamp, requirements.join("\n") + "\n")
end

desc "Check the package with shexli, the analyzer extensions.gnome.org uses for reviews"
task :shexli => [:shexli_venv, :cleanup, :build] do
	shexli = File.join(SHEXLI_VENV, 'bin', 'shexli')
	package = File.join(BUILD_DIRECTORY, zip_file)

	sh shexli, package

	# shexli always exits with 0, so count the errors in its JSON report.
	output = IO.popen([shexli, '--format', 'json', package], &:read)
	raise "shexli failed with status #{$?.exitstatus}" unless $?.success?
	errors = JSON.parse(output).fetch('findings').count { |finding| finding['severity'] == 'error' }
	raise "shexli reported #{errors} error(s), extensions.gnome.org review would likely reject this package." if errors > 0
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
	if args.target === 'user'
		# Installs the same way as from extensions.gnome.org, compiling the
		# settings schemas too.
		sh 'gnome-extensions', 'install', '--force', File.join(BUILD_DIRECTORY, zip_file)
	else
		# gnome-extensions can only install for the current user.
		sh %{unzip -uo #{BUILD_DIRECTORY}/#{zip_file} -d #{target_dir}/#{PACKAGE_NAME}}
		sh %{#{GLIB_SCHEMA_COMPILE_COMMAND} #{target_dir}/#{PACKAGE_NAME}/schemas}
	end
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

	if File.exist? "#{target_dir}/#{PACKAGE_NAME}"
		rm_r "#{target_dir}/#{PACKAGE_NAME}"
		puts message
	end

end

desc "Clean up build artifacts"
task :cleanup do
	if File.exist? BUILD_DIRECTORY
		rm_r BUILD_DIRECTORY
	end
	puts "Project is clean"
end

task :default do
	puts 'List of available tasks:'
	system("rake -sT")
end
