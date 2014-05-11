require 'rake/packagetask'

PACKAGE_NAME = 'System_Monitor@bghome.gmail.com'
VERSION = '0.1.0'

Rake::PackageTask.new(PACKAGE_NAME, VERSION) do |pkg|
	Dir.chdir "System_Monitor@bghome.gmail.com" # Go to the source directory
	files = Rake::FileList.new("**/**")

	pkg.need_zip = true
	pkg.package_dir = File.dirname(__FILE__) + "/build"
	pkg.package_files = files
end

desc "Build the distributable files under the build directory"
task :build => [:package] do
	puts "Build complete"
end

desc "Clean up build artifacts"
task :cleanup => [:clobber_package] do
	puts "Project is clean"
end