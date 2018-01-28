const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Lang = imports.lang;
const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Util = Me.imports.util;

let BaseMenuItem = new Lang.Class({
    Name: "BaseMenuItem",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(text, options) {
        options = options || {};
        let icon = options.icon, summary_text = options.summary_text, button_icon = options.button_icon, button_callback = options.button_callback,
        button_trigger_key = options.button_trigger_key;
        delete options.icon;
        delete options.summary_text;
        delete options.button_icon;
        delete options.button_callback;
        delete options.button_trigger_key;
        this.parent(options);

        if (icon) {
            this.setIcon(icon);
        }

        this.label = new St.Label({text: text, style_class: "item-label"});
        this.labelBin = new St.Bin({child: this.label});
        this.actor.add(this.labelBin);
        this.connect('active-changed', Lang.bind(this, this._activeChanged));

        if (summary_text) {
            this.rightLabel = new St.Label({text: summary_text, style_class: "right-label"});
            this.rightLabelBin = new St.Bin({child: this.rightLabel});
            this.actor.add(this.rightLabelBin, {expand: true, x_fill: false, x_align: St.Align.END});
        }

        if (button_icon) {
            this.button = new St.Button();
            this.button.connect('clicked', Lang.bind(this, function(actor, event) {
                button_callback.call(this.button, actor, event, this.getState());
            }));
            this.button_icon = new St.Icon({
                icon_name: button_icon,
                icon_size: 14,
                style_class: 'system-status-icon'
            });
            this.button.set_child(this.button_icon);
            this.actor.add(this.button, {expand: true, x_fill: false, x_align: St.Align.END});
        }
    },

    destroy: function() {
        this.disconnect('active-changed');
        if (this.button instanceof St.Button) {
            this.button.disconnect('clicked');
        }
        this.parent();
    },

    _activeChanged: function() {
        // Expand ellipsized label.
        this.label.clutter_text.set_line_wrap(this.active);
    },

    setLabel: function(text) {
        this.label.text = text;
    },

    setIcon: function(icon) {
        this.icon = icon;
        this.actor.add(this.icon);
    },

    switchToIcon: function(icon) {
        let children = this.actor.get_children();
        let position = -1;
        for (let i in children) {
            if (children[i] == this.icon) {
                position = i;
                break;
            }
        }

        if (position != -1) {
            this.actor.remove_actor(this.icon);
            this.icon = icon;
            this.actor.insert_child_at_index(this.icon, position);
        }
    },

    hideIcon: function() {
        this.icon.hide();
    },

    showIcon: function() {
        this.icon.show();
    },

    setSummaryText: function(text) {
        this.rightLabel.text = text;
    },

    hideButton: function() {
        this.button.hide();
    },

    showButton: function() {
        this.button.show();
    },

    setState: function(state) {
        this._state = state;
    },

    getState: function() {
        return this._state || {};
    }
});

var ResourceTitleItem = new Lang.Class({
    Name: "ResourceTitleItem",
    Extends: BaseMenuItem,

    _init: function(text, icon, summary_text) {
        this.parent(text, {"icon": icon, "summary_text": summary_text, style_class:"resource-title", "hover": false, "activate": false});
    }
});

var ProcessItem = new Lang.Class({
    Name: "ProcessItem",
    Extends: BaseMenuItem,

    _init: function(text, button_icon, button_callback, button_trigger_key) {
        this.parent(text, {"button_icon": button_icon, "button_callback": button_callback, "button_trigger_key": button_trigger_key, "activate": false});
    }
});

var MountItem = new Lang.Class({
    Name: "MountItem",
    Extends: BaseMenuItem,

    _init: function(text) {
        this.parent(text, {"activate": false});
    }
});

var StateItem = new Lang.Class({
    Name: "StateItem",
    Extends: BaseMenuItem,

    _init: function(text) {
        this.parent(text, {"activate": false});
    }
});

var InterfaceItem = new Lang.Class({
    Name: "InterfaceItem",
    Extends: BaseMenuItem,

    _init: function(text) {
        let icon = new St.Icon({
            icon_name: 'network-wired-no-route-symbolic',
            icon_size: 14,
            style_class: 'system-status-icon'
        });
        this.parent(text, {"activate": false, "icon": icon});
        this.label.style_class += ' interface-label';

        this.download_icon = new St.Icon({
            icon_name: 'network-receive-symbolic',
            icon_size: 14,
            style_class: 'system-status-icon'
        });
        this.upload_icon = new St.Icon({
            icon_name: 'network-transmit-symbolic',
            icon_size: 14,
            style_class: 'system-status-icon'
        });
        this.download_text = new St.Label({
            text: 'loading...',
            style_class: 'bytes-text'
        });
        this.upload_text = new St.Label({
            text: 'loading...',
            style_class: 'bytes-text'
        });
        this.actor.add(this.download_text, {expand: true, x_fill: true, x_align: St.Align.END});
        this.actor.add(this.download_icon, {expand: true, x_fill: true, x_align: St.Align.END});
        this.actor.add(this.upload_text, {expand: true, x_fill: true, x_align: St.Align.END});
        this.actor.add(this.upload_icon, {expand: true, x_fill: true, x_align: St.Align.END});
    },
    switchToLoopBackIcon : function() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'computer-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    },
    switchToWiredIcon : function() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wired-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    },
    switchToWirelessIcon : function() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wireless-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    },
    switchToUnknownIcon : function() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wired-no-route-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    },
    setDownloadText: function(text) {
        this.download_text.text = text;
    },
    setUploadText: function(text) {
        this.upload_text.text = text;
    },
    hideIcon: function() {
        this.icon.hide();
        this.download_icon.hide();
        this.upload_icon.hide();
    },

    showIcon: function() {
        this.icon.show();
        this.download_icon.show();
        this.upload_icon.show();
    },
});

