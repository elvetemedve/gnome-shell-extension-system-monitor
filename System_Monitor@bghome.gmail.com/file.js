const Gio = imports.gi.Gio;

const File = function(filename) {
	var file = Gio.File.new_for_path(filename);

	return {
		getContents: function() {
			return '' + file.load_contents(null)[1];
		},

		list: function() {
			let results = [];
			let file_info, list = file.enumerate_children(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, null);
			while ((file_info = list.next_file(null)) != null) {
				results.push(file_info.get_attribute_as_string(Gio.FILE_ATTRIBUTE_STANDARD_NAME));
			}
			return results;
		}
	}
}