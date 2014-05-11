require 'rake'

PACKAGE_NAME = 'System_Monitor@bghome.gmail.com'
VERSION = '0.1.0'
BUILD_DIRECTORY = File.join(File.dirname(__FILE__), "build")

directory BUILD_DIRECTORY

def zip_file
	"#{PACKAGE_NAME}-#{VERSION}.zip"
end

task :prepare => BUILD_DIRECTORY do
	cp_r PACKAGE_NAME, BUILD_DIRECTORY
end

task :package => [BUILD_DIRECTORY, zip_file]
file zip_file do
	chdir(BUILD_DIRECTORY) do
		sh %{zip -r #{zip_file} #{PACKAGE_NAME}}
	end
end

desc "Build the distributable files under the build directory"
task :build => [:package] do
	puts "Build complete"
end

desc "Clean up build artifacts"
task :cleanup do
	rm_r BUILD_DIRECTORY
	puts "Project is clean"
end

task :default do
	puts 'List of available tasks:'
	system("rake -sT")
end