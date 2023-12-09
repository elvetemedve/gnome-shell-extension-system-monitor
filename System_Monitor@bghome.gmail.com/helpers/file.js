"use strict";

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as AsyncModule from './async.js';

export class File {
    constructor(path) {
        this.file = Gio.File.new_for_path(path);
        this.tasks = new AsyncModule.Tasks();
    }
    
    exists() {
        return new Promise(resolve => resolve(this.file.query_exists(null)));
    }
    
    read() {
        let that = this;

        return new Promise((resolve, reject) => {
            this.tasks.newSubtask(() => {
                try {
                    that.file.load_contents_async(null, function(file, res) {
                        try {
                            // @see https://gjs-docs.gnome.org/gjs/encoding.md#textdecoder-decode
                            resolve(new TextDecoder().decode(file.load_contents_finish(res)[1]));
                        } catch (e) {
                            reject(e);
                        }
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    list() {
        return new Promise((resolve, reject) => {
            let max_items = 100, results = [];

            try {
                this.file.enumerate_children_async(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null, function(file, res) {
                    try {
                        let enumerator = file.enumerate_children_finish(res);

                        let callback = function(enumerator, res) {
                            try {
                                let files = enumerator.next_files_finish(res);
                                for (let i = 0; i < files.length; i++) {
                                    let file_info = files[i];
                                    results.push(file_info.get_attribute_as_string(Gio.FILE_ATTRIBUTE_STANDARD_NAME));
                                }

                                if (files.length == 0) {
                                    enumerator.close_async(GLib.PRIORITY_LOW, null, function(){});

                                    resolve(results);
                                } else {
                                    enumerator.next_files_async(max_items, GLib.PRIORITY_LOW, null, callback);
                                }
                            } catch (e) {
                                reject(e);
                            }
                        };

                        enumerator.next_files_async(max_items, GLib.PRIORITY_LOW, null, callback);
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    create(text, replace) {
        return new Promise(resolve => {
            let outputstream = this.file.create(Gio.FileCreateFlags[replace ? "REPLACE_DESTINATION" : "NONE"], null);

            outputstream.write_all(typeof text === "string" ? text : "", null);

            outputstream.close(null);

            resolve();
        });
    }

    append(text) {
        return new Promise(resolve => {
            let outputstream = this.file.append_to(Gio.FileCreateFlags.NONE, null);

            outputstream.write_all(text, null);

            outputstream.close(null);

            resolve();
        });
    }

    copyto(path, replace) {
        return new Promise(resolve => resolve(this.file.copy(new File(path).file, Gio.FileCopyFlags[replace ? "OVERWRITE" : "NONE"], null, null)));
    }

    moveto(path) {
        return new Promise(resolve => resolve(this.file.move(new File(path).file, Gio.FileCopyFlags.NONE, null, null)));
    }

    rename(name) {
        return new Promise(resolve => {
            this.file.set_display_name_async(name, GLib.PRIORITY_DEFAULT, null, (source, res) => resolve(source.set_display_name_finish(res)));
        });
    }

    delete() {
        return new Promise(resolve => {
            this.file.delete_async(GLib.PRIORITY_DEFAULT, null, (source, res) => resolve(source.delete_finish(res)));
        });
    }

    mkdir() {
        return new Promise(resolve => {
            this.file.make_directory_async(GLib.PRIORITY_DEFAULT, null, (source, res) => resolve(source.make_directory_finish(res)));
        });
    }

    symlinkto(path) {
        return new Promise(resolve => resolve(this.file.make_symbolic_link(path, null)));
    }

    destroy() {
        this.tasks.cancel();
        this.tasks = null;
        this.file = null;
    }
}