const Separator = new Lang.Class({
    Name: "Separator",
    Extends: PopupMenu.PopupSeparatorMenuItem
});

var MeterAreaContainer = new Lang.Class({
    Name: "MeterAreaContainer",
    Extends: St.BoxLayout,

    _init: function() {
        this.parent({"accessible-name": 'meterArea', "vertical": false});
    },
    addMeter: function(meter, position) {
        if (!meter instanceof MeterContainer) {
            throw new TypeError("First argument of addMeter() method must be instance of MeterContainer.");
        }
        if (position == undefined) {
            this.add_actor(meter);
        } else {
            this.insert_child_at_index(meter, position);
        }
    },
    removeMeter: function(meter) {
        if (!meter instanceof MeterContainer) {
            throw new TypeError("First argument of removeMeter() method must be instance of MeterContainer.");
        }
        this.remove_actor(meter);
    }
});

const MeterContainer = new Lang.Class({
    Name: "MeterContainer",
    Extends: St.BoxLayout,

    _init: function() {
        this.parent({"vertical": true});
        this._menu_items = [];
    },
    addTitleItem: function(item) {
        if (!item instanceof ResourceTitleItem) {
            throw new TypeError("First argument of addTitleItem() method must be instance of ResourceTitleItem.");
        }
        this.add_actor(item.actor);
        this._label_item = item;
    },
    addMenuItem: function(item) {
        if (!item instanceof BaseMenuItem) {
            throw new TypeError("First argument of addMenuItem() method must be instance of BaseMenuItem.");
        }
        this.add_actor(item.actor);
        this._menu_items.push(item);
    },
    removeAllMenuItems: function() {
        for (let item of this._menu_items) {
            this.remove_actor(item.actor);
            item.actor.destroy();
        }
        this._menu_items.length = 0;
    },
    update: function(state) {
        this._label_item.setSummaryText(Math.round(state.percent) + ' %');
    },
    destroy: function() {
        let actors = this.get_children();
        for (let i = 0; i < actors.length; i++) {
            let actor = actors[i];
            this.remove_actor(actor);
            actor.destroy();
            actor = null;
        }
        this.parent();
    }
});

var ProcessItemsContainer = new Lang.Class({
    Name: "ProcessItemsContainer",
    Extends: MeterContainer,

    update: function(state) {
        MeterContainer.prototype.update.call(this, state);

        for (let i = 0; i < this._menu_items.length; i++) {
            if (i in state.processes) {
                let process = state.processes[i];
                this._menu_items[i].setLabel(process.command);
                this._menu_items[i].showButton();
                this._menu_items[i].setState(process);
            } else {
                this._menu_items[i].setLabel(' ');
                this._menu_items[i].hideButton();
                this._menu_items[i].setState({});
            }
        }
    }
});

var SystemLoadItemsContainer = new Lang.Class({
    Name: "SystemLoadItemsContainer",
    Extends: MeterContainer,

    update: function(state) {
        MeterContainer.prototype.update.call(this, state);

        let load = state.system_load;
        this._menu_items[0].setLabel(load.load_average_1 + ' / ' + load.load_average_5 + ' / ' + load.load_average_15);
        this._menu_items[1].setLabel(
            '%running% out of %all% tasks are running'
                .replace('%running%', load.running_tasks_count)
                .replace('%all%', load.tasks_count)
        );
        for (let i = 2; i < this._menu_items.length; i++) {
            this._menu_items[i].setLabel(' ');
        }
    }
});

var DirectoriesContainer = new Lang.Class({
    Name: "DirectoriesContainer",
    Extends: MeterContainer,

    _init: function() {
        this.parent();
        this._directories = new Util.Directories();
    },

    update: function(state) {
        MeterContainer.prototype.update.call(this, state);

        for (let i = 0; i < this._menu_items.length; i++) {
            if (i in state.directories) {
                let directory = state.directories[i];
                this._menu_items[i].setLabel(
                    '%mount_dir% (%size% free)'
                        .replace('%mount_dir%', directory.name)
                        .replace('%size%', this._directories.formatBytes(directory.free_size))
                );
            } else {
                this._menu_items[i].setLabel(' ');
            }
        }
    }
});

var NetworkInterfaceItemsContainer = new Lang.Class({
    Name: "NetworkInterfaceItemsContainer",
    Extends: MeterContainer,

    _init: function() {
        this.parent();
        this._network = new Util.Network();
    },

    update: function(state) {
        MeterContainer.prototype.update.call(this, state);

        for (let i = 0; i < this._menu_items.length; i++) {
            if (i in state.interfaces) {
                let network_interface = state.interfaces[i];
                this._menu_items[i].setLabel(network_interface.name + ': ');
                this._menu_items[i].setDownloadText(this._network.formatBytes(network_interface.download));
                this._menu_items[i].setUploadText(this._network.formatBytes(network_interface.upload));
                switch(network_interface.type) {
                    case 'loopback':
                        this._menu_items[i].switchToLoopBackIcon();
                        break;
                    case 'wired':
                        this._menu_items[i].switchToWiredIcon();
                        break;
                    case 'wireless':
                        this._menu_items[i].switchToWirelessIcon();
                        break;
                    default:
                        this._menu_items[i].switchToUnknownIcon();
                }
                this._menu_items[i].showIcon();
            } else {
                this._menu_items[i].setLabel(' ');
                this._menu_items[i].setDownloadText(' ');
                this._menu_items[i].setUploadText(' ');
                this._menu_items[i].hideIcon();
            }
        }
    }
});
