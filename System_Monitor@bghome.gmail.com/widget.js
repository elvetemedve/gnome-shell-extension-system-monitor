const { Clutter, GObject, St } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Util = Me.imports.util;

const BaseMenuItem = GObject.registerClass(
class BaseMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(text, options) {
        options = options || {};
        let icon = options.icon, summary_text = options.summary_text, button_icon = options.button_icon, button_callback = options.button_callback,
        button_trigger_key = options.button_trigger_key;
        delete options.icon;
        delete options.summary_text;
        delete options.button_icon;
        delete options.button_callback;
        delete options.button_trigger_key;
        super._init(options);
        let that = this;

        if (icon) {
            this.setIcon(icon);
        }

        this.label = new St.Label({text: text, style_class: "item-label"});
        this.labelBin = new St.Bin({child: this.label});
        this.actor.add(this.labelBin);
        this._change_event_id = this.connect('notify::active', menuItem => {
            // Expand ellipsized label.
            this.label.clutter_text.set_line_wrap(menuItem.active);
        });

        if (summary_text) {
            this.rightLabel = new St.Label({text: summary_text, style_class: "right-label"});
            this.rightLabelBin = new St.Bin({child: this.rightLabel});
            this.actor.add(this.rightLabelBin, {expand: true, x_fill: false, x_align: St.Align.END});
        }

        if (button_icon) {
            this.button = new St.Button();
            this.button._click_event_id = this.button.connect('clicked', function(actor, event) {
                button_callback.call(that.button, actor, event, that.getState());
            });
            this.button_icon = new St.Icon({
                icon_name: button_icon,
                icon_size: 14,
                style_class: 'system-status-icon'
            });
            this.button.set_child(this.button_icon);
            this.actor.add(this.button, {expand: true, x_fill: false, x_align: St.Align.END});
        }
    }

    destroy() {
        if (this._change_event_id) {
            this.disconnect(this._change_event_id);
            this._change_event_id = null;
        }
        if (this.button instanceof St.Button && this.button._click_event_id) {
            this.button.disconnect(this.button._click_event_id);
            this.button._click_event_id = null;
        }
    }

    setLabel(text) {
        this.label.text = text;
    }

    setIcon(icon) {
        this.icon = icon;
        this.actor.add(this.icon);
    }

    switchToIcon(icon) {
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
    }

    hideIcon() {
        this.icon.hide();
    }

    showIcon() {
        this.icon.show();
    }

    setSummaryText(text) {
        this.rightLabel.text = text;
    }

    hideButton() {
        this.button.hide();
    }

    showButton() {
        this.button.show();
    }

    setState(state) {
        this._state = state;
    }

    getState() {
        return this._state || {};
    }
});

var ResourceTitleItem = GObject.registerClass(
class ResourceTitleItem extends BaseMenuItem {
    _init(text, icon, summary_text) {
        super._init(text, {"icon": icon, "summary_text": summary_text, style_class:"resource-title", "hover": false, "activate": false});
    }
});

var ProcessItem = GObject.registerClass(
class ProcessItem extends BaseMenuItem {
    _init(text, button_icon, button_callback, button_trigger_key) {
        super._init(text, {"button_icon": button_icon, "button_callback": button_callback, "button_trigger_key": button_trigger_key, "activate": false});
    }
});

var MountItem = GObject.registerClass(
class MountItem extends BaseMenuItem {
    _init(text) {
        super._init(text, {"activate": false});
    }
});

var StateItem = GObject.registerClass(
class StateItem extends BaseMenuItem {
    _init(text) {
        super._init(text, {"activate": false});
    }
});

var InterfaceItem = GObject.registerClass(
class InterfaceItem extends BaseMenuItem {
    _init(text) {
        let icon = new St.Icon({
            icon_name: 'network-wired-no-route-symbolic',
            icon_size: 14,
            style_class: 'system-status-icon'
        });
        super._init(text, {"activate": false, "icon": icon});
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
    }
    switchToLoopBackIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'computer-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    }
    switchToWiredIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wired-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    }
    switchToWirelessIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wireless-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    }
    switchToUnknownIcon() {
        this.switchToIcon(
            new St.Icon({
                icon_name: 'network-wired-no-route-symbolic',
                icon_size: 14,
                style_class: 'system-status-icon'
            })
        );
    }
    setDownloadText(text) {
        this.download_text.text = text;
    }
    setUploadText(text) {
        this.upload_text.text = text;
    }
    hideIcon() {
        this.icon.hide();
        this.download_icon.hide();
        this.upload_icon.hide();
    }

    showIcon() {
        this.icon.show();
        this.download_icon.show();
        this.upload_icon.show();
    }
});

var MeterAreaContainer = GObject.registerClass(
class MeterAreaContainer extends PopupMenu.PopupBaseMenuItem {
    _init() {
        super._init({"style_class": "meter-area-container"});
    }
    addMeter(meter, position) {
        if (!meter instanceof MeterContainer) {
            throw new TypeError("First argument of addMeter() method must be instance of MeterContainer.");
        }
        if (position == undefined) {
            this.actor.add_actor(meter);
        } else {
            this.actor.insert_child_at_index(meter, position);
        }
    }
    removeMeter(meter) {
        if (!meter instanceof MeterContainer) {
            throw new TypeError("First argument of removeMeter() method must be instance of MeterContainer.");
        }
        this.actor.remove_actor(meter);
    }
});

const MeterContainer = GObject.registerClass(
class MeterContainer extends St.BoxLayout {
    _init() {
        super._init({"vertical": true});
        this._menu_items = [];
    }
    addTitleItem(item) {
        if (!item instanceof ResourceTitleItem) {
            throw new TypeError("First argument of addTitleItem() method must be instance of ResourceTitleItem.");
        }
        this.add_actor(item.actor);
        this._label_item = item;
    }
    addMenuItem(item) {
        if (!item instanceof BaseMenuItem) {
            throw new TypeError("First argument of addMenuItem() method must be instance of BaseMenuItem.");
        }
        this.add_actor(item.actor);
        this._menu_items.push(item);
    }
    removeAllMenuItems() {
        for (let item of this._menu_items) {
            this.remove_actor(item.actor);
            item.actor.destroy();
        }
        this._menu_items.length = 0;
    }
    update(state) {
        this._label_item.setSummaryText(Math.round(state.percent) + ' %');
    }
});

var ProcessItemsContainer = GObject.registerClass(
class ProcessItemsContainer extends MeterContainer {
    update(state) {
        super.update(state);

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

var SystemLoadItemsContainer = GObject.registerClass(
class SystemLoadItemsContainer extends MeterContainer {
    update(state) {
        super.update(state);

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

var DirectoriesContainer = GObject.registerClass(
class DirectoriesContainer extends MeterContainer {
    _init() {
        super._init();
        this._directories = new Util.Directories();
    }

    update(state) {
        super.update(state);

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

var NetworkInterfaceItemsContainer = GObject.registerClass(
class NetworkInterfaceItemsContainer extends MeterContainer {
    _init() {
        super._init();
        this._network = new Util.Network();
    }

    update(state) {
        super.update(state);

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
